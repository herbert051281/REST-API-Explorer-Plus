# CLAUDE.md

## Project: REST API Explorer Plus

A ServiceNow browser bookmarklet and Edge/Chrome extension that generates Power BI-ready REST API URLs and Power Query M code. Built as a self-contained IIFE (`public/bookmarklet.js`) compiled to `public/bookmarklet.min.js` via esbuild, then packaged into `extension/` by `npm run build:extension`.

**Key capabilities:**
- Auto-detects the current ServiceNow page (list, form, or report) and populates fields via `sys_report` API + DOM inspection
- Supports dot-walking through reference fields (e.g. `assigned_to.user_name`, `model.u_forecast_model`)
- Outputs a Power Query M code block ready to paste into Power BI Advanced Editor
- Distributed as a bookmarklet (from `localhost:5175`) or as a Manifest V3 browser extension (`extension.zip`)

**Stack:** Vanilla JS (no framework), Vite dev server for local hosting, esbuild for minification, ServiceNow REST API (`/api/now/table/`), Power Query M.

**Primary user:** Herbert — works with ServiceNow data connected to Power BI reports.

---

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
