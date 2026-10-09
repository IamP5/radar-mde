"""Turn raw SIOPE/SICONFI/IBGE downloads into the app's dataset (web/src/data/*.json).

Inputs (see fetch_br.py): data/raw/br/{ibge_municipios,entes}.json, siope_<UF>_<year>.json,
siope_receita_<UF>_<year>.json. SICONFI annex 14 files (data/raw/a14_*.json, São Paulo only) add the
Treasury cross-check and health %, where present.
"""
import hashlib, json, math, os, re, statistics, unicodedata
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
# Municipalities installed after 2008 (IBGE): years before installation get no record at all (never "não declarou")
INSTALLED = {1504752: 2013, 4212650: 2013, 4220000: 2013, 5006275: 2013, 4314548: 2013, 5101837: 2025}
# IBGE label typos in regiões intermediárias/imediatas
LABEL_FIX = {"Juíz de Fora": "Juiz de Fora"}
def stage_fields():
    path = os.path.join(ROOT, "web", "src", "lib", "etapas-fields.ts")
    text = open(path, encoding="utf-8").read()
    found = re.findall(r'\{\s*id:\s*"(\w+)",\s*siope:\s*"([^"]+)",\s*kind:\s*"(money|percent)"', text)
    if not found or len(found) != text.count("siope:"):
        raise SystemExit(f"could not read stage fields from {path}")
    return found


STAGE_FIELDS = stage_fields()
STAGE_BY_CODE = {code: (fid, kind) for fid, code, kind in STAGE_FIELDS}
MONEY_FIELDS = [fid for fid, _, kind in STAGE_FIELDS if kind == "money"]
# Outside this band a per-student figure is a filing error (R$ 5, R$ 514 mil).
PER_ALUNO_LO, PER_ALUNO_HI = 100, 200_000


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
        rec["base"] = round(si["8.1"] / 0.25)  # baseSrc omitted = SIOPE 8.1 (the usual case)
    elif rec.get("mdeV") and rec["mde"] > 0:
        rec["base"], rec["baseSrc"] = round(rec["mdeV"] / rec["mde"] * 100), "8.2"
    elif rec_base > 0:
        rec["base"], rec["baseSrc"] = round(rec_base), "receita"
    if rec.get("base") and not rec.get("mdeV"):
        rec["mdeV"], rec["mdeVEst"] = round(rec["base"] * rec["mde"] / 100), 1  # Radar estimate, not declared
    if "1.2" in si and si["1.2"] > 0:
        rec["fun"] = round(si["1.2"], 2)
        rec["funMin"] = 70 if y >= 2021 else 60
    # 1.4 (Fundeb left for next year) reads very differently in 2008, the Fundeb's 2nd year; negatives are filing errors
    if si.get("1.4") is not None and y > 2008 and si["1.4"] >= 0:
        rec["funLeft"] = round(si["1.4"], 2)
    if si.get("2.8"):
        rec["eduShare"] = round(si["2.8"], 2)
    if si.get("4.9") and PER_ALUNO_LO <= si["4.9"] <= PER_ALUNO_HI:
        rec["perAluno"] = round(si["4.9"])
    if rec.get("mdeV") and rec.get("base") and abs(rec["mdeV"] / rec["base"] * 100 - rec["mde"]) > 1:
        # R$ applied contradicts the declared % (the % is SIOPE's official figure): fall back to the estimate
        rec["mdeV"], rec["mdeVEst"] = round(rec["base"] * rec["mde"] / 100), 1
    if sc:
        if "base" not in rec and sc["mde"] and sc["mde"]["pct"] > 0 and sc["mde"].get("val"):
            rec["base"], rec["baseSrc"] = round(sc["mde"]["val"] / sc["mde"]["pct"] * 100), "siconfi"
            rec["mdeV"], rec["mdeVEst"] = round(rec["base"] * rec["mde"] / 100), 1
        if sc["mde"] and abs(sc["mde"]["pct"] - rec["mde"]) >= 1:
            rec["alt"] = round(sc["mde"]["pct"], 2)  # Treasury figure disagrees with SIOPE
    return rec



