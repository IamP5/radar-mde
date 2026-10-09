"use client";

/**
 * Brazil geometry in a fixed base space (Mercator fitted into BASE × BASE), computed once. The map camera maps base
 * coordinates to the screen, so resizing the window never re-projects the 5,570 municipalities.
 */
import { geoMercator, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry, MultiLineString } from "geojson";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";

export const BASE = 1000;

export type Bbox = [number, number, number, number];
export type Shape = { id: number; d: string; bbox: Bbox; cx: number; cy: number };
export type BrGeo = {
  mun: Shape[];
  uf: Shape[];
  /** inner borders between states */
  ufBorders: string;
  /** country outline */
  outline: string;
  /** bbox of the whole country */
  bbox: Bbox;
  munHtml: string;
  ufHtml: string;
};

export const ufOfMun = (id: number) => Math.floor(id / 100000);

let promise: Promise<BrGeo> | null = null;
export function loadBrGeo(): Promise<BrGeo> {
  promise ??= fetch("/geo/br.topo.json")
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<Topology>;
    })
    .then(build)
    .catch((e) => {
      promise = null;
      throw e;
    });
  return promise;
}

function build(topo: Topology): BrGeo {
  const munObj = topo.objects.mun as GeometryCollection<{ id: number }>;
  const ufObj = topo.objects.uf as GeometryCollection<{ id: number }>;
  const mun = feature(topo, munObj) as FeatureCollection<Geometry, { id: number }>;
  const uf = feature(topo, ufObj) as FeatureCollection<Geometry, { id: number }>;
  const proj = geoMercator().fitSize([BASE, BASE], uf);
  const path = geoPath(proj).digits(2);
  const shapes = (fc: FeatureCollection<Geometry, { id: number }>): Shape[] =>
    fc.features.map((f) => {
      const [[x0, y0], [x1, y1]] = path.bounds(f as Feature);
      const [cx, cy] = path.centroid(f as Feature);
      return { id: f.properties.id, d: path(f as Feature) ?? "", bbox: [x0, y0, x1, y1], cx, cy };
    });
  const munShapes = shapes(mun);
  const ufShapes = shapes(uf);
  const inner = path(mesh(topo, ufObj, (a, b) => a !== b) as MultiLineString) ?? "";
  const outline = path(mesh(topo, ufObj, (a, b) => a === b) as MultiLineString) ?? "";
  const [[x0, y0], [x1, y1]] = path.bounds(uf);
  const munHtml = munShapes.map((s) => `<path data-id="${s.id}" data-uf="${ufOfMun(s.id)}" d="${s.d}"></path>`).join("");
  const ufHtml = ufShapes.map((s) => `<path data-id="${s.id}" data-uf="${s.id}" d="${s.d}"></path>`).join("");
  return { mun: munShapes, uf: ufShapes, ufBorders: inner, outline, bbox: [x0, y0, x1, y1], munHtml, ufHtml };
}
