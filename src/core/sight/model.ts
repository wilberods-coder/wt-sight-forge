import { DEFAULT_TRACE, type TraceOptions } from '../image/trace';

export type Vec = [number, number];
export type RGBA = [number, number, number, number];
export type ThousandthType = 'ussr' | 'nato' | 'real';

/**
 * Drawing primitive in sight space. All coordinates are in thousandths (mils) with
 * `thousandth:b = yes`; the origin is the aim point and positive y points DOWN
 * (same convention as drawLines in the official wiki example).
 *
 * Lines and quads with `screen: true` are written with `thousandth:b = no` instead: their
 * coordinates are fractions of the screen height (origin at the centre, so the visible
 * height spans -0.5..0.5). That is how WTDraw-made art sights are drawn: they keep their
 * on-screen size at every zoom level.
 */
export type Prim =
  | { kind: 'line'; a: Vec; b: Vec; src: PrimSource; screen?: boolean }
  | { kind: 'quad'; p: [Vec, Vec, Vec, Vec]; src: PrimSource; screen?: boolean }
  | { kind: 'circle'; pos: Vec; diameter: number; size: number; segment: [number, number]; src: PrimSource }
  | { kind: 'text'; text: string; pos: Vec; size: number; align: number; src: PrimSource };

export type PrimSource = 'artwork' | 'element';

export type ArtAnchor = 'screen' | 'mils';
export type ArtPreset = 'topRight' | 'topLeft' | 'bottomRight' | 'bottomLeft' | 'center';

export interface ArtworkSettings {
  enabled: boolean;
  trace: TraceOptions;
  /** "screen": fractions of screen height, fixed on screen; "mils": thousandths, zooms with the sight. */
  anchor: ArtAnchor;
  /** When set, offsets are derived from the artwork bounds so it sits in that corner of the crosshair. */
  preset: ArtPreset | null;
  /** Longest side of the artwork, in screen heights (anchor "screen") or mils (anchor "mils"). Offsets use the same unit. */
  size: number;
  /** Degrees, clockwise on screen. */
  rotation: number;
  offsetX: number;
  offsetY: number;
  flipX: boolean;
  flipY: boolean;
}

export interface CircleItem {
  id: string;
  x: number;
  y: number;
  diameter: number;
  /** Line thickness (game's `size:r`). */
  size: number;
  start: number;
  end: number;
}

