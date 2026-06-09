# REST API Explorer Plus — Project Memory

## What This Is

A React 18 + TypeScript + Vite + Tailwind CSS single-page app that fixes the ServiceNow → Power BI display name problem.

**Problem:** ServiceNow REST API returns technical table/field names (`cmn_department`, `sys_id`) instead of human-readable labels. Power BI reports show unreadable data.

**Solution:** This tool lets you browse tables by display name ("Department"), see field labels mapped to technical names, and generates Power BI-ready URLs and Power Query M code pre-configured with `sysparm_display_value=all`.

---

## Key ServiceNow Params

| Param | Value | Effect |
|-------|-------|--------|
| `sysparm_display_value` | `all` | Returns both `value` (sys_id) and `display_value` (label) for every field |
| `sysparm_exclude_reference_link` | `true` | Removes noisy API link objects |
| `sysparm_display_value` | `true` | Returns only display values (no raw sys_ids) |

**Reference fields in Power BI:** Expand the column → pick `.display_value` sub-field to get the human-readable name.

---

## ServiceNow Metadata Tables Used

| Table | Purpose |
|-------|---------|
| `sys_db_object` | All tables with their display labels (`name` = technical, `label` = display) |
| `sys_dictionary` | All fields for a table with labels (`element` = technical, `column_label` = display) |

---

## Project Structure

```
src/
├── types/servicenow.ts          # Connection, SysDbObject, SysDictField types
├── hooks/useServiceNow.ts       # fetchTables(), fetchFields(), getErrorMessage()
├── utils/urlBuilder.ts          # buildApiUrl(), buildMCode()
└── components/
    ├── ConnectionPanel.tsx      # Instance URL + Basic Auth form
    ├── TableBrowser.tsx         # Search tables by display label
    ├── FieldExplorer.tsx        # Field label ↔ technical name mapping with checkboxes
    └── PowerBIUrlBuilder.tsx    # URL tab + Power Query M Code tab + copy buttons
```

---

## Running the App

```bash
npm run dev       # Dev server → http://localhost:5173
npm run build     # Production build → dist/
```

---

## CORS Note

Browsers block direct cross-origin requests from localhost to ServiceNow. **Power BI Desktop (native app) does NOT have this restriction** — the generated M code and URLs work directly in Power BI without any proxy.

For browser-based testing from localhost, you would need to add a Vite proxy in `vite.config.ts`.

---

## Instance

User's ServiceNow test instance: `rsmntest.service-now.com`

---

## Coding Lessons Learned

### 1. Escape string literals in generated code

When building Power Query M (or any code-as-string output), always escape special characters before interpolating API or user data. In M, double-quote is escaped as `""`:

```js
lbl.replace(/"/g, '""')
```

A label like `System "Admin" Name` produced invalid M code that Power BI silently refused to parse. Any value interpolated into a generated code string (M, SQL, JSON) must be escaped for the target language.

---

### 2. Wire up every DOM element you create

After creating a wrapper with `el()`, immediately write the `appendChild` chain — don't defer it. A `flistWrap` variable was created but never appended, so its `flex:1;overflow-y:auto` never applied and the live preview bar scrolled out of view instead of staying sticky.

```js
// Correct pattern — wire it all in one pass
var wrap = el('div', { style: 'flex:1;overflow-y:auto;min-height:0' });
wrap.appendChild(el('div', { id: '...' }));
body.appendChild(wrap);
body.appendChild(footer);
```

---

### 3. Always `.catch()` browser API calls

`navigator.clipboard.writeText()` rejects when the page loses focus (normal when switching tabs to paste). Without `.catch()` the button silently does nothing. All clipboard and permission API calls must chain an error handler that shows visible feedback.

---

### 4. Document API parameter differences between sibling outputs

`buildMCode()` used `sysparm_display_value=true` (flat strings) while `buildUrl()` used `sysparm_display_value=all` (nested `{value, display_value}` objects). Both looked correct in code but produced incompatible shapes. When two code paths hit the same API with different params, add a UI note and a comment at both call sites explaining why they differ.

---

### 5. Token pattern for async search — discard stale responses

Any fetch triggered from a user input event must guard against out-of-order responses:

```js
let gfToken = 0;
function runGfSearch(term) {
  var token = ++gfToken;
  snowFetch(...).then(function(data) {
    if (token !== gfToken) return; // discard stale
    // update state
  });
}
```

Debouncing reduces frequency but doesn't eliminate races on slow networks. The token variable lives in the same scope as the state it protects.
