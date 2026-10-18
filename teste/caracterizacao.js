/* Testes de CARACTERIZAÇÃO da leitura em voz alta, nas DUAS páginas (index.html e index-en.html).
   Descrevem o que o app faz hoje e que NÃO pode mudar com a troca das chaves para o cofre:
     - a página abre sem erro e mostra os botões ▶
     - voz do aparelho: ▶ fala sem pedir nada e sem chamar internet
     - Gemini / OpenAI / ElevenLabs: ▶ chama o provedor com a chave que a pessoa guardou
       (sem "cofre.proteger" no RootifyONE, o cofre pede o PIN só no ▶; o teste cria o PIN e segue)
     - o resto das preferências de voz (motor, voz, modelo) continua em planos2026:voz
     - 320 px sem rolagem lateral
   Só valores de mentira. Uso: node teste/caracterizacao.js */
const { chromium, servir, novoContexto, semear, passaPin, PAGINAS, relatorio } = require('./comum');
const PORTA = process.env.PORTA || 8097, BASE = 'http://localhost:' + PORTA, PIN = 'pin-de-teste-9';
const { falhas, conferir } = relatorio();
const CHAVES = { gemini: 'AIza-FALSA-gemini-1', openai: 'sk-FALSA-openai-1', elevenlabs: 'sk_FALSA_eleven_1' };

async function tocar(page) {
  await page.waitForSelector('.tts-ctl button', { state: 'attached', timeout: 20000 });
  await page.locator('.tts-ctl button:visible').first().click();
}

(async () => {
  const srv = await servir(PORTA);
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const erros = [];
  for (const [arq, lg] of PAGINAS) {
    console.log('\n▶ ' + arq);
    /* 1. abre sem erro, com botões ▶ */
    { const pedidos = [], ctx = await novoContexto(browser, 1100, pedidos), p = await ctx.newPage();
      p.on('pageerror', e => erros.push(arq + ': ' + e.message));
      await p.goto(BASE + '/' + arq); await p.waitForSelector('.tts-ctl button', { state: 'attached', timeout: 20000 });
      conferir((await p.evaluate(() => document.documentElement.lang)).toLowerCase().startsWith(lg), arq + ': idioma da página = ' + lg);
      conferir(await p.locator('.tts-ctl button').count() > 100, arq + ': botões ▶ nos títulos');
      await ctx.close(); }
    /* 2. voz do aparelho: sem PIN, sem internet */
    { const pedidos = [], ctx = await novoContexto(browser, 1100, pedidos), p = await ctx.newPage();
      p.on('pageerror', e => erros.push(arq + ': ' + e.message));
      await p.goto(BASE + '/' + arq); await tocar(p); await p.waitForTimeout(1500);
      conferir(await p.evaluate(() => window.__fala.length) > 0, arq + ': voz do aparelho fala ao tocar ▶');
      conferir(!(await p.$('#solver-cofre')) && pedidos.length === 0, arq + ': voz do aparelho não pede PIN e não chama provedor');
      await ctx.close(); }
    /* 3. cada provedor recebe a chave guardada */
    for (const prov of ['gemini', 'openai', 'elevenlabs']) {
      const pedidos = [], ctx = await novoContexto(browser, 1100, pedidos);
      const campo = { gemini: 'geminiKey', openai: 'openaiKey', elevenlabs: 'elevenKey' }[prov];
      const voz = { motor: prov, elevenVoz: 'voz-falsa-1' }; voz[campo] = CHAVES[prov];
      await semear(ctx, { 'planos2026:voz': voz });
      const p = await ctx.newPage(); p.on('pageerror', e => erros.push(arq + ': ' + e.message));
      await p.goto(BASE + '/' + arq);
      await tocar(p);
      await passaPin(p, PIN, 6000);   /* 2.5.1: sem "cofre.proteger", o PIN é pedido no ▶ com voz da internet */
      await p.waitForFunction(() => true); await p.waitForTimeout(2500);
      conferir(pedidos.length > 0 && pedidos.every(x => x.prov === prov && x.chave === CHAVES[prov]), arq + ': ▶ com ' + prov + ' chama o provedor com a chave guardada (' + pedidos.length + ' pedido(s))');
      const v = JSON.parse(await p.evaluate(() => localStorage.getItem('planos2026:voz')));
      conferir(v.motor === prov && (prov !== 'elevenlabs' || v.elevenVoz === 'voz-falsa-1'), arq + ': motor e voz continuam em planos2026:voz (' + prov + ')');
      await ctx.close();
    }
    /* 4. 320 px sem rolagem lateral */
    { const pedidos = [], ctx = await novoContexto(browser, 320, pedidos), p = await ctx.newPage();
      p.on('pageerror', e => erros.push(arq + ': ' + e.message));
      await p.goto(BASE + '/' + arq); await p.waitForSelector('.tts-ctl button', { state: 'attached', timeout: 20000 }); await p.waitForTimeout(500);
      const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
      conferir(r.sw <= r.iw, arq + ': 320 px sem rolagem lateral (' + r.sw + ' ≤ ' + r.iw + ')');
      await ctx.close(); }
  }
  conferir(erros.length === 0, 'nenhuma tela com erro de JavaScript' + (erros.length ? ' — ' + erros.slice(0, 3).join(' | ') : ''));
  await browser.close(); srv.close();
  if (falhas.length) { console.log('\n' + falhas.length + ' falha(s)'); process.exit(1); }
  console.log('\ntudo certo');
})().catch(e => { console.error(e); process.exit(1); });
