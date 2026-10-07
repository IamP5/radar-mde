/**
 * Column-keyed transport for arrays of plain objects handed from a Server Component to a Client Component.
 * The RSC payload (inlined in the HTML) otherwise repeats every key for every municipality; this keeps the
 * keys once and works for any row shape, so fields added to `Row` later travel without changes here.
 */
export type Columns<T> = { k: (keyof T & string)[]; v: unknown[][] };

export function toColumns<T extends object>(rows: T[]): Columns<T> {
  const keys = new Set<keyof T & string>();
  for (const r of rows) for (const k of Object.keys(r)) keys.add(k as keyof T & string);
  const k = [...keys];
  return { k, v: rows.map((r) => k.map((key) => (r as Record<string, unknown>)[key])) };
}

export function fromColumns<T>({ k, v }: Columns<T>): T[] {
  return v.map((vals) => {
    const o: Record<string, unknown> = {};
    k.forEach((key, i) => {
      if (vals[i] !== undefined) o[key] = vals[i];
    });
    return o as T;
  });
}
