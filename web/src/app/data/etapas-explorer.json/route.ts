import { explorerStages } from "@/lib/etapas";
import { compressedJson } from "../compressed";

/** Creche, fundamental and EJA for the explorer, fetched the first time those columns are shown. */
export function GET(req: Request) {
  return compressedJson(req, "etapas-explorer", () => explorerStages());
}
