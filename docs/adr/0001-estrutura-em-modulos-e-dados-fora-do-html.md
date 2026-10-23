# ADR 0001 — Estrutura em módulos ES e dados fora do HTML

**Estado:** proposta (F0, 22/10/2026) · **Vale a partir da:** F1

## Contexto

O app atual é um único `index.html` de 47.578 linhas e 2,9 MB, duplicado em `index-en.html` (gerado por `sincroniza-en.py`).
Dentro dele moram 8 blocos `<script type="application/json">`: `traden` (1.349 linhas, dicionário PT→EN, igual nos dois
arquivos), `dados` (20.278 linhas, 882 KB), `ig` (10.454 linhas, 808 KB: as 49 séries, os 43 gráficos, marcos, governos,
dimensões), `bio`, `glos`, `patr`, `dlinks`, `proc`. O código está em 6 `<script>` (calendário no `<head>`, principal, voz "v1.7",
apoio "v1.8", Congresso e Presidência "v2.0", Colinha "v2.2") e 6 `<style>`. Nada disso é "dinâmico e atualizável": mudar um
número é editar o HTML e regenerar o inglês. A diretriz da SolverONE proíbe framework e passo de build; o módulo comum
(`diretrizes.js`) e os mestres (`janela.js`, `cofre.js`, `recursos.js`) são arquivos copiados.

## Decisão

1. **Dados fora do HTML.** Cada bloco JSON vira arquivo em `dados/` (`dados/ig.json`, `dados/dados.json`, …) e, para o inglês,
   `dados/en/<bloco>.json` (hoje só 7 blocos diferem entre PT e EN). Séries longas podem virar CSV por indicador quando saírem
   dos robôs (ADR 0002). O site carrega com `fetch` (rede primeiro, 4 s, cópia guardada como reserva, igual ao `recursos.js`).
2. **Código em módulos ES, sem build.** `index.html` vira um shell pequeno que carrega `modulos/app.js` (`type="module"`); os
   seis scripts de hoje viram módulos com o mesmo código e as mesmas funções (`modulos/infograficos.js`, `comparadores.js`,
   `voz.js`, `apoio.js` (AssistONE, ☰, compartilhar), `eleicoes/congresso.js`, `eleicoes/presidencia.js`, `eleicoes/colinha.js`,
   `calendario.js`). Os mestres continuam `<script>` clássicos no `<head>`, intocados.
3. **Um HTML só para os dois idiomas.** `traden` vira `i18n/en.json`; o idioma vem da preferência (`dgo:global:idioma`, como nos
   outros apps) ou do caminho antigo `index-en.html`, que passa a redirecionar para `./?lang=en` mantendo o `#` (ADR 0009).
   `sincroniza-en.py` deixa de existir; o teste "index-en igual ao gerado" vira "en.json cobre todas as chaves do `traden`".
4. **O módulo Eleições é movido como está**: mesmas rotas (`#hub`, `#colinha`, `#congresso/…`, `#mandato`, …), mesmos ids e
   chaves do localStorage, para as 913 verificações continuarem valendo com ajuste só de caminho.

## Alternativas

| | A · Só tirar os dados (HTML continua um arquivo por idioma) | **B · Módulos ES sem build (escolhida)** | C · Framework com build (Vite + React/Svelte) |
|---|---|---|---|
| Prós | menor mudança; `sincroniza-en.py` continua; risco baixo | código legível por qualquer IA e pessoa; cada tela num arquivo; sem toolchain; obedece a diretriz; `import()` sob demanda carrega Eleições só quando ligado | ecossistema, componentes, tipos |
| Contras | continua um script de 11 mil linhas; o shell com quatro destinos e os interruptores por módulo ficam presos num arquivo só; o inglês continua gerado | exige navegador com módulos ES (Chrome 105+, Safari 16+, já no `compat.minimos` do RootifyONE); 1 requisição por módulo (poucos, cacheados pelo service worker) | contra a diretriz (sem build, agnóstico a LLM); reescrita = perda das 913 verificações e da paridade |

## Consequências

- O `index.html` novo tem só o shell (cabeçalho, quatro destinos, rodapé, `<script type="module">`): meta de menos de 300 linhas.
- O teste de paridade (`teste/paridade.js`) é o gate: mesmo snapshot (`dados/ig.json` com o mesmo sha256 do bloco antigo) → mesmos
  CSVs em cada um dos 43 blocos. Enquanto um bloco não bater, ele continua servido pelo código antigo (adaptador legado).
- O `ARQUITETURA.md` passa a listar "o que cada módulo faz, o que não se toca" (defesa contra reescrita, seção "Código agnóstico a LLM").

## Condição de mudar

Se o `compat.minimos` precisar descer abaixo de módulos ES (público com aparelho muito antigo), a saída é concatenar os módulos
num arquivo por script simples (ainda sem framework), não voltar ao HTML único. Se a paridade não fechar num bloco depois de duas
tentativas, aquele bloco fica no adaptador legado e a decisão não muda.

## Como se prova

913 verificações (`teste/rodar.js`) + `node teste/paridade.js comparar antes depois` com 0 diferenças + links antigos abertos (ADR 0009).
