# Pendências — Eleições 2026

## Feito
- **v2.5.3 (18/Out/2026) — janela do cofre sem digital automática**: `cofre.js` 1.5.0 e `janela.js` 1.0.2 (cópias exatas do master,
  conferidas por sha256); `cofre.proteger` com `"tipo": "sim-nao"` e 🔐 no nome. Testes: números de versão ajustados em
  `voz-cofre.js`, `cofre-protecao.js` e `janelas.js`. Ver "2.5.3" no `ARQUITETURA.md`.
- **v2.5.2 (18/Out/2026) — barra da Colinha em uma linha**: `.ck-bar` sem quebra (`flex-wrap:nowrap`), botões `flex:1 1 0`, 44 px de
  altura, barra com no máximo 60 px; rótulos "📤 Compartilhar", "💬 Texto", "🖨 Imprimir"; até 480 px, Texto e Imprimir só com o ícone
  (44×44, `aria-label` e `title` com o nome completo). Só CSS e rótulos. Teste novo: `colinha-barra.js`.
- **v2.5.1 (18/Out/2026) — o site abre sem PIN**: `SolverCofre.proteger` só com o comportamento `cofre.proteger` ligado no
  RootifyONE (padrão desligado; declarado no `recursos-do-app.json`). O PIN aparece só no ▶ com voz da internet e chave guardada, e
  "Agora não" segue a leitura com a voz do aparelho. Teste novo: `cofre-entrada.js`. Ver "2.5.1" em "Janelas pela janela comum e
  regras do PIN" no `ARQUITETURA.md`.

- **v2.5.0 (18/Out/2026) — calendário eleitoral configurável**: um calendário só (`window.Calendario`) com fases 1º turno,
  2º turno e pós-eleição pela data de Brasília; o RootifyONE muda datas, cargos, turnos, onde há 2º turno e força a fase pelo
  comportamento `eleicao.calendario` (declarado no `recursos-do-app.json`). No 2º turno a Colinha mostra só governador (nos estados
  com 2º turno) e presidente, com os dois finalistas do TSE (`ele-c.json` + arquivo unificado, no máximo 1 vez por hora, cópia no
  aparelho); lista manual vence a do TSE; cola por turno, com a do 1º turno guardada; no pós-eleição a Colinha some sozinha.
  Início e aba Mandato da Presidência leem a data e a posse do calendário. Ver "Calendário eleitoral" no `ARQUITETURA.md`.
  Teste novo: `calendario.js`; `janelas.js` e `colinha-interruptor.js` passaram a fixar o relógio no 1º turno.

- **v2.4.0 (17/Out/2026) — janelas pela janela comum + regras do PIN do cofre** (passada das janelas, app 2): `janela.js` 1.0.1 e
  `cofre.js` 1.4.0 (cópias exatas do master); todas as janelas, a gaveta ☰, o AssistONE, os quatro menus e a confirmação/aviso
  (antes `confirm()`/`alert()`) seguem a diretriz "Janelas (pop-ups)"; `SolverCofre.proteger` e `SolverCofre.painelDigital`.
  Ver "Janelas pela janela comum e regras do PIN" no `ARQUITETURA.md`. Testes novos: `janelas.js` e `cofre-protecao.js`.

- **v2.3.0 (17/Out/2026) — chaves de voz no cofre** (Fase 3 da leitura de segurança): Gemini, OpenAI e ElevenLabs deixaram o
  texto aberto (`planos2026:voz` e a cópia em `ch_config`) e passaram para o cofre comum de chaves, com PIN. Ver
  "Chaves de voz no cofre" no `ARQUITETURA.md`.

- **v2.3.0 — interruptor da Colinha**: a Colinha da eleição pode ser desligada no RootifyONE (Controle dos apps → função "Colinha da eleição"), a pedido do dono, porque a eleição está acabando.

## Sugestões (não feitas, para o dono decidir)
- **Regra nova para a mãe (rootify-one)**: "app que não guarda dado pessoal não protege a entrada; o PIN do cofre aparece só na hora
  de usar a chave, e `proteger` vira um comportamento `cofre.proteger` do RootifyONE" — vai para a diretriz (seção do cofre) e para
  o módulo comum (`diretrizes.js`, `cofre: { proteger }`), numa sessão da mãe.
- **Relato do dono (18/Out/2026), do cofre mestre (`cofre.js` 1.5.0, rootify-one; não é deste app)**: a digital dispara sozinha ao
  abrir e a caixa do sistema não fecha com um toque.
- **`versoes.json`** — a diretriz pede o arquivo `versoes.json` na raiz (versão, data e novidades PT/EN, lido pelo módulo comum).
  Este app guarda as versões **dentro das duas páginas** (bloco `dados`: `versao`, `atualizado_em` e a lista `versoes`, PT no
  `index.html` e EN no `index-en.html`). O dono decidiu (18/Out/2026) não criar o arquivo agora.
- **O que ainda tem "2026" fixo fora do calendário** (para a ferramenta de monitoramento, depois; nada disso é da Colinha):
  - `congresso-sync.py`: `DIA_ELEICAO` (idade dos candidatos no dia da eleição) e `POSSE` (atos do Executivo desde a posse) são
    do próprio script; o site já lê a posse do calendário, mas o filtro dos atos continua no script;
  - o código da eleição no DivulgaCandContas (`20322002026`) nas fotos do TSE (Colinha e Congresso) — o `ele-c.json` traz esse
    número (`sqele`) e daria para ler de lá;
  - textos do Congresso com "2026", "4 de outubro" ou "até 2035/2031" (`Cg`) e o nome do site ("Eleições 2026").
- **Eleição municipal (2028)**: o calendário já aceita prefeito e vereador e a lista manual aceita código de município, mas a
  Colinha só tem dados por estado (`cola/<UF>.json`). Faltaria o `congresso-sync.py` gerar os dados por município e a Colinha
  pedir o município (e, para o 2º turno, ler os municípios no `mun-e<eleição>-cm.json` do TSE).
- **`recursos.js` mais antigo que o master** do rootify-one (falta a tela "Em manutenção" do id `app` do Modo DEUS). Não mexi
  (é cópia de arquivo mestre): vem na varredura.
- **Service worker / uso sem internet** — o dono decidiu (17/Out/2026): fica para um PR próprio, com regra zero. Este app não tem
  `sw.js` nem `versoes.json` (as versões ficam no bloco `dados` das duas páginas). Quando ganhar `sw.js`, ele precisa guardar o
  `janela.js` e o `cofre.js`.
- **Ajuda aberta de dentro das Configurações** — pedido do dono (17/Out/2026), pendente: a ajuda (ex.: ajuda da voz, "como
  conseguir a chave") deve abrir dentro da própria janela das Configurações, como uma seção que expande, em vez de fechar e
  reabrir as Configurações.
- **AssistONE abre sozinho na primeira visita**: agora, sendo janela, ele prende a tela até "Agora não". O dono decidiu (17/Out/2026)
  que fica como está.
- **Menus presos a um botão como janela**: idioma, seleção múltipla, compartilhar e Presidência/Congresso agora são janela (a página
  de trás trava e o toque fora fecha), mantendo o visual de menu. Se o dono preferir que menu continue sendo menu, é voltar atrás.
- **Content-Security-Policy**: o `cofre.js` assume uma página sem script de terceiros; o Eleições ainda não declara CSP.
  Um CSP `script-src 'self'` (com o que a página já usa) reduziria o risco de código de fora ler as chaves com o cofre aberto.
- **Chave da Anthropic em `ch_config`**: este app não usa; ela continua onde está até o Contador receber o cofre.
