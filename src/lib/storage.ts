import { normalizeProject, type SightProject } from '../core/sight/model';

/** Minimal IndexedDB key-value store: projects can hold images, which are too big for localStorage. */
const DB_NAME = 'wt-sight-forge';
const STORE = 'projects';
const DRAFT_KEY = '__draft__';

export interface StoredProject {
  project: SightProject;
  thumbnail?: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (!dbPromise)
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const t = d.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function listProjects(): Promise<StoredProject[]> {
  const keys = await tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys());
  const values = await tx<StoredProject[]>('readonly', (s) => s.getAll());
  return values
    .filter((_, i) => keys[i] !== DRAFT_KEY)
    .map((v) => ({ ...v, project: normalizeProject(v.project) }))
    .sort((a, b) => b.project.updatedAt - a.project.updatedAt);
}

export const saveProject = (sp: StoredProject) => tx('readwrite', (s) => s.put(sp, sp.project.id));
export const deleteProject = (id: string) => tx('readwrite', (s) => s.delete(id));

export async function loadDraft(): Promise<SightProject | null> {
  try {
    const v = await tx<StoredProject | undefined>('readonly', (s) => s.get(DRAFT_KEY));
    return v ? normalizeProject(v.project) : null;
  } catch {
    return null;
  }
}

export async function saveDraft(project: SightProject) {
  try {
    await tx('readwrite', (s) => s.put({ project }, DRAFT_KEY));
  } catch {
    /* private mode etc. — the draft is a convenience only */
  }
}

/** Parse a project file exported by "Project file". Throws on anything else. */
export function parseProjectFile(text: string): SightProject {
  const data = JSON.parse(text);
  if (!data || data.format !== 'wt-sight-forge') throw new Error('not a project');
  return normalizeProject(data);
}
