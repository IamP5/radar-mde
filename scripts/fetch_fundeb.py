"""Download FNDE Fundeb VAAT and VAAR files and write web/src/data/fundeb.json.

  python3 scripts/fetch_fundeb.py

Raw files land in data/raw/br/fundeb/ (gitignored). The app reads only fundeb.json.
Cities.json is not touched. Re-running skips downloads that already exist.

Exercises are the latest publication we could actually open:
  2025: 6ª publicação, Portaria MEC/MF nº 5, de 29/04/2026 (CSV).
  2026: 3ª publicação, Portaria MEC/MF nº 11, de 28/08/2026 (XLSX).
The 2026 page links that publication's VAAT CSV at the 1ª publicação file
(Portaria nº 14, de 29/12/2025). The matching XLSX is the file used here.
2021 and 2022 return 404. 2023 and 2024 do not publish the same per-municipality
VAAT CSV, so those exercises are left out rather than guessed.
"""
import csv, io, json, os, time, urllib.request, zipfile
from decimal import Decimal, ROUND_HALF_UP
from xml.etree import ElementTree as ET

ROOT = os.path.join(os.path.dirname(__file__), "..")
RAW = os.path.join(ROOT, "data", "raw", "br", "fundeb")
OUT = os.path.join(ROOT, "web", "src", "data", "fundeb.json")
META = os.path.join(ROOT, "web", "src", "data", "meta.json")
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
HOST = "https://www.gov.br"

SOURCES = {
    2025: {
        "label": "6ª publicação",
        "portaria": "Portaria Interministerial MEC/MF nº 5, de 29 de abril de 2026",
        "page": f"{HOST}/fnde/pt-br/acesso-a-informacao/acoes-e-programas/financiamento/fundeb/2025",
        "vaat": f"{HOST}/fnde/pt-br/acesso-a-informacao/acoes-e-programas/financiamento/fundeb/2025-1/6-publicacao-2013-portaria-mec-mf-n-5-de-29-de-abril-de-2026/3.VAATVAATMINecomplementaoVAATporentefederado.csv/@@download/file",
        "vaar": f"{HOST}/fnde/pt-br/acesso-a-informacao/acoes-e-programas/financiamento/fundeb/2025-1/6-publicacao-2013-portaria-mec-mf-n-5-de-29-de-abril-de-2026/6.RedesbeneficiadascoeficientesdedistribuioecomplementaoVAAR.csv/@@download/file",
    },
    2026: {
        "label": "3ª publicação",
        "portaria": "Portaria Interministerial MEC/MF nº 11, de 28 de agosto de 2026",
        "page": f"{HOST}/fnde/pt-br/acesso-a-informacao/acoes-e-programas/financiamento/fundeb/2026",
        "vaat": f"{HOST}/fnde/pt-br/acesso-a-informacao/acoes-e-programas/financiamento/fundeb/2026-1/publicacoes-2026/3-publicacoes/3-vaat-vaat-min-e-complementacao-vaat-por-ente-federado-p11.xlsx/@@download/file",
        "vaar": f"{HOST}/fnde/pt-br/acesso-a-informacao/acoes-e-programas/financiamento/fundeb/2026-1/publicacoes-2026/3-publicacoes/6-redes-beneficiadas-coeficientes-de-distribuicao-e-complementacao-vaar-prevista-p11.csv/@@download/file",
        "note": "O link CSV da 3ª publicação no portal abre o arquivo da 1ª (Portaria nº 14, de 29/12/2025). A série usa o XLSX da Portaria nº 11, de 28/08/2026.",
    },
}


def download(url, dest, tries=6, timeout=180):
    if os.path.exists(dest) and os.path.getsize(dest) > 1000:
        return
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "radar-mde/1.0"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                body = r.read()
            if len(body) < 1000:
                raise RuntimeError(f"short body {len(body)}")
            tmp = dest + ".tmp"
            open(tmp, "wb").write(body)
            os.replace(tmp, dest)
            print("got", os.path.basename(dest), len(body), flush=True)
            return
        except Exception as e:
            last = e
            print("retry", i, url[:120], e, flush=True)
            time.sleep(5 * (i + 1))
    raise RuntimeError(f"{url}: {last}")


