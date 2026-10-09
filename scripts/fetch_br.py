"""Fetch everything the national dataset needs into data/raw/br/.

  python3 scripts/fetch_br.py ref            IBGE municipalities + SICONFI entes (population) + IBGE meshes
  python3 scripts/fetch_br.py indicadores    SIOPE indicators, one file per UF-year (2008–2025)
  python3 scripts/fetch_br.py receita [UF..] SIOPE revenue lines for the art. 212 base, per UF-year (2008–2020)
  python3 scripts/fetch_br.py ipca           IPCA monthly index (IBGE SIDRA table 1737, variable 2266), for deflators

Every step skips files that already exist, so it can be re-run after a failure.
Environment: THREADS (default 6), YEARS (comma list, overrides the default range).
"""
import gzip, json, os, sys, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

RAW = os.path.join(os.path.dirname(__file__), "..", "data", "raw", "br")
os.makedirs(RAW, exist_ok=True)
SIOPE = "https://www.fnde.gov.br/olinda-ide/servico/DADOS_ABERTOS_SIOPE/versao/v1/odata/"
IBGE = "https://servicodados.ibge.gov.br/api"
UFS = ["RO", "AC", "AM", "RR", "PA", "AP", "TO", "MA", "PI", "CE", "RN", "PB", "PE", "AL", "SE", "BA",
       "MG", "ES", "RJ", "SP", "PR", "SC", "RS", "MS", "MT", "GO", "DF"]
THREADS = int(os.environ.get("THREADS", "6"))
KEEP = {
    "1.1", "1.2", "1.4", "2.8", "4.8", "4.9", "4.1", "4.2", "4.10", "7.2", "7.3", "8.1", "8.2",
    "4.14", "4.15", "4.5", "4.6", "2.1", "2.2", "2.4", "2.5", "2.9", "2.10",
}
CODES = {
    "4,11,10,00,00,00",  # impostos (IPTU, ISS, ITBI, IRRF)
    "4,19,11,00,00,00",  # multas e juros de mora dos tributos
    "4,19,13,00,00,00",  # multas e juros da dívida ativa dos tributos
    "4,19,31,00,00,00",  # dívida ativa tributária
    "4,17,21,01,02,00",  # FPM
    "4,17,21,01,05,00",  # ITR
    "4,17,21,36,00,00",  # ICMS desoneração (LC 87/96)
    "4,17,22,01,01,00",  # cota-parte ICMS
    "4,17,22,01,02,00",  # cota-parte IPVA
    "4,17,22,01,04,00",  # cota-parte IPI exportação
}


def get(url, tries=6, timeout=300):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "radar-mde/1.0"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                body = r.read()
            return json.loads(gzip.decompress(body) if body[:2] == b"\x1f\x8b" else body)
        except Exception as e:
            print("retry", i, url[:140], e, flush=True)
            time.sleep(5 * (i + 1))
    raise RuntimeError(url)


def years(default):
    return [int(y) for y in os.environ["YEARS"].split(",")] if os.environ.get("YEARS") else list(default)


def save(p, data):
    tmp = p + ".tmp"
    json.dump(data, open(tmp, "w"), ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, p)


