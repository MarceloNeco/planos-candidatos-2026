# Arquitetura — Eleições 2026 (planos-candidatos-2026)

Site estático, sem build, sem framework. **Um arquivo por idioma**: `index.html` (PT-BR) e
`index-en.html` (EN-US). Os dois têm o **mesmo código**; só os blocos de dados mudam.

## O que é cada arquivo

| Arquivo | O que é | Mexer? |
|---|---|---|
| `index.html` | a página em português: HTML + CSS + JS + dados embutidos | **sim — é a fonte** |
| `index-en.html` | a mesma página em inglês, **gerada** pelo `sincroniza-en.py` | só os blocos de dados (JSON) |
| `sincroniza-en.py` | copia o código do `index.html` para o `index-en.html`, mantendo os dados em inglês | rodar depois de toda edição de código |
| `*.pdf` | os oito planos de governo registrados, sem alteração | nunca |
| `banner.jpg`, `trilha.mp3` | capa e trilha sonora (a trilha é opcional: sem o arquivo o botão some) | — |
| `TESTE-VOZ-planos-candidatos-2026.html` | página avulsa para descobrir que vozes o navegador entrega | — |
| `congresso-pautas.json` | **o método do Congresso**: as 10 pautas (tema oficial da Câmara e palavras-chave), os 9 eixos de posicionamento (cada votação nominal e para que lado conta o Sim) e as votações marcantes da ficha, em PT e EN | **sim — é a fonte do método** |
| `congresso-sync.py` | baixa votos e propostas (Câmara e Senado, desde 2019), candidaturas e patrimônio (TSE), calcula posição por eixo e propostas por pauta e gera a pasta `congresso/` (≈5 min) | rodar depois de mexer no método |
| `congresso/` | `indice.json` (método, placares, média de cada partido, datas) + um arquivo por estado (`SP.json`…) com candidatos, currículo, votos, posição por eixo e propostas por pauta + `recentes.json` (últimas 25 votações nominais das duas Casas, com o voto de cada parlamentar ligado) | **nunca à mão**: é gerada pelo script |
| `presidencia-compromissos.json` | acompanhamento do presidente eleito: mapa macrotema → temas oficiais da Câmara e o **status editorial** de cada compromisso (só com ato oficial e link) | **sim — anotar o andamento aqui** |
| `presidencia/mandato.json` | resultado da Presidência no TSE (eleito, 2º turno) e atos do Executivo (PL, PLP, PEC, MPV) desde a posse em 05/01/2027 | **nunca à mão**: gerado pelo `congresso-sync.py` |
| `.github/workflows/congresso-sync.yml` | roda o `congresso-sync.py` todo dia às 06h17 (Brasília) e grava a pasta `congresso/`; também pelo botão "Run workflow" na aba Actions | — |

## Dentro do `index.html` (de cima para baixo)

1. `<head>` + `<style>` principal — tokens de cor (`:root`), tema escuro, layout de todas as abas.
2. `<nav>` e as oito `.view` (Início, Currículo, Infográficos, Macrotemas, Índice sob medida,
   Documentos, Método, Glossário), rodapé, janelas (`<dialog>`) de Configurações e Sobre.
3. Blocos de dados `<script type="application/json">`:
   `traden` (dicionário PT→EN da interface — **é código, igual nos dois arquivos**), `dados`
   (citações, candidatos, macrotemas, versões), `ig` (séries e marcos), `bio`, `glos`, `patr`,
   `dlinks`, `proc` — **estes sete são os únicos que diferem entre PT e EN**.
4. **Script principal** (`(function(){ "use strict"; ... })()`): preferências (`PREFS`, chave
   `planos2026:prefs` no localStorage), idioma (`TR`, `traduzDOM`), gráficos, tabelas, filtros,
   Configurações (`pintaPainelOC`), exportação (`window.DL`). No fim expõe `window.PG`, a ponte
   que os blocos de apoio usam.
5. **Leitura em voz alta** (`<style>` + `<script>` "v1.7"): `window.VozLeitor` (o leitor),
   `window.VozPainel` (seção nas Configurações). Chave `planos2026:voz`.
6. **Blocos de apoio** (`<style>` + `<script>` "v1.8"): AssistONE, menu ☰ do celular,
   compartilhar (`window.PGShare`), acessibilidade (`window.CfgAcess`, `window.CfgAssist`).
