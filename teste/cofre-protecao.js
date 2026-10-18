/* Teste das regras do PIN do cofre (cofre.js 1.5.0, SolverCofre.proteger) e do painel da digital, nas DUAS páginas.
   Desde a 2.5.1 essas regras só valem com o comportamento "cofre.proteger" ligado no RootifyONE (aqui, simulado);
   sem ele, ver teste/cofre-entrada.js. Só valores de mentira (PIN e chave de teste).
     - com chave guardada: o PIN é pedido ao ABRIR a página e ao RECARREGAR; "Agora não" (Esc) deixa trancado
     - a janela do PIN é a janela comum: trava a rolagem de trás
     - passar de uma tela para outra do mesmo app (#macrotemas) não pede o PIN de novo
     - sair do app (ir para outro site e voltar) tranca
     - 5 minutos sem uso tranca; escondido por mais de 1 minuto tranca (relógio simulado)
     - sem chave guardada: nunca aparece PIN
     - Configurações: o painel da digital do cofre aparece (o desenho é do cofre.js)
   Uso: node teste/cofre-protecao.js */
const { chromium, servir, novoContexto, semear, passaPin, comProtecao, PAGINAS, relatorio } = require('./comum');
const PORTA = process.env.PORTA || 8099, BASE = 'http://localhost:' + PORTA, PIN = 'pin-de-teste-9', CHAVE = 'AIza-FALSA-protecao-1';
const { falhas, conferir } = relatorio();

const janelaPin = (p) => p.locator('#solver-cofre .sc-caixa');
const aberto = (p) => p.evaluate(() => SolverCofre.aberto());
const quieto = (p) => p.evaluate(() => new Promise(ok => SolverJanela.quandoQuieto(() => setTimeout(ok, 30)))).catch(() => {});
/* cria o cofre com uma chave de mentira, aberto */
const guardar = (p) => p.evaluate(async ([pin, chave]) => { await SolverCofre.pronto; await SolverCofre.criar(pin); await SolverCofre.gravar('ia:gemini', chave); }, [PIN, CHAVE]);
/* digita o PIN; com digital no aparelho o cofre ainda oferece ligá-la: Esc = "Agora não" */
const abreComPin = async (p) => {
  for (const c of await p.$$('#solver-cofre input[type=password]')) await c.fill(PIN);
  await p.click('#solver-cofre button[type=submit]');
  await p.waitForFunction(() => SolverCofre.aberto(), null, { timeout: 15000 });
  if (await p.locator('#solver-cofre').count()) { await p.keyboard.press('Escape'); await p.locator('#solver-cofre').waitFor({ state: 'detached', timeout: 5000 }); }
};
const aparece = async (p, ms) => { try { await janelaPin(p).waitFor({ state: 'visible', timeout: ms || 6000 }); return true; } catch (e) { return false; } };

async function nova(browser, arq, largura, relogio, erros) {
  const ctx = await novoContexto(browser, largura || 1100, []);
  await comProtecao(ctx, BASE);
  await semear(ctx, { 'planos2026:prefs': { aoVisto: true, telaCiente: true }, 'planos2026:novidade-colinha': 1 });
  const p = await ctx.newPage(); p.on('pageerror', e => erros.push(arq + ': ' + e.message));
  /* autenticador de mentira do próprio Chromium: o aparelho de teste "tem digital" (o cofre só desenha o botão assim) */
  const cdp = await ctx.newCDPSession(p); await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  if (relogio) await p.clock.install({ time: new Date('2026-10-17T12:00:00') });
  await p.goto(BASE + '/' + arq + '#inicio'); await p.waitForSelector('#menu button', { state: 'attached' });
  if (relogio) await p.clock.runFor(1000);
  await p.evaluate(() => SolverCofre.pronto);
  return { ctx, p };
}

