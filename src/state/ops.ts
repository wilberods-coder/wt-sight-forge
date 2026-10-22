import type { TraceOptions } from '../core/image/trace';
import type { ArtworkSettings, ElementsConfig, SightGlobals, SightProject } from '../core/sight/model';

export type SetProject = (fn: (p: SightProject) => SightProject) => void;

const touch = (p: SightProject): SightProject => ({ ...p, updatedAt: Date.now() });

export const ops = (set: SetProject) => ({
  artwork: (patch: Partial<ArtworkSettings>) => set((p) => touch({ ...p, artwork: { ...p.artwork, ...patch } })),
  trace: (patch: Partial<TraceOptions>) => set((p) => touch({ ...p, artwork: { ...p.artwork, trace: { ...p.artwork.trace, ...patch } } })),
  element: <K extends keyof ElementsConfig>(key: K, patch: Partial<ElementsConfig[K]>) =>
    set((p) => touch({ ...p, elements: { ...p.elements, [key]: { ...p.elements[key], ...patch } } })),
  globals: (patch: Partial<SightGlobals>) => set((p) => touch({ ...p, globals: { ...p.globals, ...patch } })),
});

export type Ops = ReturnType<typeof ops>;
