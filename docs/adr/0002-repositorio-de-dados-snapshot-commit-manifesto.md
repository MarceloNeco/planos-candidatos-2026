# ADR 0002 — Repositório público de dados: snapshot = commit, `manifesto.json`

**Estado:** proposta (F0, 22/10/2026) · **Decisão do dono já tomada:** repositório público só de dados (`radar-one-dados`, parecer, seção 6, item 3)

## Contexto

A especificação pede snapshots reproduzíveis (T19, T38), proveniência por observação e `source_published_at` separado de
`first_seen_at` e `published_at`. Não há banco nem servidor: GitHub Free, Actions gratuito só em repositório público, Pages
com teto de 1 GB (docs/limites-planos-gratuitos.md). O app atual já faz isso em miniatura: `congresso-sync.py` grava
`congresso/` e `cola/` com um commit por dia.

## Decisão

- Repositório **público** `radar-one-dados`, publicado em `solverone.com.br/radar-one-dados/` (mesma origem: sem CORS, mesmo cache).
- Estrutura: `fontes/<familia>/<dataset>/<recurso>.csv|json` (ex.: `fontes/bcb/sgs-432/anual.csv`), `manifesto.json` na raiz e
  `README.md`. Séries longas em CSV por indicador; JSON só para metadados e listas pequenas.
- **Snapshot = commit.** `snapshot_id` é o sha do commit que gravou o manifesto; o manifesto lista, por dataset: `source_id`,
  `recurso`, `arquivo`, `sha256`, `linhas`, `method_version`, `source_published_at` (último período da origem), `first_seen_at`,
  `published_at` (hora do commit, UTC), `estado` (documentada/piloto/homologado/degradado) e `ultimo_erro`. Um robô só grava
  quando o sha256 do conteúdo mudou (idempotente); o manifesto muda sempre que algo mudou.
- O site lê `manifesto.json` com `cache: 'no-cache'` e prazo de 4 s, guarda a última cópia (IndexedDB) e mostra "última versão
  disponível de [data]" quando a rede falha. "Versão salva" (T19/T41) = o painel guarda no aparelho o conjunto exato de
  observações que usou (não só a data), para reabrir igual mesmo depois de republicação.

## Alternativas

| | A · Dados dentro do repositório do produto | **B · Repositório de dados separado (escolhida)** | C · Supabase como fonte pública |
|---|---|---|---|
| Prós | um lugar só; um deploy só | Actions gratuito e sem limite de minutos em repositório público; histórico de dados separado do histórico de código; PR do produto não carrega commits de robô; teto de 1 GB só para dados | consulta dinâmica, filtros |
| Contras | commits diários de robô poluem o histórico do código; o site do produto cresce até o teto de 1 GB; um robô quebrado pode travar o deploy do app | dois repositórios para o dono acompanhar; publicação do site e dos dados em momentos diferentes (o manifesto resolve: o site diz qual snapshot está mostrando) | egress de 5 GB, pausa em 7 dias sem uso, precisa de API e RLS para leitura pública; contra o parecer ("leitura pública nunca bate no Supabase") |

## Consequências

- O `congresso-sync.py` e o workflow migram para o repositório de dados (F3); até lá continuam no repositório do produto.
- Fixar uma versão antiga = ler os arquivos por commit (`raw.githubusercontent.com/<conta>/radar-one-dados/<sha>/…`, que responde com
  CORS aberto) só em exportação e auditoria; a navegação normal usa sempre o último snapshot publicado.
- Tamanho: o acervo atual (ig + dados) tem 1,7 MB; séries diárias (Selic desde 1998 = 8.268 linhas, ~60 KB em CSV) cabem com folga.
  Revisar quando o repositório passar de 300 MB.

## Condição de mudar

Repositório de dados acima de 1 GB, ou necessidade real de consulta dinâmica (filtros no servidor) → mover séries frias para
Cloudflare R2 e consultar por Worker (gratuito até 100 mil requisições/dia), mantendo o manifesto como contrato.

## Como se prova

`manifesto.json` validado por esquema (robô falha se faltar campo); teste de replay: rodar o robô duas vezes seguidas não gera
segundo commit; o site mostra o `snapshot_id` em "Fonte e cálculo" de todo cartão.