(async () => {
  const srv = await servir(PORTA);
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const erros = [];
  for (const [arq] of PAGINAS) {
    console.log('\n▶ ' + arq);
    /* sem chave guardada: nunca pede PIN, nem ao abrir nem ao recarregar */
    { const { ctx, p } = await nova(browser, arq, 1100, false, erros);
      await p.waitForTimeout(800);
      conferir(!(await janelaPin(p).count()), arq + ': sem chave guardada, ao abrir não aparece PIN');
      await p.reload(); await p.waitForTimeout(1200);
      conferir(!(await janelaPin(p).count()), arq + ': sem chave guardada, ao recarregar não aparece PIN');
      await ctx.close(); }

    /* com chave guardada */
    { const { ctx, p } = await nova(browser, arq, 390, false, erros);
      await guardar(p);
      conferir(await aberto(p), arq + ': cofre criado com uma chave de mentira');
      await p.reload();
      conferir(await aparece(p), arq + ': ao RECARREGAR com chave guardada o PIN é pedido');
      conferir(!(await aberto(p)), arq + ': e o cofre está trancado enquanto a janela do PIN está aberta');
      conferir(await p.evaluate(() => getComputedStyle(document.documentElement).overflow) === 'hidden' && await p.evaluate(() => !!document.querySelector('dialog.sj#solver-cofre[open]')), arq + ': a janela do PIN é a janela comum e trava a rolagem de trás (390 px)');
      await p.keyboard.press('Escape'); await p.locator('#solver-cofre').waitFor({ state: 'detached', timeout: 4000 });
      conferir(!(await aberto(p)), arq + ': "Agora não" (Esc) deixa o cofre trancado');
      await quieto(p);
      await p.reload(); await aparece(p);
      await abreComPin(p);
      conferir(await aberto(p) && await p.evaluate(c => SolverCofre.lerAgora('ia:gemini') === c, CHAVE), arq + ': com o PIN o cofre abre e a chave guardada volta');
      await p.evaluate(() => { location.hash = '#macrotemas'; }); await p.waitForTimeout(800);
      conferir(!(await janelaPin(p).count()) && await aberto(p), arq + ': passar para outra tela do mesmo app não pede o PIN de novo');
      /* painel da digital nas Configurações (o aparelho de teste tem um autenticador de mentira, ver nova()) */
      await p.setViewportSize({ width: 1100, height: 800 });
      await p.evaluate(() => PG.abreConfig()); await p.waitForSelector('#tts-cofre-digital', { state: 'attached', timeout: 4000 });
      await p.locator('#tts-cofre-digital button').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      const dig = await p.locator('#tts-cofre-digital').innerText();
      conferir(dig.trim().length > 5 && await p.locator('#tts-cofre-digital button').count() === 1, arq + ': o painel da digital do cofre aparece nas Configurações, com o botão de ligar ("' + dig.trim().replace(/\s+/g, ' ').slice(0, 50) + '…")');
      await p.evaluate(() => EJ.fecha(document.getElementById('cfg'))); await quieto(p);
      /* sair do app: ir para outro lugar e voltar tranca */
      await p.goto('about:blank'); await p.goto(BASE + '/' + arq + '#inicio');
      conferir(await aparece(p) && !(await aberto(p)), arq + ': depois de sair do app e voltar, o cofre está trancado e pede o PIN');
      await ctx.close(); }

    /* cinco minutos sem uso (relógio simulado) */
    { const { ctx, p } = await nova(browser, arq, 1100, true, erros);
      await guardar(p);
      conferir(await aberto(p), arq + ': (relógio simulado) cofre aberto');
      await p.clock.fastForward('04:00');
      conferir(await aberto(p), arq + ': com 4 minutos sem uso o cofre continua aberto');
      await p.clock.fastForward('02:00');
      conferir(!(await aberto(p)), arq + ': com 5 minutos sem uso o cofre tranca');
      await ctx.close(); }

    /* escondido por mais de 1 minuto */
    { const { ctx, p } = await nova(browser, arq, 1100, true, erros);
      await guardar(p);
      const esconder = (v) => p.evaluate(v => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => v }); document.dispatchEvent(new Event('visibilitychange')); }, v);
      await esconder(true); await p.clock.fastForward('00:30'); await esconder(false);
      conferir(await aberto(p), arq + ': escondido por 30 segundos o cofre continua aberto');
      await esconder(true); await p.clock.fastForward('01:20'); await esconder(false);
      await p.clock.runFor(100);
      conferir(!(await aberto(p)), arq + ': escondido por mais de 1 minuto o cofre tranca ao voltar');
      await ctx.close(); }
  }
  conferir(erros.length === 0, 'nenhuma tela com erro de JavaScript' + (erros.length ? ' — ' + erros.slice(0, 3).join(' | ') : ''));
  await browser.close(); srv.close();
  if (falhas.length) { console.log('\n' + falhas.length + ' falha(s)'); process.exit(1); }
  console.log('\ntudo certo');
})().catch(e => { console.error(e); process.exit(1); });
