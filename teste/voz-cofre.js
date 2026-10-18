/* Teste das chaves de voz no cofre (cofre.js 1.5.0, com SolverCofre.proteger), nas DUAS páginas (index.html e index-en.html).
   Chaves de mentira em planos2026:voz e em ch_config (as que o Contador deixava aqui) e provedores simulados.
     - ao criar o PIN as chaves vão para o cofre e SAEM dos dois lugares (o resto de cada um fica)
     - ▶ com Gemini usa a chave que veio do cofre
     - cofre trancado → ▶ pede o PIN e segue; voz do aparelho nunca pede
     - sem chave nenhuma: avisa sem abrir janela de PIN
     - Configurações: "🔐 Guardado no cofre", sem os botões do Contador, trocar grava só no cofre, "🔒 Trancar o cofre agora"
     - nenhuma chave de mentira sobra em texto aberto no navegador
     - 320 px sem rolagem lateral (com a janela do PIN e com as Configurações)
   Uso: node teste/voz-cofre.js */
const { chromium, servir, novoContexto, semear, passaPin, comProtecao, PAGINAS, relatorio } = require('./comum');
const PORTA = process.env.PORTA || 8096, BASE = 'http://localhost:' + PORTA, PIN = 'pin-de-teste-9';
const { falhas, conferir } = relatorio();
const G = 'AIza-FALSA-gemini-1', O = 'sk-FALSA-openai-1', E = 'sk_FALSA_eleven_1', NOVA = 'AIza-FALSA-NOVA-2', ANT = 'sk-ant-FALSA-1';
const VOZ = () => ({ motor: 'gemini', geminiVoz: 'Kore', vel: 1.2, geminiKey: G, openaiKey: O, elevenKey: E });
const CONTADOR = () => ({ titulo: 'meu config', anthropicKey: ANT, geminiKey: G, openaiKey: O, elevenKey: E });

const ler = (p, k) => p.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), k);
const tocar = async (p, n) => { await p.waitForSelector('.tts-ctl button', { state: 'attached', timeout: 20000 }); await p.locator('.tts-ctl button:visible').nth(n || 0).click(); };
const tudoEmAberto = (p) => p.evaluate(() => { let t = ''; for (let i = 0; i < localStorage.length; i++) t += localStorage.key(i) + '=' + localStorage.getItem(localStorage.key(i)) + '\n'; return t; });

