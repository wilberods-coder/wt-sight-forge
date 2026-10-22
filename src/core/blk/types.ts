/**
 * Data model of the War Thunder DataBlock (.blk) text format as used by user sights.
 *
 * Syntax (official wiki, "User-made sighting reticles"):
 *   block_name { param_name:type = value  ... }
 * Types: t (quoted text), r (real), i (integer), b (yes/no, on/off, true/false, 1/0),
 *        c (color: r, g, b, a), p2 / p3 / p4 (2, 3 or 4 reals).
 */

export type BlkType = 't' | 'r' | 'i' | 'b' | 'c' | 'p2' | 'p3' | 'p4';

export type BlkValue =
  | { type: 't'; value: string }
  | { type: 'r'; value: number }
  | { type: 'i'; value: number }
  | { type: 'b'; value: boolean }
  | { type: 'c'; value: [number, number, number, number] }
  | { type: 'p2'; value: [number, number] }
  | { type: 'p3'; value: [number, number, number] }
  | { type: 'p4'; value: [number, number, number, number] };

export interface BlkParam {
  kind: 'param';
  name: string;
  value: BlkValue;
  comment?: string;
}

export interface BlkBlock {
  kind: 'block';
  name: string;
  children: BlkNode[];
  /** Write the whole block on one line: `line { line:p4 = 0, 0, 1, 1; move:b = no; }` */
  inline?: boolean;
  comment?: string;
}

export interface BlkComment {
  kind: 'comment';
  text: string;
}

export type BlkNode = BlkParam | BlkBlock | BlkComment;

/** Root of a file: parameters and blocks written at top level. */
export interface BlkDocument {
  children: BlkNode[];
}

export const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const param = (name: string, value: BlkValue, comment?: string): BlkParam => ({
  kind: 'param',
  name,
  value,
  comment,
});

export const block = (name: string, children: BlkNode[], opts: { inline?: boolean; comment?: string } = {}): BlkBlock => ({
  kind: 'block',
  name,
  children,
  ...opts,
});

export const comment = (text: string): BlkComment => ({ kind: 'comment', text });

export const T = (value: string): BlkValue => ({ type: 't', value });
export const R = (value: number): BlkValue => ({ type: 'r', value });
export const I = (value: number): BlkValue => ({ type: 'i', value });
export const B = (value: boolean): BlkValue => ({ type: 'b', value });
export const C = (r: number, g: number, b: number, a: number): BlkValue => ({ type: 'c', value: [r, g, b, a] });
export const P2 = (x: number, y: number): BlkValue => ({ type: 'p2', value: [x, y] });
export const P3 = (x: number, y: number, z: number): BlkValue => ({ type: 'p3', value: [x, y, z] });
export const P4 = (x: number, y: number, z: number, w: number): BlkValue => ({ type: 'p4', value: [x, y, z, w] });
