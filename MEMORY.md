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
