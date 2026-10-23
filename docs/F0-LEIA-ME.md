# F0 — decisões e inventário da plataforma política (22/10/2026)

Pasta de trabalho da F0. Nada aqui foi publicado; nada no app que está no ar mudou. Quando o dono escolher o nome, este conteúdo
vai para o repositório novo num PR único (entrega 8), com os caminhos indicados no `ARQUITETURA.md`.

| Entrega | Arquivo(s) | Estado |
|---|---|---|
| 1 · Cinco nomes | na conversa | ✅ RadarONE (escolhido em 22/10/2026) |
| 2 · Repositórios e ADRs | `docs/adr/0000` a `0010` (10 ADRs + índice); repositório `radar-one-dados` (README e manifesto) | ADRs prontos; em 26/10 (depois do 2º turno): renomear este repositório para `radar-one`, criar `radar-one-dados` e o repositório-placa com o nome antigo (`docs/redirecionamento/`) |
| 3 · Manifesto legacy_catalog | `docs/legacy_catalog.json`, `docs/legacy_catalog.md`, gerador `robos/gera-legacy-catalog.py` | ✅ 43 entradas, 49 séries |
| 4 · Registro de fontes e custo real | `docs/fontes/registro-de-fontes.json` e `.md`, gerador `robos/gera-registro-fontes.py`; `docs/medicao-conectores.md`; `docs/limites-planos-gratuitos.md`; protótipo `robos/prototipo-ibge-bcb.py` + `robos/saida/` | ✅ 173 datasets (12 documentadas); IBGE e BCB medidos e conferidos contra o acervo |
| 5 · Harness de paridade | `teste/paridade.js` + `teste/paridade/` (resumos e comparações do autoteste) | ✅ autoteste passou em 22/10/2026: atual × atual = 0 diferenças (43 blocos: 41 por CSV, 2 por impressão digital); Selic alterada de propósito → acusou só `g-inflacao-e-taxa-de-juros` (1999: 19 → 20) |
| 6 · recursos-do-app.json | `docs/recursos-do-app.json` (9 recursos, 8 comportamentos, PT/EN, padrão e "onde") | ✅ rascunho; o campo `app` recebe o nome |
| 7 · Plano da F1 | `docs/plano-F1.md` (10 PRs, prova por PR, Fable × Sonnet) | ✅ |
| 8 · ARQUITETURA.md, PENDENCIAS.md e PR único | `ARQUITETURA.md`, `PENDENCIAS.md` | ✅ este PR |

Fontes lidas, na ordem pedida: as duas especificações v2 e o parecer (`rootify-one`, branch `claude/optimistic-dirac-aswbie`,
`docs/reforma/`), a diretriz geral, o `CLAUDE.md`, `ARQUITETURA.md`, `PENDENCIAS.md`, `recursos-do-app.json`, `congresso-sync.py`,
o workflow, a estrutura do `index.html` e `sincroniza-en.py` do `planos-candidatos-2026`, e `recursos.js`, `rootify-recursos.js`,
`rootify-publicar.js`, `DIRETRIZ-RECURSOS-E-CONTEUDO.md`, `PLATAFORMA-DADOS.md` e `solverone-dados/recursos/` do RootifyONE.
