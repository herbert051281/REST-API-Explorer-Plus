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