def flag_atypical(entities):
    """Mark (never drop) values outside the entity's own pattern, as rec["atip"] = ["mde", "aluno", "base"];
    rec["atipImpl"] = 1 when a flag is physically implausible (likely a filing error).
    mde:   < 5% or > 60% (implausible), or a one-year outlier against the entity's own history:
           |value - median of the ±2 neighbouring years| >= 10 p.p. and value < 15% or > 40%.
           Persistent low application is real under-application and is NOT flagged.
    aluno: per-student, relative to the national median of the year, < 0.4x or > 2.5x the entity's own typical
           level (median over its years); or a year-over-year jump > 2.5x / drop < 0.4x that is not a return to
           the level of two years before; or a one-year spike that reverts (> 2x or < 0.5x both neighbouring
           years, or a 2.5x jump into or out of the year while the years before and after are at the same level);
           or > 8x the national median (implausible).
    base:  tax-revenue base < 0.4x or > 2.5x the median of the entity's neighbouring years (±2)."""
    nat = {}
    for y in YEARS:
        v = [e["years"][y]["perAluno"] for e in entities if y in e["years"] and e["years"][y].get("perAluno")]
        nat[y] = statistics.median(v) if v else None

    def around(vals, y):
        nb = [vals[z] for z in range(y - 2, y + 3) if z != y and z in vals]
        return statistics.median(nb) if len(nb) >= 2 else None

    for e in entities:
        ys = e["years"]
        mde = {y: r["mde"] for y, r in ys.items() if r.get("mde") is not None}
        alu = {y: r["perAluno"] for y, r in ys.items() if r.get("perAluno")}
        aluno_flags = per_aluno_outliers(alu, nat)
        base = {y: r["base"] for y, r in ys.items() if r.get("base")}
        for y, r in ys.items():
            f, impl = [], False
            if y in mde:
                v, md = mde[y], around(mde, y)
                if v < 5 or v > 60:
                    f.append("mde"); impl = True
                elif md is not None and abs(v - md) >= 10 and (v < 15 or v > 40):
                    f.append("mde")
            if y in aluno_flags:
                f.append("aluno")
                if aluno_flags[y]:
                    impl = True
            if y in base:
                md = around(base, y)
                if md and ratio_out(base[y] / md):
                    f.append("base")
            if f:
                r["atip"] = f
                if impl:
                    r["atipImpl"] = 1



# Material (2.10) has a national median near R$ 34, so that floor would drop most cities. Cap it at R$ 5.000.
# Education-spending shares cannot pass 100%. Fundeb shares can, the same way indicator 1.2 can, up to 200%.
FUNDEB_FIELDS = {"fuEi", "fuEf"}
SHARE_FIELDS = {"shEi", "shEf", "mer"}
STUDENT_FIELDS = {"cre", "pre", "ei", "ef", "eja", "ee", "prof"}


def ratio_out(r, lo=0.4, hi=2.5):
    return not lo <= r <= hi


def per_aluno_outliers(values, municipal_median):
    rel = {y: v / municipal_median[y] for y, v in values.items() if municipal_median.get(y)}
    own = statistics.median(list(rel.values())) if len(rel) >= 4 else None
    flagged = {}
    for y in rel:
        prev, prev2 = values.get(y - 1), values.get(y - 2)
        jump = prev and ratio_out(values[y] / prev) and not (prev2 and not ratio_out(values[y] / prev2))
        # one-year spike that reverts (ACA-23): > 2x or < 0.5x both neighbours, or a 2.5x jump from the
        # previous year followed by a return to that level the next year
        nxt = values.get(y + 1)
        spike = prev and nxt and ((values[y] > 2 * prev and values[y] > 2 * nxt) or (values[y] < 0.5 * prev and values[y] < 0.5 * nxt))
        # a jump into y or out of y (2.5x) where the year before and after are at the same level
        spike = spike or (prev and nxt and (ratio_out(values[y] / prev) or ratio_out(nxt / values[y])) and not ratio_out(nxt / prev))
        implausible = rel[y] > 8
        if implausible or (own and ratio_out(rel[y] / own)) or jump or spike:
            flagged[y] = implausible
    return flagged


def keep_stage(fid, raw):
    try:
        v = float(raw)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(v) or v <= 0:
        return None
    if fid == "mat":
        if v > 5_000:
            return None
        kept = round(v, 2)
        return kept or None
    if fid in STUDENT_FIELDS:
        if v < PER_ALUNO_LO or v > PER_ALUNO_HI:
            return None
        return int(round(v))
    if fid in FUNDEB_FIELDS:
        if v > 200:
            return None
        return round(v, 2)
    if fid in SHARE_FIELDS:
        if v > 100:
            return None
        return round(v, 2)
    return None


