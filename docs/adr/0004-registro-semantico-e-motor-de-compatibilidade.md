# ADR 0004 — Registro semântico de indicadores (T18) e motor de compatibilidade (T20) em JS, revalidados em Python

**Estado:** proposta (F0, 22/10/2026) · **Vale a partir da:** F2

## Contexto

Hoje cada uma das 49 séries do acervo tem `titulo`, `unidade`, `orgao`, `serie_codigo`, `criterio`, `fonte` e `pontos`, e o
comparador "Sobrepor indicadores" já recusa misturar unidades (converte em base 100 e avisa). A especificação exige um registro
versionado por indicador (`indicator_id`, `version`, `measure_kind`, `unit`, `dimensions`, `frequency`, `period_basis`,
`aggregation_rule`, `allowed_transforms`, `comparability_group`, `source`, `revision_policy`, `quality`) e um motor que devolve
`allowed`, `warnings`, `blockers` com códigos estáveis (`UNIT_MISMATCH`, `GEO_BREAK`, `PERIOD_MISMATCH`, `METHOD_BREAK`,
`BASE_UNAVAILABLE`, `PARTIAL_WINDOW`), validado de novo "no backend" (uma URL adulterada não contorna a regra). Não há backend:
o "backend" é o robô que publica.

## Decisão

1. `dados/registro.json`: uma entrada por indicador com os campos de T18; nasce preenchido a partir do acervo (49 séries) pelo
   script `robos/gera-registro.py`, com `version: "1"` e `comparability_group` por unidade e conceito. Mudar conceito = nova versão.
2. `modulos/compatibilidade.js`: função pura `validar({series, transformacao, recorte, registro}) → {allowed, warnings, blockers,
   alternativas}`, usada pela tela antes de desenhar (T20) e pelo exportador.
3. `robos/compatibilidade.py`: a **mesma regra** em Python; o robô que publica um snapshot roda todas as comparações salvas como
   fixtures e falha a publicação se JS e Python divergirem. As regras ficam numa **tabela JSON única** (`dados/regras-compat.json`:
   que transformação é válida para que `measure_kind`/`unit`, quais códigos cada quebra gera) interpretada pelos dois; o código
   só aplica a tabela.
4. Fixtures compartilhadas em `teste/compat/*.json` (entrada → saída esperada), rodadas pelo Node e pelo Python no CI.
   Casos obrigatórios: 10% → 8% = −2 p.p. (relativo −20% só se escolhido); base 100 bloqueada sem base comum; seis séries no
   celular em pequenos múltiplos; juros % a.a. × inflação acumulada = mesma notação, conceitos diferentes (`warnings`).

## Alternativas

| | A · Motor só no JS | **B · Tabela de regras única, JS na tela e Python no robô (escolhida)** | C · Motor só no Python, tela consome resultado pronto |
|---|---|---|---|
| Prós | um código só; resposta imediata na tela | resposta imediata na tela e revalidação na publicação; uma fonte de verdade (a tabela); fixtures iguais | impossível adulterar na tela |
| Contras | URL adulterada passa; a regra não é revalidada antes de publicar | duas implementações da leitura da tabela (pequenas, ~150 linhas cada) e um teste de equivalência a manter | sem feedback na hora de montar o gráfico; cada combinação nova exige rodar o robô |

## Consequências

- O comparador atual (`sobrepor()`) passa a chamar `validar` e a mostrar a alternativa válida em vez de converter em silêncio.
- Cartão, detalhe, comparação e exportação usam o mesmo contrato `MetricCard` (T40: `status` é dado, não cor).

## Condição de mudar

Se a tabela de regras não expressar um caso (ex.: deflator por período misto), a regra vira código nos dois lados **com fixture
antes**; se isso acontecer três vezes, revisar o formato da tabela, não abandonar a dupla validação.

## Como se prova

`node teste/compat.js` e `python3 -I robos/compatibilidade.py --teste` passam nas mesmas fixtures; paridade do comparador.
