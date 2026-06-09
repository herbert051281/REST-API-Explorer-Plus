# Graph Report - .  (2026-06-08)

## Corpus Check
- Corpus is ~17,370 words - fits in a single context window. You may not need a graph.

## Summary
- 385 nodes · 662 edges · 33 communities (20 shown, 13 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 31 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Bookmarklet UI Engine|Bookmarklet UI Engine]]
- [[_COMMUNITY_React App Components|React App Components]]
- [[_COMMUNITY_Extension Minified Build|Extension Minified Build]]
- [[_COMMUNITY_Public Minified Build|Public Minified Build]]
- [[_COMMUNITY_Bookmarklet API Functions|Bookmarklet API Functions]]
- [[_COMMUNITY_Project Dependencies|Project Dependencies]]
- [[_COMMUNITY_Build System & Docs|Build System & Docs]]
- [[_COMMUNITY_App TypeScript Config|App TypeScript Config]]
- [[_COMMUNITY_Node TypeScript Config|Node TypeScript Config]]
- [[_COMMUNITY_Extension Manifest|Extension Manifest]]
- [[_COMMUNITY_Extension Build Script|Extension Build Script]]
- [[_COMMUNITY_UI Icon Sprite Sheet|UI Icon Sprite Sheet]]
- [[_COMMUNITY_Extension Icon Design|Extension Icon Design]]
- [[_COMMUNITY_Hero Branding Assets|Hero Branding Assets]]
- [[_COMMUNITY_Framework Brand Assets|Framework Brand Assets]]
- [[_COMMUNITY_Dev Tool Settings|Dev Tool Settings]]
- [[_COMMUNITY_TypeScript Project Refs|TypeScript Project Refs]]
- [[_COMMUNITY_Bookmarklet Tests|Bookmarklet Tests]]
- [[_COMMUNITY_Screenshot Utility|Screenshot Utility]]
- [[_COMMUNITY_ESLint Rules|ESLint Rules]]
- [[_COMMUNITY_PostCSS Setup|PostCSS Setup]]
- [[_COMMUNITY_Claude Dev Config|Claude Dev Config]]
- [[_COMMUNITY_Field Drill Navigation|Field Drill Navigation]]
- [[_COMMUNITY_URL Normalization|URL Normalization]]
- [[_COMMUNITY_API Response Type|API Response Type]]
- [[_COMMUNITY_Connection Status Type|Connection Status Type]]
- [[_COMMUNITY_URL Builder Options|URL Builder Options]]
- [[_COMMUNITY_README Docs|README Docs]]

