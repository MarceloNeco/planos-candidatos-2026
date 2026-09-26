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
- Nada de ranking, nota geral ou recomendação de voto em lugar nenhum.
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
