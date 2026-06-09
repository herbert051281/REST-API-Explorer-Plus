# M Code Syntax Highlighting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain monochrome M code `<pre>` block with a syntax-highlighted code editor-style block that has bracket depth coloring, keyword/string/function colors, and an integrated header bar with language label and copy button.

**Architecture:** A pure `tokenize()` function in `src/utils/mCodeTokenizer.ts` (no React imports) does a linear regex scan over the M code string and returns a flat token array. A `MCodeBlock` React component imports from that utility and maps tokens to colored `<span>` elements. `CopyButton` is extracted to its own file so both `PowerBIUrlBuilder` and `MCodeBlock` can import it without circular dependencies.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest (added for unit-testing the tokenizer)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/utils/mCodeTokenizer.ts` | **Create** | `tokenize()`, `colorForToken()`, `Token` types — pure TS, no React |
| `src/utils/mCodeTokenizer.test.ts` | **Create** | Vitest unit tests for `tokenize()` and `colorForToken()` |
| `src/components/CopyButton.tsx` | **Create** | Extracted CopyButton component |
| `src/components/MCodeBlock.tsx` | **Create** | `MCodeBlock` component — imports tokenizer, renders header + highlighted `<pre>` |
| `src/components/PowerBIUrlBuilder.tsx` | **Modify** | Import CopyButton + MCodeBlock; replace M code tab block |
| `package.json` | **Modify** | Add vitest dev dependency and `test:unit` script |
| `vitest.config.ts` | **Create** | Minimal vitest config (node environment, no jsdom needed) |

---

## Task 1: Install Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install vitest**

```bash
npm install --save-dev vitest
```

Expected: vitest appears in `devDependencies` in `package.json`.

- [ ] **Step 2: Add `test:unit` script to `package.json`**

In `package.json`, add `"test:unit"` alongside the existing `"test"`:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "test": "node tests/bookmarklet-detect.test.mjs",
  "test:unit": "vitest run",
  "preview": "vite preview",
  "build:extension": "node scripts/build-extension.mjs"
},
```

- [ ] **Step 3: Create `vitest.config.ts` at the project root**

The tokenizer is pure TypeScript (no JSX, no DOM), so the node environment is sufficient.

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Verify vitest runs with no errors**

```bash
npm run test:unit
```

Expected output: `No test files found` or `0 tests passed`. No crash.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest for unit testing"
```

---

## Task 2: Extract CopyButton

**Files:**
- Create: `src/components/CopyButton.tsx`
- Modify: `src/components/PowerBIUrlBuilder.tsx`

- [ ] **Step 1: Create `src/components/CopyButton.tsx`**

Copy the `CopyButton` function verbatim from `PowerBIUrlBuilder.tsx` (currently lines 14–50):

```tsx
import { useState } from 'react';

export default function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded border transition-colors ${
        copied
          ? 'bg-green-50 border-green-300 text-green-700'
          : 'bg-white border-slate-300 text-slate-600 hover:border-[#1d3c4b] hover:text-[#1d3c4b]'
      }`}
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Update `PowerBIUrlBuilder.tsx` — remove inline definition, add import**

Delete the entire `CopyButton` function body from `PowerBIUrlBuilder.tsx` (lines 14–50 inclusive). Replace the import block at the top with:

```tsx
import { useState } from 'react';
import type { Connection, SysDbObject, SysDictField } from '../types/servicenow';
import { buildApiUrl, buildMCode } from '../utils/urlBuilder';
import CopyButton from './CopyButton';
```

Everything else in the file stays identical.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run dev server and confirm URL tab copy button still works**

```bash
npm run dev
```

Open the app, load a table, open the URL Builder, click "Copy URL". Confirm the button shows "Copied!" briefly. The M code tab should still show the plain code block unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/components/CopyButton.tsx src/components/PowerBIUrlBuilder.tsx
git commit -m "refactor: extract CopyButton to its own file"
```

