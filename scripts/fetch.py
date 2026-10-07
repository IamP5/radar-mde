"""Fetch RREO Annex 14 (6th bimester) for all SP municipalities from SICONFI."""
import json, os, sys, time, urllib.request, urllib.parse, urllib.error
from concurrent.futures import ThreadPoolExecutor

BASE = "https://apidatalake.tesouro.gov.br/ords/siconfi/tt"
RAW = os.path.join(os.path.dirname(__file__), "..", "data", "raw")
YEARS = [int(y) for y in os.environ.get("YEARS", "2015,2016").split(",")]

DELAY = float(os.environ.get("DELAY", "1.1"))

def get(url, tries=8):
    for i in range(tries):
        time.sleep(DELAY)
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(15 * (i + 1))
            else:
                time.sleep(3)
        except Exception:
            time.sleep(3)
    raise RuntimeError(url)

def entes():
    p = os.path.join(RAW, "entes.json")
    if not os.path.exists(p):
        d = [e for e in get(f"{BASE}/entes")["items"] if e["uf"] == "SP" and e["esfera"] == "M"]
        json.dump(d, open(p, "w"), ensure_ascii=False)
    return json.load(open(p))

def fetch(args):
    cod, year, anexo, tag = args
    p = os.path.join(RAW, f"{tag}_{cod}_{year}.json")
    if os.path.exists(p):
        if json.load(open(p)) or os.path.exists(p + ".simp"):
            return
        types = ["RREO Simplificado"]  # empty full RREO: small municipalities file the simplified one
    else:
        types = ["RREO", "RREO Simplificado"]
    items = []
    for t in types:
        q = urllib.parse.urlencode({"an_exercicio": year, "nr_periodo": 6, "co_tipo_demonstrativo": t,
                                    "no_anexo": anexo, "id_ente": cod})
        try:
            items = get(f"{BASE}/rreo?{q}")["items"]
        except RuntimeError:
            return
        if items:
            break
    json.dump(items, open(p, "w"), ensure_ascii=False)
    if not items:
        open(p + ".simp", "w").close()  # both types checked and empty

if __name__ == "__main__":
    es = entes()
    anexo, tag = (sys.argv[1], sys.argv[2]) if len(sys.argv) > 2 else ("RREO-Anexo 14", "a14")
    jobs = [(e["cod_ibge"], y, anexo, tag) for y in reversed(YEARS) for e in es]
    if os.environ.get("PRIORITY"):
        ids = sorted({i for i, _ in json.load(open(os.environ["PRIORITY"]))})
        jobs = [(i, y, anexo, tag) for i in ids for y in YEARS]
    done = 0
    with ThreadPoolExecutor(int(os.environ.get("THREADS", "1"))) as ex:
        for _ in ex.map(fetch, jobs):
            done += 1
            if done % 200 == 0:
                print(done, "/", len(jobs), flush=True)
    print("done", len(jobs))
