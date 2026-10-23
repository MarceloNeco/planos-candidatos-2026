# Plano da F1 — estrutura nova, em PRs pequenos e ordenados

Regras que valem em todos os PRs: 8 linhas simples do que muda; nenhum merge sem o "pode mesclar" do chat Arquitetura; nenhum
segredo; mestres (`janela.js`, `cofre.js`, `recursos.js`) intocados; nenhuma mudança no app que está no ar (o endereço antigo só
muda no PR 9); todo PR roda **as 913 verificações** (`node teste/rodar.js`) e **o harness de paridade** (`node teste/paridade.js`)
contra o mesmo snapshot e termina com 0 diferenças; nada de framework nem build.

Modelo: **Fable** desenha o que define a arquitetura e revisa; **Sonnet** executa o que tem contrato pronto (ADR + fixtures +
teste de aceite escrito antes). A coluna "Modelo" diz quem faz o PR; a revisão de todos é no chat Arquitetura.

| PR | Entrega | Como se prova que nada regrediu | Modelo |
|---|---|---|---|
| **F1-PR1 · Base e harness** | Repositório novo (cópia com histórico) + este PR da F0 já mesclado; `teste/paridade.js` e `teste/rodar.js` rodando no CI (workflow `teste.yml` com Playwright em todo PR); `.editorconfig`; pastas `modulos/`, `dados/`, `i18n/`, `robos/` criadas vazias com `LEIA-ME.md` dizendo o que vai em cada uma | CI verde: 913 + `paridade autoteste`; o site continua idêntico (nenhum arquivo servido mudou) | Fable (define o CI e os contratos de pasta) |
| **F1-PR2 · Dados fora do HTML** | Os 8 blocos JSON saem do `index.html` para `dados/<bloco>.json` e `dados/en/<bloco>.json`; `modulos/dados.js` carrega (rede primeiro, 4 s, cópia guardada) e expõe `window.__IG__` etc. exatamente como a linha 36310 faz hoje; `index-en.html` continua gerado por um `sincroniza-en.py` reduzido (só `lang`, links e `IDIOMA`) até o PR 4; `sha256(dados/ig.json)` = sha256 do bloco antigo (`6cc98b68…`) | paridade `antes × depois` = 0 (mesmo snapshot: o sha confere); 913; página abre sem rede depois da primeira visita (cópia guardada); o `legacy_catalog.json` ganha `estado_migracao: "dados-em-arquivo"` | Sonnet (contrato: ADR 0001 §1, teste de paridade pronto) |
| **F1-PR3 · Código em módulos ES** | Os 6 `<script>` viram módulos ES com o mesmo código (`modulos/calendario.js`, `infograficos.js`, `comparadores.js`, `voz.js`, `apoio.js`, `eleicoes/{congresso,presidencia,colinha}.js`, `app.js`); `index.html` carrega `app.js` com `type="module"`; nenhuma função muda de nome; `window.PG`, `window.Cg`, `window.Colinha`, `window.Calendario` continuam expostos | 913 (os testes usam os mesmos ids e globais); paridade 0; lint (`eslint` sem build) sem erro; tamanho do `index.html` < 2.000 linhas (relatório no PR) | Sonnet (contrato: ADR 0001 §2, lista de módulos e exportações escrita pelo Fable no PR1) |
| **F1-PR4 · Um HTML, dois idiomas** | `traden` vira `i18n/en.json`; `traduzDOM` lê dele; idioma pela preferência comum (`dgo:global:idioma`) e por `?lang=en`; `index-en.html` vira redirecionamento interno (`./?lang=en` + `#`); `sincroniza-en.py` apagado; teste "en.json cobre 100% das chaves" | 913 (as páginas de teste passam a ser `index.html` e `index.html?lang=en`); paridade nos dois idiomas; teste de cobertura do dicionário | Sonnet |
| **F1-PR5 · Shell com os quatro destinos** | `index.html` novo: cabeçalho curto, barra inferior **Hoje · Explorar · Indicadores · Salvos** (UX01/UX03, 44 px, `aria-current`), ☰ em grupos, 🏠, 📥, ⚙, busca; roteador único (`modulos/rotas.js`) com histórico por camada (Voltar do celular); Indicadores = os infográficos e comparadores de hoje; Hoje = entrada contextual de Eleições + atalhos; Explorar e Salvos nascem com estado vazio ("Comece por um nome, tema ou território"; "Seu primeiro painel começa aqui"); nenhum destino some pela fase eleitoral | 913; paridade 0; teste novo `teste/navegacao.js`: 4 destinos, Voltar 3 vezes, 320 px sem rolagem lateral, foco visível; Lighthouse de acessibilidade sem erro crítico | Fable (desenha o shell e o roteador) |
| **F1-PR6 · Módulo Eleições preservado** | Colinha, Presidência, Congresso, planos, macrotemas, Índice sob medida, Documentos, Método e Glossário montados **dentro** do shell como módulo `eleicoes/` carregado por `import()` quando o recurso `eleicoes` está ligado ou um link direto pede; mesmas rotas e ids; `planos2026:*` intocado | 913 inteiras (é o gate principal deste PR); paridade 0; teste de links antigos (todas as rotas `#…` do ADR 0009 abrem) | Sonnet (contrato: ADR 0001 §4, lista de rotas) com revisão Fable |
| **F1-PR7 · Interruptores e ciclo eleitoral** | `recursos-do-app.json` novo (este da F0) vira o do site; `data-recurso` em cada destino e tela; `Calendario` lê `eleicao.modo` e `eleicao.fase` com a precedência do ADR 0010; fase `acompanhamento` e `pre-campanha`; `atualizacao.cadencia` mostrada em "Cobertura e fontes"; calendário aceita `P2`/`V` e lugar = município (só o modelo; a Colinha por município fica para a F3) | 913; paridade 0; `teste/calendario.js` ampliado: relógio em 2026-10-26 → Colinha some e infográficos continuam; 2027-01-05 → acompanhamento; manual com fase "2" em qualquer data; recurso `eleicoes` desligado → arquivo por link; `recursos-do-app.json` igual ao `PADRAO` do código (teste já existe) | Fable (regra de precedência e fases) |
| **F1-PR8 · PWA** | `manifest.json`, ícones 192/512 maskable, `sw.js` do módulo com cache `dgo-radar-one-vN` (rede primeiro para código e JSON, cache primeiro para PDF/imagem/áudio), "Usar sem internet" nas Configurações, aviso Samsung → Chrome; `versoes.json` (regra zero: hoje o app não tem `sw.js` nem `versoes.json`; o dono decidiu em 17/10 que entram em PR próprio) | 913; paridade 0; teste offline: segunda visita sem rede abre Indicadores com o último snapshot e o selo "Sem internet"; `sw.js` não apaga cache de outro app (nome com o app) | Sonnet (contrato: diretriz "Usar sem internet", `sw.js` do módulo comum) |
| **F1-PR9 · Migração local** | `modulos/migracao.js` (ADR 0008): prefixo novo, esquema versionado, duplo gravar, "Voltar para a versão anterior"; painéis salvos nascem versionados | 913; `teste/migracao.js` (semear antigas → novas iguais; desfazer; idempotente); paridade 0 | Sonnet (contrato: ADR 0008, tabela de chaves) |
| **F1-PR10 · Redirecionamentos e aliases** | `dados/aliases.json` gerado do `legacy_catalog.json`; roteador aceita `#` antigos; **PR separado no `planos-candidatos-2026`** com as páginas de redirecionamento preservando o `#` e o `canonical`; `apps.json` do RootifyONE atualizado (pelo RootifyONE, não por commit) | `teste/aliases.js`: cada âncora antiga abre o bloco certo; o endereço antigo leva ao novo com o mesmo `#`; 913; paridade 0 | Fable (é o único PR que toca o app no ar; precisa de "pode mesclar" próprio) |

## Ordem e dependências

PR1 → PR2 → PR3 → PR4 → PR5 → PR6 → PR7 → PR8 → PR9 → PR10. PR2 e PR3 podem ser trocados de ordem; PR8 e PR9 podem andar em
paralelo depois do PR7. Cada PR fecha num dia de Sonnet (2 a 4 horas de sessão) ou numa sessão de Fable; a F1 inteira são 10 PRs,
dos quais 4 em Fable (1, 5, 7, 10) e 6 em Sonnet (2, 3, 4, 6, 8, 9).

## O que a F1 NÃO faz

Não liga robô novo (F2), não cria `registro.json` nem o motor de compatibilidade (F2), não toca no Supabase (F4), não muda os
rótulos públicos, não muda o conteúdo de nenhum infográfico. O produto no fim da F1 é o mesmo de hoje, com cara de aplicativo
(quatro destinos), controlado pelo RootifyONE, instalável e pronto para receber dados dinâmicos.

## Gate para passar à F2

0 regressão (913 + paridade), links antigos abrem, Lighthouse móvel sem erro crítico, `index.html` pequeno, ADRs 0001, 0005, 0008,
0009 e 0010 marcados "implementado" com a data do PR.
