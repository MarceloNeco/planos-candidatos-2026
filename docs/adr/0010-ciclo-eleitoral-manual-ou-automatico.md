# ADR 0010 — Ciclo eleitoral: manual ou automático, controlado pelo RootifyONE; preparado para o ciclo municipal de 2028

**Estado:** proposta (F0, 22/10/2026) · **Origem:** requisitos 1 e 2 do dono (19/10/2026) · **Vale a partir da:** F1 (PR "interruptores")

## Contexto

O dono quer: a troca entre "modo eleições" (pré-campanha, 1º turno, 2º turno, Colinha, municipais) e "modo acompanhamento" (só
infográficos, indicadores, mandatos) é configuração de **administrador no RootifyONE**, nunca numa seção de admin do site público;
dois modos, **manual** (o administrador escolhe a fase) e **automático** (a fase rola pelo calendário e os robôs atualizam notícias,
APIs e TSE numa agenda; passada a eleição, Colinha e Eleições apagam sozinhas e ficam só indicadores e acompanhamento). O
automático inclui a atualização escalonada por família de dados (ADR 0003). E a plataforma nasce pronta para prefeito e vereador
em 2028 (pré-campanha em 2027), sem reescrever nada: o calendário é dado, não código.

O que já existe (2.5.0): `window.Calendario` lê o comportamento `eleicao.calendario` do RootifyONE (ano, `fase` "auto"/"1"/"2"/
"pos", `tse`, turnos com data e cargos, `segundoTurno` manual por cargo e lugar, posse, cargos com código do TSE) e calcula a fase
pela data de Brasília; no pós-eleição a Colinha some sozinha; o 2º turno é lido do TSE (`ele-c.json` e arquivos `-u.json`) no
máximo uma vez por hora. O que falta: o modo (manual × automático) como chave própria, a fase como chave própria com
"pré-campanha" e "acompanhamento", a cadência por família, e os dados por município para 2028.

## Decisão

1. **Três comportamentos no RootifyONE** (`recursos-do-app.json`): `eleicao.modo` (`manual` | `automatico`, padrão `automatico`),
   `eleicao.fase` (`auto` | `pre-campanha` | `1` | `2` | `pos` | `acompanhamento`, padrão `auto`) e `eleicao.calendario` (o JSON de
   hoje, que continua aceitando `fase` por compatibilidade). Regra de precedência no `Calendario.fase()`: se `eleicao.modo ===
   'manual'`, vale `eleicao.fase` (e, se esta for `auto`, vale `calendario.fase`, e só então a data); se `automatico`, vale a data
   de Brasília sobre os turnos do calendário (como hoje), e `eleicao.fase` é ignorada (mostrada em cinza no RootifyONE com a nota
   "no automático a fase vem da data").
2. **Fases e o que cada uma liga** (tudo por `data-recurso` e pela fase, sem seção de admin no site):
   `pre-campanha` → recurso Eleições ligado, Colinha escondida, destaque de candidaturas em Hoje;
   `1` e `2` → como hoje (Colinha com os cargos do turno; finalistas do TSE no 2º);
   `pos` → Colinha escondida, "Eleição <ano> · encerrada", Presidência → Mandato em destaque;
   `acompanhamento` → o módulo eleitoral some da navegação como se `eleicoes` estivesse desligado (sem desligá-lo: o
   administrador pode voltar), ficam Hoje, Explorar, Indicadores e Salvos. No automático, `pos` passa a `acompanhamento`
   sozinho **na posse** (`calendario.posse`), para o arquivo da eleição ficar acessível entre o resultado e a posse.
3. **Automático também nos dados:** o `judiciario-eleitoral.yml` lê `eleicao.modo` e o calendário publicado; em `automatico`,
   entre a convenção e o último turno, roda a cada 1–6 h (TSE: candidaturas, finalistas, resultados) e, fora da janela, diária;
   as outras famílias seguem `atualizacao.cadencia`. Em `manual`, os robôs continuam na cadência configurada (o manual é do
   **modo de exibição**, não desliga a coleta; para parar a coleta, a família vai para `"manual"` em `atualizacao.cadencia`).
