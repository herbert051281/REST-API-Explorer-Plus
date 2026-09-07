# REST API Explorer Plus

**Turns the ServiceNow REST API into Power BI-ready queries — without the sys_ids.**

ServiceNow's own REST API Explorer answers in machine language: tables come back as
`cmn_department`, reference fields come back as 32-character `sys_id` values. If you're
building a Power BI model on top of that, you spend the first hour translating before you
can write a single query.

This tool does the translation. Browse tables by their display label, map technical field
names to the labels users recognize, and generate the URL — or the Power Query M code —
with `sysparm_display_value=all` already configured.

![license](https://img.shields.io/badge/license-MIT-blue?style=flat-square)
![react](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black)
![typescript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![powerbi](https://img.shields.io/badge/Power%20BI-F2C811?style=flat-square&logo=powerbi&logoColor=black)

---

## What it does

- **Browse tables by display label** — reads `sys_db_object`, shows you human names
- **Explore fields** — reads `sys_dictionary`, maps technical name → label → type
- **Generate the query** — outputs a ready REST URL *and* a Power Query M snippet,
  with display-value parameters pre-set
- **Copy and go** — paste straight into Power BI Desktop

---

## How it works

```
ConnectionPanel ──► fetchTables (sys_db_object)
                        │
                        ▼
                  TableBrowser ──► fetchFields (sys_dictionary)
                                        │
                                        ▼
                                  FieldExplorer
                                        │
                                        ▼
                                PowerBIUrlBuilder ──► REST URL │ Power Query M
```

**Stack** — React 18 · TypeScript · Vite · Tailwind CSS · Axios · Vitest

---

## Running it

```bash
git clone https://github.com/herbert051281/REST-API-Explorer-Plus.git
cd REST-API-Explorer-Plus
npm install
npm run dev     # http://localhost:5173
```

A browser extension build lives in `extension/` — load it unpacked via
`chrome://extensions` → Developer mode → Load unpacked.

> **On CORS:** a browser can't call a ServiceNow instance directly from localhost.
> That's fine for the intended use — Power BI Desktop isn't a browser and has no CORS
> restriction, so the generated M code runs without issue. The extension build exists
> for the cases where you do want to explore live from the browser.

---

## Why I built it

I build reporting layers over enterprise systems. ServiceNow is one of the systems where
the gap between "the API returns data" and "the model is usable" is widest, and it's a gap
you cross by hand every single time. This closes it once.

---

## License

MIT
