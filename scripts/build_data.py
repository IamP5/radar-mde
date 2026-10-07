"""Turn raw SIOPE/SICONFI/IBGE downloads into the app's dataset (web/src/data/*.json).

Inputs (see fetch_br.py): data/raw/br/{ibge_municipios,entes}.json, siope_<UF>_<year>.json,
siope_receita_<UF>_<year>.json. SICONFI annex 14 files (data/raw/a14_*.json, São Paulo only) add the
Treasury cross-check and health %, where present.
"""
import json, os, re, unicodedata
from collections import defaultdict
from datetime import date

ROOT = os.path.join(os.path.dirname(__file__), "..")
RAW = os.path.join(ROOT, "data", "raw")
BR = os.path.join(RAW, "br")
OUT = os.path.join(ROOT, "web", "src", "data")
YEARS = list(range(2008, 2026))  # SIOPE open data starts in 2008
os.makedirs(OUT, exist_ok=True)

UFS = {  # sigla: (IBGE code, name, region)
    "RO": (11, "Rondônia", "N"), "AC": (12, "Acre", "N"), "AM": (13, "Amazonas", "N"), "RR": (14, "Roraima", "N"),
    "PA": (15, "Pará", "N"), "AP": (16, "Amapá", "N"), "TO": (17, "Tocantins", "N"),
    "MA": (21, "Maranhão", "NE"), "PI": (22, "Piauí", "NE"), "CE": (23, "Ceará", "NE"),
    "RN": (24, "Rio Grande do Norte", "NE"), "PB": (25, "Paraíba", "NE"), "PE": (26, "Pernambuco", "NE"),
    "AL": (27, "Alagoas", "NE"), "SE": (28, "Sergipe", "NE"), "BA": (29, "Bahia", "NE"),
    "MG": (31, "Minas Gerais", "SE"), "ES": (32, "Espírito Santo", "SE"), "RJ": (33, "Rio de Janeiro", "SE"),
    "SP": (35, "São Paulo", "SE"), "PR": (41, "Paraná", "S"), "SC": (42, "Santa Catarina", "S"),
    "RS": (43, "Rio Grande do Sul", "S"), "MS": (50, "Mato Grosso do Sul", "CO"), "MT": (51, "Mato Grosso", "CO"),
    "GO": (52, "Goiás", "CO"), "DF": (53, "Distrito Federal", "CO"),
}
UF_BY_CODE = {v[0]: k for k, v in UFS.items()}
BRASILIA = 5300108


def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def metric(items, prefix):
    out = {}
    for r in items:
        if r["cod_conta"].startswith(prefix):
            col = r["coluna"]
            if col.startswith("% Aplicado"):
                out["pct"] = r["valor"]
            elif col.startswith("% Mínimo"):
                out["min"] = r["valor"]
            elif col.startswith("Valor Apurado"):
                out["val"] = r["valor"]
    return out if "pct" in out else None


ibge = json.load(open(os.path.join(BR, "ibge_municipios.json")))
pop = {e["cod_ibge"]: e["populacao"] for e in json.load(open(os.path.join(BR, "entes.json")))}
pop[BRASILIA] = pop.get(53, 0)  # SICONFI lists the Distrito Federal as a single "D" entity


def load_siope():
    """(key, year) -> {COD_EXIB: value}; key is the 6-digit municipality code or 'UF:<sigla>' for state governments."""
    out, seen = {}, defaultdict(set)  # seen: years with a downloaded file, per UF
    for uf in UFS:
        for y in YEARS:
            p = os.path.join(BR, f"siope_{uf}_{y}.json")
            if not os.path.exists(p):
                continue
            seen[uf].add(y)
            for r in json.load(open(p)):
                try:
                    v = float(r["VAL_INDI"])
                except (TypeError, ValueError):
                    continue
                key = r["COD_MUNI"] if r["TIPO"] == "Municipal" else f"UF:{uf}"
                out.setdefault((key, y), {})[r["COD_EXIB"]] = v
    return out, seen


def load_receita():
    """Constitutional MDE base (impostos + transferências) rebuilt from SIOPE revenue lines,
    for years without indicator 8.1. Matches 8.1 within 2% for 97% of SP municipalities in 2020."""
    out = defaultdict(float)
    for uf in UFS:
        for y in YEARS:
            p = os.path.join(BR, f"siope_receita_{uf}_{y}.json")
            if not os.path.exists(p):
                continue
            for r in json.load(open(p)):
                try:
                    out[(r["COD_MUNI"], y)] += float(r["VAL_DECL"])
                except (TypeError, ValueError):
                    pass
    return out


siope, seen = load_siope()
receita = load_receita()


def siconfi(cod, y):
    """Treasury (SICONFI) annex 14, only downloaded for São Paulo: cross-check and health %."""
    p = os.path.join(RAW, f"a14_{cod}_{y}.json")
    if not os.path.exists(p):
        return None, False
    items = json.load(open(p))
    return ({"mde": metric(items, "MinimoAnualDasReceitasDeImpostosNaManutencao"),
             "fun": metric(items, "MinimoAnualDoFUNDEBNaRemuneracao"),
             "sau": metric(items, "AplicacaoTotalDasDespesasComAcoesEServicosPublicosDeSaude")},
            os.path.exists(p + ".simp"))