def mark_per_aluno(year_maps, field, municipal_median):
    for ys in year_maps:
        values = {y: cell[field] for y, cell in ys.items() if field in cell}
        for y, implausible in per_aluno_outliers(values, municipal_median).items():
            cell = ys[y]
            cell.setdefault("atip", []).append(field)
            if implausible:
                cell.setdefault("impl", []).append(field)


def siope_present():
    found = {}
    for uf in UFS:
        years = [y for y in YEARS if os.path.exists(os.path.join(BR, f"siope_{uf}_{y}.json"))]
        if years:
            found[uf] = years
    return found


def receita_covers(present):
    for uf, years in present.items():
        for y in years:
            if 2008 <= y <= 2020 and not os.path.exists(os.path.join(BR, f"siope_receita_{uf}_{y}.json")):
                return False
    return True


def write_etapas():
    cities_path = os.path.join(OUT, "cities.json")
    meta = json.load(open(cities_path, encoding="utf-8"))
    uf_of, since, by_code = {}, {}, {}
    for c in meta:
        cid = c["id"]
        uf_of[cid] = c["uf"]
        if c.get("since"):
            since[cid] = c["since"]
        if cid == BRASILIA:
            continue  # no municipal SIOPE row; the city reads UF:DF below
        code = cid // 10
        if code in by_code:
            raise SystemExit(f"duplicate siope code {code}")
        by_code[code] = cid

    city_years = {}
    gov_years = {uf: {} for uf in UFS}
    field_years = {fid: set() for fid, _, _ in STAGE_FIELDS}

    def put(store, year, fid, value):
        store.setdefault(year, {})[fid] = value
        field_years[fid].add(year)

    def installed(cid, year):
        s = since.get(cid)
        return not (s and year < s)

    for uf in UFS:
        for y in YEARS:
            path = os.path.join(BR, f"siope_{uf}_{y}.json")
            if not os.path.exists(path):
                continue
            for r in json.load(open(path)):
                spec = STAGE_BY_CODE.get(r.get("COD_EXIB"))
                if not spec:
                    continue
                fid, kind = spec
                value = keep_stage(fid, r.get("VAL_INDI"))
                if value is None:
                    continue
                if r.get("TIPO") == "Municipal":
                    try:
                        code = int(r["COD_MUNI"])
                    except (TypeError, ValueError):
                        continue
                    cid = by_code.get(code)
                    if cid is None or not installed(cid, y):
                        continue
                    put(city_years.setdefault(cid, {}), y, fid, value)
                else:
                    put(gov_years[uf], y, fid, value)
                    if uf == "DF" and installed(BRASILIA, y):
                        put(city_years.setdefault(BRASILIA, {}), y, fid, value)

    for fid in MONEY_FIELDS:
        buckets = {}
        for years in city_years.values():
            for y, cell in years.items():
                if fid in cell:
                    buckets.setdefault(y, []).append(cell[fid])
        municipal_median = {y: statistics.median(vals) for y, vals in buckets.items() if vals}
        mark_per_aluno(list(city_years.values()), fid, municipal_median)
        mark_per_aluno(list(gov_years.values()), fid, municipal_median)

    def pack_years(years):
        out = {}
        for y in sorted(years):
            src = years[y]
            cell = {fid: src[fid] for fid, _, _ in STAGE_FIELDS if fid in src}
            if not cell:
                continue
            if src.get("atip"):
                cell["atip"] = src["atip"]
            if src.get("impl"):
                cell["impl"] = src["impl"]
            out[str(y)] = cell
        return out

    cities_out = {}
    for cid in sorted(city_years):
        packed = pack_years(city_years[cid])
        if packed:
            cities_out[str(cid)] = packed
    gov_out = {}
    for uf in UFS:
        packed = pack_years(gov_years[uf])
        if packed:
            gov_out[uf] = packed

    def pack_medians(bucket):
        out = {}
        for y in sorted(bucket):
            cell = {}
            for fid, _, kind in STAGE_FIELDS:
                vals = bucket[y].get(fid) or []
                if not vals:
                    continue
                med = statistics.median(vals)
                cell[fid] = round(med, 2) if fid == "mat" else (int(round(med)) if kind == "money" else round(med, 2))
                cell[fid + "N"] = len(vals)
            if cell:
                out[str(y)] = cell
        return out

    br, uf_b, reg_b = {}, {uf: {} for uf in UFS}, {reg: {} for reg in ("N", "NE", "SE", "S", "CO")}
    for cid, years in city_years.items():
        uf = uf_of[cid]
        reg = UFS[uf][2]
        for y, cell in years.items():
            for fid, _, _ in STAGE_FIELDS:
                if fid not in cell:
                    continue
                br.setdefault(y, {}).setdefault(fid, []).append(cell[fid])
                uf_b[uf].setdefault(y, {}).setdefault(fid, []).append(cell[fid])
                reg_b[reg].setdefault(y, {}).setdefault(fid, []).append(cell[fid])

    doc = {
        "fields": [{"id": fid, "siope": code, "kind": kind, "years": sorted(field_years[fid])} for fid, code, kind in STAGE_FIELDS],
        "cities": cities_out,
        "gov": gov_out,
        "medians": {
            "br": pack_medians(br),
            "uf": {uf: pack_medians(uf_b[uf]) for uf in UFS},
            "reg": {reg: pack_medians(reg_b[reg]) for reg in ("N", "NE", "SE", "S", "CO")},
        },
    }
    path = os.path.join(OUT, "etapas.json")
    text = json.dumps(doc, ensure_ascii=False, separators=(",", ":"))
    open(path, "w", encoding="utf-8").write(text)
    loaded = json.loads(text)
    sa = loaded["cities"]["3547809"]["2023"]
    print("etapas.json MB", os.path.getsize(path) / 1e6)
    print(json.dumps(sa, ensure_ascii=False))
    assert sa["cre"] == 15257
    assert sa["pre"] == 15759
    assert sa["ei"] == 15497
    assert sa["ef"] == 16666
    assert sa["eja"] == 15351
    assert sa["shEi"] == 40.02
    assert sa["shEf"] == 47.49
    assert sa["fuEi"] == 46.97
    assert sa["fuEf"] == 48.23
    assert sa["mat"] == 144.04
    assert sa["prof"] == 6048
    assert "ee" not in sa and "mer" not in sa
    n = sum(1 for c in loaded["cities"].values() if "cre" in c.get("2023", {}))
    assert loaded["medians"]["br"]["2023"]["creN"] == n
    cre_years = next(f["years"] for f in loaded["fields"] if f["id"] == "cre")
    assert cre_years == sorted(set(cre_years))
    print("field years", {f["id"]: f["years"] for f in loaded["fields"]})


