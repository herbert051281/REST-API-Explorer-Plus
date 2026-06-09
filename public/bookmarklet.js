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
  let gfToken = 0;

  let view = 'loading';
  let errorMsg = '';
  let tableSearch = '';

  let detectStatus = '';
  let detectMsg = '';

  // ── Saved sets (localStorage, per-instance) ────────────────────────────────
  const SETS_KEY = '__snx_sets_' + location.hostname + '__';
  let savedSets = [];
  try { savedSets = JSON.parse(localStorage.getItem(SETS_KEY) || '[]'); } catch (e) { savedSets = []; }
  function persistSets() { try { localStorage.setItem(SETS_KEY, JSON.stringify(savedSets)); } catch (e) {} }
  function saveCurrentSet(name) {
    if (!selectedTable || queryFields.length === 0) return;
    var set = { name: name.trim(), table: selectedTable, fields: queryFields.slice(), query: sysparmQuery, limit: limitValue };
    savedSets = savedSets.filter(function (s) { return s.name !== set.name; });
    savedSets.unshift(set);
    persistSets();
  }
  function loadSet(set) {
    selectedTable = set.table;
    queryFields = set.fields.slice();
    sysparmQuery = set.query || '';
    limitValue = set.limit || '10000';
    drillStack = [];
    if (!fieldsCache[selectedTable.name]) {
      fetchLevelFields(selectedTable.name, function (flds) { currentLevelFields = flds; });
    } else {
      currentLevelFields = fieldsCache[selectedTable.name];
    }
    urlTabActive = false;
    view = 'my-query';
    fullRender();
  }
  function deleteSet(name) {
    savedSets = savedSets.filter(function (s) { return s.name !== name; });
    persistSets();
    fullRender();
  }

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
        runDetection();
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
    var frameWin = window, frameDoc = document, frameSrc = location.href;
    try {
      var iframe = document.getElementById('gsft_main') ||
        document.querySelector('iframe[name="gsft_main"]');
      if (iframe && iframe.contentDocument) {
        frameWin = iframe.contentWindow;
        frameDoc = iframe.contentDocument;
        frameSrc = iframe.src || frameSrc;
      }
    } catch (e) {}
    return { frameWin: frameWin, frameDoc: frameDoc, frameSrc: frameSrc };
  }

  function extractReportId(url) {
    var m = url.match(/jvar_report_id=([a-f0-9]{32})/i);
    if (!m) { try { m = decodeURIComponent(url).match(/jvar_report_id=([a-f0-9]{32})/i); } catch (e) {} }
    return m ? m[1] : null;
  }

  function extractTableFromUrl(url) {
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
    var tableName = null;
    var fieldNames = [];

    function pushField(f) { if (f && f !== 'sys_id' && fieldNames.indexOf(f) === -1) fieldNames.push(f); }

    ctx.frameDoc.querySelectorAll('.list_header_cell[field], th[field], [data-column-field], [data-field-name]').forEach(function (h) {
      pushField(h.getAttribute('field') || h.getAttribute('data-column-field') || h.getAttribute('data-field-name'));
    });

    try { if (ctx.frameWin.g_form && ctx.frameWin.g_form.tableName) tableName = ctx.frameWin.g_form.tableName; } catch (e) {}
    try { if (!tableName && ctx.frameWin.g_list) tableName = ctx.frameWin.g_list.table_name || ctx.frameWin.g_list.tableName; } catch (e) {}

    if (!tableName) tableName = extractTableFromUrl(ctx.frameSrc) || extractTableFromUrl(location.href);

    try { if (ctx.frameWin.g_form && ctx.frameWin.g_form._fields) Object.keys(ctx.frameWin.g_form._fields).forEach(pushField); } catch (e) {}

    try {
      var gr = ctx.frameWin.g_report || ctx.frameWin.GlideReport;
      if (gr) {
        [gr.field, gr.list_fields, gr.group_by].forEach(function (v) {
          if (v) String(v).split(',').forEach(function (f) { pushField(f.trim()); });
        });
      }
    } catch (e) {}

    var reportId = extractReportId(ctx.frameSrc) || extractReportId(location.href);
    if (reportId) {
      detectMsg = 'Reading report configuration…'; renderDetectBanner();
      snowFetch('/api/now/table/sys_report?sysparm_query=sys_id=' + reportId + '&sysparm_limit=1')
        .then(function (data) {
          var rpt = (data.result || [])[0];
          if (!rpt) { finishDetection(tableName, fieldNames, ''); return; }

          function strVal(v) { return v ? (typeof v === 'object' ? (v.value || '') : String(v)) : ''; }
          var rptTable = strVal(rpt.table) || tableName;
          var rptTitle = strVal(rpt.title) || '';

          var SKIP = { 'true': 1, 'false': 1, 'sys_id': 1, 'none': 1, 'asc': 1, 'desc': 1 };
          var REPORT_TYPES = { 'bar': 1, 'pie': 1, 'list': 1, 'trend': 1, 'line': 1, 'area': 1,
            'histogram': 1, 'map': 1, 'pivot': 1, 'multilevel': 1, 'donut': 1, 'funnel': 1 };

          var apiFields = [];
          function pushApi(f) { if (apiFields.indexOf(f) === -1) apiFields.push(f); }

          var ORDERED_KEYS = ['list_fields', 'field', 'group_by', 'sum_fields', 'avg_fields'];
          ORDERED_KEYS.forEach(function (key) {
            var raw = strVal(rpt[key]);
            if (!raw) return;
            raw.split(',').forEach(function (p) {
              p = p.trim();
              if (p && /^[a-z_][a-z0-9_.]*$/.test(p) && p.length >= 2 && !SKIP[p] && !REPORT_TYPES[p]) pushApi(p);
            });
          });

          Object.keys(rpt).forEach(function (key) {
            if (ORDERED_KEYS.indexOf(key) !== -1) return;
            if (key === 'table' || key === 'sys_id' || key === 'sys_class_name' ||
                key === 'sys_created_by' || key === 'sys_updated_by' ||
                key.indexOf('sys_mod') === 0) return;
            var raw = strVal(rpt[key]);
            if (!raw || raw.length < 2) return;
            var parts = raw.split(',').map(function (p) { return p.trim(); }).filter(Boolean);
            if (parts.length < 2) return;
            var allFieldLike = parts.every(function (p) {
              return /^[a-z_][a-z0-9_.]*$/.test(p) && p.length >= 2 && !SKIP[p] && !REPORT_TYPES[p];
            });
            if (!allFieldLike) return;
            parts.forEach(function (f) { pushApi(f); });
          });

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
      detectMsg = 'No ServiceNow table detected. Open a list, form, or report first.';
      view = 'tables'; fullRender();
      return;
    }
    var tbl = tables.find(function (t) { return t.name === tableName; }) || { name: tableName, label: tableName };
    var fCount = fieldNames.length;
    detectStatus = 'found';
    detectMsg = (hint ? hint + ' · ' : '') + 'Table: ' + tbl.label + (fCount ? ' · ' + fCount + ' fields detected' : ' (no columns detected — browse manually)');
    renderDetectBanner();
    selectBaseTable(tbl, fCount > 0 ? fieldNames : null);
  }

  // ── Global field search ────────────────────────────────────────────────────
  function runGfSearch(term) {
    var token = ++gfToken;
    gfLoading = true; repaintGfList();
    var q = 'column_labelLIKE' + term + '^ORelementLIKE' + term + '^active=true^elementISNOTEMPTY';
    snowFetch('/api/now/table/sys_dictionary?sysparm_query=' + encodeURIComponent(q) + '&sysparm_fields=element,column_label,internal_type,name&sysparm_display_value=true&sysparm_limit=100')
      .then(function (data) {
        if (token !== gfToken) return;
        gfResults = (data.result || []).filter(function (f) { return f.element && f.name; });
        gfLoading = false; repaintGfList();
      })
      .catch(function () {
        if (token !== gfToken) return;
        gfLoading = false; repaintGfList();
      });
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
    updateQueryBadge(); repaintFieldList(); repaintLivePreview();
  }
  function removeFromQuery(path) { queryFields = queryFields.filter(function (f) { return f.path !== path; }); updateQueryBadge(); fullRender(); }
  function updateQueryBadge() {
    var b = document.getElementById('__snx_qbadge__');
    if (b) { b.textContent = queryFields.length > 0 ? String(queryFields.length) : ''; b.style.display = queryFields.length > 0 ? 'inline-flex' : 'none'; }
  }
  function lookupTableLabel(techName) { var t = tables.find(function (x) { return x.name === techName; }); return t ? t.label : techName; }

  // ── Builders ───────────────────────────────────────────────────────────────
  function pathToLabel(path) {
    return path.split('.').map(function (seg) {
      return seg
        .replace(/^u_/, '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    }).join(' - ');
  }

  function resolveDotWalkLabel(path, baseFlds, callback) {
    var segs = path.split('.');
    function segFallback(s) {
      return s.replace(/^u_/, '').replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    }
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
      return '{"result.' + f.path + '", "' + lbl.replace(/"/g, '""') + '"}';
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

  // ── Bulk add ───────────────────────────────────────────────────────────────
  function bulkAddFields(raw) {
    var names = raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (names.length === 0) return;
    var prefix = currentPathPrefix();
    var labelPrefix = currentLabelPrefix();
    var flds = currentLevelFields;
    names.forEach(function (name) {
      var path = prefix + name;
      if (isInQuery(path)) return;
      var f = flds.find(function (x) { return x.element === name; });
      if (f) {
        addToQuery(path, labelPrefix + f.column_label, f.internal_type);
      } else if (name.indexOf('.') !== -1) {
        resolveDotWalkLabel(name, flds, function (label, type) { addToQuery(name, label, type); });
      } else {
        addToQuery(path, labelPrefix + pathToLabel(name), 'string');
      }
    });
    updateQueryBadge();
    repaintFieldList();
    repaintLivePreview();
  }

  // ── SVG icon helper ────────────────────────────────────────────────────────
  var ICONS = {
    query:  '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4"/>',
    tables: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
    mcode:  '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    url:    '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  };
  function svgIcon(key, size) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', size || 14); svg.setAttribute('height', size || 14);
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
    svg.style.cssText = 'flex-shrink:0;display:block';
    svg.innerHTML = ICONS[key] || '';
    return svg;
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
    if (type === 'integer' || type === 'float' || type === 'decimal') return '__snx_badge __snx_badge_num';
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
        var drillBtn = el('button', { className: '__snx_drillbtn', title: 'Browse ' + refTLabel + ' fields' }, ['→ ' + refTLabel]);
        drillBtn.onclick = function (e) { e.stopPropagation(); drillInto(f.element, f.column_label, f.reference); };
        actions.appendChild(drillBtn);
      }
      var addBtn = el('button', { className: '__snx_addbtn' + (inQuery ? ' __snx_addbtn_on' : ''), title: inQuery ? 'Added: ' + path : 'Add: ' + path }, [inQuery ? '✓' : '+']);
      addBtn.onclick = function (e) { e.stopPropagation(); if (!inQuery) addToQuery(path, label, f.internal_type); };
      actions.appendChild(addBtn);
      tbody.appendChild(el('tr', {}, [
        el('td', { style: 'color:#0f172a' }, [
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
    if (gfQuery.trim().length < 2) { container.appendChild(el('div', { style: 'padding:24px 16px;text-align:center;color:#94a3b8;font-size:12px' }, ['Search to discover which tables have a field. Click a result to open that table.'])); return; }
    if (gfResults.length === 0) { container.appendChild(el('div', { style: 'padding:24px 16px;text-align:center;color:#94a3b8;font-size:12px' }, ['No fields found for "' + gfQuery + '"'])); return; }
    var tbl = document.createElement('table');
    tbl.className = '__snx_ftable';
    tbl.appendChild(el('thead', {}, [el('tr', {}, [el('th', {}, ['Label']), el('th', {}, ['Field name']), el('th', {}, ['Table']), el('th', {}, ['Type'])])]));
    var tbody = document.createElement('tbody');
    gfResults.forEach(function (f) {
      var tLbl = lookupTableLabel(f.name);
      var row = el('tr', { title: 'Open ' + tLbl + ' as base table' }, [
        el('td', { style: 'font-weight:500;color:#0f172a' }, [f.column_label || f.element]),
        el('td', { style: 'font-family:monospace;font-size:11px;color:#64748b' }, [f.element]),
        el('td', {}, [el('div', { style: 'font-size:11px;font-weight:600;color:#0f172a' }, [tLbl]), el('div', { style: 'font-family:monospace;font-size:11px;color:#64748b' }, [f.name])]),
        el('td', {}, [el('span', { className: badgeCls(f.internal_type) }, [f.internal_type || 'string'])]),
      ]);
      row.onclick = function () { var tObj = tables.find(function (x) { return x.name === f.name; }) || { name: f.name, label: tLbl }; selectBaseTable(tObj); };
      tbody.appendChild(row);
    });
    tbl.appendChild(tbody);
    container.appendChild(tbl);
    container.appendChild(el('div', { style: 'padding:6px 12px;font-size:11px;color:#94a3b8;border-top:1px solid #f1f5f9' }, ['Click a row to open that table, then use → to drill into related tables.']));
  }

  function repaintLivePreview() {
    var bar = document.getElementById('__snx_preview__');
    if (!bar) return;
    var n = queryFields.length;
    bar.innerHTML = '';
    if (n === 0) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    bar.appendChild(el('span', { className: '__snx_preview_count' }, [n + ' field' + (n === 1 ? '' : 's') + ' selected']));
    var copyBtn = el('button', { className: '__snx_preview_copy' }, ['⎘ Copy M code']);
    copyBtn.onclick = function () {
      navigator.clipboard.writeText(buildMCode()).then(function () {
        copyBtn.textContent = '✓ Copied!';
        copyBtn.classList.add('__snx_copied');
        setTimeout(function () { copyBtn.textContent = '⎘ Copy M code'; copyBtn.classList.remove('__snx_copied'); }, 2000);
      }).catch(function () {
        copyBtn.textContent = '⚠ Copy failed';
        setTimeout(function () { copyBtn.textContent = '⎘ Copy M code'; }, 2000);
      });
    };
    bar.appendChild(copyBtn);
    var viewBtn = el('button', { className: '__snx_preview_view' }, ['View query →']);
    viewBtn.onclick = function () { urlTabActive = false; view = 'my-query'; fullRender(); };
    bar.appendChild(viewBtn);
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
  styleEl.textContent = [
    // Panel shell
    '#__snow_api_explorer_plus__{all:initial;position:fixed;top:0;right:0;width:540px;height:100vh;z-index:2147483647;display:flex;flex-direction:column;font-family:-apple-system,"Inter","Segoe UI",system-ui,sans-serif;font-size:13px;background:#f8fafc;box-shadow:-12px 0 48px rgba(0,0,0,.28);border-left:1px solid rgba(255,255,255,.08);overflow:hidden}',
    '#__snow_api_explorer_plus__ *{box-sizing:border-box;margin:0;padding:0}',

    // Header
    '.__snx_h{background:#0f172a;color:#fff;padding:13px 16px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;gap:8px;border-bottom:1px solid rgba(14,165,233,.35)}',
    '.__snx_h span{font-weight:700;font-size:14px;flex:1;letter-spacing:-.03em}',
    '.__snx_h span b{color:#38bdf8;font-weight:800}',
    '.__snx_hbtn{background:none;border:none;color:#64748b;cursor:pointer;font-size:18px;line-height:1;padding:6px;flex-shrink:0;border-radius:8px;display:flex;align-items:center;justify-content:center;transition:background .15s,color .15s;min-width:32px;min-height:32px}',
    '.__snx_hbtn:hover{color:#f1f5f9;background:rgba(255,255,255,.1)}',
    '.__snx_hlimwrap{display:flex;align-items:center;gap:5px;flex-shrink:0;color:#94a3b8;font-size:11px;font-weight:600;white-space:nowrap}',
    '.__snx_hlim{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);color:#e2e8f0;border-radius:7px;padding:4px 7px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;transition:border-color .15s}',
    '.__snx_hlim:hover{border-color:rgba(14,165,233,.6)}',
    '.__snx_hlim:focus{outline:none;border-color:#38bdf8;box-shadow:0 0 0 2px rgba(56,189,248,.2)}',
    '.__snx_hlim option{background:#1e293b;color:#f1f5f9}',
    '.__snx_detectbtn{background:rgba(56,189,248,.12);border:1px solid rgba(56,189,248,.3);color:#7dd3fc;border-radius:7px;padding:5px 11px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0;transition:all .15s}',
    '.__snx_detectbtn:hover{background:rgba(56,189,248,.22);border-color:rgba(56,189,248,.6);color:#bae6fd}',

    // Detection banner
    '.__snx_detectbanner{display:none;align-items:flex-start;gap:8px;padding:8px 14px;font-size:12px;font-weight:500;border-bottom:1px solid;line-height:1.45;flex-shrink:0;word-break:break-word}',

    // Body + loading
    '.__snx_body{flex:1;overflow-y:auto;display:flex;flex-direction:column;min-height:0;background:#f8fafc}',
    '.__snx_loading{flex:1;display:flex;align-items:center;justify-content:center;color:#94a3b8;gap:10px;font-size:13px}',
    '.__snx_spin{width:18px;height:18px;border:2px solid #e2e8f0;border-top-color:#0ea5e9;border-radius:50%;animation:__snx_spin .7s linear infinite;flex-shrink:0}',
    '@keyframes __snx_spin{to{transform:rotate(360deg)}}',
    '.__snx_err{margin:12px;padding:12px 14px;background:#fff;border:1px solid #fecaca;border-left:3px solid #ef4444;border-radius:10px;color:#b91c1c;font-size:12px;line-height:1.5}',

    // Main nav tabs — Excel-style colored sheet tabs
    '.__snx_maintabs{display:flex;background:#07111f;padding:10px 12px 0;gap:3px;flex-shrink:0}',
    '.__snx_maintab{flex:1;padding:10px 6px 9px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-bottom:none;border-radius:7px 7px 0 0;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .15s;letter-spacing:-.01em;white-space:nowrap}',
    '.__snx_maintab_query{color:rgba(147,197,253,.55)}',
    '.__snx_maintab_query:hover{background:rgba(37,99,235,.2);color:#93c5fd;border-color:rgba(37,99,235,.4)}',
    '.__snx_maintab_query.__snx_active{background:#2563eb;color:#fff;border-color:#1d4ed8;font-weight:700}',
    '.__snx_maintab_tables{color:rgba(103,232,249,.55)}',
    '.__snx_maintab_tables:hover{background:rgba(8,145,178,.2);color:#67e8f9;border-color:rgba(8,145,178,.4)}',
    '.__snx_maintab_tables.__snx_active{background:#0891b2;color:#fff;border-color:#0e7490;font-weight:700}',
    '.__snx_maintab_search{color:rgba(196,181,253,.55)}',
    '.__snx_maintab_search:hover{background:rgba(124,58,237,.2);color:#c4b5fd;border-color:rgba(124,58,237,.4)}',
    '.__snx_maintab_search.__snx_active{background:#7c3aed;color:#fff;border-color:#6d28d9;font-weight:700}',
    '.__snx_qbadge{display:none;background:rgba(255,255,255,.22);color:#fff;border-radius:9999px;font-size:10px;font-weight:700;min-width:18px;height:18px;padding:0 5px;align-items:center;justify-content:center}',

    // Search / filter inputs
    '.__snx_search{padding:10px 12px;border-bottom:1px solid #edf2f7;display:flex;gap:6px;align-items:center;flex-shrink:0;background:#fff}',
    '.__snx_search input{flex:1;border:1.5px solid #e2e8f0;border-radius:9px;padding:8px 12px;font-size:12px;font-family:inherit;outline:none;background:#f8fafc;color:#0f172a;transition:border-color .15s,box-shadow .15s}',
    '.__snx_search input::placeholder{color:#94a3b8}',
    '.__snx_search input:focus{border-color:#0ea5e9;background:#fff;box-shadow:0 0 0 3px rgba(14,165,233,.12)}',

    // Bulk add input
    '.__snx_bulkadd{padding:8px 12px;border-bottom:1px solid #edf2f7;display:flex;gap:6px;align-items:center;flex-shrink:0;background:#f0f9ff}',
    '.__snx_bulkadd input{flex:1;border:1.5px solid #bae6fd;border-radius:9px;padding:7px 12px;font-size:12px;font-family:monospace;outline:none;background:#fff;color:#0f172a;transition:border-color .15s,box-shadow .15s}',
    '.__snx_bulkadd input::placeholder{color:#94a3b8;font-family:inherit}',
    '.__snx_bulkadd input:focus{border-color:#0ea5e9;box-shadow:0 0 0 3px rgba(14,165,233,.12)}',
    '.__snx_bulkadd_hint{font-size:10px;color:#38bdf8;font-weight:600;white-space:nowrap;flex-shrink:0}',

    // Meta row
    '.__snx_meta{font-size:11px;color:#94a3b8;padding:5px 14px;flex-shrink:0;font-weight:500;background:#fff;border-bottom:1px solid #f1f5f9}',

    // Table / item list
    '.__snx_list{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:5px;padding:10px}',
    '.__snx_item{padding:10px 14px;cursor:pointer;background:#fff;border-radius:10px;border:1px solid #e8edf4;box-shadow:0 1px 2px rgba(0,0,0,.04);transition:all .12s}',
    '.__snx_item:hover{background:#f0f9ff;border-color:#bae6fd;box-shadow:0 4px 12px rgba(14,165,233,.1);transform:translateY(-1px)}',
    '.__snx_item.__snx_sel{background:#eff6ff;border-color:#7dd3fc;border-left:3px solid #0ea5e9;padding-left:11px;box-shadow:0 2px 8px rgba(14,165,233,.15)}',
    '.__snx_item_label{font-weight:600;color:#0f172a;font-size:13px}',
    '.__snx_item_name{font-family:monospace;font-size:11px;color:#94a3b8;margin-top:2px}',

    // Toolbar (breadcrumb row)
    '.__snx_toolbar{padding:10px 14px;border-bottom:1px solid #edf2f7;display:flex;align-items:center;gap:8px;flex-shrink:0;background:#fff}',
    '.__snx_back{background:none;border:1px solid transparent;color:#0ea5e9;cursor:pointer;font-size:12px;font-weight:600;font-family:inherit;display:flex;align-items:center;gap:4px;padding:5px 8px;white-space:nowrap;flex-shrink:0;border-radius:7px;transition:all .15s}',
    '.__snx_back:hover{background:#f0f9ff;border-color:#bae6fd}',
    '.__snx_breadcrumb{font-size:11px;color:#94a3b8;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',

    // Fields table
    '.__snx_ftable{width:100%;border-collapse:collapse}',
    '.__snx_ftable th{position:sticky;top:0;background:#fff;text-align:left;padding:8px 10px;font-size:10.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.6px;border-bottom:2px solid #f1f5f9}',
    '.__snx_ftable td{padding:9px 10px;border-bottom:1px solid #f8fafc;vertical-align:middle}',
    '.__snx_ftable tr:hover td{background:#f8fbff}',

    // Type badges
    '.__snx_badge{font-size:10px;padding:2px 7px;border-radius:5px;font-weight:700;white-space:nowrap;letter-spacing:.02em}',
    '.__snx_badge_ref{background:#d1fae5;color:#065f46}',
    '.__snx_badge_str{background:#dbeafe;color:#1e40af}',
    '.__snx_badge_dt{background:#fce7f3;color:#9d174d}',
    '.__snx_badge_num{background:#fef3c7;color:#92400e}',
    '.__snx_badge_other{background:#f1f5f9;color:#475569}',

    // Buttons
    '.__snx_addbtn{width:30px;height:30px;border-radius:7px;border:1.5px solid #e2e8f0;background:#fff;color:#64748b;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;justify-content:center;transition:all .12s}',
    '.__snx_addbtn:hover{border-color:#0ea5e9;color:#0ea5e9;background:#f0f9ff}',
    '.__snx_addbtn_on{background:#d1fae5!important;border-color:#34d399!important;color:#065f46!important;cursor:default}',
    '.__snx_drillbtn{height:28px;padding:0 9px;border-radius:7px;border:1.5px solid #e2e8f0;background:#f8fafc;color:#0ea5e9;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap;margin-right:4px;transition:all .12s}',
    '.__snx_drillbtn:hover{border-color:#0ea5e9;background:#f0f9ff}',

    // Sub tabs (URL / M)
    '.__snx_tabs{display:flex;flex-shrink:0;background:#dde3ec;padding:10px 14px 0;gap:4px}',
    '.__snx_tab{flex:0;padding:11px 20px 10px;background:#c8d1dc;border:1.5px solid #b0bcc9;border-bottom:none;border-radius:7px 7px 0 0;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;color:#64748b;display:flex;align-items:center;gap:7px;transition:all .15s;white-space:nowrap}',
    '.__snx_tab_m:hover{background:#dcfce7;color:#16a34a;border-color:#86efac}',
    '.__snx_tab_url:hover{background:#ffedd5;color:#ea580c;border-color:#fdba74}',
    '.__snx_tab_m.__snx_active{background:#16a34a;color:#fff;border-color:#15803d;font-weight:700}',
    '.__snx_tab_url.__snx_active{background:#ea580c;color:#fff;border-color:#c2410c;font-weight:700}',

    // Code block
    '.__snx_code{background:#0d1117;color:#e6edf3;font-family:"Cascadia Code","Fira Code","Consolas",monospace;font-size:11.5px;line-height:1.75;padding:16px;white-space:pre-wrap;word-break:break-all;flex:1;overflow-y:auto;margin:10px;border-radius:12px;border:1px solid rgba(255,255,255,.06)}',

    // Copy row
    '.__snx_copyrow{display:flex;justify-content:flex-end;align-items:center;padding:8px 14px;border-bottom:1px solid #f1f5f9;background:#fff;flex-shrink:0;gap:8px}',
    '.__snx_copybtn{display:flex;align-items:center;gap:6px;border:1.5px solid #e2e8f0;background:#fff;border-radius:8px;padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s;color:#334155}',
    '.__snx_copybtn:hover{border-color:#0ea5e9;color:#0ea5e9;background:#f0f9ff}',
    '.__snx_copybtn.__snx_copied{border-color:#34d399;color:#065f46;background:#d1fae5}',

    // Query options
    '.__snx_opts{padding:12px 14px;background:#fff;border-bottom:1px solid #f1f5f9;display:flex;flex-direction:column;gap:8px;flex-shrink:0}',
    '.__snx_opts label{font-size:12px;font-weight:600;color:#64748b;display:flex;align-items:center;gap:6px}',
    '.__snx_opts select,.__snx_opts input[type=text]{font-size:12px;font-family:inherit;border:1.5px solid #e2e8f0;border-radius:8px;padding:5px 9px;background:#f8fafc;color:#0f172a;transition:border-color .15s}',
    '.__snx_opts select:focus,.__snx_opts input[type=text]:focus{outline:none;border-color:#0ea5e9;background:#fff;box-shadow:0 0 0 2px rgba(14,165,233,.12)}',
    '.__snx_opts input[type=text]{flex:1}',

    // Info callout
    '.__snx_info{margin:10px 12px;padding:10px 13px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;font-size:11px;color:#0369a1;line-height:1.6;flex-shrink:0}',

    // Query fields list
    '.__snx_qlist{overflow-y:auto;flex-shrink:0;border-bottom:1px solid #f1f5f9;max-height:220px;background:#fff}',
    '.__snx_rmbtn{width:28px;height:28px;border-radius:6px;border:none;background:none;color:#cbd5e1;font-size:16px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0;transition:all .15s}',
    '.__snx_rmbtn:hover{background:#fef2f2;color:#ef4444}',

    // Empty state
    '.__snx_empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 28px;text-align:center;color:#94a3b8;gap:12px}',
    '.__snx_empty_icon{font-size:36px;opacity:.4}',

    // Dot-walk path strip
    '.__snx_dwpath{padding:7px 14px;background:#fffbeb;border-bottom:1px solid #fde68a;font-size:11px;font-weight:500;color:#78350f;flex-shrink:0}',

    // Live preview bar (sticky footer in fields view)
    '.__snx_preview{display:none;align-items:center;gap:8px;padding:10px 14px;background:#0f172a;border-top:1px solid rgba(56,189,248,.2);flex-shrink:0}',
    '.__snx_preview_count{font-size:11.5px;font-weight:700;color:#7dd3fc;flex:1;letter-spacing:-.01em}',
    '.__snx_preview_copy{display:flex;align-items:center;gap:5px;border:1.5px solid rgba(56,189,248,.4);background:rgba(56,189,248,.1);border-radius:7px;padding:6px 12px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;color:#7dd3fc;transition:all .15s}',
    '.__snx_preview_copy:hover{background:rgba(56,189,248,.2);border-color:rgba(56,189,248,.7);color:#bae6fd}',
    '.__snx_preview_copy.__snx_copied{border-color:#34d399;color:#6ee7b7;background:rgba(52,211,153,.1)}',
    '.__snx_preview_view{display:flex;align-items:center;border:1.5px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);border-radius:7px;padding:6px 12px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;color:#94a3b8;transition:all .15s;white-space:nowrap}',
    '.__snx_preview_view:hover{border-color:rgba(255,255,255,.25);color:#e2e8f0}',

    // Saved sets
    '.__snx_sets{background:#fff;border-bottom:1px solid #f1f5f9;flex-shrink:0}',
    '.__snx_sets_hdr{display:flex;align-items:center;justify-content:space-between;padding:8px 14px;border-bottom:1px solid #f8fafc}',
    '.__snx_sets_title{font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.6px}',
    '.__snx_sets_savebtn{display:flex;align-items:center;gap:4px;border:1.5px solid #e2e8f0;background:#fff;border-radius:7px;padding:4px 10px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;color:#64748b;transition:all .15s}',
    '.__snx_sets_savebtn:hover{border-color:#0ea5e9;color:#0ea5e9;background:#f0f9ff}',
    '.__snx_set_row{display:flex;align-items:center;gap:8px;padding:7px 14px;border-bottom:1px solid #f8fafc;transition:background .1s}',
    '.__snx_set_row:hover{background:#f8fafc}',
    '.__snx_set_name{flex:1;font-size:12px;font-weight:600;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.__snx_set_meta{font-size:11px;color:#94a3b8;white-space:nowrap}',
    '.__snx_set_load{border:1.5px solid #e2e8f0;background:#fff;border-radius:6px;padding:3px 9px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;color:#0ea5e9;transition:all .15s;white-space:nowrap}',
    '.__snx_set_load:hover{border-color:#0ea5e9;background:#f0f9ff}',
    '.__snx_set_del{width:24px;height:24px;border:none;background:none;color:#cbd5e1;font-size:14px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;border-radius:5px;transition:all .15s}',
    '.__snx_set_del:hover{background:#fef2f2;color:#ef4444}',
  ].join('');
  document.head.appendChild(styleEl);

  // ── Panel ──────────────────────────────────────────────────────────────────
  var panel = document.createElement('div');
  panel.id = PANEL_ID;
  document.body.appendChild(panel);

  function renderMainTabs(body) {
    var defs = [
      { label: 'My Query',      v: 'my-query',     cls: '__snx_maintab_query',  icon: 'query',  badge: true },
      { label: 'Browse Tables', v: 'tables',        cls: '__snx_maintab_tables', icon: 'tables' },
      { label: 'Search Fields', v: 'field-search',  cls: '__snx_maintab_search', icon: 'search' },
    ];
    body.appendChild(el('div', { className: '__snx_maintabs' }, defs.map(function (d) {
      var btn = el('button', { className: '__snx_maintab ' + d.cls + (view === d.v ? ' __snx_active' : '') }, [
        svgIcon(d.icon, 13),
        d.label,
        d.badge ? el('span', { id: '__snx_qbadge__', className: '__snx_qbadge', style: queryFields.length > 0 ? 'display:inline-flex' : 'display:none' }, [String(queryFields.length)]) : null,
      ]);
      btn.onclick = function () { view = d.v; fullRender(); };
      return btn;
    })));
  }

  function renderSavedSets(body) {
    if (savedSets.length === 0 && (!selectedTable || queryFields.length === 0)) return;
    var section = el('div', { className: '__snx_sets' });
    var hdr = el('div', { className: '__snx_sets_hdr' }, [
      el('span', { className: '__snx_sets_title' }, ['Saved Sets']),
    ]);
    if (selectedTable && queryFields.length > 0) {
      var saveBtn = el('button', { className: '__snx_sets_savebtn' }, ['+ Save current']);
      saveBtn.onclick = function () {
        var name = prompt('Name this field set:', selectedTable.label);
        if (name && name.trim()) { saveCurrentSet(name.trim()); fullRender(); }
      };
      hdr.appendChild(saveBtn);
    }
    section.appendChild(hdr);
    savedSets.forEach(function (s) {
      var row = el('div', { className: '__snx_set_row' }, [
        el('span', { className: '__snx_set_name' }, [s.name]),
        el('span', { className: '__snx_set_meta' }, [s.fields.length + ' fields · ' + (s.table ? s.table.name : '')]),
      ]);
      var loadBtn = el('button', { className: '__snx_set_load' }, ['Load']);
      loadBtn.onclick = function () { loadSet(s); };
      var delBtn = el('button', { className: '__snx_set_del', title: 'Delete' }, ['×']);
      delBtn.onclick = function () { deleteSet(s.name); };
      row.appendChild(loadBtn);
      row.appendChild(delBtn);
      section.appendChild(row);
    });
    body.appendChild(section);
  }

  function fullRender() {
    panel.innerHTML = '';

    var limitOpts = ['100', '1000', '10000', '100000', '1000000'];
    var hLimSel = el('select', { className: '__snx_hlim', title: 'Record limit (sysparm_limit)', onchange: function (e) { limitValue = e.target.value; var c = document.getElementById('__snx_mqcode__'); if (c) c.textContent = urlTabActive ? buildUrl() : buildMCode(); } },
      limitOpts.map(function (v) { var o = el('option', { value: v }, [v]); if (v === limitValue) o.setAttribute('selected', 'selected'); return o; }));
    var detectBtn = el('button', { className: '__snx_detectbtn', title: 'Auto-detect table and fields from the current page', onclick: function () { runDetection(); } }, ['⊙ Detect']);
    panel.appendChild(el('div', { className: '__snx_h' }, [
      el('span', {}, ['REST API Explorer ', el('b', {}, ['Plus'])]),
      el('div', { className: '__snx_hlimwrap' }, ['Limit ', hLimSel]),
      detectBtn,
      el('button', { className: '__snx_hbtn', onclick: function () { panel.style.display = 'none'; } }, ['✕']),
    ]));

    var banner = el('div', { id: '__snx_detectbanner__', className: '__snx_detectbanner' });
    panel.appendChild(banner);
    renderDetectBanner();

    var body = el('div', { className: '__snx_body' });
    panel.appendChild(body);

    if (view === 'loading') { body.appendChild(el('div', { className: '__snx_loading' }, [el('div', { className: '__snx_spin' }), 'Loading…'])); return; }

    if (view === 'error') {
      body.appendChild(el('div', { className: '__snx_err' }, [errorMsg]));
      body.appendChild(el('button', { style: 'margin:12px;font-family:inherit;font-size:12px;padding:7px 14px;background:#0ea5e9;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600', onclick: loadTables }, ['Retry']));
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

    // ── Field view ───────────────────────────────────────────────────────────
    if (view === 'fields') {
      var currentTableL = drillStack.length > 0 ? drillStack[drillStack.length - 1].tableLabel : (selectedTable ? selectedTable.label : '');
      var currentTableN = drillStack.length > 0 ? drillStack[drillStack.length - 1].tableName : (selectedTable ? selectedTable.name : '');
      var crumbs = [selectedTable ? selectedTable.label : ''].concat(drillStack.map(function (d) { return d.refLabel + ' (' + d.tableName + ')'; }));

      var backLabel, backAction;
      if (drillStack.length === 0) { backLabel = '← Tables'; backAction = function () { view = 'tables'; fullRender(); }; }
      else { var prevL = drillStack.length > 1 ? drillStack[drillStack.length - 2].tableLabel : (selectedTable ? selectedTable.label : 'Back'); backLabel = '← ' + prevL; backAction = drillBack; }

      body.appendChild(el('div', { className: '__snx_toolbar' }, [
        el('button', { className: '__snx_back', onclick: backAction }, [backLabel]),
        el('div', { style: 'flex:1;min-width:0;margin:0 6px' }, [
          el('div', { style: 'font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px' }, [currentTableL]),
          drillStack.length > 0 ? el('div', { className: '__snx_breadcrumb' }, [crumbs.join(' → ')]) : null,
        ]),
        el('code', { style: 'font-size:11px;color:#94a3b8;flex-shrink:0;font-family:monospace' }, [currentTableN]),
      ]));

      if (drillStack.length > 0) {
        var dotPath = drillStack.map(function (d) { return d.refElement; }).join('.') + '.[field]';
        body.appendChild(el('div', { className: '__snx_dwpath' }, ['Path: ', el('code', { style: 'font-family:monospace;font-weight:700' }, [dotPath])]));
      }

      // Bulk add row
      var bulkInput = el('input', { type: 'text', placeholder: 'Bulk add: state,number,assigned_to → Enter' });
      bulkInput.onkeydown = function (e) {
        if (e.key === 'Enter' && bulkInput.value.trim()) {
          bulkAddFields(bulkInput.value);
          bulkInput.value = '';
        }
      };
      body.appendChild(el('div', { className: '__snx_bulkadd' }, [
        bulkInput,
        el('span', { className: '__snx_bulkadd_hint' }, ['↵ Enter']),
      ]));

      var fi = el('input', { type: 'text', placeholder: 'Filter fields…', value: fieldFilter, oninput: function (e) { fieldFilter = e.target.value; repaintFieldList(); } });
      body.appendChild(el('div', { className: '__snx_search' }, [fi]));
      body.appendChild(el('div', { id: '__snx_fmeta__', className: '__snx_meta' }, [currentLevelFields.length + ' fields']));

      var flistWrap = el('div', { style: 'flex:1;overflow-y:auto;min-height:0' });
      flistWrap.appendChild(el('div', { id: '__snx_flist__', className: '__snx_list', style: 'padding:0' }));
      body.appendChild(flistWrap);
      body.appendChild(el('div', { id: '__snx_preview__', className: '__snx_preview' }));

      repaintFieldList();
      repaintLivePreview();
      return;
    }

    // ── My Query ─────────────────────────────────────────────────────────────
    if (view === 'my-query') {
      renderMainTabs(body);

      renderSavedSets(body);

      if (!selectedTable || queryFields.length === 0) {
        body.appendChild(el('div', { className: '__snx_empty' }, [
          el('div', { className: '__snx_empty_icon' }, ['⊕']),
          el('div', { style: 'font-weight:700;color:#0f172a;font-size:14px' }, ['No fields in query']),
          el('div', { style: 'font-size:12px;line-height:1.8;color:#94a3b8' }, [
            'Click ', el('strong', { style: 'color:#0f172a' }, ['⊙ Detect']), ' to auto-fill from the current page.',
            el('br', {}), 'Or browse tables and click ', el('strong', { style: 'color:#0f172a' }, ['+']), ' to add fields.',
            el('br', {}), 'Use ', el('strong', { style: 'color:#0f172a' }, ['→ TableName']), ' on reference fields to dot-walk.',
          ]),
        ]));
        return;
      }

      body.appendChild(el('div', { style: 'padding:8px 14px;border-bottom:1px solid #f1f5f9;background:#f8fafc;flex-shrink:0' }, [
        el('div', { style: 'font-size:10.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.6px;margin-bottom:2px' }, ['Base table']),
        el('div', { style: 'font-weight:700;color:#0f172a' }, [
          selectedTable.label,
          el('code', { style: 'font-family:monospace;font-size:11px;color:#94a3b8;font-weight:400;margin-left:6px' }, [selectedTable.name]),
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
          el('td', { style: 'font-weight:500;color:#0f172a' }, [f.label]),
          el('td', {}, [el('code', { style: 'font-family:monospace;font-size:11px;color:' + (hasDot ? '#059669' : '#94a3b8') }, [f.path])]),
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

      // Tabs — Power Query M first (hero)
      body.appendChild(el('div', { className: '__snx_tabs' }, [
        (function () { var t = el('button', { className: '__snx_tab __snx_tab_m' + (!urlTabActive ? ' __snx_active' : '') }, [svgIcon('mcode', 14), 'Power Query M']); t.onclick = function () { urlTabActive = false; refreshMqCode(); }; return t; })(),
        (function () { var t = el('button', { className: '__snx_tab __snx_tab_url' + (urlTabActive ? ' __snx_active' : '') }, [svgIcon('url', 14), 'REST API URL']); t.onclick = function () { urlTabActive = true; refreshMqCode(); }; return t; })(),
      ]));

      var copyBtn = el('button', { className: '__snx_copybtn' }, ['⎘ Copy']);
      copyBtn.onclick = function () {
        navigator.clipboard.writeText(urlTabActive ? buildUrl() : buildMCode()).then(function () {
          copyBtn.className = '__snx_copybtn __snx_copied'; copyBtn.textContent = '✓ Copied!';
          setTimeout(function () { copyBtn.className = '__snx_copybtn'; copyBtn.textContent = '⎘ Copy'; }, 2000);
        }).catch(function () {
          copyBtn.className = '__snx_copybtn'; copyBtn.textContent = '⚠ Copy failed';
          setTimeout(function () { copyBtn.textContent = '⎘ Copy'; }, 2000);
        });
      };
      body.appendChild(el('div', { className: '__snx_copyrow' }, [copyBtn]));
      body.appendChild(el('div', { id: '__snx_urlnote__', className: '__snx_info', style: urlTabActive ? '' : 'display:none' }, [
        'URL mode returns ', el('code', { style: 'font-size:10.5px' }, ['display_value=all']), ' — each field is a ',
        el('code', { style: 'font-size:10.5px' }, ['{value, display_value}']), ' object, not a flat string. ',
        'Use the Power Query M tab for columns ready to load into Power BI.',
      ]));
      body.appendChild(el('div', { id: '__snx_mqcode__', className: '__snx_code' }, [urlTabActive ? buildUrl() : buildMCode()]));
    }

    function refreshMqCode() {
      var c = document.getElementById('__snx_mqcode__');
      if (c) c.textContent = urlTabActive ? buildUrl() : buildMCode();
      var note = document.getElementById('__snx_urlnote__');
      if (note) note.style.display = urlTabActive ? '' : 'none';
      var tabs = panel.querySelectorAll('.__snx_tab');
      if (tabs[0]) tabs[0].className = '__snx_tab __snx_tab_m' + (!urlTabActive ? ' __snx_active' : '');
      if (tabs[1]) tabs[1].className = '__snx_tab __snx_tab_url' + (urlTabActive ? ' __snx_active' : '');
    }
  }

  loadTables();
})();
