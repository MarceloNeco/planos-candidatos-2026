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
| `recursos.js` | interruptores do RootifyONE (cópia avulsa do master do `rootify-one`; carregado no `<head>` das duas páginas com `data-app="eleicoes-2026"`): lê `solverone-dados/recursos/global.json` e `eleicoes-2026.json` | **nunca à mão**: trocar pela cópia nova do master |
| `janela.js` | janela comum da SolverONE (`SolverJanela` 1.0.1), carregada no `<head>` das duas páginas **antes** do `cofre.js`. Toda janela do site passa por ela (ver "Janelas" abaixo) | **nunca à mão**: cópia exata do master do `rootify-one` |
| `cofre.js` | cofre comum de chaves da SolverONE (`SolverCofre` 1.4.0), carregado no `<head>` das duas páginas **depois** do `janela.js` e antes do código do app. Guarda as chaves de voz (Gemini, OpenAI, ElevenLabs) embaralhadas, com PIN | **nunca à mão**: cópia exata do master do `rootify-one` |
| `teste/` | testes automáticos (Chromium/Playwright, só valores de mentira): `node teste/rodar.js` | sim |
| `recursos-do-app.json` | diz ao RootifyONE o que este app obedece (hoje: `assistone` e `assistone.dicas`) | sim — ao ligar um interruptor novo no código |
| `TESTE-VOZ-planos-candidatos-2026.html` | página avulsa para descobrir que vozes o navegador entrega | — |
| `congresso-pautas.json` | **o método do Congresso**: as 10 pautas (tema oficial da Câmara e palavras-chave), os 9 eixos de posicionamento (cada votação nominal e para que lado conta o Sim) e as votações marcantes da ficha, em PT e EN | **sim — é a fonte do método** |
| `congresso-sync.py` | baixa votos e propostas (Câmara e Senado, desde 2019), candidaturas e patrimônio (TSE), calcula posição por eixo e propostas por pauta e gera a pasta `congresso/` (≈5 min) | rodar depois de mexer no método |
| `congresso/` | `indice.json` (método, placares, média de cada partido, datas) + um arquivo por estado (`SP.json`…) com candidatos, currículo, votos, posição por eixo e propostas por pauta + `recentes.json` (últimas 25 votações nominais das duas Casas, com o voto de cada parlamentar ligado) | **nunca à mão**: é gerada pelo script |
| `presidencia-compromissos.json` | acompanhamento do presidente eleito: mapa macrotema → temas oficiais da Câmara e o **status editorial** de cada compromisso (só com ato oficial e link) | **sim — anotar o andamento aqui** |
| `presidencia/mandato.json` | resultado da Presidência no TSE (eleito, 2º turno) e atos do Executivo (PL, PLP, PEC, MPV) desde a posse em 05/01/2027 | **nunca à mão**: gerado pelo `congresso-sync.py` |
| `cola/` | dados da Colinha da eleição: um arquivo por estado (`SP.json`…) com todas as candidaturas de deputado federal, estadual/distrital, senador e governador (`[cargo, número, nome de urna, partido, id do TSE]`), `BR.json` (presidente), `partidos.json` (sigla → número) e `fotos/<UF>/<id>.jpg` (foto oficial do pacote de fotos do TSE, reduzida para até 120×160; precisa do Pillow). Só dados abertos do TSE | **nunca à mão**: gerada pelo `congresso-sync.py` (`--so-cola` gera só ela, em segundos) |
| `.github/workflows/congresso-sync.yml` | roda o `congresso-sync.py` todo dia às 06h17 (Brasília) e grava as pastas `congresso/`, `presidencia/` e `cola/`; também pelo botão "Run workflow" na aba Actions | — |

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

## Chaves de voz no cofre (v2.3.0, 17/Out/2026)

As chaves da leitura em voz alta **não ficam mais em texto aberto**. `planos2026:voz` guarda só motor, voz, modelo,
velocidade e tom. As chaves moram no cofre comum (`cofre.js`, nomes `ia:gemini`, `ia:openai`, `ia:elevenlabs`),
o mesmo que o Contador de Histórias usa: **a chave do cofre vale para os dois apps** (saíram `chaveContador` e os botões
"Usar a chave já salva no Contador de Histórias").

- **Migração** (`SolverCofre.registrarFontes`, no bloco "v1.7"): `planos2026:voz` (`geminiKey`, `openaiKey`, `elevenKey`)
  e `ch_config` (os mesmos três campos, **sem** `manter`: a cópia temporária que o Contador deixava para este app sai) vão para
  o cofre e **saem dos dois lugares** quando a pessoa cria o PIN (ou abre o cofre). Nenhum outro campo de um nem do outro é tocado.
