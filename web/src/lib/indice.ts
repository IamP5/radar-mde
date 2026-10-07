/** Client: the light municipality index (/data/indice.json, ~80 KB gzipped), shared by search and maps. */
export type IndexEntry = { id: number; name: string; uf: string; slug: string; pop: number };
type Raw = [id: number, name: string, uf: string, slug: string, pop: number];

let promise: Promise<IndexEntry[]> | null = null;
export function loadIndex(): Promise<IndexEntry[]> {
  promise ??= fetch("/data/indice.json")
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<Raw[]>;
    })
    .then((rows) => rows.map(([id, name, uf, slug, pop]) => ({ id, name, uf, slug, pop })))
    .catch((e: unknown) => {
      promise = null; // allow retry
      throw e;
    });
  return promise;
}