---

## Task 3: Write Failing Tokenizer Tests

**Files:**
- Create: `src/utils/mCodeTokenizer.test.ts`

- [ ] **Step 1: Create `src/utils/mCodeTokenizer.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { tokenize, colorForToken } from './mCodeTokenizer';

describe('tokenize', () => {
  it('consumes every character — no gaps, no duplicates', () => {
    const code = 'let\n    x = "hello"\nin\n    x';
    const tokens = tokenize(code);
    expect(tokens.map((t) => t.text).join('')).toBe(code);
  });

  it('identifies let and in as keywords', () => {
    const tokens = tokenize('let\nin');
    const keywords = tokens.filter((t) => t.type === 'keyword').map((t) => t.text);
    expect(keywords).toEqual(['let', 'in']);
  });

  it('does not flag partial words "inside" or "inlet" as keyword', () => {
    const tokens = tokenize('inside inlet');
    expect(tokens.every((t) => t.type !== 'keyword')).toBe(true);
  });

  it('identifies named steps with #" prefix', () => {
    const tokens = tokenize('#"Converted to Table"');
    expect(tokens[0]).toMatchObject({ type: 'named-step', text: '#"Converted to Table"' });
    expect(tokens).toHaveLength(1);
  });

  it('identifies plain strings (double-quoted, no # prefix)', () => {
    const tokens = tokenize('"result"');
    expect(tokens[0]).toMatchObject({ type: 'string', text: '"result"' });
  });

  it('identifies functions with dot notation', () => {
    const tokens = tokenize('Table.FromRecords');
    expect(tokens[0]).toMatchObject({ type: 'function', text: 'Table.FromRecords' });
  });

  it('assigns depth 0 to the outermost open bracket', () => {
    const tokens = tokenize('(');
    expect(tokens[0]).toMatchObject({ type: 'bracket-open', text: '(', depth: 0 });
  });

  it('increments depth for nested open brackets', () => {
    const tokens = tokenize('({');
    const opens = tokens.filter((t) => t.type === 'bracket-open');
    expect(opens[0].depth).toBe(0);
    expect(opens[1].depth).toBe(1);
  });

  it('assigns the post-decrement depth to close brackets so pairs share a color', () => {
    // open '(' at depth 0 → depth becomes 1
    // open '{' at depth 1 → depth becomes 2
    // close '}' → depth becomes 1, assigned depth 1
    // close ')' → depth becomes 0, assigned depth 0
    const tokens = tokenize('({})');
    const closes = tokens.filter((t) => t.type === 'bracket-close');
    expect(closes[0].depth).toBe(1);
    expect(closes[1].depth).toBe(0);
  });

  it('never lets depth go below 0 on unmatched close brackets', () => {
    const tokens = tokenize(')');
    expect(tokens[0]).toMatchObject({ type: 'bracket-close', depth: 0 });
  });
});

describe('colorForToken', () => {
  it('returns keyword color for keyword tokens', () => {
    expect(colorForToken({ type: 'keyword', text: 'let' })).toBe('#569CD6');
  });

  it('returns named-step color for named-step tokens', () => {
    expect(colorForToken({ type: 'named-step', text: '#"x"' })).toBe('#9CDCFE');
  });

  it('returns string color for string tokens', () => {
    expect(colorForToken({ type: 'string', text: '"x"' })).toBe('#CE9178');
  });

  it('returns function color for function tokens', () => {
    expect(colorForToken({ type: 'function', text: 'Table.X' })).toBe('#DCDCAA');
  });

  it('cycles bracket colors by depth: 0→gold, 1→orchid, 2→sky, 3→gold again', () => {
    expect(colorForToken({ type: 'bracket-open', text: '(', depth: 0 })).toBe('#FFD700');
    expect(colorForToken({ type: 'bracket-open', text: '(', depth: 1 })).toBe('#DA70D6');
    expect(colorForToken({ type: 'bracket-open', text: '(', depth: 2 })).toBe('#87CEEB');
    expect(colorForToken({ type: 'bracket-open', text: '(', depth: 3 })).toBe('#FFD700');
  });

  it('returns plain color for plain tokens', () => {
    expect(colorForToken({ type: 'plain', text: '=' })).toBe('#D4D4D4');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail (module not yet created)**

```bash
npm run test:unit
```

Expected: import error — `Cannot find module './mCodeTokenizer'`. All tests fail.

---

## Task 4: Implement the Tokenizer

**Files:**
- Create: `src/utils/mCodeTokenizer.ts`

- [ ] **Step 1: Create `src/utils/mCodeTokenizer.ts`**

```ts
export type TokenType =
  | 'keyword'
  | 'named-step'
  | 'string'
  | 'function'
  | 'bracket-open'
  | 'bracket-close'
  | 'plain';

