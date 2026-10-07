/**
 * Column-keyed transport for arrays of plain objects handed from a Server Component to a Client Component.
 * The RSC payload (inlined in the HTML) otherwise repeats every key for every municipality; this keeps the
 * keys once and works for any row shape, so fields added to `Row` later travel without changes here.
 */
export type Columns<T> = { k: (keyof T & string)[]; v: unknown[][] };

/** boolean[] (e.g. `nd`, one flag per year) travels as "~<bitmask>[:<length>]" instead of "[false,false,…]". */
const isBools = (v: unknown): v is boolean[] => Array.isArray(v) && v.length > 0 && v.length <= 30 && v.every((x) => typeof x === "boolean");
const packBools = (v: boolean[]) => `~${v.reduce((m, b, i) => (b ? m | (1 << i) : m), 0)}:${v.length}`;
const unpackBools = (s: string) => {
  const [m, n] = s.slice(1).split(":").map(Number);
  return Array.from({ length: n }, (_, i) => (m & (1 << i)) !== 0);
};

export function toColumns<T extends object>(rows: T[]): Columns<T> {
  const keys = new Set<keyof T & string>();
  for (const r of rows) for (const k of Object.keys(r)) keys.add(k as keyof T & string);
  const k = [...keys];
  return { k, v: rows.map((r) => k.map((key) => { const x = (r as Record<string, unknown>)[key]; return isBools(x) ? packBools(x) : x; })) };
}

export function fromColumns<T>({ k, v }: Columns<T>): T[] {
  return v.map((vals) => {
    const o: Record<string, unknown> = {};
    k.forEach((key, i) => {
      const x = vals[i];
      if (x !== undefined) o[key] = typeof x === "string" && /^~\d+:\d+$/.test(x) ? unpackBools(x) : x;
    });
    return o as T;
  });
}