7. **Escolha e Congresso** (`<style>` + `<script>` "v2.0", no fim): a tela de escolha (`#hub`), o botão
   "Presidência ▾ / Congresso ▾" ao lado do nome do site e o módulo Congresso (objeto `Cg`), com abas
   próprias no topo (`#cg-menu`): `#congresso` (início), `#congresso/afinidade`, `/favoritos`, `/comparar`,
   `/metodo` e a ficha `#congresso/ficha/<UF>/<id do TSE>`.
   As duas telas são `.view` vazias no HTML (`v-hub`, `v-congresso`) e entram no roteador pela lista
   `MODOS_V`; no ☰, na busca e no AssistONE entram pelas chaves `hub` e `congresso…` do `TELAS`
   (o ☰ mostra só as páginas da parte em que a pessoa está).
   Endereço sem `#`: a primeira visita abre a escolha; depois, a última parte usada (`planos2026:modo`).
   Prioridades, posições, favoritos, comparação e cola ficam em `planos2026:congresso`. Textos em `T(pt, en)`.
   Contas: `Cg.pos` (posição num eixo: voto próprio → padrão geral → bancada do partido), `Cg.afPos`,
   `Cg.afPri`, `Cg.geral`; arrastar e soltar em `ordenavel()`.
   **Mandato** (`#congresso/mandato`, `Cg.telaMandato`): novidades desde a última visita (`recentes.json` ×
   favoritos; contador 🔔 no menu), eleitos do estado (campo `r` do TSE), presença / partido / governo
   (`c.m`) e antes × depois por eixo (`c.ea`, `c.ed`). A legislatura em curso vem de `indice.json`
   (`legislatura`), calculada pela data no script (`legislatura()`): em 01/02/2027 troca sozinha para a 58ª.
8. **Presidência · Mandato** (`#mandato`, objeto `PM`, no mesmo bloco "v2.0"): compromissos = citações do
   plano com `tipo: proposta` e `nivel` 4–5; status de `presidencia-compromissos.json`; atos do governo de
   `presidencia/mandato.json`. Eleito lido do TSE pelo script (`NUM_PRES`).
   "Conferir nas fontes oficiais" (`Cg.fontes`): o navegador lê de novo, direto nas APIs da Câmara e do
   Senado, os votos de todas as votações usadas e recalcula (`Cg.recalc`, mesma regra do script) só nesta
   visita; do TSE lê a data de publicação das candidaturas. Leitura em voz alta dos títulos do Congresso:
   entradas `#v-congresso …` no `ALVOS` do bloco de voz.

## Como a tradução funciona

A interface em inglês **não** tem HTML próprio: `traduzDOM` troca cada nó de texto cujo conteúdo
(espaços normalizados) seja **exatamente** uma chave do dicionário `traden`. Portanto:

- Mudou um texto de interface em PT? **Acrescente o par novo no `traden`** (chave = texto PT
  exato do nó, valor = EN). Sem isso, o texto aparece em português na página em inglês.
- Texto gerado pelo JS com `TR("chave")` usa `CHAVES` (PT) e `traden["chave"]` (EN).
- Os blocos novos (AssistONE, ☰, compartilhar) usam `T(pt, en)` direto, sem dicionário.
- Citações, nomes de documentos, marcos e verbetes **nunca** são traduzidos: cada trecho foi
  conferido contra o PDF.

## Regras que não se quebram

- Nenhuma preferência sai do navegador; nada é enviado a servidor. Chaves do localStorage
  começam com `planos2026:` porque o domínio é dividido com os outros apps da SolverONE.
- Nada de ranking, nota geral ou recomendação de voto. **Única exceção, decidida pelo dono em
  02/Out/2026:** a aba Congresso mostra o % de votos iguais aos da pessoa (só concordância de voto
  nas perguntas escolhidas) e pode ordenar por ele. A própria aba explica que não é nota nem recomendação.
- Todo texto novo nasce em PT **e** EN.
- Ao publicar: subir `versao` e `atualizado_em` no bloco `dados` **dos dois arquivos** e
  acrescentar a entrada em `versoes` (PT no `index.html`, EN no `index-en.html`); depois rodar
  `python3 sincroniza-en.py`.

## Onde mudar o quê

| Quero… | Onde |
|---|---|
| texto de uma aba | HTML da `.view` + par no `traden` |
| ajuda do AssistONE por tela, atalhos, dicas | objeto `TELAS`, `AO.atalhosDe`, `AO.agendaDica` (bloco de apoio) |
| itens do menu ☰ | `Gav.conteudo` (bloco de apoio) |
| seções das Configurações | `pintaPainelOC` (script principal); cartões do AssistONE e Acessibilidade em `CfgAssist`/`CfgAcess` |
| cores, tema | `:root` no `<style>` principal |
| citações, candidatos | bloco `dados` (nos dois arquivos) |
| tela de escolha, módulo Congresso, botão Atualizar | bloco "v2.0" no fim do `index.html` (`pintaHub`, `Cg.tela…`, `Seletor`) |
| pautas, eixos e votações usadas na afinidade | `congresso-pautas.json` e depois `python3 congresso-sync.py` |
| andamento de um compromisso do presidente eleito | `presidencia-compromissos.json` → `status` (o site lê direto, sem rodar script) |
| votações novas da legislatura de 2027 no antes × depois | `congresso-pautas.json` (eixos) e depois `python3 congresso-sync.py` |