export interface Token {
  type: TokenType;
  text: string;
  depth?: number;
}

const BRACKET_COLORS = ['#FFD700', '#DA70D6', '#87CEEB'] as const;

const TOKEN_COLORS: Record<TokenType, string> = {
  'keyword':       '#569CD6',
  'named-step':    '#9CDCFE',
  'string':        '#CE9178',
  'function':      '#DCDCAA',
  'bracket-open':  '',
  'bracket-close': '',
  'plain':         '#D4D4D4',
};

const RULES: Array<[TokenType, RegExp]> = [
  ['named-step',    /^#"[^"]*"/],
  ['string',        /^"[^"]*"/],
  ['keyword',       /^(?:let|in)(?![A-Za-z0-9_])/],
  ['function',      /^[A-Za-z][A-Za-z0-9]*\.[A-Za-z][A-Za-z0-9]*/],
  ['bracket-open',  /^[({[]/],
  ['bracket-close', /^[)}\]]/],
  ['plain',         /^[\s\S]/],
];

export function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  let depth = 0;

  while (pos < code.length) {
    const slice = code.slice(pos);

    for (const [type, regex] of RULES) {
      const m = regex.exec(slice);
      if (!m) continue;

      if (type === 'bracket-open') {
        tokens.push({ type, text: m[0], depth });
        depth++;
      } else if (type === 'bracket-close') {
        depth = Math.max(0, depth - 1);
        tokens.push({ type, text: m[0], depth });
      } else {
        tokens.push({ type, text: m[0] });
      }

      pos += m[0].length;
      break;
    }
  }

  return tokens;
}

export function colorForToken(token: Token): string {
  if (token.type === 'bracket-open' || token.type === 'bracket-close') {
    return BRACKET_COLORS[(token.depth ?? 0) % 3];
  }
  return TOKEN_COLORS[token.type];
}
```

- [ ] **Step 2: Run tests**

```bash
npm run test:unit
```

Expected: all tests pass, output similar to:

```
✓ src/utils/mCodeTokenizer.test.ts (12)
Test Files  1 passed (1)
Tests       12 passed (12)
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/utils/mCodeTokenizer.ts src/utils/mCodeTokenizer.test.ts
git commit -m "feat: implement M code tokenizer with bracket depth coloring"
```

---

## Task 5: Build the MCodeBlock Component

**Files:**
- Create: `src/components/MCodeBlock.tsx`

- [ ] **Step 1: Create `src/components/MCodeBlock.tsx`**

```tsx
import { tokenize, colorForToken } from '../utils/mCodeTokenizer';
import CopyButton from './CopyButton';