- **Leitura**: `chaveCofre(prov, rótulo)` → `SolverCofre.ler`. Cofre trancado: ▶ com Gemini/OpenAI/ElevenLabs abre a janela do
  PIN dizendo para quê e a leitura segue sozinha; "Agora não" avisa que o cofre continua trancado. Sem chave nenhuma: avisa sem pedir
  PIN. A voz do aparelho nunca toca no cofre.
- **`grava()`** escreve **por cima** do que já está em `planos2026:voz` (não regrava o objeto inteiro): enquanto o cofre ainda não
  foi aberto, uma chave antiga em texto aberto não se perde antes de migrar. `P` nunca carrega as chaves.
- **Configurações → Leitura em voz alta**: "🔐 Guardado no cofre"; o campo fica vazio e colar outra chave + "Guardar no cofre"
  troca (grava só no cofre, pede PIN se preciso); "🔒 Trancar o cofre agora" aparece com o cofre aberto. Textos em `T(pt, en)`.
- Não há backup/exportação de preferências neste app que leve chaves (o `DL` exporta dados do site, não `planos2026:voz`).
- **Atenção na página em inglesa**: só se edita o `index.html` (e, a cada versão, as entradas `versao`/`versoes` do bloco `dados` do `index-en.html`); o `index-en.html` sai do `sincroniza-en.py`. O teste
  `teste/rodar.js` confere que o inglês é igual ao que o script gera.
- **Testes**: `caracterizacao.js` (vale antes e depois: voz do aparelho sem PIN, cada provedor recebe a chave guardada, motor e voz
  ficam em `planos2026:voz`, 320 px) e `voz-cofre.js` (migração, trancar/destrancar, trocar chave, nada em texto aberto).

## Janelas pela janela comum e regras do PIN (v2.4.0, 17/Out/2026)

Diretriz "Janelas (pop-ups)" da plataforma (passada das janelas, app 2). Toda janela do site abre por `SolverJanela.abrir`
(`janela.js`, cópia exata do master): a página de trás não rola nem recebe toque/foco; três saídas (botão da janela, Esc, Voltar do
celular) mais toque na parte escura (só se começa e termina nela); com texto digitado pergunta "Descartar?"; uma janela por vez.

- **`window.EJ`** (script no `<head>` do `index.html`, logo depois do `recursos.js`) é a única ponte do app com o `SolverJanela`.
  A caixa de cada janela continua sendo o elemento que já existia (agora um `<div>` com a mesma classe; a tag `<dialog>` era do
  navegador e o `<dialog>` da janela comum é o fundo): `EJ.abre(caixa, {focar, temTexto, descarta, aoFechar})` (a busca da Colinha e a do AssistONE levam `temTexto:false`: busca não é texto a perder) põe a caixa dentro da
  janela e, ao fechar, ela volta escondida para onde morava (`descarta`: some). `EJ.fecha(caixa)`; `EJ.pop(botao, menu)` para os
  quatro menus presos a um botão (idioma, seleção múltipla, compartilhar, Presidência/Congresso: mesma janela, sem escurecer,
  posicionados pelo botão); `EJ.confirma(texto, rótulo, fn)` e `EJ.aviso(texto)` no lugar de `confirm()`/`alert()` (janela curta
  `alertdialog`, `porCima`: abre por cima de qualquer janela aberta e fecha junto com ela); `EJ.aPartirDe(caixa, abrirOutra, voltar)`
  para a ajuda aberta de dentro das Configurações (nada empilha: a de baixo fecha, a nova abre e, ao fechar, a primeira volta);
  `EJ.quando(fn)` = `SolverJanela.quandoQuieto` (o `depois()` do app já usa: trocar de tela só depois que o histórico acompanhou).
- **Janelas** (todas em `EJ.abre`): glossário `#gloss`, painel de leitura `#doc` ("O que mudou", "Aviso de uso"), Configurações `#cfg`
  (o campo da chave de voz leva `data-sj-texto`: chave colada e não guardada pergunta "Descartar?"), aviso de tela estreita
  `#tela-dlg`, "i" das dimensões `#cm-info`, ajuda da voz `#tts-dlg`, Colinha (escolher candidato `#ck-dlg`, imprimir — agora com
  "Cancelar" —, aviso NOVIDADE), gaveta ☰ (`Gav`, `.gav` dentro da janela), AssistONE (`AO.box`, janela sem escurecer; o tour também)
  e os quatro menus. Telas de bloqueio: não há neste app.
- O AssistONE abre sozinho na primeira visita ("Olá!") e, como janela, passa a prender a tela até "Agora não" (pendência abaixo).
- Fechar uma janela **volta a rolagem** para onde estava (regra 5 da diretriz): ações que rolam a página depois de fechar o
  AssistONE usam `depois(...)`.