4. **2028 como dado:** o calendário aceita `turnos` com cargos `P2` (prefeito, dígitos 2, código TSE 11) e `V` (vereador, dígitos 5,
   código TSE 13) e `lugar` = código do município no TSE; `segundoTurno.P2` lista os municípios com 2º turno (ou lê do
   `mun-e<eleição>-cm.json` do TSE). A Colinha passa a pedir o município quando o turno tem cargo municipal (hoje pede só UF) e
   o robô gera `cola/<UF>/<municipio>.json` (hoje gera por UF). Isso é trabalho de código, mas **genérico**: feito uma vez, serve
   para 2028, 2032 e para qualquer eleição suplementar; nenhuma data ou ano fica no código (já é a regra desde a 2.5.0).
   Datas de 2028 pela Lei 9.504/1997, art. 1º: 1º turno 01/10/2028, 2º turno 29/10/2028; posse 01/01/2029. Conferir no calendário
   oficial do TSE quando publicado (as páginas do TSE bloquearam leitura automática em 22/10/2026).
5. Nada disso cria tela de administração no site: o site só **lê** o arquivo publicado; o RootifyONE é o único lugar de mudar.

## Alternativas

| | A · O robô publica os interruptores (escreve `recursos/<app>.json` quando a data vira) | **B · O app calcula a fase pela data e pelo calendário publicado; o RootifyONE só configura (escolhida; é o que a 2.5.0 já faz)** | C · Fase sempre manual (o dono muda à mão a cada etapa) |
|---|---|---|---|
| Prós | um lugar escreve o estado; o site não calcula | sem token de escrita no Actions para o `solverone-dados`; funciona mesmo se o robô falhar (a data vira no aparelho da pessoa, no horário de Brasília); testável com relógio simulado (já há `teste/calendario.js`) | simples |
| Contras | o Actions precisaria de token para gravar no `solverone-dados` (segredo a mais) e sobrescreveria o que o RootifyONE publicou; atraso do cron vira atraso de fase | duas leituras do mesmo JSON (site e robô) | depende de alguém lembrar; contra o requisito do dono |

## Conflitos apontados ao dono (não decididos aqui)

- O parecer (seção 3) listava `eleicao.calendario` como "existe" e `atualizacao.cadencia` como um valor único "diária". Os
  requisitos 1 e 2 (19/10) **ampliam**: cadência por família (JSON) e duas chaves novas (`eleicao.modo`, `eleicao.fase`). Não é
  contradição, é extensão; o parecer precisa ser atualizado na seção 3.
- `eleicao.fase` passa a existir **fora** de `eleicao.calendario.fase`. Para não quebrar quem já configurou o calendário no
  RootifyONE, a chave de dentro continua lida como reserva. O dono decide se, na F2, a de dentro é removida.
- "Pré-campanha" não existe hoje como fase; a proposta é tratá-la como "eleição ligada sem Colinha". Se o dono quiser Colinha
  também na pré-campanha (lista preliminar de candidatos), é só mudar o que a fase liga, sem mexer no modelo.

## Condição de mudar

Se o RootifyONE ganhar publicação agendada ("ligar no dia X", item "a especificar" da diretriz Controle dos apps), a troca de fase
pode virar agendamento publicado; o cálculo pela data continua como reserva.

## Como se prova

Teste com relógio simulado (`teste/calendario.js` ampliado): modo automático em 2026-10-26 → Colinha escondida, Eleições em
arquivo, infográficos visíveis; em 2027-01-05 → acompanhamento; modo manual com `eleicao.fase = "2"` em qualquer data → 2º turno;
calendário de 2028 com `P2` e `V` → Colinha pede município; cadência por família lida pelo workflow (teste do robô).
