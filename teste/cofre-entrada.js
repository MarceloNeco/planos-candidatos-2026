/* Teste da ENTRADA sem PIN (2.5.1), nas DUAS páginas. Só valores de mentira (PIN e chave de teste).
   O cofre é um só por endereço: um OUTRO app (página de mentira em /outro-app/) cria o cofre e guarda "ia:gemini".
     - nada no RootifyONE: abrir o Eleições não mostra a janela do PIN e a tela fica usável (um toque no menu funciona)
     - "cofre.proteger" ligado pelo RootifyONE (arquivo simulado; o aparelho guarda a cópia na primeira visita):
       ao abrir de novo, a janela do PIN aparece, como antes
     - ▶ com voz da internet (Gemini) e chave guardada: pede o PIN; "Agora não" deixa a leitura seguir com a voz do
       aparelho, sem chamar o provedor
   Uso: node teste/cofre-entrada.js */
const { chromium, servir, novoContexto, semear, PAGINAS, relatorio } = require('./comum');
const PORTA = process.env.PORTA || 8094, BASE = 'http://localhost:' + PORTA, PIN = 'pin-de-teste-9', CHAVE = 'AIza-FALSA-outro-app-1';
const { falhas, conferir } = relatorio();

const OUTRO_APP = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>outro app</title>' +
  '<script src="/janela.js"></script><script src="/cofre.js"></script></head><body><p>outro app da SolverONE</p></body></html>';
const janelaPin = (p) => p.locator('#solver-cofre .sc-caixa');
const aparece = async (p, ms) => { try { await janelaPin(p).waitFor({ state: 'visible', timeout: ms || 6000 }); return true; } catch (e) { return false; } };

/* contexto com o cofre criado por outro app (chave "ia:gemini") e, se pedido, "cofre.proteger" ligado no RootifyONE */
async function preparar(browser, protege, pedidos) {
  const ctx = await novoContexto(browser, 1100, pedidos);
  await semear(ctx, { 'planos2026:prefs': { aoVisto: true, telaCiente: true }, 'planos2026:novidade-colinha': 1, 'planos2026:voz': { motor: 'gemini' } });
  await ctx.route(BASE + '/outro-app/', r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: OUTRO_APP }));
  await ctx.route(BASE + '/solverone-dados/recursos/*.json', r => {
    if (!protege || !/eleicoes-2026\.json$/.test(r.request().url())) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ recursos: {}, comportamentos: { 'cofre.proteger': true } }) });
  });
  const o = await ctx.newPage();
  await o.goto(BASE + '/outro-app/');
  await o.evaluate(async ([pin, chave]) => { await SolverCofre.pronto; await SolverCofre.criar(pin); await SolverCofre.gravar('ia:gemini', chave); }, [PIN, CHAVE]);
  const ok = await o.evaluate(() => SolverCofre.existe() && SolverCofre.tem('ia:gemini'));
  await o.close();
  return { ctx, ok };
}
/* abre o Eleições numa aba nova (sem a sessão da aba do outro app: o cofre está trancado) */
async function abrir(ctx, arq, erros) {
  const p = await ctx.newPage(); p.on('pageerror', e => erros.push(arq + ': ' + e.message));
  await p.goto(BASE + '/' + arq + '#inicio'); await p.waitForSelector('#menu button', { state: 'attached' });
  await p.evaluate(() => SolverCofre.pronto);
  return p;
}

(async () => {
  const srv = await servir(PORTA);
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const erros = [];
  for (const [arq, lg] of PAGINAS) {
    console.log('\n▶ ' + arq);

    /* 1. nada no RootifyONE: abre sem PIN e a tela fica usável */
    { const { ctx, ok } = await preparar(browser, false, []);
      conferir(ok, arq + ': o outro app criou o cofre com a chave "ia:gemini"');
      const p = await abrir(ctx, arq, erros);
      conferir(!(await aparece(p, 4000)), arq + ': sem nada no RootifyONE, abrir não mostra a janela do PIN');
      conferir(await p.evaluate(() => SolverJanela.quantas() === 0 && getComputedStyle(document.documentElement).overflow !== 'hidden'), arq + ': nenhuma janela aberta e a página rola');
      const antes = await p.evaluate(() => location.hash);
      let tocou = true;
      try { await p.locator('#menu button:visible').nth(1).click({ timeout: 3000 }); } catch (e) { tocou = false; }
      await p.waitForTimeout(500);
      conferir(tocou && await p.evaluate(() => location.hash) !== antes, arq + ': a tela fica usável: um toque no menu troca de página');
      conferir(!(await p.evaluate(() => SolverCofre.aberto())), arq + ': o cofre continua trancado (a chave não foi aberta sem pedir)');
      await ctx.close(); }

    /* 2. "cofre.proteger" ligado no RootifyONE: a janela do PIN aparece ao abrir, como antes */
    { const { ctx } = await preparar(browser, true, []);
      const p1 = await abrir(ctx, arq, erros);   /* primeira visita: o aparelho recebe o arquivo e guarda a cópia */
      await p1.waitForFunction(() => SolverRecursos.valor('cofre.proteger', false) === true, null, { timeout: 8000 }).catch(() => {});
      await p1.close();
      const p = await abrir(ctx, arq, erros);
      conferir(await aparece(p, 8000), arq + ': com "cofre.proteger" ligado no RootifyONE, ao abrir aparece a janela do PIN');
      await ctx.close(); }

    /* 3. ▶ com voz da internet e chave guardada: pede o PIN; "Agora não" segue com a voz do aparelho */
    { const pedidos = [], { ctx } = await preparar(browser, false, pedidos);
      const p = await abrir(ctx, arq, erros);
      await p.evaluate(() => { location.hash = '#macrotemas'; }); await p.waitForTimeout(800);
      await p.waitForSelector('.tts-ctl button', { state: 'attached', timeout: 20000 });
      await p.locator('.tts-ctl button:visible').first().click();
      conferir(await aparece(p, 8000), arq + ': ▶ com Gemini e chave guardada pede o PIN');
      await p.keyboard.press('Escape'); await p.locator('#solver-cofre').waitFor({ state: 'detached', timeout: 5000 });   /* "Agora não" */
      await p.waitForTimeout(1500);
      conferir(await p.evaluate(() => window.__fala.length) > 0 && pedidos.length === 0, arq + ': "Agora não": a leitura segue com a voz do aparelho, sem chamar o Gemini (' + pedidos.length + ' pedido(s))');
      const aviso = await p.evaluate(() => (document.querySelector('.tts-bar .tts-st') || {}).textContent || '');
      conferir(lg === 'pt' ? /segue com a voz do aparelho/.test(aviso) : /continues with the device voice/.test(aviso), arq + ': a barra da leitura diz que seguiu com a voz do aparelho ("' + aviso.slice(0, 70) + '")');
      await ctx.close(); }
  }
  conferir(erros.length === 0, 'nenhuma tela com erro de JavaScript' + (erros.length ? ' — ' + erros.slice(0, 3).join(' | ') : ''));
  await browser.close(); srv.close();
  if (falhas.length) { console.log('\n' + falhas.length + ' falha(s)'); process.exit(1); }
  console.log('\ntudo certo');
})().catch(e => { console.error(e); process.exit(1); });