def build_published():
    ibge = json.load(open(os.path.join(BR, "ibge_municipios.json")))
    pop = {e["cod_ibge"]: e["populacao"] for e in json.load(open(os.path.join(BR, "entes.json")))}
    pop[BRASILIA] = pop.get(53, 0)  # SICONFI lists the Distrito Federal as a single "D" entity
    siope, seen = load_siope()
    receita = load_receita()

    cities = []
    coverage = {uf: {y: 0 for y in YEARS} for uf in UFS}
    NORONHA = 2605459  # state district (PE), not a municipality: no budget of its own to declare
    for m in sorted(ibge, key=lambda m: m["id"]):
        cod = m["id"]
        if cod == NORONHA:
            continue
        uf = UF_BY_CODE[cod // 100000]
        ri = m.get("regiao-imediata") or {}
        since = INSTALLED.get(cod)
        years = {}
        for y in YEARS:
            if since and y < since:
                continue  # the municipality did not exist yet
            sc, simp = siconfi(cod, y)
            key = f"UF:DF" if cod == BRASILIA else cod // 10
            si = siope.get((key, y))
            if si and si.get("1.1", 0) > 0:  # 0% filings are empty placeholders, not real declarations
                rec = record(si, receita.get((cod // 10, y), 0), y, sc)
            elif sc and sc["mde"]:
                mde = sc["mde"]
                rec = {"s": "ok", "src": "siconfi", "mde": round(mde["pct"], 2), "mdeV": round(mde.get("val", 0))}
                if mde["pct"] > 0 and mde.get("val"):
                    rec["base"], rec["baseSrc"] = round(mde["val"] / mde["pct"] * 100), "siconfi"
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
        inter, imediata = (ri.get("regiao-intermediaria") or {}).get("nome"), ri.get("nome")
        city = {
            "id": cod, "name": m["nome"], "slug": slug(m["nome"]), "uf": uf, "pop": pop.get(cod, 0),
            "inter": LABEL_FIX.get(inter, inter), "imediata": LABEL_FIX.get(imediata, imediata),
            "capital": False, "years": years,
        }
        if since:
            city["since"] = since
        cities.append(city)

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

    flag_atypical(cities)
    flag_atypical(states)

    cities_txt = json.dumps(cities, ensure_ascii=False, separators=(",", ":"))
    states_txt = json.dumps(states, ensure_ascii=False, separators=(",", ":"))
    open(os.path.join(OUT, "cities.json"), "w").write(cities_txt)
    open(os.path.join(OUT, "states.json"), "w").write(states_txt)

    n = len(cities)
    total = {y: sum(coverage[uf][y] for uf in UFS) for y in YEARS}
    # municipalities that existed in each year (denominator for coverage)
    n_by_year = {y: sum(1 for c in cities if c.get("since", 0) <= y) for y in YEARS}
    # Publish a year once the national picture is close to complete, so totals are comparable across years
    complete = [y for y in YEARS if total[y] >= 0.85 * n_by_year[y]]
    # Raw SIOPE files are downloaded by fetch_br.py; their newest modification date is the extraction date
    siope_files = [os.path.join(BR, f) for f in os.listdir(BR) if f.startswith("siope_")]
    extracted = date.fromtimestamp(max(os.path.getmtime(f) for f in siope_files)).isoformat()
    updated = date.today().isoformat()
    etapas_path = os.path.join(OUT, "etapas.json")
    etapas_txt = open(etapas_path, encoding="utf-8").read() if os.path.exists(etapas_path) else ""
    digest = hashlib.sha1((cities_txt + states_txt + etapas_txt).encode()).hexdigest()[:8]
    version = f"{updated}.{digest}"
    pop_year = max((e.get("exercicio") or 0) for e in json.load(open(os.path.join(BR, "entes.json")))) or None
    # IPCA deflators: annual average of the monthly index (IBGE SIDRA 1737/2266), to R$ of the latest published year
    ipca_raw = json.load(open(os.path.join(BR, "ipca_1737.json")))
    avg = {}
    for y in YEARS:
        months = [v for k, v in ipca_raw["index"].items() if k.startswith(str(y))]
        assert len(months) == 12, f"IPCA incomplete for {y}"
        avg[y] = sum(months) / 12
    ipca_base = complete[-1]
    ipca = {"base": ipca_base, "factor": {str(y): round(avg[ipca_base] / avg[y], 6) for y in YEARS},
            "source": ipca_raw["source"], "fetched": ipca_raw["fetched"],
            "method": "média anual do número-índice do IPCA; fator = média do ano-base ÷ média do ano"}
    # health (SICONFI annex 14, SP only so far): which UFs have any value
    health_by_uf = defaultdict(int)
    for c in cities:
        if any(r.get("sau") is not None for r in c["years"].values()):
            health_by_uf[c["uf"]] += 1
    meta_doc = {"years": complete, "updated": updated, "extracted": extracted, "version": version,
                "popYear": pop_year, "popSource": f"SICONFI/Tesouro (cadastro de entes, exercício {pop_year}), estimativa IBGE",
                "license": "CC BY 4.0", "licenseUrl": "https://creativecommons.org/licenses/by/4.0/deed.pt_BR",
                "installed": {str(k): v for k, v in INSTALLED.items()}, "nByYear": n_by_year,
                "ipca": ipca, "health": {"ufs": sorted(health_by_uf), "cities": dict(health_by_uf)},
                "coverage": total, "coverageUf": coverage}
    fundeb_path = os.path.join(OUT, "fundeb.json")
    if os.path.exists(fundeb_path):
        fj = json.load(open(fundeb_path, encoding="utf-8"))
        meta_doc["fundeb"] = {"years": fj["years"], "floor": fj["floor"], "publications": fj["publications"]}
    json.dump(meta_doc, open(os.path.join(OUT, "meta.json"), "w"), ensure_ascii=False)
    # small client-safe file (bundled into client code): data version, IPCA deflators, UFs with health data
    json.dump({"v": version, "ipca": ipca, "healthUfs": sorted(health_by_uf)}, open(os.path.join(OUT, "version.json"), "w"),
              ensure_ascii=False)
    print("cities", n, "coverage(mde) by year", total)
    print("published years", complete)
    print("size MB", os.path.getsize(os.path.join(OUT, "cities.json")) / 1e6)


def main():
    cities_path = os.path.join(OUT, "cities.json")
    before = os.path.getsize(cities_path)
    write_etapas()
    if receita_covers(siope_present()):
        build_published()
    else:
        after = os.path.getsize(cities_path)
        assert after == before, (before, after)


if __name__ == "__main__":
    main()