export interface LineItem {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ElementsConfig {
  centerDot: { enabled: boolean; diameter: number; shape: 'circle' | 'square' | 'diamond' };
  crosshair: {
    enabled: boolean;
    gap: number;
    length: number;
    style: 'line' | 'bar';
    thickness: number;
    top: boolean;
    bottom: boolean;
    left: boolean;
    right: boolean;
  };
  horizontalLine: { enabled: boolean; gap: number; length: number; tickStep: number; tickSize: number; labels: boolean };
  verticalLine: { enabled: boolean; gap: number; lengthUp: number; lengthDown: number; tickStep: number; tickSize: number };
  rangefinder: {
    enabled: boolean;
    /** Target height in metres used for stadiametric ranging (2.7 m is the classic Soviet value). */
    targetHeight: number;
    distances: number[];
    x: number;
    y: number;
    spacing: number;
    labels: boolean;
  };
  /** Native game ballistic range scale (crosshair_distances). */
  distanceTicks: {
    enabled: boolean;
    maxDistance: number;
    step: number;
    labelEvery: number;
    drawUpward: boolean;
    /** Horizontal position in screen fractions (`distancePos`). */
    posX: number;
    /** Notch length in screen fractions (`crosshairDistHorSizeMain`). */
    tickLength: number;
    /** Muzzle velocity used ONLY for the browser preview approximation. */
    previewSpeed: number;
  };
  circles: { enabled: boolean; items: CircleItem[] };
  customLines: { enabled: boolean; items: LineItem[] };
}

export interface SightGlobals {
  fileName: string;
  /** UserSights sub-folder: "all_tanks" or a vehicle id. */
  folder: string;
  thousandth: ThousandthType;
  color: RGBA;
  lightColor: RGBA;
  lineSizeMult: number;
  fontSizeMult: number;
  drawDistanceCorrection: boolean;
  matchClasses: { exp_tank: boolean; exp_heavy_tank: boolean; exp_tank_destroyer: boolean; exp_SPAA: boolean };
}

export interface ProjectImage {
  dataUrl: string;
  fileName: string;
  width: number;
  height: number;
}

export interface SightProject {
  format: 'wt-sight-forge';
  version: 1;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  image: ProjectImage | null;
  artwork: ArtworkSettings;
  elements: ElementsConfig;
  globals: SightGlobals;
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export const DEFAULT_ARTWORK: ArtworkSettings = {
  enabled: true,
  trace: DEFAULT_TRACE,
  anchor: 'screen',
  preset: 'topRight',
  // Up and to the right of the crosshair — the usual art-sight layout. The visible screen spans
  // -0.5..0.5 vertically, so 0.45 still fits above the horizontal line.
  size: 0.45,
  rotation: 0,
  offsetX: 0.24,
  offsetY: -0.24,
  flipX: false,
  flipY: false,
};

export const DEFAULT_ELEMENTS: ElementsConfig = {
  centerDot: { enabled: true, diameter: 0.8, shape: 'circle' },
  crosshair: { enabled: true, gap: 2, length: 12, style: 'line', thickness: 0.4, top: true, bottom: true, left: true, right: true },
  horizontalLine: { enabled: false, gap: 16, length: 60, tickStep: 4, tickSize: 1.5, labels: true },
  verticalLine: { enabled: false, gap: 16, lengthUp: 40, lengthDown: 40, tickStep: 4, tickSize: 1.5 },
  rangefinder: { enabled: false, targetHeight: 2.7, distances: [200, 400, 600, 800, 1000, 1200, 1600, 2000], x: -40, y: 22, spacing: 5, labels: true },
  distanceTicks: { enabled: false, maxDistance: 2400, step: 200, labelEvery: 400, drawUpward: false, posX: 0.12, tickLength: 0.02, previewSpeed: 1000 },
  circles: { enabled: false, items: [{ id: 'c1', x: 0, y: 0, diameter: 8, size: 1.5, start: 0, end: 360 }] },
  customLines: { enabled: false, items: [{ id: 'l1', x1: -20, y1: 10, x2: 20, y2: 10 }] },
};

export const DEFAULT_GLOBALS: SightGlobals = {
  fileName: 'my_sight',
  folder: 'all_tanks',
  thousandth: 'ussr',
  color: [255, 107, 53, 255],
  lightColor: [255, 30, 30, 255],
  lineSizeMult: 1,
  fontSizeMult: 1,
  drawDistanceCorrection: true,
  matchClasses: { exp_tank: true, exp_heavy_tank: true, exp_tank_destroyer: true, exp_SPAA: true },
};

export function newProject(name = 'my_sight'): SightProject {
  const now = Date.now();
  return {
    format: 'wt-sight-forge',
    version: 1,
    id: uid(),
    name,
    createdAt: now,
    updatedAt: now,
    image: null,
    artwork: structuredClone(DEFAULT_ARTWORK),
    elements: structuredClone(DEFAULT_ELEMENTS),
    globals: { ...structuredClone(DEFAULT_GLOBALS), fileName: name },
  };
}

/** Fill gaps in projects saved by older versions / hand-edited files. */
export function normalizeProject(p: Partial<SightProject>): SightProject {
  const base = newProject();
  return {
    ...base,
    ...p,
    format: 'wt-sight-forge',
    version: 1,
    artwork: { ...base.artwork, ...legacyPlacement(p.artwork), trace: { ...base.artwork.trace, ...p.artwork?.trace } },
    elements: Object.fromEntries(
      Object.entries(base.elements).map(([k, v]) => [k, { ...v, ...(p.elements as Record<string, object> | undefined)?.[k] }]),
    ) as unknown as ElementsConfig,
    globals: { ...base.globals, ...p.globals, matchClasses: { ...base.globals.matchClasses, ...p.globals?.matchClasses } },
  };
}

/**
 * Projects saved before screen anchoring existed were placed in mils. Untouched ones (centred,
 * default size) move to the new default layout; hand-placed ones keep their mils placement.
 */
function legacyPlacement(a: Partial<ArtworkSettings> | undefined): Partial<ArtworkSettings> {
  if (!a || a.anchor) return a ?? {};
  const untouched = !a.offsetX && !a.offsetY && (a.size === undefined || a.size === 40);
  if (untouched) {
    const { trace, enabled, rotation, flipX, flipY } = a;
    return { trace, enabled, rotation, flipX, flipY } as Partial<ArtworkSettings>;
  }
  return { ...a, anchor: 'mils', preset: null };
}

export const MILS_PER_RAD: Record<ThousandthType, number> = {
  ussr: 6000 / (2 * Math.PI),
  nato: 6400 / (2 * Math.PI),
  real: 1000,
};

export const VEHICLE_FOLDER_RE = /^[A-Za-z0-9_]+$/;
export const FILE_NAME_RE = /^[A-Za-z0-9_\-]+$/;
