# Pendências — Eleições 2026

## Feito
- **v2.3.0 (17/Out/2026) — chaves de voz no cofre** (Fase 3 da leitura de segurança): Gemini, OpenAI e ElevenLabs deixaram o
  texto aberto (`planos2026:voz` e a cópia em `ch_config`) e passaram para o cofre comum de chaves, com PIN. Ver
  "Chaves de voz no cofre" no `ARQUITETURA.md`.

- **v2.3.0 — interruptor da Colinha**: a Colinha da eleição pode ser desligada no RootifyONE (Controle dos apps → função "Colinha da eleição"), a pedido do dono, porque a eleição está acabando.

## Sugestões (não feitas, para o dono decidir)
- **Service worker / uso sem internet**: este app não tem `sw.js` nem `versoes.json` (as versões ficam no bloco `dados` das duas
  páginas). Se um dia ganhar `sw.js`, ele precisa guardar o `cofre.js`.
- **Content-Security-Policy**: o `cofre.js` assume uma página sem script de terceiros; o Eleições ainda não declara CSP.
  Um CSP `script-src 'self'` (com o que a página já usa) reduziria o risco de código de fora ler as chaves com o cofre aberto.
- **Chave da Anthropic em `ch_config`**: este app não usa; ela continua onde está até o Contador receber o cofre.