def record(si, rec_base, y, sc=None):
    rec = {"s": "ok", "src": "siope", "mde": round(si["1.1"], 2)}
    if si.get("8.2"):
        rec["mdeV"] = round(si["8.2"])
    if si.get("8.1"):
        rec["base"] = round(si["8.1"] / 0.25)
    elif rec.get("mdeV") and rec["mde"] > 0:
        rec["base"] = round(rec["mdeV"] / rec["mde"] * 100)
    elif rec_base > 0:
        rec["base"] = round(rec_base)
        rec["mdeV"] = round(rec["base"] * rec["mde"] / 100)
    if "1.2" in si and si["1.2"] > 0:
        rec["fun"] = round(si["1.2"], 2)
        rec["funMin"] = 70 if y >= 2021 else 60
    # 1.4 (Fundeb left for next year) reads very differently in 2008, the Fundeb's 2nd year; negatives are filing errors
    if si.get("1.4") is not None and y > 2008 and si["1.4"] >= 0:
        rec["funLeft"] = round(si["1.4"], 2)
    if si.get("2.8"):
        rec["eduShare"] = round(si["2.8"], 2)
    if si.get("4.9") and 100 <= si["4.9"] <= 200_000:  # outside this band it's a filing error (R$ 5, R$ 514 mil)
        rec["perAluno"] = round(si["4.9"])
    if rec.get("mdeV") and rec.get("base") and abs(rec["mdeV"] / rec["base"] * 100 - rec["mde"]) > 1:
        del rec["mdeV"]  # R$ applied contradicts the declared % (the % is SIOPE's official figure)
    if sc:
        if "base" not in rec and sc["mde"] and sc["mde"]["pct"] > 0 and sc["mde"].get("val"):
            rec["base"] = round(sc["mde"]["val"] / sc["mde"]["pct"] * 100)
            rec["mdeV"] = round(rec["base"] * rec["mde"] / 100)
        if sc["mde"] and abs(sc["mde"]["pct"] - rec["mde"]) >= 1:
            rec["alt"] = round(sc["mde"]["pct"], 2)  # Treasury figure disagrees with SIOPE
    return rec


cities = []
coverage = {uf: {y: 0 for y in YEARS} for uf in UFS}
NORONHA = 2605459  # state district (PE), not a municipality: no budget of its own to declare
for m in sorted(ibge, key=lambda m: m["id"]):
    cod = m["id"]
    if cod == NORONHA:
        continue
    uf = UF_BY_CODE[cod // 100000]
    ri = m.get("regiao-imediata") or {}
    years = {}
    for y in YEARS:
        sc, simp = siconfi(cod, y)
        key = f"UF:DF" if cod == BRASILIA else cod // 10
        si = siope.get((key, y))
        if si and si.get("1.1", 0) > 0:  # 0% filings are empty placeholders, not real declarations
            rec = record(si, receita.get((cod // 10, y), 0), y, sc)
        elif sc and sc["mde"]:
            mde = sc["mde"]
            rec = {"s": "ok", "src": "siconfi", "mde": round(mde["pct"], 2), "mdeV": round(mde.get("val", 0))}
            if mde["pct"] > 0 and mde.get("val"):
                rec["base"] = round(mde["val"] / mde["pct"] * 100)
            if sc["fun"]:
                rec["fun"] = round(sc["fun"]["pct"], 2)
                rec["funMin"] = sc["fun"].get("min") or (70 if y >= 2021 else 60)
        elif y in seen[uf] or simp:
            rec = {"s": "nd"}  # nothing declared for this year
        else:
            continue  # not collected
        if sc and sc["sau"] and rec.get("s") == "ok":
            rec["sau"] = round(sc["sau"]["pct"], 2)
        if rec.get("mde") is not None:
            coverage[uf][y] += 1
        years[y] = rec
    cities.append({
        "id": cod, "name": m["nome"], "slug": slug(m["nome"]), "uf": uf, "pop": pop.get(cod, 0),
        "inter": (ri.get("regiao-intermediaria") or {}).get("nome"), "imediata": ri.get("nome"),
        "capital": False, "years": years,
    })

# capitals: SICONFI flags them in `entes`
caps = {e["cod_ibge"] for e in json.load(open(os.path.join(BR, "entes.json"))) if str(e["capital"]).strip() == "1"}
for c in cities:
    c["capital"] = c["id"] in caps or c["id"] == BRASILIA

for uf in UFS:
    s = [c["slug"] for c in cities if c["uf"] == uf]
    assert len(set(s)) == len(s), f"slug collision in {uf}"

# State governments (SIOPE "Estadual"): the 25% rule applies to them as well
states = []
for uf, (code, name, reg) in UFS.items():
    years = {}
    for y in YEARS:
        si = siope.get((f"UF:{uf}", y))
        if si and si.get("1.1", 0) > 0:
            years[y] = record(si, 0, y)
        elif y in seen[uf]:
            years[y] = {"s": "nd"}
    states.append({"uf": uf, "code": code, "name": name, "region": reg, "years": years})

json.dump(cities, open(os.path.join(OUT, "cities.json"), "w"), ensure_ascii=False, separators=(",", ":"))
json.dump(states, open(os.path.join(OUT, "states.json"), "w"), ensure_ascii=False, separators=(",", ":"))

n = len(cities)
total = {y: sum(coverage[uf][y] for uf in UFS) for y in YEARS}
# Publish a year once the national picture is close to complete, so totals are comparable across years
complete = [y for y in YEARS if total[y] >= 0.85 * n]
json.dump({"years": complete, "updated": date.today().isoformat(), "coverage": total,
           "coverageUf": coverage}, open(os.path.join(OUT, "meta.json"), "w"), ensure_ascii=False)
print("cities", n, "coverage(mde) by year", total)
print("published years", complete)
print("size MB", os.path.getsize(os.path.join(OUT, "cities.json")) / 1e6)
