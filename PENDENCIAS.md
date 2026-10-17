# Pendências — Eleições 2026

## Feito
- **v2.4.0 (17/Out/2026) — janelas pela janela comum + regras do PIN do cofre** (passada das janelas, app 2): `janela.js` 1.0.1 e
  `cofre.js` 1.4.0 (cópias exatas do master); todas as janelas, a gaveta ☰, o AssistONE, os quatro menus e a confirmação/aviso
  (antes `confirm()`/`alert()`) seguem a diretriz "Janelas (pop-ups)"; `SolverCofre.proteger` e `SolverCofre.painelDigital`.
  Ver "Janelas pela janela comum e regras do PIN" no `ARQUITETURA.md`. Testes novos: `janelas.js` e `cofre-protecao.js`.

- **v2.3.0 (17/Out/2026) — chaves de voz no cofre** (Fase 3 da leitura de segurança): Gemini, OpenAI e ElevenLabs deixaram o
  texto aberto (`planos2026:voz` e a cópia em `ch_config`) e passaram para o cofre comum de chaves, com PIN. Ver
  "Chaves de voz no cofre" no `ARQUITETURA.md`.

- **v2.3.0 — interruptor da Colinha**: a Colinha da eleição pode ser desligada no RootifyONE (Controle dos apps → função "Colinha da eleição"), a pedido do dono, porque a eleição está acabando.

## Sugestões (não feitas, para o dono decidir)
- **Service worker / uso sem internet**: este app não tem `sw.js` nem `versoes.json` (as versões ficam no bloco `dados` das duas
  páginas). Se um dia ganhar `sw.js`, ele precisa guardar o `janela.js` e o `cofre.js` (a passada das janelas pedia isso, mas não
  há `sw.js` para editar; criar um é decisão do dono).
- **AssistONE abre sozinho na primeira visita**: agora, sendo janela, ele prende a tela até "Agora não". Sugestão: trocar a abertura
  automática por só a dica no canto (que não é janela). Não foi mudado.
- **Janelas com busca perguntam "Descartar?"**: a busca da Colinha e a do AssistONE contam como texto digitado (regra 4). Se o dono
  achar demais, dá para dizer `temTexto:false` nessas duas.
- **Menus presos a um botão como janela**: idioma, seleção múltipla, compartilhar e Presidência/Congresso agora são janela (a página
  de trás trava e o toque fora fecha), mantendo o visual de menu. Se o dono preferir que menu continue sendo menu, é voltar atrás.
- **Content-Security-Policy**: o `cofre.js` assume uma página sem script de terceiros; o Eleições ainda não declara CSP.
  Um CSP `script-src 'self'` (com o que a página já usa) reduziria o risco de código de fora ler as chaves com o cofre aberto.
- **Chave da Anthropic em `ch_config`**: este app não usa; ela continua onde está até o Contador receber o cofre.
