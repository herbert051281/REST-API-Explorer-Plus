/* REST API Explorer Plus — ServiceNow Bookmarklet
   Dot-walk aware field builder for Power BI REST URLs. */
(function () {
  'use strict';

  const PANEL_ID = '__snow_api_explorer_plus__';
  const existing = document.getElementById(PANEL_ID);
  if (existing) { existing.style.display = existing.style.display === 'none' ? 'flex' : 'none'; return; }

  // ── State ──────────────────────────────────────────────────────────────────
  let tables = [];
  let selectedTable = null;
  let queryFields = [];
  let drillStack = [];
  let fieldsCache = {};
  let currentLevelFields = [];
  let fieldFilter = '';

  let limitValue = '10000';
  let sysparmQuery = '';
  let urlTabActive = false;

  let gfQuery = '';
  let gfResults = [];
  let gfLoading = false;
  let gfTimer = null;

  let view = 'loading';
  let errorMsg = '';
  let tableSearch = '';

  let detectStatus = ''; // '' | 'detecting' | 'found' | 'none' | 'error'
  let detectMsg = '';

  const csrf = window.g_ck || '';

  // ── API ────────────────────────────────────────────────────────────────────
  function snowFetch(path) {
    return fetch(path, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'X-UserToken': csrf },
    }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }

  function loadTables() {
    view = 'loading'; fullRender();
    snowFetch('/api/now/table/sys_db_object?sysparm_fields=name,label&sysparm_limit=5000&sysparm_display_value=true')
      .then(function (data) {
        function sv(v) { return v && typeof v === 'object' ? String(v.value || v.display_value || '') : String(v || ''); }
        tables = (data.result || []).filter(function (t) { return t.name; })
          .map(function (t) { return { name: sv(t.name), label: sv(t.label) || sv(t.name) }; })
          .sort(function (a, b) { return a.label.localeCompare(b.label); });
        view = 'tables'; fullRender();
      })
      .catch(function (e) { errorMsg = e.message; view = 'error'; fullRender(); });
  }

  function fetchLevelFields(tableName, cb, errCb) {
    if (fieldsCache[tableName]) { cb(fieldsCache[tableName]); return; }
    snowFetch('/api/now/table/sys_dictionary?sysparm_query=name=' + tableName + '^active=true^elementISNOTEMPTY&sysparm_fields=element,column_label,internal_type,reference&sysparm_display_value=true&sysparm_limit=500')
      .then(function (data) {
        function sv(v) { return v && typeof v === 'object' ? String(v.value || v.display_value || '') : String(v || ''); }
        var flds = (data.result || []).filter(function (f) { return f.element; })
          .map(function (f) { return { element: sv(f.element), column_label: sv(f.column_label) || sv(f.element), internal_type: sv(f.internal_type) || 'string', reference: sv(f.reference) || '' }; })
          .sort(function (a, b) { return a.column_label.localeCompare(b.column_label); });
        fieldsCache[tableName] = flds;
        cb(flds);
      })
      .catch(function (e) { if (errCb) { errCb(e); } else { errorMsg = e.message; view = 'error'; fullRender(); } });
  }

  function selectBaseTable(tbl, autoFieldNames) {
    if (selectedTable && selectedTable.name !== tbl.name) { queryFields = []; drillStack = []; }
    selectedTable = tbl;
    fieldFilter = '';
    view = 'loading'; fullRender();
    fetchLevelFields(tbl.name, function (flds) {
      currentLevelFields = flds;
      if (autoFieldNames && autoFieldNames.length > 0) {
        var toProcess = autoFieldNames.filter(function (fname) { return !isInQuery(fname); });
        var remaining = toProcess.length;
        if (remaining === 0) { view = 'fields'; fullRender(); return; }
        var results = new Array(toProcess.length);
        function onAllDone() {
          results.forEach(function (r) { if (r && !isInQuery(r.path)) queryFields.push(r); });
          urlTabActive = false;
          view = queryFields.length > 0 ? 'my-query' : 'fields';
          fullRender();
        }
        toProcess.forEach(function (fname, idx) {
          var f = flds.find(function (x) { return x.element === fname; });
          if (f) {
            results[idx] = { path: fname, label: f.column_label, type: f.internal_type };
            if (--remaining === 0) onAllDone();
          } else if (fname.indexOf('.') !== -1) {
            resolveDotWalkLabel(fname, flds, function (label, type) {
              results[idx] = { path: fname, label: label, type: type };
              if (--remaining === 0) onAllDone();
            });
          } else {
            // Not in this table's sys_dictionary — likely an inherited field (e.g. "number", "state").
            // Include it with a name-based label rather than silently dropping it.
            results[idx] = { path: fname, label: pathToLabel(fname), type: 'string' };
            if (--remaining === 0) onAllDone();
          }
        });
      } else {
        view = 'fields';
        fullRender();
      }
    });
  }

  function drillInto(refElement, refLabel, refTableTechName) {
    var tLbl = lookupTableLabel(refTableTechName);
    drillStack.push({ refElement: refElement, refLabel: refLabel, tableName: refTableTechName, tableLabel: tLbl });
    fieldFilter = '';
    view = 'loading'; fullRender();
    fetchLevelFields(refTableTechName, function (flds) { currentLevelFields = flds; view = 'fields'; fullRender(); });
  }

  function drillBack() {
    drillStack.pop();
    fieldFilter = '';
    var tName = drillStack.length > 0 ? drillStack[drillStack.length - 1].tableName : selectedTable.name;
    currentLevelFields = fieldsCache[tName] || [];
    view = 'fields'; fullRender();
  }

  // ── Page detection ─────────────────────────────────────────────────────────
  function getPageContext() {
    // Try to reach into the ServiceNow content iframe (classic UI uses gsft_main)
    var frameWin = window, frameDoc = document, frameSrc = location.href;
    try {
      var iframe = document.getElementById('gsft_main') ||
        document.querySelector('iframe[name="gsft_main"]');
      if (iframe && iframe.contentDocument) {
        frameWin = iframe.contentWindow;
        frameDoc = iframe.contentDocument;
        frameSrc = iframe.src || frameSrc;
      }
    } catch (e) { /* cross-origin guard (shouldn't happen on same domain) */ }
    return { frameWin: frameWin, frameDoc: frameDoc, frameSrc: frameSrc };
  }

  function extractReportId(url) {
    // Try literal match first, then URL-decoded (handles nav_to.do?uri=...%3Fjvar_report_id%3D...)
    var m = url.match(/jvar_report_id=([a-f0-9]{32})/i);
    if (!m) { try { m = decodeURIComponent(url).match(/jvar_report_id=([a-f0-9]{32})/i); } catch (e) {} }
    return m ? m[1] : null;
  }

  function extractTableFromUrl(url) {
    // e.g. /incident_list.do  /incident.do
    var m = url.match(/\/([a-z_][a-z0-9_]+?)(_list)?\.do/i);
    if (!m) return null;
    var t = m[1];
    var skip = ['nav_to', 'sys_report_template', 'sys_report', 'logout', 'ui_page', 'x_'];
    if (skip.some(function (s) { return t.startsWith(s); })) return null;
    return t;
  }

  function runDetection() {
    detectStatus = 'detecting'; detectMsg = 'Scanning page…';
    renderDetectBanner();

    var ctx = getPageContext();

    // ── Step 1: DOM + globals ─────────────────────────────────────────────────
    var tableName = null;
    var fieldNames = [];

    // JS globals
    try { if (ctx.frameWin.g_form && ctx.frameWin.g_form.tableName) tableName = ctx.frameWin.g_form.tableName; } catch (e) {}
    try { if (!tableName && ctx.frameWin.g_list) tableName = ctx.frameWin.g_list.table_name || ctx.frameWin.g_list.tableName; } catch (e) {}

    // URL fallback
    if (!tableName) tableName = extractTableFromUrl(ctx.frameSrc) || extractTableFromUrl(location.href);

    function pushField(f) { if (f && f !== 'sys_id' && fieldNames.indexOf(f) === -1) fieldNames.push(f); }

    // Classic list column headers
    ctx.frameDoc.querySelectorAll('.list_header_cell[field], th[field], [data-column-field], [data-field-name]').forEach(function (h) {
      pushField(h.getAttribute('field') || h.getAttribute('data-column-field') || h.getAttribute('data-field-name'));
    });

    // g_form fields (form view)
    try { if (ctx.frameWin.g_form && ctx.frameWin.g_form._fields) Object.keys(ctx.frameWin.g_form._fields).forEach(pushField); } catch (e) {}

    // g_report / report widget globals (chart reports)
    try {
      var gr = ctx.frameWin.g_report || ctx.frameWin.GlideReport;
      if (gr) {
        // Some versions expose field list directly
        [gr.field, gr.list_fields, gr.group_by].forEach(function (v) {
          if (v) String(v).split(',').forEach(function (f) { pushField(f.trim()); });
        });
      }
    } catch (e) {}

    // ── Step 2: sys_report API — full record scan ─────────────────────────────
    var reportId = extractReportId(ctx.frameSrc) || extractReportId(location.href);
    if (reportId) {
      detectMsg = 'Reading report configuration…'; renderDetectBanner();

      // Fetch the full record (no sysparm_fields filter) so we catch every
      // column, including custom ones used by third-party apps like Opintel.
      snowFetch('/api/now/table/sys_report?sysparm_query=sys_id=' + reportId + '&sysparm_limit=1')
        .then(function (data) {
          var rpt = (data.result || [])[0];
          if (!rpt) { finishDetection(tableName, fieldNames, ''); return; }

          // Normalize: {value,display_value} objects → plain string
          function strVal(v) { return v ? (typeof v === 'object' ? (v.value || '') : String(v)) : ''; }

          var rptTable = strVal(rpt.table) || tableName;
          var rptTitle = strVal(rpt.title) || '';

          // Known non-field values to exclude from the scan
          var SKIP = { 'true': 1, 'false': 1, 'sys_id': 1, 'none': 1, 'asc': 1, 'desc': 1 };
          // Report type words that look like field names but aren't
          var REPORT_TYPES = { 'bar': 1, 'pie': 1, 'list': 1, 'trend': 1, 'line': 1, 'area': 1,
            'histogram': 1, 'map': 1, 'pivot': 1, 'multilevel': 1, 'donut': 1, 'funnel': 1 };

          // Build an ordered field list from the report API — this is the authoritative
          // column sequence. DOM-detected fields (g_report, list headers) are merged in
          // afterwards so they don't pollute the ordering.
          var apiFields = [];
          function pushApi(f) { if (apiFields.indexOf(f) === -1) apiFields.push(f); }

          // First pass: ordered display-column keys give the correct column sequence.
          // list_fields is the primary source — it matches the ServiceNow list view order.
          var ORDERED_KEYS = ['list_fields', 'field', 'group_by', 'sum_fields', 'avg_fields'];
          ORDERED_KEYS.forEach(function (key) {
            var raw = strVal(rpt[key]);
            if (!raw) return;
            raw.split(',').forEach(function (p) {
              p = p.trim();
              if (p && /^[a-z_][a-z0-9_.]*$/.test(p) && p.length >= 2 && !SKIP[p] && !REPORT_TYPES[p]) {
                pushApi(p);
              }
            });
          });

          // Second pass: scan remaining properties for multi-value field lists.
          // Requires ≥2 parts so single-value metadata (table name, report type, etc.) is ignored.
          Object.keys(rpt).forEach(function (key) {
            if (ORDERED_KEYS.indexOf(key) !== -1) return;
            if (key === 'table' || key === 'sys_id' || key === 'sys_class_name' ||
                key === 'sys_created_by' || key === 'sys_updated_by' ||
                key.indexOf('sys_mod') === 0) return;

            var raw = strVal(rpt[key]);
            if (!raw || raw.length < 2) return;

            var parts = raw.split(',').map(function (p) { return p.trim(); }).filter(Boolean);
            if (parts.length < 2) return; // single-value → table name / type / metadata, skip

            var allFieldLike = parts.every(function (p) {
              return /^[a-z_][a-z0-9_.]*$/.test(p) && p.length >= 2 && !SKIP[p] && !REPORT_TYPES[p];
            });
            if (!allFieldLike) return;

            parts.forEach(function (f) { pushApi(f); });
          });

          // Merge: API order is authoritative; any DOM-detected fields not in the API
          // list (e.g. from list column headers on a list+report combo page) go at the end.
          var mergedFields = apiFields.slice();
          fieldNames.forEach(function (f) { if (mergedFields.indexOf(f) === -1) mergedFields.push(f); });

          finishDetection(rptTable, mergedFields, rptTitle ? 'Report: ' + rptTitle : '');
        })
        .catch(function () { finishDetection(tableName, fieldNames, ''); });
    } else {
      finishDetection(tableName, fieldNames, '');
    }
  }

  function finishDetection(tableName, fieldNames, hint) {
    if (!tableName) {
      detectStatus = 'none';
      detectMsg = 'No ServiceNow table detected on this page. Open a list, form, or report first.';
      renderDetectBanner(); return;
    }
    var tbl = tables.find(function (t) { return t.name === tableName; }) || { name: tableName, label: tableName };
    var fCount = fieldNames.length;
    detectStatus = 'found';
    detectMsg = (hint ? hint + ' · ' : '') + 'Table: ' + tbl.label + (fCount ? ' · ' + fCount + ' fields detected' : ' (no field columns detected — browse manually)');
    renderDetectBanner();
    selectBaseTable(tbl, fCount > 0 ? fieldNames : null);
  }

  // ── Global field search ────────────────────────────────────────────────────
  function runGfSearch(term) {
    gfLoading = true; repaintGfList();
    var q = 'column_labelLIKE' + term + '^ORelementLIKE' + term + '^active=true^elementISNOTEMPTY';
    snowFetch('/api/now/table/sys_dictionary?sysparm_query=' + encodeURIComponent(q) + '&sysparm_fields=element,column_label,internal_type,name&sysparm_display_value=true&sysparm_limit=100')
      .then(function (data) { gfResults = (data.result || []).filter(function (f) { return f.element && f.name; }); gfLoading = false; repaintGfList(); })
      .catch(function () { gfLoading = false; repaintGfList(); });
  }
  function onGfInput(val) {
    gfQuery = val; clearTimeout(gfTimer);
    if (val.trim().length < 2) { gfResults = []; gfLoading = false; repaintGfList(); return; }
    gfLoading = true; repaintGfList();
    gfTimer = setTimeout(function () { runGfSearch(val.trim()); }, 400);
  }

  // ── Query helpers ──────────────────────────────────────────────────────────
  function currentPathPrefix() { return drillStack.length > 0 ? drillStack.map(function (d) { return d.refElement; }).join('.') + '.' : ''; }
  function currentLabelPrefix() { return drillStack.length > 0 ? drillStack.map(function (d) { return d.refLabel; }).join(' → ') + ' → ' : ''; }
  function isInQuery(path) { return queryFields.some(function (f) { return f.path === path; }); }
  function addToQuery(path, label, type) {
    if (!isInQuery(path)) queryFields.push({ path: path, label: label, type: type });
    updateQueryBadge(); repaintFieldList();
  }
  function removeFromQuery(path) { queryFields = queryFields.filter(function (f) { return f.path !== path; }); updateQueryBadge(); fullRender(); }
  function updateQueryBadge() {
    var b = document.getElementById('__snx_qbadge__');
    if (b) { b.textContent = queryFields.length > 0 ? String(queryFields.length) : ''; b.style.display = queryFields.length > 0 ? 'inline-flex' : 'none'; }
  }
  function lookupTableLabel(techName) { var t = tables.find(function (x) { return x.name === techName; }); return t ? t.label : techName; }

  // ── Builders ───────────────────────────────────────────────────────────────
  // Convert a technical dot-walk path to a readable label when no display name is available.
  // e.g. "u_user_affected.u_job_function_ref" → "User Affected - Job Function Ref"
  function pathToLabel(path) {
    return path.split('.').map(function (seg) {
      return seg
        .replace(/^u_/, '')       // strip u_ custom-field prefix
        .replace(/_/g, ' ')       // underscores → spaces
        .replace(/\b\w/g, function (c) { return c.toUpperCase(); }); // Title Case
    }).join(' - ');
  }

  // Resolves each segment of a dot-walk path through sys_dictionary to get exact column labels.
  function resolveDotWalkLabel(path, baseFlds, callback) {
    var segs = path.split('.');
    function segFallback(s) {
      return s.replace(/^u_/, '').replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    }
    // ServiceNow column headers show only the final segment's label. We traverse the
    // reference chain to reach the right table, then return that last segment's label.
    function next(idx, flds) {
      var seg = segs[idx];
      var f = flds.find(function (x) { return x.element === seg; });
      if (!f) { callback(segFallback(segs[segs.length - 1]), 'string'); return; }
      if (idx === segs.length - 1) { callback(f.column_label, f.internal_type || 'string'); return; }
      if (f.reference) {
        fetchLevelFields(f.reference, function (refFlds) { next(idx + 1, refFlds); }, function () {
          callback(segFallback(segs[segs.length - 1]), 'string');
        });
      } else {
        callback(segFallback(segs[segs.length - 1]), 'string');
      }
    }
    next(0, baseFlds);
  }

  function buildUrl() {
    if (!selectedTable) return '';
    var base = location.origin + '/api/now/table/' + selectedTable.name;
    var p = 'sysparm_display_value=all&sysparm_exclude_reference_link=true&sysparm_limit=' + limitValue;
    if (queryFields.length) p += '&sysparm_fields=' + queryFields.map(function (f) { return f.path; }).join(',');
    if (sysparmQuery) p += '&sysparm_query=' + encodeURIComponent(sysparmQuery);
    return base + '?' + p;
  }
  function buildMCode() {
    if (!selectedTable || !queryFields.length) return '/* No fields selected */';
    var fieldList = queryFields.map(function (f) { return f.path; }).join(',');
    // sysparm_display_value=true returns flat strings — no nested {value,display_value} objects to unwrap
    var fullUrl = location.origin + '/api/now/table/' + selectedTable.name +
      '?sysparm_display_value=true' +
      '&sysparm_exclude_reference_link=true' +
      '&sysparm_fields=' + encodeURIComponent(fieldList) +
      '&sysparm_limit=' + limitValue +
      (sysparmQuery ? '&sysparm_query=' + encodeURIComponent(sysparmQuery) : '');
    var srcNames  = queryFields.map(function (f) { return '"' + f.path + '"'; });
    var prefixed  = queryFields.map(function (f) { return '"result.' + f.path + '"'; });
    var renamePairs = queryFields.map(function (f) {
      var lbl = (f.label && f.label !== f.path) ? f.label : pathToLabel(f.path.indexOf('.') !== -1 ? f.path.split('.').pop() : f.path);
      return '{"result.' + f.path + '", "' + lbl + '"}';
    });
    var L = [];
    L.push('let');
    L.push('    Source = Json.Document(Web.Contents("' + fullUrl + '")),');
    L.push('    #"Converted to Table" = Table.FromRecords({Source}),');
    L.push('    #"Expanded result" = Table.ExpandListColumn(#"Converted to Table", "result"),');
    L.push('    #"Expanded result1" = Table.ExpandRecordColumn(#"Expanded result", "result", {' + srcNames.join(', ') + '}, {' + prefixed.join(', ') + '}),');
    L.push('    #"Renamed Columns" = Table.RenameColumns(#"Expanded result1", {' + renamePairs.join(', ') + '})');
    L.push('in');
    L.push('    #"Renamed Columns"');
    return L.join('\r\n');
  }

  // ── DOM helpers ────────────────────────────────────────────────────────────
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'className') node.className = attrs[k];
      else if (k.startsWith('on') && typeof attrs[k] === 'function') node[k] = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    if (children) [].concat(children).forEach(function (c) {
      if (c == null) return;
      node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    });
    return node;
  }
  function badgeCls(type) {
    if (type === 'reference') return '__snx_badge __snx_badge_ref';
    if (type === 'string' || type === 'translated_text') return '__snx_badge __snx_badge_str';
    if (type === 'glide_date_time' || type === 'glide_date') return '__snx_badge __snx_badge_dt';
    return '__snx_badge __snx_badge_other';
  }

  // ── In-place repaints ──────────────────────────────────────────────────────
  function filteredTables() {
    var q = tableSearch.toLowerCase().trim();
    return q ? tables.filter(function (t) { return t.label.toLowerCase().includes(q) || t.name.toLowerCase().includes(q); }) : tables;
  }
  function filteredCurrentFields() {
    var q = fieldFilter.toLowerCase().trim();
    return q ? currentLevelFields.filter(function (f) { return f.column_label.toLowerCase().includes(q) || f.element.toLowerCase().includes(q); }) : currentLevelFields;
  }

  function repaintTableList() {
    var list = document.getElementById('__snx_tlist__');
    var meta = document.getElementById('__snx_tmeta__');
    if (!list) return;
    var ft = filteredTables();
    if (meta) meta.textContent = ft.length + ' of ' + tables.length + ' tables';
    list.innerHTML = '';
    ft.forEach(function (t) {
      var item = el('div', { className: '__snx_item' + (selectedTable && selectedTable.name === t.name ? ' __snx_sel' : '') }, [
        el('div', { className: '__snx_item_label' }, [t.label]),
        el('div', { className: '__snx_item_name' }, [t.name]),
      ]);
      item.onclick = function () { selectBaseTable(t); };
      list.appendChild(item);
    });
  }

  function repaintFieldList() {
    var list = document.getElementById('__snx_flist__');
    var meta = document.getElementById('__snx_fmeta__');
    if (!list) return;
    var ff = filteredCurrentFields();
    var prefix = currentPathPrefix();
    var labelPrefix = currentLabelPrefix();
    if (meta) meta.textContent = ff.length + (ff.length !== currentLevelFields.length ? ' of ' + currentLevelFields.length : '') + ' fields';
    list.innerHTML = '';
    var tbl = document.createElement('table');
    tbl.className = '__snx_ftable';
    tbl.appendChild(el('thead', {}, [el('tr', {}, [
      el('th', {}, ['Label']), el('th', {}, ['Field name']), el('th', {}, ['Type']), el('th', { style: 'width:70px;text-align:right' }, ['+']),
    ])]));
    var tbody = document.createElement('tbody');
    ff.forEach(function (f) {
      var path = prefix + f.element;
      var label = labelPrefix + f.column_label;
      var inQuery = isInQuery(path);
      var isRef = f.internal_type === 'reference' && f.reference;
      var refTLabel = isRef ? lookupTableLabel(f.reference) : '';
      var actions = el('td', { style: 'text-align:right;white-space:nowrap;padding:4px 8px' });
      if (isRef) {
        var drillBtn = el('button', { className: '__snx_drillbtn', title: 'Browse ' + refTLabel + ' fields for dot-walking' }, ['→ ' + refTLabel]);
        drillBtn.onclick = function (e) { e.stopPropagation(); drillInto(f.element, f.column_label, f.reference); };
        actions.appendChild(drillBtn);
      }
      var addBtn = el('button', { className: '__snx_addbtn' + (inQuery ? ' __snx_addbtn_on' : ''), title: inQuery ? 'Added: ' + path : 'Add: ' + path }, [inQuery ? '✓' : '+']);
      addBtn.onclick = function (e) { e.stopPropagation(); if (!inQuery) addToQuery(path, label, f.internal_type); };
      actions.appendChild(addBtn);
      tbody.appendChild(el('tr', {}, [
        el('td', { style: 'color:#1e293b' }, [
          el('div', { style: 'font-weight:500' }, [f.column_label]),
          isRef ? el('div', { style: 'font-size:11px;color:#64748b;margin-top:2px' }, ['→ ' + refTLabel]) : null,
        ]),
        el('td', { style: 'font-family:monospace;font-size:11px;color:#64748b' }, [f.element]),
        el('td', {}, [el('span', { className: badgeCls(f.internal_type) }, [f.internal_type])]),
        actions,
      ]));
    });
    tbl.appendChild(tbody);
    list.appendChild(tbl);
  }

  function repaintGfList() {
    var container = document.getElementById('__snx_gflist__');
    var meta = document.getElementById('__snx_gfmeta__');
    if (!container) return;
    if (meta) {
      if (gfLoading) meta.textContent = 'Searching…';
      else if (gfQuery.trim().length < 2) meta.textContent = 'Type at least 2 characters';
      else meta.textContent = gfResults.length + ' results across all tables';
    }
    container.innerHTML = '';
    if (gfLoading) { container.appendChild(el('div', { className: '__snx_loading', style: 'padding:24px' }, [el('div', { className: '__snx_spin' }), 'Searching…'])); return; }
    if (gfQuery.trim().length < 2) { container.appendChild(el('div', { style: 'padding:24px 16px;text-align:center;color:#9ca3af;font-size:12px' }, ['Search to discover which tables have a field. Click a result to open that table.'])); return; }
    if (gfResults.length === 0) { container.appendChild(el('div', { style: 'padding:24px 16px;text-align:center;color:#9ca3af;font-size:12px' }, ['No fields found for "' + gfQuery + '"'])); return; }
    var tbl = document.createElement('table');
    tbl.className = '__snx_ftable';
    tbl.appendChild(el('thead', {}, [el('tr', {}, [el('th', {}, ['Label']), el('th', {}, ['Field name']), el('th', {}, ['Table']), el('th', {}, ['Type'])])]));
    var tbody = document.createElement('tbody');
    gfResults.forEach(function (f) {
      var tLbl = lookupTableLabel(f.name);
      var row = el('tr', { title: 'Open ' + tLbl + ' as base table' }, [
        el('td', { style: 'font-weight:500;color:#1e293b' }, [f.column_label || f.element]),
        el('td', { style: 'font-family:monospace;font-size:11px;color:#64748b' }, [f.element]),
        el('td', {}, [el('div', { style: 'font-size:11px;font-weight:600;color:#1e293b' }, [tLbl]), el('div', { style: 'font-family:monospace;font-size:11px;color:#64748b' }, [f.name])]),
        el('td', {}, [el('span', { className: badgeCls(f.internal_type) }, [f.internal_type || 'string'])]),
      ]);
      row.onclick = function () { var tObj = tables.find(function (x) { return x.name === f.name; }) || { name: f.name, label: tLbl }; selectBaseTable(tObj); };
      tbody.appendChild(row);
    });
    tbl.appendChild(tbody);
    container.appendChild(tbl);
    container.appendChild(el('div', { style: 'padding:6px 12px;font-size:11px;color:#64748b;border-top:1px solid #f1f5f9' }, ['Click a row to open that table, then use → to drill into related tables.']));
  }

  function renderDetectBanner() {
    var banner = document.getElementById('__snx_detectbanner__');
    if (!banner) return;
    if (!detectStatus) { banner.style.display = 'none'; return; }
    banner.style.display = 'flex';
    var colors = {
      detecting: { bg: '#eff6ff', border: '#bfdbfe', color: '#1e40af' },
      found:     { bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d' },
      none:      { bg: '#fffbeb', border: '#fde68a', color: '#92400e' },
      error:     { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c' },
    }[detectStatus] || { bg: '#f8fafc', border: '#e5e7eb', color: '#64748b' };
    banner.style.background = colors.bg;
    banner.style.borderColor = colors.border;
    banner.style.color = colors.color;
    var icon = { detecting: '⟳', found: '✓', none: '⚠', error: '✕' }[detectStatus] || '';
    banner.innerHTML = '';
    banner.appendChild(document.createTextNode(icon + ' ' + detectMsg));
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  var styleEl = document.createElement('style');
  styleEl.textContent = '#__snow_api_explorer_plus__{all:initial;position:fixed;top:0;right:0;width:520px;height:100vh;z-index:2147483647;display:flex;flex-direction:column;font-family:"Segoe UI",system-ui,sans-serif;font-size:13px;background:#f0f4f8;box-shadow:-8px 0 40px rgba(0,0,0,.22);border-left:1px solid #c8d5e0;overflow:hidden}#__snow_api_explorer_plus__ *{box-sizing:border-box;margin:0;padding:0}.__snx_h{background:linear-gradient(135deg,#1a3545 0%,#1d3c4b 55%,#1e4d5c 100%);color:#fff;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;gap:8px}.__snx_h span{font-weight:700;font-size:14px;flex:1;letter-spacing:-.02em}.__snx_h span b{color:#7dd3fc}.__snx_hbtn{background:none;border:none;color:#94a3b8;cursor:pointer;font-size:18px;line-height:1;padding:6px;flex-shrink:0;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:background .15s,color .15s;min-width:32px;min-height:32px}.__snx_hbtn:hover{color:#fff;background:rgba(255,255,255,.15)}.__snx_hbtn:focus-visible{outline:2px solid rgba(255,255,255,.6);outline-offset:2px}.__snx_hlimwrap{display:flex;align-items:center;gap:5px;flex-shrink:0;color:#cbd5e1;font-size:11px;font-weight:600;white-space:nowrap}.__snx_hlim{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);color:#f1f5f9;border-radius:6px;padding:4px 6px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;transition:border-color .15s}.__snx_hlim:hover{border-color:rgba(255,255,255,.45)}.__snx_hlim:focus{outline:none;border-color:rgba(255,255,255,.6);box-shadow:0 0 0 2px rgba(255,255,255,.2)}.__snx_hlim option{background:#1e293b;color:#f1f5f9}.__snx_detectbtn{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);color:#f1f5f9;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0;transition:background .15s,border-color .15s}.__snx_detectbtn:hover{background:rgba(255,255,255,.22);border-color:rgba(255,255,255,.4);color:#fff}.__snx_detectbtn:focus-visible{outline:2px solid rgba(255,255,255,.6);outline-offset:2px}.__snx_detectbanner{display:none;align-items:flex-start;gap:8px;padding:8px 14px;font-size:12px;font-weight:500;border-bottom:1px solid;line-height:1.45;flex-shrink:0;word-break:break-word}.__snx_body{flex:1;overflow-y:auto;display:flex;flex-direction:column;min-height:0;background:#f0f4f8}.__snx_loading{flex:1;display:flex;align-items:center;justify-content:center;color:#64748b;gap:10px;font-size:13px}.__snx_spin{width:18px;height:18px;border:2px solid #e2e8f0;border-top-color:#1d3c4b;border-radius:50%;animation:__snx_spin .7s linear infinite;flex-shrink:0}@keyframes __snx_spin{to{transform:rotate(360deg)}}.__snx_err{margin:12px;padding:12px 14px;background:#fff;border:1px solid #fecaca;border-left:3px solid #ef4444;border-radius:10px;color:#b91c1c;font-size:12px;line-height:1.5}.__snx_maintabs{display:flex;background:#1d3c4b;padding:8px 12px 10px;gap:4px;flex-shrink:0}.__snx_maintab{flex:1;padding:8px 6px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.13);border-radius:8px;font-family:inherit;font-size:12px;font-weight:500;cursor:pointer;color:rgba(255,255,255,.6);display:flex;align-items:center;justify-content:center;gap:5px;transition:all .15s}.__snx_maintab:hover{background:rgba(255,255,255,.18);color:rgba(255,255,255,.9);border-color:rgba(255,255,255,.28)}.__snx_maintab.__snx_active{background:#fff;border-color:transparent;color:#1d3c4b;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.2)}.__snx_maintab:focus-visible{outline:2px solid rgba(255,255,255,.5);outline-offset:2px}.__snx_qbadge{display:none;background:rgba(255,255,255,.25);color:#fff;border-radius:9999px;font-size:10px;font-weight:700;min-width:18px;height:18px;padding:0 5px;align-items:center;justify-content:center}.__snx_maintab.__snx_active .__snx_qbadge{background:#1d3c4b;color:#fff}.__snx_search{padding:10px 12px;border-bottom:1px solid #edf2f7;display:flex;gap:6px;align-items:center;flex-shrink:0;background:#fff}.__snx_search input{flex:1;border:1.5px solid #e2e8f0;border-radius:10px;padding:8px 12px;font-size:12px;font-family:inherit;outline:none;background:#f8fafc;color:#1e293b;transition:border-color .15s,background .15s,box-shadow .15s}.__snx_search input::placeholder{color:#94a3b8}.__snx_search input:focus{border-color:#1d3c4b;background:#fff;box-shadow:0 0 0 3px rgba(29,60,75,.1)}.__snx_meta{font-size:11px;color:#64748b;padding:6px 14px;flex-shrink:0;font-weight:500;background:#fff;border-bottom:1px solid #edf2f7}.__snx_list{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:6px;padding:10px}.__snx_item{padding:10px 14px;cursor:pointer;background:#fff;border-radius:10px;border:1px solid #e6edf4;box-shadow:0 1px 3px rgba(0,0,0,.05);transition:all .15s}.__snx_item:hover{background:#fafcff;border-color:#c5d8e8;box-shadow:0 3px 10px rgba(0,0,0,.08);transform:translateY(-1px)}.__snx_item.__snx_sel{background:#eef5ff;border-color:#93c5fd;border-left:3px solid #1d3c4b;padding-left:11px;box-shadow:0 2px 8px rgba(29,60,75,.12)}.__snx_item_label{font-weight:600;color:#1e293b;font-size:13px}.__snx_item_name{font-family:monospace;font-size:11px;color:#64748b;margin-top:2px}.__snx_toolbar{padding:10px 14px;border-bottom:1px solid #edf2f7;display:flex;align-items:center;gap:8px;flex-shrink:0;background:#fff}.__snx_back{background:none;border:1px solid transparent;color:#1d3c4b;cursor:pointer;font-size:12px;font-weight:600;font-family:inherit;display:flex;align-items:center;gap:4px;padding:5px 8px;white-space:nowrap;flex-shrink:0;border-radius:6px;transition:background .15s,border-color .15s}.__snx_back:hover{background:#f0f9ff;border-color:#bfdbfe}.__snx_back:focus-visible{outline:2px solid #1d3c4b;outline-offset:2px}.__snx_breadcrumb{font-size:11px;color:#64748b;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.__snx_ftable{width:100%;border-collapse:collapse}.__snx_ftable th{position:sticky;top:0;background:#fff;text-align:left;padding:9px 10px;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #edf2f7}.__snx_ftable td{padding:9px 10px;border-bottom:1px solid #f4f8fb;vertical-align:middle}.__snx_ftable tr:hover td{background:#f8fbff}.__snx_badge{font-size:11px;padding:3px 8px;border-radius:6px;font-weight:600;white-space:nowrap}.__snx_badge_ref{background:#dcfce7;color:#15803d;border:1px solid #bbf7d0}.__snx_badge_str{background:#dbeafe;color:#1d4ed8;border:1px solid #bfdbfe}.__snx_badge_dt{background:#fce7f3;color:#9d174d;border:1px solid #fbcfe8}.__snx_badge_other{background:#f1f5f9;color:#334155;border:1px solid #e2e8f0}.__snx_addbtn{width:30px;height:30px;border-radius:6px;border:1.5px solid #d1d5db;background:#fff;color:#475569;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;justify-content:center;transition:all .15s}.__snx_addbtn:hover{border-color:#1d3c4b;color:#1d3c4b;background:#f0f9ff}.__snx_addbtn:focus-visible{outline:2px solid #1d3c4b;outline-offset:2px}.__snx_addbtn_on{background:#dcfce7!important;border-color:#16a34a!important;color:#15803d!important;cursor:default}.__snx_drillbtn{height:28px;padding:0 8px;border-radius:6px;border:1.5px solid #e2e8f0;background:#f8fafc;color:#1d4ed8;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap;margin-right:4px;transition:all .15s}.__snx_drillbtn:hover{border-color:#1d3c4b;background:#eff6ff;color:#1d3c4b}.__snx_drillbtn:focus-visible{outline:2px solid #1d3c4b;outline-offset:2px}.__snx_tabs{display:flex;border-bottom:2px solid #edf2f7;flex-shrink:0;background:#fff;padding:0 12px}.__snx_tab{flex:0;padding:10px 14px;background:none;border:none;border-bottom:2px solid transparent;margin-bottom:-2px;font-family:inherit;font-size:12px;font-weight:500;cursor:pointer;color:#64748b;transition:color .15s;white-space:nowrap}.__snx_tab:hover{color:#1d3c4b}.__snx_tab.__snx_active{border-bottom-color:#1d3c4b;color:#1d3c4b;font-weight:700}.__snx_tab:focus-visible{outline:2px solid #1d3c4b;outline-offset:-2px}.__snx_code{background:#0f172a;color:#e2e8f0;font-family:"Cascadia Code","Fira Code",Consolas,monospace;font-size:11.5px;line-height:1.7;padding:16px;white-space:pre-wrap;word-break:break-all;flex:1;overflow-y:auto;margin:10px;border-radius:12px}.__snx_copyrow{display:flex;justify-content:flex-end;align-items:center;padding:8px 14px;border-bottom:1px solid #edf2f7;background:#fff;flex-shrink:0;gap:8px}.__snx_copybtn{display:flex;align-items:center;gap:6px;border:1.5px solid #e2e8f0;background:#fff;border-radius:8px;padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s;color:#334155}.__snx_copybtn:hover{border-color:#1d3c4b;color:#1d3c4b;background:#eff6ff}.__snx_copybtn:focus-visible{outline:2px solid #1d3c4b;outline-offset:2px}.__snx_copybtn.__snx_copied{border-color:#16a34a;color:#16a34a;background:#f0fdf4}.__snx_opts{padding:12px 14px;background:#fff;border-bottom:1px solid #edf2f7;display:flex;flex-direction:column;gap:8px;flex-shrink:0}.__snx_opts label{font-size:12px;font-weight:600;color:#475569;display:flex;align-items:center;gap:6px}.__snx_opts select,.__snx_opts input[type=text]{font-size:12px;font-family:inherit;border:1.5px solid #e2e8f0;border-radius:8px;padding:5px 9px;background:#f8fafc;color:#1e293b;transition:border-color .15s,background .15s}.__snx_opts select:focus,.__snx_opts input[type=text]:focus{outline:none;border-color:#1d3c4b;background:#fff;box-shadow:0 0 0 2px rgba(29,60,75,.1)}.__snx_opts input[type=text]{flex:1}.__snx_info{margin:10px 12px;padding:10px 13px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;font-size:11px;color:#1e40af;line-height:1.6;flex-shrink:0}.__snx_qlist{overflow-y:auto;flex-shrink:0;border-bottom:1px solid #edf2f7;max-height:240px;background:#fff}.__snx_rmbtn{width:28px;height:28px;border-radius:5px;border:none;background:none;color:#94a3b8;font-size:16px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0;transition:all .15s}.__snx_rmbtn:hover{background:#fef2f2;color:#ef4444}.__snx_rmbtn:focus-visible{outline:2px solid #ef4444;outline-offset:2px}.__snx_empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 28px;text-align:center;color:#64748b;gap:10px}.__snx_dwpath{padding:8px 14px;background:#fffbeb;border-bottom:1px solid #fde68a;font-size:11px;font-weight:500;color:#78350f;flex-shrink:0}';
  document.head.appendChild(styleEl);

  // ── Panel ──────────────────────────────────────────────────────────────────
  var panel = document.createElement('div');
  panel.id = PANEL_ID;
  document.body.appendChild(panel);

  function renderMainTabs(body) {
    var defs = [{ label: 'Browse Tables', v: 'tables' }, { label: 'Search Fields', v: 'field-search' }, { label: 'My Query', v: 'my-query', badge: true }];
    body.appendChild(el('div', { className: '__snx_maintabs' }, defs.map(function (d) {
      var btn = el('button', { className: '__snx_maintab' + (view === d.v ? ' __snx_active' : '') }, [
        d.label,
        d.badge ? el('span', { id: '__snx_qbadge__', className: '__snx_qbadge', style: queryFields.length > 0 ? 'display:inline-flex' : 'display:none' }, [String(queryFields.length)]) : null,
      ]);
      btn.onclick = function () { view = d.v; fullRender(); };
      return btn;
    })));
  }

  function fullRender() {
    panel.innerHTML = '';

    // Header
    var limitOpts = ['100', '1000', '10000', '100000', '1000000'];
    var hLimSel = el('select', { className: '__snx_hlim', title: 'Record limit (sysparm_limit)', onchange: function (e) { limitValue = e.target.value; var c = document.getElementById('__snx_mqcode__'); if (c) c.textContent = urlTabActive ? buildUrl() : buildMCode(); } },
      limitOpts.map(function (v) { var o = el('option', { value: v }, [v]); if (v === limitValue) o.setAttribute('selected', 'selected'); return o; }));
    var detectBtn = el('button', { className: '__snx_detectbtn', title: 'Auto-detect table and fields from the current page or report', onclick: function () { runDetection(); } }, ['⊙ Detect from page']);
    panel.appendChild(el('div', { className: '__snx_h' }, [
      el('span', {}, ['REST API Explorer ', el('b', {}, ['Plus'])]),
      el('div', { className: '__snx_hlimwrap' }, ['Limit ', hLimSel]),
      detectBtn,
      el('button', { className: '__snx_hbtn', onclick: function () { panel.style.display = 'none'; } }, ['✕']),
    ]));

    // Detection result banner
    var banner = el('div', { id: '__snx_detectbanner__', className: '__snx_detectbanner' });
    panel.appendChild(banner);
    renderDetectBanner();

    var body = el('div', { className: '__snx_body' });
    panel.appendChild(body);

    if (view === 'loading') { body.appendChild(el('div', { className: '__snx_loading' }, [el('div', { className: '__snx_spin' }), 'Loading…'])); return; }

    if (view === 'error') {
      body.appendChild(el('div', { className: '__snx_err' }, [errorMsg]));
      body.appendChild(el('button', { style: 'margin:12px;font-family:inherit;font-size:12px;padding:6px 12px;background:#1d3c4b;color:#fff;border:none;border-radius:5px;cursor:pointer;', onclick: loadTables }, ['Retry']));
      return;
    }

    // ── Browse Tables ────────────────────────────────────────────────────────
    if (view === 'tables') {
      renderMainTabs(body);
      var si = el('input', { type: 'text', placeholder: 'Search tables…', value: tableSearch, oninput: function (e) { tableSearch = e.target.value; repaintTableList(); } });
      body.appendChild(el('div', { className: '__snx_search' }, [si]));
      body.appendChild(el('div', { id: '__snx_tmeta__', className: '__snx_meta' }, [tables.length + ' tables']));
      body.appendChild(el('div', { id: '__snx_tlist__', className: '__snx_list' }));
      repaintTableList();
      si.focus();
      return;
    }

    // ── Global Field Search ──────────────────────────────────────────────────
    if (view === 'field-search') {
      renderMainTabs(body);
      var gfi = el('input', { type: 'text', placeholder: 'Search fields across all tables…', value: gfQuery, oninput: function (e) { onGfInput(e.target.value); } });
      body.appendChild(el('div', { className: '__snx_search' }, [gfi]));
      body.appendChild(el('div', { id: '__snx_gfmeta__', className: '__snx_meta' }, ['']));
      body.appendChild(el('div', { id: '__snx_gflist__', className: '__snx_list' }));
      repaintGfList();
      gfi.focus();
      return;
    }

    // ── Field view (base + drill-in) ─────────────────────────────────────────
    if (view === 'fields') {
      var currentTableN = drillStack.length > 0 ? drillStack[drillStack.length - 1].tableName : (selectedTable ? selectedTable.name : '');
      var currentTableL = drillStack.length > 0 ? drillStack[drillStack.length - 1].tableLabel : (selectedTable ? selectedTable.label : '');
      var crumbs = [selectedTable ? selectedTable.label : ''].concat(drillStack.map(function (d) { return d.refLabel + ' (' + d.tableName + ')'; }));

      var backLabel, backAction;
      if (drillStack.length === 0) { backLabel = '← Tables'; backAction = function () { view = 'tables'; fullRender(); }; }
      else { var prevL = drillStack.length > 1 ? drillStack[drillStack.length - 2].tableLabel : (selectedTable ? selectedTable.label : 'Back'); backLabel = '← ' + prevL; backAction = drillBack; }

      body.appendChild(el('div', { className: '__snx_toolbar' }, [
        el('button', { className: '__snx_back', onclick: backAction }, [backLabel]),
        el('div', { style: 'flex:1;min-width:0;margin:0 6px' }, [
          el('div', { style: 'font-weight:700;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px' }, [currentTableL]),
          drillStack.length > 0 ? el('div', { className: '__snx_breadcrumb' }, [crumbs.join(' → ')]) : null,
        ]),
        el('code', { style: 'font-size:11px;color:#64748b;flex-shrink:0;font-family:monospace' }, [currentTableN]),
      ]));

      if (drillStack.length > 0) {
        var dotPath = drillStack.map(function (d) { return d.refElement; }).join('.') + '.[field]';
        body.appendChild(el('div', { className: '__snx_dwpath' }, ['Path: ', el('code', { style: 'font-family:monospace;font-weight:700' }, [dotPath])]));
      }

      var fi = el('input', { type: 'text', placeholder: 'Filter fields…', value: fieldFilter, oninput: function (e) { fieldFilter = e.target.value; repaintFieldList(); } });
      body.appendChild(el('div', { className: '__snx_search' }, [fi]));
      body.appendChild(el('div', { id: '__snx_fmeta__', className: '__snx_meta' }, [currentLevelFields.length + ' fields']));
      body.appendChild(el('div', { id: '__snx_flist__', className: '__snx_list' }));
      repaintFieldList();
      return;
    }

    // ── My Query ─────────────────────────────────────────────────────────────
    if (view === 'my-query') {
      renderMainTabs(body);

      if (!selectedTable || queryFields.length === 0) {
        body.appendChild(el('div', { className: '__snx_empty' }, [
          el('div', { style: 'font-size:32px' }, ['⊕']),
          el('div', { style: 'font-weight:600;color:#1e293b;font-size:14px' }, ['No fields in query']),
          el('div', { style: 'font-size:12px;line-height:1.7' }, [
            'Click ', el('strong', {}, ['⊙ Detect from page']), ' to auto-fill from the current report or list.',
            el('br', {}), 'Or browse tables and click ', el('strong', {}, ['+']), ' to add fields.',
            el('br', {}), 'Use ', el('strong', {}, ['→ TableName']), ' on reference fields for dot-walking.',
          ]),
        ]));
        return;
      }

      body.appendChild(el('div', { style: 'padding:8px 12px;border-bottom:1px solid #e5e7eb;background:#f8fafc;flex-shrink:0' }, [
        el('div', { style: 'font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.6px;margin-bottom:3px' }, ['Base table']),
        el('div', { style: 'font-weight:700;color:#1e293b' }, [
          selectedTable.label,
          el('code', { style: 'font-family:monospace;font-size:11px;color:#64748b;font-weight:400;margin-left:6px' }, [selectedTable.name]),
        ]),
      ]));

      var qTable = document.createElement('table');
      qTable.className = '__snx_ftable';
      qTable.appendChild(el('thead', {}, [el('tr', {}, [el('th', {}, ['Label']), el('th', {}, ['Dot-walk path']), el('th', {}, ['Type']), el('th', { style: 'width:28px' })])]));
      var qTbody = document.createElement('tbody');
      queryFields.forEach(function (f) {
        var hasDot = f.path.includes('.');
        var rmBtn = el('button', { className: '__snx_rmbtn', title: 'Remove' }, ['×']);
        rmBtn.onclick = function () { removeFromQuery(f.path); };
        qTbody.appendChild(el('tr', {}, [
          el('td', { style: 'font-weight:500;color:#1e293b' }, [f.label]),
          el('td', {}, [el('code', { style: 'font-family:monospace;font-size:11px;color:' + (hasDot ? '#15803d' : '#64748b') }, [f.path])]),
          el('td', {}, [el('span', { className: badgeCls(f.type) }, [f.type])]),
          el('td', {}, [rmBtn]),
        ]));
      });
      qTable.appendChild(qTbody);
      var qScroll = el('div', { className: '__snx_qlist' });
      qScroll.appendChild(qTable);
      body.appendChild(qScroll);

      var qIn = el('input', { type: 'text', placeholder: 'sysparm_query filter…', value: sysparmQuery, oninput: function (e) { sysparmQuery = e.target.value; refreshMqCode(); } });
      body.appendChild(el('div', { className: '__snx_opts' }, [el('label', {}, ['Filter ', qIn])]));

      if (queryFields.some(function (f) { return f.path.includes('.'); })) {
        body.appendChild(el('div', { className: '__snx_info' }, ['Green paths are dot-walked. In Power BI, expand Column1 — these come back as flat text columns.']));
      }

      body.appendChild(el('div', { className: '__snx_tabs' }, [
        (function () { var t = el('button', { className: '__snx_tab' + (urlTabActive ? ' __snx_active' : '') }, ['REST API URL']); t.onclick = function () { urlTabActive = true; refreshMqCode(); }; return t; })(),
        (function () { var t = el('button', { className: '__snx_tab' + (!urlTabActive ? ' __snx_active' : '') }, ['Power Query M']); t.onclick = function () { urlTabActive = false; refreshMqCode(); }; return t; })(),
      ]));

      var copyBtn = el('button', { className: '__snx_copybtn' }, ['⎘ Copy']);
      copyBtn.onclick = function () {
        navigator.clipboard.writeText(urlTabActive ? buildUrl() : buildMCode()).then(function () {
          copyBtn.className = '__snx_copybtn __snx_copied'; copyBtn.textContent = '✓ Copied!';
          setTimeout(function () { copyBtn.className = '__snx_copybtn'; copyBtn.textContent = '⎘ Copy'; }, 2000);
        });
      };
      body.appendChild(el('div', { className: '__snx_copyrow' }, [copyBtn]));
      body.appendChild(el('div', { id: '__snx_mqcode__', className: '__snx_code' }, [urlTabActive ? buildUrl() : buildMCode()]));
    }

    function refreshMqCode() {
      var c = document.getElementById('__snx_mqcode__');
      if (c) c.textContent = urlTabActive ? buildUrl() : buildMCode();
      var tabs = panel.querySelectorAll('.__snx_tab');
      if (tabs[0]) tabs[0].className = '__snx_tab' + (urlTabActive ? ' __snx_active' : '');
      if (tabs[1]) tabs[1].className = '__snx_tab' + (!urlTabActive ? ' __snx_active' : '');
    }
  }

  loadTables();
})();
