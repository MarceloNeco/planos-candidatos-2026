# ADR 0003 — Robôs no GitHub Actions: um job por família, cadência por família configurada no RootifyONE, idempotentes

**Estado:** proposta (F0, 22/10/2026) · **Incorpora:** requisito 2 do dono (19/10): atualização escalonada por família, configurável no RootifyONE, sem ninguém rodar nada na mão

## Contexto

Hoje existe um robô (`congresso-sync.py`, cron `17 9 * * *` = 06h17 de Brasília, ~5 min, só biblioteca padrão do Python) num
workflow único. A especificação (T38) pede sequência idempotente, timezone explícito, atraso aleatório, retries e fila de exceções;
o parecer traduz para "cadência diária; horária só em dia de votação e só se medido". O cron do Actions atrasa na virada da hora
e é desativado após 60 dias sem atividade no repositório (docs/limites-planos-gratuitos.md). Medição desta F0: IBGE e BCB
reproduzidos em 67 s; o IBGE derrubou a conexão de um dos dois endereços; o BCB devolve HTML com HTTP 200 em janelas longas
(docs/medicao-conectores.md).

## Decisão

1. **Um workflow por família** no repositório de dados: `indicadores.yml` (IBGE, BCB, Tesouro, estatística setorial),
   `congresso.yml` (Câmara, Senado), `esferas.yml` (Siconfi, Transferegov, PNCP, estados e municípios), `judiciario-eleitoral.yml`
   (TSE, DataJud, STF, STJ, TCU) e, só na F4, `noticias.yml`. Cada um tem `schedule` com minutos **escalonados** (06h17, 06h31,
   06h45, 06h59 de Brasília: `17 9`, `31 9`, `45 9`, `59 9` UTC), `workflow_dispatch` (botão "Run workflow") e
   `concurrency` por família (nunca dois iguais ao mesmo tempo).
2. **A cadência vem do RootifyONE.** O primeiro passo de cada job lê `solverone.com.br/solverone-dados/recursos/<app>.json`
   (publicado pelo RootifyONE) e o comportamento `atualizacao.cadencia`; se a família está `"manual"` ou a cadência ainda não
   venceu (comparando com `published_at` do manifesto), o job termina sem fazer nada. O cron fica sempre no menor intervalo
   permitido (diário; o `congresso.yml` ganha um segundo `schedule` horário em dias úteis que só age se a cadência for
   `"horaria-em-sessao"` e houver sessão no dia). Assim o administrador liga, desliga e muda a cadência **sem commit**.
3. **Idempotência:** chave de execução = dataset + partição + versão da origem; o robô baixa, valida o tipo e o esquema da
   resposta (não só o status HTTP), normaliza, compara o sha256 com o arquivo atual e só grava o que mudou; commit único no
   fim ("<família>: dados oficiais de AAAA-MM-DD"); erro persistente vai para `manifesto.json → ultimo_erro` e marca o dataset
   como `degradado` sem apagar o último snapshot válido.
4. **Rede:** `User-Agent` identificado, timeout, 3 tentativas com espera exponencial, respeito a `Retry-After`, janelas curtas
   onde a fonte exige (BCB), dois caminhos onde houver (IBGE agregados v3 e apisidra).
5. **Segredos** (Portal da Transparência, DataJud, Fact Check): só em GitHub Secrets do repositório de dados; o site nunca recebe chave.
6. **Ciclo eleitoral automático** (ADR 0010): o `judiciario-eleitoral.yml` lê `eleicao.modo`; em `automatico`, dentro da janela
   do calendário, roda a cada 1–6 h (segundo `schedule` com guarda) para candidaturas, finalistas e resultados do TSE.

## Alternativas

| | A · Um workflow monolítico (como hoje) | **B · Um workflow por família, guarda por cadência (escolhida)** | C · Agendador externo (Cloudflare Worker cron chamando `workflow_dispatch`) |
|---|---|---|---|
| Prós | simples; um lugar | falha de uma fonte não derruba as outras; cadência e escalonamento por família; logs por família; o RootifyONE controla sem commit | minuto mais confiável que o cron do Actions |
| Contras | IBGE fora do ar bloqueia o TSE; cadência única; 5 min hoje viram 30 min amanhã | mais arquivos YAML (um molde, cinco cópias); cada job repete o passo de ler a configuração (1 requisição) | mais uma peça fora do GitHub; precisa de token do GitHub no Worker (segredo a mais); contra "preferência por lote no Actions" |

## Consequências

- O molde do workflow e o `robos/comum.py` (baixa com insistência, validação, manifesto) são escritos uma vez (F2) e copiados.
- "Tempo real" não é prometido: a tela mostra a cadência configurada e a hora do último snapshot, separadas do atraso da origem.
- Se o repositório de dados ficar 60 dias sem commit, o GitHub desliga os crons: o manifesto registra `published_at` e o
  RootifyONE pode avisar na Inbox do dono (pendência para o RootifyONE).

## Condição de mudar

Atraso médio do cron acima de 1 h por mais de duas semanas, ou necessidade de minuto certo numa janela eleitoral → alternativa C
só para o disparo, mantendo os robôs no Actions.

## Como se prova

Teste de contrato por família (fixtures gravadas: resposta boa, resposta HTML com 200, 502, esquema mudado); rodar duas vezes
seguidas sem novo commit; mudar `atualizacao.cadencia` no RootifyONE para `"manual"` e ver o job terminar sem gravar.
