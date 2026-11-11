/** Tiny single-pass Python tokenizer for read-only syntax highlighting. */

export type TokenKind = 'keyword' | 'builtin' | 'string' | 'number' | 'comment' | 'operator' | 'plain';
export interface Token {
  text: string;
  kind: TokenKind;
}

const KEYWORDS = new Set([
  'False', 'None', 'True', 'and', 'as', 'assert', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else',
  'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or',
  'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
]);
const BUILTINS = new Set([
  'print', 'len', 'range', 'int', 'str', 'float', 'bool', 'list', 'dict', 'set', 'tuple', 'sum', 'min', 'max',
  'round', 'type', 'isinstance', 'sorted', 'enumerate', 'zip', 'abs', 'input',
]);

const RE = /(#[^\n]*)|([rRbBfF]{0,2}"(?:[^"\\\n]|\\.)*"?|[rRbBfF]{0,2}'(?:[^'\\\n]|\\.)*'?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)|([+\-*/%=<>!&|^~:]+)|(\s+|.)/g;

export function tokenize(line: string): Token[] {
  const out: Token[] = [];
  for (const m of line.matchAll(RE)) {
    const [text, comment, str, num, ident, op] = m;
    let kind: TokenKind = 'plain';
    if (comment) kind = 'comment';
    else if (str) kind = 'string';
    else if (num) kind = 'number';
    else if (ident) kind = KEYWORDS.has(ident) ? 'keyword' : BUILTINS.has(ident) ? 'builtin' : 'plain';
    else if (op) kind = 'operator';
    const last = out[out.length - 1];
    if (last && last.kind === kind && kind === 'plain') last.text += text;
    else out.push({ text, kind });
  }
  return out;
}