# ---------------------------------------------------------------- reference data
def ref():
    p = os.path.join(RAW, "ibge_municipios.json")
    if not os.path.exists(p):
        save(p, get(f"{IBGE}/v1/localidades/municipios"))
    p = os.path.join(RAW, "entes.json")
    if not os.path.exists(p):
        d = get("https://apidatalake.tesouro.gov.br/ords/siconfi/tt/entes")["items"]
        save(p, [e for e in d if e["esfera"] in ("M", "D")])  # DF files as "D"
    # Meshes (TopoJSON is not offered at every level; GeoJSON + mapshaper later)
    mesh = {
        "malha_br_uf.json": f"{IBGE}/v3/malhas/paises/BR?formato=application/vnd.geo%2Bjson&qualidade=minima&intrarregiao=UF",
        "malha_br_mun.json": f"{IBGE}/v3/malhas/paises/BR?formato=application/vnd.geo%2Bjson&qualidade=minima&intrarregiao=municipio",
    }
    for name, url in mesh.items():
        p = os.path.join(RAW, name)
        if not os.path.exists(p):
            save(p, get(url, timeout=600))
            print(name, os.path.getsize(p) // 1024, "KB", flush=True)
    # Per-state meshes at a finer quality for the state dashboards
    for uf in UFS:
        p = os.path.join(RAW, f"malha_{uf}.json")
        if not os.path.exists(p):
            save(p, get(f"{IBGE}/v3/malhas/estados/{uf}?formato=application/vnd.geo%2Bjson"
                        "&qualidade=intermediaria&intrarregiao=municipio", timeout=600))


# ---------------------------------------------------------------- SIOPE indicators
def indicadores_one(uf, year):
    p = os.path.join(RAW, f"siope_{uf}_{year}.json")
    if os.path.exists(p):
        return
    rows, skip = [], 0
    while True:
        url = (SIOPE + "Indicadores_Siope(Ano_Consulta=@Ano_Consulta,Num_Peri=@Num_Peri,Sig_UF=@Sig_UF)"
               f"?@Ano_Consulta={year}&@Num_Peri={1 if year < 2017 else 6}&@Sig_UF='{uf}'&$format=json"
               f"&$top=10000&$skip={skip}&$orderby=COD_MUNI,COD_EXIB&$select=TIPO,COD_MUNI,NOM_MUNI,COD_EXIB,VAL_INDI")
        batch = get(url)["value"]
        rows += [x for x in batch if x["COD_EXIB"] in KEEP]
        if len(batch) < 10000:
            break
        skip += 10000
    save(p, rows)
    print("ind", uf, year, len(rows), "rows", len({r["COD_MUNI"] for r in rows}), "entes", flush=True)


def indicadores():
    jobs = [(uf, y) for y in years(range(2008, 2026)) for uf in UFS]
    run(indicadores_one, jobs)


# ---------------------------------------------------------------- SIOPE revenue (art. 212 base)
UF_CODE = {"RO": 11, "AC": 12, "AM": 13, "RR": 14, "PA": 15, "AP": 16, "TO": 17, "MA": 21, "PI": 22, "CE": 23,
           "RN": 24, "PB": 25, "PE": 26, "AL": 27, "SE": 28, "BA": 29, "MG": 31, "ES": 32, "RJ": 33, "SP": 35,
           "PR": 41, "SC": 42, "RS": 43, "MS": 50, "MT": 51, "GO": 52, "DF": 53}


def munis_of(uf):
    # SIOPE's COD_MUNI is the 6-digit IBGE code (no check digit)
    return sorted(m["id"] // 10 for m in json.load(open(os.path.join(RAW, "ibge_municipios.json")))
                  if m["id"] // 100000 == UF_CODE[uf])


def receita_one(uf, year):
    p = os.path.join(RAW, f"siope_receita_{uf}_{year}.json")
    if os.path.exists(p):
        return
    per = 1 if year < 2017 else 6
    # COD_EXIB_FORMATADO can't be filtered server-side, and unordered $skip paging drops rows:
    # query small COD_MUNI ranges that fit in one page and keep the codes locally.
    munis = munis_of(uf)
    rows = []
    for k in range(0, len(munis), 25):
        lo, hi = munis[k], munis[min(k + 25, len(munis)) - 1]
        f = f"NOM_COLU eq 'Receitas Realizadas' and COD_MUNI ge {lo} and COD_MUNI le {hi}"
        url = (SIOPE + "Receita_Siope(Ano_Consulta=@Ano_Consulta,Num_Peri=@Num_Peri,Sig_UF=@Sig_UF)"
               f"?@Ano_Consulta={year}&@Num_Peri={per}&@Sig_UF='{uf}'&$format=json&$top=10000"
               "&$select=TIPO,COD_MUNI,COD_EXIB_FORMATADO,VAL_DECL&$filter=" + urllib.parse.quote(f))
        batch = get(url)["value"]
        assert len(batch) < 10000, (uf, year, lo, hi)
        rows += [x for x in batch if x["TIPO"] == "Municipal" and x["COD_EXIB_FORMATADO"] in CODES]
    save(p, rows)
    print("rec", uf, year, len(rows), "rows", len({r["COD_MUNI"] for r in rows}), "entes", flush=True)


def receita(ufs):
    jobs = [(uf, y) for uf in ufs for y in years(range(2008, 2021))]
    run(receita_one, jobs)


# ---------------------------------------------------------------- IPCA (inflation)
SIDRA = "https://apisidra.ibge.gov.br/values"


def ipca():
    """IPCA número-índice (dez/1993 = 100), every month, Brasil: SIDRA table 1737, variable 2266.
    Always re-downloaded (it is small and grows every month)."""
    rows = get(f"{SIDRA}/t/1737/n1/all/v/2266/p/all?formato=json")
    out = {r["D3C"]: float(r["V"]) for r in rows[1:] if r.get("V") not in (None, "", "...", "-")}
    save(os.path.join(RAW, "ipca_1737.json"), {"source": "IBGE/SIDRA, tabela 1737, variável 2266 (IPCA - número-índice, dez/1993=100)",
                                                "fetched": time.strftime("%Y-%m-%d"), "index": out})
    print("ipca months", len(out), "last", max(out))


def run(fn, jobs):
    t0 = time.time()
    with ThreadPoolExecutor(THREADS) as ex:
        futs = {ex.submit(fn, *j): j for j in jobs}
        for n, f in enumerate(as_completed(futs), 1):
            try:
                f.result()
            except Exception as e:
                print("FAILED", futs[f], e, flush=True)
            if n % 20 == 0:
                print(f"{n}/{len(jobs)} in {time.time() - t0:.0f}s", flush=True)
    print("done", fn.__name__, len(jobs), f"{time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "ref"
    if cmd == "ref":
        ref()
    elif cmd == "indicadores":
        indicadores()
    elif cmd == "receita":
        receita(sys.argv[2:] or UFS)
    elif cmd == "ipca":
        ipca()