def money(v):
    return float(Decimal(str(v)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def parse_num(raw, percent_fraction=False):
    if raw is None:
        return 0.0
    if isinstance(raw, bool):
        raise TypeError(raw)
    if isinstance(raw, (int, float)):
        v = float(raw)
        pct = False
    else:
        s = str(raw).strip().replace("\xa0", "").replace(" ", "")
        if s in ("", "-", "–", "—"):
            return 0.0
        pct = s.endswith("%")
        if pct:
            s = s[:-1]
        if "," in s:
            s = s.replace(".", "").replace(",", ".")
        v = float(s)
    if percent_fraction and not pct and 0 < v <= 1:
        v *= 100
    return v


def col_index(ref):
    letters = "".join(ch for ch in ref if ch.isalpha())
    n = 0
    for ch in letters:
        n = n * 26 + ord(ch) - 64
    return n - 1


def read_xlsx(path):
    z = zipfile.ZipFile(path)
    root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    strings = []
    for si in root.findall("m:si", NS):
        strings.append("".join(t.text or "" for t in si.iter(f"{{{NS['m']}}}t")))
    sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    rows = []
    for row in sheet.findall("m:sheetData/m:row", NS):
        cells = {}
        for c in row.findall("m:c", NS):
            v = c.find("m:v", NS)
            if v is None or v.text is None:
                continue
            cells[col_index(c.attrib.get("r", "A1"))] = strings[int(v.text)] if c.attrib.get("t") == "s" else v.text
        if cells:
            width = max(cells) + 1
            rows.append([cells.get(i, "") for i in range(width)])
    return rows


def read_csv(path):
    text = open(path, "rb").read().decode("latin-1")
    return list(csv.reader(io.StringIO(text), delimiter=";"))


def header_index(rows):
    for i, row in enumerate(rows):
        joined = " ".join(str(c) for c in row).upper()
        if "IBGE" in joined and "VAAT" in joined:
            return i
    raise RuntimeError("header row not found")


def pick(header, *needles):
    for i, cell in enumerate(header):
        text = " ".join(str(cell).split()).upper()
        if all(n.upper() in text for n in needles):
            return i
    return None


def vaat_rows(rows, percent_fraction):
    hi = header_index(rows)
    header = [" ".join(str(c).split()) for c in rows[hi]]
    ibge_i = pick(header, "IBGE")
    vaat_i = pick(header, "ANTERIOR")
    comp_i = next((i for i, text in enumerate(header) if "16, VI" in text.upper() or "16,VI" in text.upper()), None)
    com_i = next((i for i, text in enumerate(header) if "16, V)" in text.upper() or "16, V " in text.upper()), None)
    if com_i is None:
        com_i = next((i for i, text in enumerate(header) if "COM A COMPLEMENT" in text.upper()), None)
    iei_i = pick(header, "IEI")
    if None in (ibge_i, vaat_i, comp_i, com_i, iei_i):
        raise RuntimeError(f"columns missing in {header}")
    out = {}
    for row in rows[hi + 1:]:
        if max(ibge_i, vaat_i, comp_i, com_i, iei_i) >= len(row):
            continue
        code = str(row[ibge_i]).strip()
        if not code.isdigit() or len(code) != 7:
            continue
        out[code] = {
            "vaat": money(parse_num(row[vaat_i])),
            "vaatCom": money(parse_num(row[com_i])),
            "comp": money(parse_num(row[comp_i])),
            "iei": money(parse_num(row[iei_i], percent_fraction=percent_fraction)),
        }
    if len(out) < 5000:
        raise RuntimeError(f"only {len(out)} municipalities")
    return out


def vaar_ids(rows):
    hi = None
    for i, row in enumerate(rows):
        joined = " ".join(str(c) for c in row).upper()
        if "IBGE" in joined and ("VAAR" in joined or "COEFICIENT" in joined):
            hi = i
            break
    if hi is None:
        raise RuntimeError("VAAR header not found")
    header = [" ".join(str(c).split()) for c in rows[hi]]
    ibge_i = pick(header, "IBGE")
    ids = set()
    for row in rows[hi + 1:]:
        if ibge_i >= len(row):
            continue
        code = str(row[ibge_i]).strip()
        if code.isdigit() and len(code) == 7:
            ids.add(code)
    if len(ids) < 100:
        raise RuntimeError(f"only {len(ids)} VAAR beneficiaries")
    return ids


def floor_of(rows):
    lifted = [r["vaatCom"] for r in rows.values() if r["comp"] > 0]
    if not lifted:
        raise RuntimeError("no complementation rows")
    values = sorted(set(lifted))
    if len(values) != 1:
        raise RuntimeError(f"VAAT-MIN is not unique: {values[:8]}")
    return values[0]


def attach_meta(summary):
    text = open(META, encoding="utf-8").read().strip()
    meta = json.loads(text)
    meta["fundeb"] = summary
    open(META, "w", encoding="utf-8").write(json.dumps(meta, ensure_ascii=False) + "\n")


def main():
    os.makedirs(RAW, exist_ok=True)
    cities = {}
    publications = {}
    floors = {}
    for year, src in SOURCES.items():
        vaat_name = f"vaat-{year}" + (".xlsx" if src["vaat"].endswith(".xlsx/@@download/file") else ".csv")
        vaar_name = f"vaar-{year}.csv"
        vaat_path = os.path.join(RAW, vaat_name)
        vaar_path = os.path.join(RAW, vaar_name)
        download(src["vaat"], vaat_path)
        download(src["vaar"], vaar_path)
        percent_fraction = vaat_path.endswith(".xlsx")
        table = read_xlsx(vaat_path) if percent_fraction else read_csv(vaat_path)
        rows = vaat_rows(table, percent_fraction)
        beneficiaries = vaar_ids(read_csv(vaar_path))
        floors[str(year)] = floor_of(rows)
        publications[str(year)] = {k: src[k] for k in ("label", "portaria", "page", "vaat", "vaar") if k in src}
        if "note" in src:
            publications[str(year)]["note"] = src["note"]
        receive = 0
        for code, row in rows.items():
            row["vaar"] = 1 if code in beneficiaries else 0
            cities.setdefault(code, {})[str(year)] = row
            if row["comp"] > 0:
                receive += 1
        print(year, "mun", len(rows), "floor", floors[str(year)], "receive", receive, "vaar", len(beneficiaries), flush=True)
    doc = {
        "years": sorted(SOURCES),
        "floor": floors,
        "publications": publications,
        "cities": cities,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    tmp = OUT + ".tmp"
    json.dump(doc, open(tmp, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, OUT)
    attach_meta({"years": doc["years"], "floor": floors, "publications": publications})
    check(doc)
    print("wrote", OUT, os.path.getsize(OUT) // 1024, "KB", flush=True)


def check(doc):
    assert doc["floor"]["2025"] == 8024.31, doc["floor"]["2025"]
    sp = doc["cities"]["3547809"]["2025"]
    pb = doc["cities"]["2513851"]["2025"]
    assert sp["vaat"] == 13914.20 and sp["comp"] == 0 and sp["vaatCom"] == 13914.20, sp
    assert pb["vaat"] == 7259.40 and pb["vaatCom"] == 8024.31 and pb["comp"] == 507683.95 and pb["iei"] == 52.09, pb
    print("check 2025 Santo André SP", sp)
    print("check 2025 Santo André PB", pb)


if __name__ == "__main__":
    main()