## God Nodes (most connected - your core abstractions)
1. `fullRender()` - 25 edges
2. `m()` - 20 edges
3. `m()` - 20 edges
4. `compilerOptions` - 17 edges
5. `compilerOptions` - 16 edges
6. `repaintFieldList()` - 12 edges
7. `bulkAddFields()` - 11 edges
8. `SysDbObject` - 11 edges
9. `Be()` - 10 edges
10. `X()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `index.html (SPA entry point)` --references--> `FieldExplorer (React component)`  [INFERRED]
  index.html → src/components/FieldExplorer.tsx
- `buildMCode (util)` --implements--> `sysparm_display_value difference between URL and M code outputs`  [INFERRED]
  src/utils/urlBuilder.ts → MEMORY.md
- `loadTables (bookmarklet)` --semantically_similar_to--> `fetchTables (hook)`  [INFERRED] [semantically similar]
  public/bookmarklet.js → src/hooks/useServiceNow.ts
- `fetchLevelFields (bookmarklet)` --semantically_similar_to--> `fetchFields (hook)`  [INFERRED] [semantically similar]
  public/bookmarklet.js → src/hooks/useServiceNow.ts
- `drillInto (bookmarklet dot-walk drill)` --implements--> `Dot-walking through reference fields design`  [INFERRED]
  public/bookmarklet.js → CLAUDE.md

## Hyperedges (group relationships)
- **Extension Build Pipeline** — public_bookmarklet_js, build_extension_script, public_bookmarklet_min, extension_manifest, extension_background [EXTRACTED 1.00]
- **React Application Shell** — src_main, src_app, component_connectionpanel, component_bookmarkletpage [EXTRACTED 1.00]
- **TypeScript Composite Config** — tsconfig_root, tsconfig_app, tsconfig_node [EXTRACTED 1.00]
- **ServiceNow Dev Proxy Architecture** — vite_config, vite_config_snowproxy, hooks_useservicenow, rationale_snow_proxy [INFERRED 0.85]
- **Bookmarklet API fetch pipeline (snowFetch → level fields → detection → render)** — bookmarklet_snowfetch, bookmarklet_fetchlevelfields, bookmarklet_rundetection, bookmarklet_finishdetection, bookmarklet_selectbasetable, bookmarklet_fullrender [EXTRACTED 0.95]
- **React component data flow (hook → types → components)** — useservicenow_fetchtables, useservicenow_fetchfields, types_sysdbobject, types_sysdictfield, tablebrowser_component, fieldexplorer_component, powerbiurlbuilder_component [EXTRACTED 0.95]
- **Output generation (URL + M code) in both bookmarklet and React app** — bookmarklet_buildurl, bookmarklet_buildmcode, urlbuilder_buildapiurl, urlbuilder_buildmcode, powerbiurlbuilder_component [INFERRED 0.95]
- **Dot-walk reference field traversal system** — bookmarklet_drillinto, bookmarklet_drillback, bookmarklet_resolveDotWalk, bookmarklet_fetchlevelfields, rationale_dotwalking [EXTRACTED 0.95]

## Communities (33 total, 13 thin omitted)

### Community 0 - "Bookmarklet UI Engine"
Cohesion: 0.11
Nodes (50): addToQuery(), badgeCls(), buildMCode(), buildUrl(), bulkAddFields(), currentLabelPrefix(), currentLevelFields, currentPathPrefix() (+42 more)

### Community 1 - "React App Components"
Cohesion: 0.11
Nodes (26): Props, Props, FieldState, Props, TYPE_COLORS, PowerBIUrlBuilder(), Props, Tab (+18 more)

### Community 2 - "Extension Minified Build"
Cohesion: 0.12
Nodes (41): $(), ae(), B, Be(), Ce(), D(), de(), ee (+33 more)

### Community 3 - "Public Minified Build"
Cohesion: 0.13
Nodes (40): ae(), B, Be(), Ce(), D(), de(), ee, f (+32 more)

### Community 4 - "Bookmarklet API Functions"
Cohesion: 0.08
Nodes (40): buildMCode (bookmarklet Power Query M builder), buildUrl (bookmarklet REST URL builder), bulkAddFields (bookmarklet), drillInto (bookmarklet dot-walk drill), extractReportId (bookmarklet), extractTableFromUrl (bookmarklet), fetchLevelFields (bookmarklet), finishDetection (bookmarklet) (+32 more)

### Community 5 - "Project Dependencies"
Cohesion: 0.06
Nodes (32): dependencies, axios, react, react-dom, devDependencies, autoprefixer, eslint, @eslint/js (+24 more)

### Community 6 - "Build System & Docs"
Cohesion: 0.08
Nodes (23): Bookmarklet IIFE (self-contained panel), glyphOverlay (icon glyph renderer), makePNG (icon generator), Build Extension Script, CLAUDE.md (project instructions), BookmarkletPage Component, ConnectionPanel Component, Extension Background Service Worker (+15 more)

### Community 7 - "App TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+10 more)

### Community 8 - "Node TypeScript Config"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+9 more)

### Community 9 - "Extension Manifest"
Cohesion: 0.14
Nodes (13): action, default_icon, default_title, background, service_worker, 128, 16, 48 (+5 more)

### Community 10 - "Extension Build Script"
Cohesion: 0.24
Nodes (9): crc32(), crcTable, makePNG(), pngChunk(), root, TEAL, u32(), WHITE (+1 more)

### Community 11 - "UI Icon Sprite Sheet"
Cohesion: 0.43
Nodes (7): Bluesky Social Icon, Discord Icon, Documentation Icon, GitHub Icon, Social / User Profile Icon, Icons SVG Sprite Sheet, X (Twitter) Icon

### Community 12 - "Extension Icon Design"
Cohesion: 0.90
Nodes (5): Browser Extension, List View / Table Data Icon, Extension Icon 128px, Extension Icon 16px, Extension Icon 48px

### Community 13 - "Hero Branding Assets"
Cohesion: 0.67
Nodes (4): Branding Asset, Hero Image, Layered Isometric Design, Purple Accent Color

### Community 14 - "Framework Brand Assets"
Cohesion: 0.67
Nodes (3): React Logo (Atom/Orbital Rings), Vite Logo (Lightning Bolt with Parentheses), App Favicon (Lightning Bolt Icon)

## Ambiguous Edges - Review These
- `Extension Icon 16px` → `List View / Table Data Icon`  [AMBIGUOUS]
  extension/icons/icon16.png · relation: conceptually_related_to

## Knowledge Gaps
- **138 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+133 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Extension Icon 16px` and `List View / Table Data Icon`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `Build Extension Script` connect `Build System & Docs` to `Bookmarklet UI Engine`, `Project Dependencies`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Why does `$()` connect `Build System & Docs` to `Public Minified Build`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _142 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Bookmarklet UI Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.10666666666666667 - nodes in this community are weakly interconnected._
- **Should `React App Components` be split into smaller, more focused modules?**
  _Cohesion score 0.10631229235880399 - nodes in this community are weakly interconnected._
- **Should `Extension Minified Build` be split into smaller, more focused modules?**
  _Cohesion score 0.12427409988385599 - nodes in this community are weakly interconnected._