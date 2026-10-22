# ADR 0005 — RootifyONE como editorial, conteúdo e interruptores

**Estado:** proposta (F0, 22/10/2026) · **Vale a partir da:** F1 (interruptores) e F4 (editorial)

## Contexto

A diretriz "Controle dos apps" diz que conteúdo, funções ligadas e comportamentos são administrados no RootifyONE e publicados em
`solverone-dados` (`recursos/<app>.json`, `conteudo/<app>.json`); o app lê ao abrir, com cópia local. O Eleições 2.5.3 já obedece
`assistone`, `colinha`, `assistone.dicas`, `cofre.proteger` e `eleicao.calendario`. A especificação pede operação editorial com
apurador e revisor, estados de revisão e trilha; não há equipe, e o dono decidiu (decisão 4) começar por checagens agregadas de
terceiros. O requisito 1 do dono: **nenhuma seção de admin no site público**; tudo no RootifyONE.

## Decisão

1. **Interruptores:** o produto declara em `recursos-do-app.json` os recursos `eleicoes`, `colinha`, `indicadores`, `mandatos`,
   `promessas`, `checagens`, `imprensa`, `scores` e os comportamentos `eleicao.modo`, `eleicao.fase`, `eleicao.calendario`,
   `atualizacao.cadencia`, `score.preset`, `cobertura.minima` (arquivo pronto na raiz deste PR). Recurso desligado some da
   navegação, da busca e do AssistONE (`data-recurso="id"` + `SolverRecursos`), e a rota cai no destino mais próximo; os dados
   continuam publicados. Os robôs leem o mesmo arquivo publicado (ADR 0003).
2. **Conteúdo editorial = Conteúdo dos apps do RootifyONE**, coleções com campos declarados: `promessas` (texto original,
   objetivo, linha de base, meta, prazo, competência, entrega, dependência, bloqueio, evidências), `checagens-agregadas`
   (afirmação, pessoa, data, agência, rótulo original, link, mapeamento para a taxonomia interna), `rubricas-marcos` (ato,
   dimensão, âncora 0–5, justificativa, versão), `faixas-governo`, `apelidos-e-aliases` (43 entradas) e `faq-metodo`.
   Publicação para `solverone-dados/conteudo/<app>/<colecao>.json`.
3. **Estados por item:** `rascunho → revisado → publicado` e dois papéis (`apurador`, `revisor`: quem escreve não aprova;
   exceção registrada no log quando só há o dono), com `RF.mudar` e log encadeado. O site só mostra `publicado`.
4. O que o RootifyONE **ainda não tem** e precisa ganhar na sessão mãe (regra zero, lista para o dono): estados de revisão por
   item de coleção; papel `revisor` com bloqueio "autor não aprova"; versão por item (texto alterado cria versão); exibição no
   Controle dos apps dos comportamentos `lista` com opções (hoje há `sim-nao`, `numero`, `texto`, `lista`, `cor`, `json`) e
   validação de `atualizacao.cadencia` por chave. Até lá, as coleções publicam só `publicado` e o dono faz os dois papéis.

## Alternativas

| | A · Editorial no próprio repositório (arquivos JSON por PR) | **B · RootifyONE, Conteúdo dos apps (escolhida)** | C · Editorial direto no Supabase com tela própria |
|---|---|---|---|
| Prós | Git é trilha e versão; sem tela nova | já existe (coleções, publicação, papéis, log); o dono não precisa de GitHub para editar; mesma cascata que os outros apps | papéis reais no banco; vários revisores ao mesmo tempo |
| Contras | o dono não é desenvolvedor: editar JSON e abrir PR não é uso editorial; sem papéis | precisa das evoluções do item 4; um aparelho por vez (cofre local) até a plataforma com login | mais uma tela; leitura pública nunca bate no banco, então precisaria publicar para arquivo de qualquer jeito |

## Consequências

- Nenhum veredito, promessa ou rubrica entra por código: entra pelo RootifyONE e sai como arquivo publicado.
- Os apelidos das 43 entradas e os aliases de URL (ADR 0009) também são conteúdo: o RootifyONE pode renomear sem commit.

## Condição de mudar

Quando houver mais de duas pessoas editando ou revisão simultânea, migrar as coleções editoriais para tabelas do Supabase com RLS
(ADR 0006), mantendo o arquivo publicado como saída.

## Como se prova

Teste do app com `recursos/<app>.json` simulado (como `teste/colinha-interruptor.js`): cada recurso desligado some de ☰, busca e
AssistONE e a rota cai certo; item em `rascunho` não aparece no site.