- **Cofre 1.1.0 → 1.4.0**: `SolverCofre.proteger({motivo, ocupado, tocando})` logo depois do `registrarFontes` (bloco "v1.7"):
  com chave guardada (ou chave antiga em texto aberto esperando ir para o cofre) o PIN é pedido ao abrir e ao recarregar; tranca ao
  sair do app, com o site escondido por mais de 1 minuto e com 5 minutos sem uso (voz tocando só adia). "Agora não" (Esc, Voltar,
  toque fora) deixa trancado e a voz do aparelho segue funcionando. `SolverCofre.painelDigital` desenha a digital no elemento
  `#tts-cofre-digital` (Configurações → Leitura em voz alta → "Cofre de chaves"; só aparece com o cofre criado; o app não desenha a
  digital por conta própria; o cofre só desenha num elemento já na página: `ligaDigital`).
- **Testes**: `janelas.js` (cada janela × 4 saídas × trava × "Descartar?", 390 px e computador, PT e EN) e `cofre-protecao.js`;
  os testes antigos foram ajustados: o PIN agora abre ao carregar a página quando há chave guardada (de propósito).

## Interruptor da Colinha (v2.3.0)

A Colinha da eleição obedece ao interruptor `colinha` do RootifyONE (Controle dos apps; o app o declara em
`recursos-do-app.json`, então a grade do dono já mostra a função). Desligado: some o destaque do início (`.hub-ck`), o botão
da barra do celular, o item do menu de partes e do ☰ (todos com `data-recurso="colinha"`, escondidos pelo `recursos.js`), a
busca e o atalho do AssistONE (`colinhaOff()`), o aviso "Novidade!" não abre, e `#colinha` cai em `#hub` (`rota()` e `aplica()`);
com a página aberta, ao chegar o arquivo novo ela volta para o início sozinha. `colinhaOff()` é definida no `<head>`, logo
depois do `recursos.js`. Os dados da cola de cada pessoa (`planos2026:colinha`) não são apagados. Teste: `teste/colinha-interruptor.js`.

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

9. **Colinha da eleição** (`<style>` + `<script>` "v2.2", no fim; objeto `window.Colinha`): `#colinha`, em
   destaque na tela de escolha, acima de Presidência e Congresso. Cargos na ordem da urna (federal, estadual,
   2 senadores, governador, presidente); busca sem acento, por número ou partido; imagem montada em `<canvas>`
   e enviada pelo compartilhar do celular (ou baixada); texto pelo WhatsApp; impressão (`CK.impressao` monta `#ck-print`: 1 ou 4 cópias da cola, cada uma em 1/4 da folha, sempre em fundo branco; a pessoa escolhe ao tocar em Imprimir; na
   impressão só ele aparece). Foto do candidato de
   `cola/fotos/` (o site do TSE manda o cabeçalho CORS repetido e o navegador não deixa usar a foto dele na imagem);
   sem foto, a do TSE só na tela e, sem nenhuma, as iniciais. No celular, a barra `#modo-seg` (Início · Colinha ·
   Presidência · Congresso) fica fixa embaixo do topo e substitui o botão com o nome da página. Partidos aparecem como selo (número + sigla):
   o logotipo oficial não é dado aberto. Escolhas em `planos2026:colinha`; aviso "Novidade!" uma vez só
   (`planos2026:novidade-colinha`). O aviso "fica melhor em tela grande" só aparece na Presidência.

## Onde mudar o quê

| Quero… | Onde |
|---|---|
| texto de uma aba | HTML da `.view` + par no `traden` |
| interruptores do RootifyONE (AssistONE, dicas) | `admAO()` e `SolverRecursos` no bloco de apoio; elementos marcados com `data-recurso="assistone"` somem sozinhos; listar em `recursos-do-app.json` |
| ajuda do AssistONE por tela, atalhos, dicas | objeto `TELAS`, `AO.atalhosDe`, `AO.agendaDica` (bloco de apoio) |
| itens do menu ☰ | `Gav.conteudo` (bloco de apoio) |
| seções das Configurações | `pintaPainelOC` (script principal); cartões do AssistONE e Acessibilidade em `CfgAssist`/`CfgAcess` |
| cores, tema | `:root` no `<style>` principal |
| citações, candidatos | bloco `dados` (nos dois arquivos) |
| tela de escolha, módulo Congresso, botão Atualizar | bloco "v2.0" no fim do `index.html` (`pintaHub`, `Cg.tela…`, `Seletor`) |
| pautas, eixos e votações usadas na afinidade | `congresso-pautas.json` e depois `python3 congresso-sync.py` |
| Colinha (cargos, imagem, aviso Novidade) | bloco "v2.2" no fim do `index.html` (`CK.desenha`, `CK.desenhaImagem`, `novidade`) |
| andamento de um compromisso do presidente eleito | `presidencia-compromissos.json` → `status` (o site lê direto, sem rodar script) |
| votações novas da legislatura de 2027 no antes × depois | `congresso-pautas.json` (eixos) e depois `python3 congresso-sync.py` |