export default function MCodeBlock({ code }: { code: string }) {
  const tokens = tokenize(code);

  return (
    <div className="h-full flex flex-col rounded-lg overflow-hidden border border-slate-700">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 shrink-0">
        <span className="text-xs text-slate-400 font-mono">Power Query M</span>
        <CopyButton text={code} label="Copy M Code" />
      </div>
      <div className="flex-1 bg-slate-900 overflow-auto p-4">
        <pre className="text-xs leading-relaxed font-mono whitespace-pre">
          {tokens.map((token, i) => (
            <span key={i} style={{ color: colorForToken(token) }}>
              {token.text}
            </span>
          ))}
        </pre>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run unit tests to confirm tokenizer still passes**

```bash
npm run test:unit
```

Expected: all 12 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/MCodeBlock.tsx
git commit -m "feat: build MCodeBlock component with syntax-highlighted code block"
```

---

## Task 6: Wire MCodeBlock into PowerBIUrlBuilder

**Files:**
- Modify: `src/components/PowerBIUrlBuilder.tsx`

- [ ] **Step 1: Add MCodeBlock import**

In `PowerBIUrlBuilder.tsx`, update the import block at the top to include `MCodeBlock`:

```tsx
import { useState } from 'react';
import type { Connection, SysDbObject, SysDictField } from '../types/servicenow';
import { buildApiUrl, buildMCode } from '../utils/urlBuilder';
import CopyButton from './CopyButton';
import MCodeBlock from './MCodeBlock';
```

- [ ] **Step 2: Replace the M code tab content block**

Find and replace the `{activeTab === 'mcode' && ( ... )}` block.

**Before** (current lines 173–190):
```tsx
{activeTab === 'mcode' && (
  <>
    <div className="flex items-center justify-between mb-2">
      <p className="text-xs text-slate-500">
        In Power BI Desktop: <strong>Home → Transform Data → New Source → Blank Query → Advanced Editor</strong>
      </p>
      <CopyButton text={mCode} label="Copy M Code" />
    </div>
    <div className="flex-1 bg-slate-900 rounded-lg p-4 overflow-auto scrollbar-thin">
      <pre className="code-block text-slate-200 text-xs leading-relaxed">{mCode}</pre>
    </div>
    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
      <strong>Authentication note:</strong> Power BI will prompt for credentials when you first run this query.
      Choose <strong>Basic</strong> and enter your ServiceNow username and password.
      The M code does not hard-code credentials.
    </div>
  </>
)}
```

**After:**
```tsx
{activeTab === 'mcode' && (
  <>
    <p className="text-xs text-slate-500 mb-2">
      In Power BI Desktop: <strong>Home → Transform Data → New Source → Blank Query → Advanced Editor</strong>
    </p>
    <div className="flex-1 min-h-0">
      <MCodeBlock code={mCode} />
    </div>
    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
      <strong>Authentication note:</strong> Power BI will prompt for credentials when you first run this query.
      Choose <strong>Basic</strong> and enter your ServiceNow username and password.
      The M code does not hard-code credentials.
    </div>
  </>
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run dev server and visually verify**

```bash
npm run dev
```

Open the app. Connect to ServiceNow (or use a cached connection). Select a table and at least 3 fields. Open the URL Builder → Power Query M Code tab.

Verify all of the following:

| Check | Expected |
|---|---|
| Header bar left | "Power Query M" in slate-400 font |
| Header bar right | "Copy M Code" button |
| `let` keyword | Blue `#569CD6` |
| `in` keyword | Blue `#569CD6` |
| `#"Converted to Table"` etc. | Light blue `#9CDCFE` |
| `"result"`, field name strings | Orange `#CE9178` |
| `Table.FromRecords`, `Json.Document` | Yellow `#DCDCAA` |
| Outermost `(` `)` | Gold `#FFD700` |
| First nested `{` `}` | Orchid `#DA70D6` |
| Copy button | Copies plain M code (no HTML) to clipboard |
| URL tab | Unchanged — copy button still works |
| Auth note | Still visible below the code block |

- [ ] **Step 5: Commit**

```bash
git add src/components/PowerBIUrlBuilder.tsx
git commit -m "feat: wire MCodeBlock into PowerBIUrlBuilder M code tab"
```
