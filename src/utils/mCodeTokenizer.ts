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
    let matched = false;

    for (const [type, regex] of RULES) {
      const m = regex.exec(slice);
      if (!m) continue;

      // Skip keyword match if preceded by a word character
      if (type === 'keyword' && pos > 0 && /[A-Za-z0-9_]/.test(code[pos - 1])) {
        continue;
      }

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
      matched = true;
      break;
    }

    if (!matched) {
      pos++;
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
