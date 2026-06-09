# M Code Syntax Highlighting — Design Spec
**Date:** 2026-06-08
**Scope:** Power Query M Code tab in `PowerBIUrlBuilder`

---

## Goal

Replace the plain monochrome `<pre>` block in the M Code tab with a syntax-highlighted code block that resembles a code editor: keyword coloring, string coloring, function coloring, bracket pair coloring by nesting depth, and a header bar showing the language label and copy button.

---

## What Changes

| File | Change |
|---|---|
| `src/components/CopyButton.tsx` | **New.** Extract existing `CopyButton` component from `PowerBIUrlBuilder.tsx` |
| `src/components/MCodeBlock.tsx` | **New.** Contains `tokenize()` + `MCodeBlock` component; imports `CopyButton` |
| `src/components/PowerBIUrlBuilder.tsx` | Remove inline `CopyButton` definition (now imported); replace M code tab block with `<MCodeBlock code={mCode} />` |
| `src/utils/urlBuilder.ts` | **Untouched** |
| URL tab | **Untouched** |

---

## Tokenizer

`tokenize(code: string): Token[]`

A pure function. Linear scan — tries each regex in priority order, first match wins, advances position. Returns a flat array of tokens.

```ts
type TokenType = 'keyword' | 'named-step' | 'string' | 'function' | 'bracket-open' | 'bracket-close' | 'plain';

interface Token {
  type: TokenType;
  text: string;
  depth?: number; // set for bracket-open and bracket-close
}
```

**Regex priority order:**

1. Named step: `/#"[^"]*"/` — must come before plain string to avoid matching `#` as plain
2. String: `/"[^"]*"/`
3. Keyword: `/\b(let|in)\b/`
4. Function: `/[A-Za-z][A-Za-z0-9]*\.[A-Za-z][A-Za-z0-9]*/` (e.g. `Table.FromRecords`)
5. Open bracket: `/[({[]/` — records current depth, then increments counter
6. Close bracket: `/[)}\]]/` — decrements counter, then records depth
7. Plain: any single character (fallback)

Bracket depth cycles through 3 levels (0, 1, 2+) for color assignment.

---

## Color Scheme

All colors are against `bg-slate-900`. Chosen to match VS Code dark theme conventions so the output feels familiar.

| Token type | Color | Hex |
|---|---|---|
| `keyword` | Blue | `#569CD6` |
| `named-step` | Light blue | `#9CDCFE` |
| `string` | Orange | `#CE9178` |
| `function` | Yellow | `#DCDCAA` |
| `bracket` depth 0 | Gold | `#FFD700` |
| `bracket` depth 1 | Orchid | `#DA70D6` |
| `bracket` depth 2+ | Sky | `#87CEEB` |
| `plain` | Slate | `#D4D4D4` |

---

## Component: `MCodeBlock`

Props: `{ code: string }`

**Visual layout:**
```
┌──────────────────────────────────────────────────┐
│ bg-slate-800  Power Query M        📋 Copy M Code │  ← rounded-t-lg
├──────────────────────────────────────────────────┤
│ bg-slate-900  <pre> with <span> tokens            │  ← rounded-b-lg, overflow-auto
└──────────────────────────────────────────────────┘
```

- Header: `bg-slate-800`, `text-slate-400`, small font. Left: "Power Query M" label. Right: `<CopyButton>` imported from `src/components/CopyButton.tsx`.
- Body: `bg-slate-900 rounded-b-lg p-4 overflow-auto`, `text-xs leading-relaxed`, `whitespace-pre`.
- Each token renders as a `<span style={{ color }}>{text}</span>`. Plain tokens with no special color render without a span (or with the default color).

---

## Bracket Depth Coloring

A depth counter starts at 0. On each open bracket token: assign color for current depth, then increment. On each close bracket: decrement, then assign color for new depth. This ensures matching open/close brackets share the same color.

Depth maps to colors cyclically: `depth % 3` → gold / orchid / sky.

---

## Error Handling

The tokenizer only processes strings we generate from `buildMCode`. No user input goes through it. No error handling needed beyond the fallback plain-character rule that ensures every character is consumed.

---

## Out of Scope

- URL tab syntax highlighting
- Line numbers
- External syntax highlighting libraries
- Editable code block
