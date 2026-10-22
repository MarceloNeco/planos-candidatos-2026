# Medição real das fontes (22/10/2026, a partir do container de sessão)

Todas as chamadas abaixo foram feitas com `curl` ou com o protótipo em Python, sem chave, em 22/10/2026 entre 17h30 e 18h30 UTC.
Serve para a entrega 4 (custo real das duas primeiras famílias) e para o registro de fontes.

## Onda 1 · IBGE e BCB

| Chamada | Resultado | Tempo | Tamanho |
|---|---|---|---|
| `servicodados.ibge.gov.br/api/v3/agregados/1737/metadados` | **conexão derrubada** (Connection reset by peer), 3 tentativas, HEAD e GET | 7–12 s até cair | — |
| `apisidra.ibge.gov.br/values/t/1737/n1/all/v/69/p/last 3` | 200 | 0,54 s | 1,1 KB |
| `apisidra.ibge.gov.br/values/t/1737/n1/all/v/69/p/all` (562 meses do IPCA) | 200 | 0,85 s | 95 KB |
| `api.bcb.gov.br/.../bcdata.sgs.432/dados?...2024..2026` | 200 | 0,9 s | 39 KB |
| `api.bcb.gov.br/.../bcdata.sgs.13762/dados/ultimos/3` | 200 | 0,5 s | 115 B |
| `bcdata.sgs.432` janela de 10 anos (3 janelas) | **HTTP 200 com HTML "Requisição inválida"** (não é JSON) | 30 s cada | 6 KB |
| `bcdata.sgs.432` janelas de 5 anos (6 janelas) | 5 × 200 e **1 × 502** (2013–2017, transitório) | 1,1 a 27 s | 53–69 KB |
| `bcdata.sgs.4189/dados/ultimos/3` | 200 | 1,3 s | — |
| `dadosabertos.bcb.gov.br` (CKAN, licença do dataset) | **403** ao leitor automático | 0,2–0,6 s | — |

**Protótipo `robos/prototipo-ibge-bcb.py`** (biblioteca padrão do Python): 7 chamadas, 66,9 s, 1 nova tentativa; reproduziu **28 anos do IPCA** (dezembro de cada ano, SIDRA 1737 v69) e **27 anos da meta da Selic** (último valor do ano, SGS 432) **exatamente iguais ao acervo** do `index.html` 2.5.3. Lições para o robô de verdade:

1. IBGE: ter dois caminhos (agregados v3 e apisidra) e tratar queda de conexão como "fonte degradada", não como zero.
2. BCB: janelas curtas (3 anos ou `ultimos/N` para a atualização diária; carga histórica uma vez, em janelas de 5 anos, com nova tentativa); validar `Content-Type: application/json` antes de aceitar.
3. Idempotência: o robô só grava quando o conteúdo mudou; o manifesto guarda `source_published_at` (data do último período), `first_seen_at` e `published_at` (commit).

## Onda 2 · Câmara e Senado

| Chamada | Resultado | Tempo | Tamanho |
|---|---|---|---|
| `dadosabertos.camara.leg.br/api/v2/deputados?itens=5` | 200 | 1,6 s | 2,2 KB |
| `.../api/v2/votacoes?dataInicio=2026-10-01&dataFim=2026-10-21&itens=5` | 200 | 0,75 s | 2,9 KB |
| `.../api/v2/deputados/204379/despesas?ano=2026&itens=3` | 200 | 0,54 s | 131 B |
| `.../api/v2/referencias/proposicoes/codTema` | 200 | 0,53 s | 2,6 KB |
| `legis.senado.leg.br/dadosabertos/senador/lista/atual.json` | 200 | 1,2 s | 130 KB |
| `.../dadosabertos/votacao?dataInicio=20261001&dataFim=20261021` | **400** (formato de data errado) | 0,8 s | — |
| `.../dadosabertos/votacao?dataInicio=2026-10-01&dataFim=2026-10-21` | 200 | 1,2 s | 55 KB |

O robô atual `congresso-sync.py` já usa as duas APIs em produção (todo dia às 06h17, ~5 min por rodada, só biblioteca padrão). O custo de "conectar" a família já foi pago; o que a F3 acrescenta é identidade por ID oficial, presença, cota reconciliada e o manifesto por dataset.

## Demais famílias (só alcance, para o registro)

| Chamada | Resultado | Tempo |
|---|---|---|
| `dadosabertos.tse.jus.br/api/3/action/package_show?id=candidatos-2026` | 200; licença **CC-BY** no metadado; 92 recursos | 0,6 s |
| `cdn.tse.jus.br/.../consulta_cand_2026.zip` | 200 (HEAD) | 0,26 s |
| `resultados.tse.jus.br/oficial/comum/config/ele-c.json` | 200 | 0,18 s |
| `apidatalake.tesouro.gov.br/ords/siconfi/tt/rreo?...` (SP, 2025, período 1) | 200 | 1,5 s / 1,36 MB |
| `api.portaldatransparencia.gov.br/api-de-dados/emendas` | 401 "Chave de API não informada" (exige chave) | 0,6 s |
| `api-publica.datajud.cnj.jus.br/` | 401 (exige credencial, como documentado) | 0,9 s |
| `www.tse.jus.br/eleicoes/calendario-eleitoral` | 403 ao leitor automático | — |

## Limite desta medição

Feita de um container na nuvem, por um proxy; um runner do GitHub Actions pode ter outro comportamento (o IBGE, por exemplo, pode aceitar lá e recusar aqui, ou o contrário). O gate de homologação (duas semanas de operação) é o que decide.
