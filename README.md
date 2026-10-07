# Radar MDE · Brasil

Painel que mostra, para os **5.570 municípios brasileiros**, quanto da receita de impostos foi aplicado em
Manutenção e Desenvolvimento do Ensino (mínimo constitucional de 25%), o uso do Fundeb e o investimento por aluno,
de 2008 a 2025, do macro ao micro: Brasil → grandes regiões → estados → municípios. Inspirado na tese de Adriana
Zanini da Silva (UNINOVE, 2021) sobre o financiamento da educação básica em Santo André.

## Rodar localmente

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

## Atualizar os dados

Tudo é baixado antes e servido como site estático (nenhuma chamada às APIs em tempo de uso).

```bash
python3 scripts/fetch_br.py ref           # IBGE (municípios, malhas) + SICONFI (população)  ~1 min
python3 scripts/fetch_br.py indicadores   # SIOPE: indicadores por UF e ano, 2008–2025        ~5 min
python3 scripts/fetch_br.py receita       # SIOPE: receitas 2008–2020 para a base de impostos ~1,5 h
scripts/build_geo.sh                      # malhas → web/public/geo/*.topo.json (mapshaper)
python3 scripts/build_data.py             # gera web/src/data/{cities,states,meta}.json
```

Cada passo pula arquivos já baixados (`data/raw/br/`); apague um arquivo para baixá-lo de novo. `THREADS=6` controla
o paralelismo; `YEARS=2025` restringe os anos. Anos só são publicados quando ≥ 85% dos municípios do país têm dados.

Opcional, só São Paulo: `YEARS=2025 python3 scripts/fetch.py` baixa o RREO Anexo 14 do SICONFI (checagem cruzada
e % em saúde).

## Estrutura

- `scripts/` — coleta (SIOPE, SICONFI, IBGE) e montagem da base.
- `web/` — Next.js (App Router), ~5.600 páginas geradas estaticamente.
  - `/` Brasil: indicadores, mapa por estado ou por município, regiões, evolução, ranking de estados, déficits.
  - `/regiao/[slug]` região (norte, nordeste, centro-oeste, sudeste, sul) com o mesmo painel.
  - `/[uf]` estado: mapa municipal, comparação com região e país, governo estadual, tabela filtrável.
  - `/[uf]/[municipio]` ficha do município: série, posição no estado e no país, vizinhos, modelos de pedido
    (LAI, CACS-Fundeb, vereador, Tribunal de Contas/MP).
  - `/explorar` tabela nacional com filtros e CSV; `/acompanhar` lista salva no navegador; `/dados` CSVs por UF;
    `/sobre` metodologia. Busca global com ⌘K.
  - `/data/municipios.json` e `/data/indice.json` são gerados no build e usados pelos mapas, busca e explorador.

## Interface

Next.js + Tailwind v4 + [shadcn/ui](https://ui.shadcn.com) (Base UI) com gráficos shadcn/Recharts e visual inspirado no
Geist da Vercel (fonte Geist, tema claro/escuro). Regras de design em `web/DESIGN.md`; componentes base em
`web/src/components/kit/` (PageHeader, Panel, Stat, Segmented, StatusBadge, tema) e `web/src/components/ui/` (shadcn).

## Fontes

- FNDE — SIOPE, API de dados abertos (`DADOS_ABERTOS_SIOPE`, indicadores e receitas; municipal e estadual).
- Tesouro Nacional — SICONFI (entes/população; RREO Anexo 14 para SP).
- IBGE — localidades e malhas municipais/estaduais.
