/**
 * from https://github.com/sindresorhus/escape-string-regexp/blob/ba9a4473850cb367936417e97f1f2191b7cc67dd/index.js
 */

export function escapeStringRegexp(string: string): string {
  // Escape characters with special meaning either inside or outside character sets.
  // Use a simple backslash escape when it’s always valid, and a `\xnn` escape when the simpler form would be disallowed by Unicode patterns’ stricter grammar.
  return string.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d')
}