(async () => {
  const srv = await servir(PORTA);
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const erros = [];
  for (const [arq, lg] of PAGINAS) {
    console.log('\n▶ ' + arq);
    const pedidos = [], ctx = await novoContexto(browser, 1100, pedidos);
    await comProtecao(ctx, BASE);   /* 2.5.1: a janela ao abrir e o PIN ao recarregar são com "cofre.proteger" ligado */
    await semear(ctx, { 'planos2026:voz': VOZ(), 'ch_config': CONTADOR(), 'planos2026:novidade-colinha': 1 });
    const p = await ctx.newPage(); p.on('pageerror', e => erros.push(arq + ': ' + e.message));
    await p.goto(BASE + '/' + arq);
    await p.evaluate(() => SolverCofre.pronto);
    conferir(await p.evaluate(() => SolverCofre.versao) === '1.5.0', arq + ': cofre.js 1.5.0 carregado antes do app');
    conferir(!(await p.evaluate(() => SolverCofre.existe())) && !(await p.evaluate(() => SolverCofre.aberto())), arq + ': ao abrir a página o cofre ainda não existe');

    /* há chaves em texto aberto: com proteger, a janela de criar o PIN já abre sozinha ao carregar a página */
    const j = p.locator('#solver-cofre .sc-caixa'); await j.waitFor({ state: 'visible', timeout: 8000 });
    const textoJanela = await j.textContent();
    conferir(lg === 'pt' ? /Proteger as chaves/.test(textoJanela) && /Eleições 2026/.test(textoJanela) : /Protect your AI keys/.test(textoJanela) && /Elections 2026/.test(textoJanela), arq + ': janela de criar o PIN no idioma da página, dizendo que é para abrir o Eleições 2026 com as chaves de voz guardadas');
    await p.setViewportSize({ width: 320, height: 700 });
    const r320 = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    conferir(r320.sw <= r320.iw, arq + ': 320 px com a janela do PIN aberta, sem rolagem lateral (' + r320.sw + ' ≤ ' + r320.iw + ')');
    await p.setViewportSize({ width: 1100, height: 800 });
    await passaPin(p, PIN, 5000);
    await tocar(p, 0);
    await p.waitForTimeout(2500);
    conferir(pedidos.length > 0 && pedidos.every(x => x.prov === 'gemini' && x.chave === G), arq + ': ▶ com Gemini usou a chave do cofre (' + pedidos.length + ' pedido(s))');

    /* as chaves saíram dos dois lugares; o resto ficou */
    const v = await ler(p, 'planos2026:voz'), c = await ler(p, 'ch_config');
    conferir(!('geminiKey' in v) && !('openaiKey' in v) && !('elevenKey' in v), arq + ': planos2026:voz sem as três chaves');
    conferir(v.motor === 'gemini' && v.geminiVoz === 'Kore' && v.vel === 1.2, arq + ': planos2026:voz manteve motor, voz e velocidade');
    conferir(!('geminiKey' in c) && !('openaiKey' in c) && !('elevenKey' in c), arq + ': ch_config sem as três chaves (sem cópia temporária)');
    conferir(c.titulo === 'meu config' && c.anthropicKey === ANT, arq + ': ch_config manteve os outros campos (inclusive a chave da Anthropic, que não é deste app)');
    const nomes = await p.evaluate(() => SolverCofre.nomes());
    conferir(['ia:gemini', 'ia:openai', 'ia:elevenlabs'].every(n => nomes.includes(n)), arq + ': cofre guarda ia:gemini, ia:openai e ia:elevenlabs');
    let aberto = await tudoEmAberto(p);
    conferir(![G, O, E].some(x => aberto.includes(x)), arq + ': nenhuma das três chaves de mentira sobra em texto aberto no navegador');

    /* Configurações */
    await p.click('#cfg-b'); await p.waitForSelector('#tts-cfg', { timeout: 5000 });
    let txt = await p.locator('#tts-cfg').innerText();
    conferir(/Guardado no cofre|Saved in the vault/i.test(txt), arq + ': Configurações mostram "Guardado no cofre"');
    conferir(!/Contador de Hist|Story ?Teller/.test(txt.replace(/é a mesma que o Contador de Histórias usa\.|the same one the Story Teller uses\./g, '')), arq + ': sem os botões "Usar a chave do Contador"');
    conferir(await p.locator('#tts-cfg input[type=password]').evaluate(i => i.value === ''), arq + ': o campo da chave não mostra a chave guardada');
    conferir(/Trancar o cofre agora|Lock the vault now/i.test(txt), arq + ': botão "Trancar o cofre agora" com o cofre aberto');
    await p.setViewportSize({ width: 320, height: 700 });
    const rc = await p.evaluate(() => { const d = document.getElementById('cfg'); return { sw: document.documentElement.scrollWidth, iw: window.innerWidth, dw: d ? d.scrollWidth : 0, dc: d ? d.clientWidth : 0 }; });
    conferir(rc.sw <= rc.iw && rc.dw <= rc.dc + 1, arq + ': 320 px com as Configurações abertas, sem rolagem lateral');
    await p.setViewportSize({ width: 1100, height: 800 });
    /* trocar a chave: grava só no cofre */
    await p.locator('#tts-cfg input[type=password]').fill(NOVA);
    await p.locator('#tts-cfg button', { hasText: /Guardar no cofre|Save in the vault/ }).click();
    await p.waitForFunction(() => SolverCofre.lerAgora('ia:gemini') === 'AIza-FALSA-NOVA-2', null, { timeout: 5000 });
    conferir(true, arq + ': trocar a chave grava no cofre');
    aberto = await tudoEmAberto(p);
    conferir(!aberto.includes(NOVA), arq + ': a chave nova não aparece em texto aberto');
    /* trancar */
    await p.locator('#tts-cfg button', { hasText: /Trancar o cofre agora|Lock the vault now/ }).click();
    await p.waitForFunction(() => !SolverCofre.aberto(), null, { timeout: 5000 });
    conferir(true, arq + ': "Trancar o cofre agora" tranca');
    await p.evaluate(() => EJ.fecha(document.getElementById('cfg'))); await p.waitForTimeout(400);

    /* trancado: ▶ com Gemini pede o PIN e segue, com a chave nova */
    pedidos.length = 0;
    await p.evaluate(() => { location.hash = '#macrotemas'; }); await p.waitForTimeout(800);
    await tocar(p, 0);
    const pediu = await passaPin(p, PIN, 8000);
    await p.waitForTimeout(2500);
    conferir(pediu, arq + ': cofre trancado → ▶ com Gemini pede o PIN');
    conferir(pedidos.length > 0 && pedidos.every(x => x.chave === NOVA), arq + ': depois do PIN a leitura segue com a chave do cofre (' + pedidos.length + ' pedido(s))');

    /* trancado + voz do aparelho: nunca pede */
    await p.evaluate(() => SolverCofre.trancar());
    await p.evaluate(() => { const o = JSON.parse(localStorage.getItem('planos2026:voz')); o.motor = 'nativo'; localStorage.setItem('planos2026:voz', JSON.stringify(o)); });
    pedidos.length = 0;
    await p.reload(); await p.evaluate(() => SolverCofre.pronto);
    conferir(!(await p.evaluate(() => SolverCofre.aberto())), arq + ': depois de recarregar o cofre continua trancado');
    await p.locator('#solver-cofre .sc-caixa').waitFor({ state: 'visible', timeout: 8000 });
    conferir(true, arq + ': ao recarregar com chave guardada o PIN é pedido (proteger)');
    await p.keyboard.press('Escape'); await p.locator('#solver-cofre').waitFor({ state: 'detached', timeout: 5000 });   /* "Agora não" */
    await tocar(p, 0); await p.waitForTimeout(1500);
    conferir(!(await p.$('#solver-cofre')) && pedidos.length === 0 && await p.evaluate(() => window.__fala.length) > 0, arq + ': voz do aparelho com o cofre trancado fala sem pedir PIN');
    await ctx.close();

    /* sem chave nenhuma: avisa sem janela de PIN */
    { const ps = [], cx = await novoContexto(browser, 1100, ps); await semear(cx, { 'planos2026:voz': { motor: 'gemini' }, 'planos2026:novidade-colinha': 1 });
      const q = await cx.newPage(); q.on('pageerror', e => erros.push(arq + ': ' + e.message));
      await q.goto(BASE + '/' + arq); await tocar(q, 0); await q.waitForTimeout(2000);
      conferir(!(await q.$('#solver-cofre')) && ps.length === 0, arq + ': Gemini sem nenhuma chave guardada: não abre janela de PIN nem chama o provedor');
      await cx.close(); }
  }
  conferir(erros.length === 0, 'nenhuma tela com erro de JavaScript' + (erros.length ? ' — ' + erros.slice(0, 3).join(' | ') : ''));
  await browser.close(); srv.close();
  if (falhas.length) { console.log('\n' + falhas.length + ' falha(s)'); process.exit(1); }
  console.log('\ntudo certo');
})().catch(e => { console.error(e); process.exit(1); });
