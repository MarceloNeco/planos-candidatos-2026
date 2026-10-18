/* Teste das JANELAS (janela.js 1.0.2 / SolverJanela) do Eleições 2026, nas DUAS páginas e em 390 px e no computador.
   Só valores de mentira. Para cada janela:
     - abre pela janela comum (um <dialog class="sj"> aberto) e a página de trás fica travada: html sem rolagem,
       a roda do mouse não rola a página, o toque em algo de trás cai na janela (não no botão de trás)
     - fecha pelo botão da própria janela, pelo Esc, pelo Voltar do celular (history.back) e pelo toque fora
       (a página volta à mesma rolagem; o Voltar não muda o endereço)
     - com texto digitado: Esc, Voltar e toque fora perguntam "Descartar?" (Continuar mantém; Descartar fecha)
   E ainda: toque que começa dentro e termina fora não fecha · uma janela por vez (a segunda espera) ·
   a confirmação curta abre por cima e fecha junto · confirm()/alert() nativos não existem mais ·
   a ajuda dentro das Configurações fecha uma e volta para a outra.
   Uso: node teste/janelas.js   (precisa do Playwright) */
const { chromium, servir, novoContexto, semear, PAGINAS, relatorio } = require('./comum');
const PORTA = process.env.PORTA || 8098, BASE = 'http://localhost:' + PORTA;
const { falhas, conferir } = relatorio();
const PREFS = { aoVisto: true, telaCiente: true };
const rotulo = (arq, w) => arq + ' · ' + (w < 700 ? '390 px' : 'computador') + ': ';

const quantas = (p) => p.evaluate(() => SolverJanela.quantas());
const espera = async (p, n, ms) => { try { await p.waitForFunction(n => SolverJanela.quantas() === n, n, { timeout: ms || 4000 }); return true; } catch (e) { return false; } };
const folga = (p) => p.waitForTimeout(250);
/* termina a conversa com o histórico (o Voltar é assíncrono) */
const quieto = (p) => p.evaluate(() => new Promise(ok => SolverJanela.quandoQuieto(() => setTimeout(ok, 30)))).catch(() => {});

async function pagina(browser, arq, w, hash, sem, itens) {
  const erros = [];
  const ctx = await novoContexto(browser, w, []);
  /* a Colinha depende do calendário eleitoral: dia fixo no 1º turno (os seis votos), para o teste não mudar com a data */
  await ctx.clock.setFixedTime(new Date('2026-10-01T15:00:00Z'));
  await semear(ctx, Object.assign({ 'planos2026:prefs': Object.assign({}, PREFS, sem || {}), 'planos2026:novidade-colinha': 1 }, itens || {}));
  const p = await ctx.newPage(); p.on('pageerror', e => erros.push(e.message));
  await p.goto(BASE + '/' + arq + (hash || '#inicio')); await p.waitForSelector('#menu button', { state: 'attached' }); await p.waitForTimeout(700);
  return { ctx, p, erros };
}

/* as janelas: abrir(p) abre; x(p) é o botão da própria janela (null = o menu fecha ao escolher); fora = ponto da parte escura;
   texto(p) digita algo; so = 'mobile' | 'desktop'; volta = seletor que reaparece ao fechar (janela aberta a partir de outra) */
const J = [
  { n: 'glossário', hash: '#metodo', abrir: p => p.evaluate(() => PG.abreGloss('vies')), x: p => p.locator('#gloss .gf button').click() },
  { n: 'painel de leitura (O que mudou)', abrir: p => p.evaluate(() => PG.abreDoc('novidades')), x: p => p.click('#doc-x') },
  { n: 'Configurações', abrir: p => p.evaluate(() => PG.abreConfig()), x: p => p.click('#cfg-x'),
    texto: async p => { await p.locator('#tts-cfg input[type=password]').fill('AIza-FALSA-colada'); }, voz: { motor: 'gemini' } },
  { n: '"i" das dimensões', hash: '#infograficos', abrir: async p => { await p.evaluate(() => { let d = document.querySelector('#v-infograficos td button.i').closest('details'); while (d) { d.open = true; d = d.parentElement && d.parentElement.closest('details'); } }); await p.locator('#v-infograficos td button.i:visible').first().click(); }, x: p => p.click('#cm-info .cfg-x') },
  { n: 'ajuda da voz (a partir das Configurações)', abrir: async p => { await p.evaluate(() => PG.abreConfig()); await p.locator('#tts-cfg button', { hasText: /Instalei uma voz|I installed a voice/ }).click(); },
    x: p => p.click('#tts-dlg .cfg-x'), volta: '#cfg' },
  { n: 'Colinha: escolher candidato', hash: '#colinha', abrir: p => p.locator('.ck-slot').last().click(), x: p => p.click('#ck-dlg .x'),
    texto: async p => { await p.locator('#ck-dlg input[type=search]').fill('ab'); }, semPergunta: true, fora: [4, 4] },
  { n: 'Colinha: imprimir', hash: '#colinha', abrir: p => p.locator('.ck-bar button').nth(2).click(), x: p => p.locator('.ck-nov .bt button.cancela').click() },
  { n: 'aviso NOVIDADE', hash: '#inicio', abrir: async p => { await quieto(p); await p.waitForTimeout(300); await p.evaluate(() => { localStorage.removeItem('planos2026:novidade-colinha'); }); await p.reload(); await p.locator('.ck-nov').waitFor({ state: 'visible', timeout: 9000 }); },
    x: p => p.locator('.ck-nov .bt button:not(.pri)').click(), recarrega: true },
  { n: 'gaveta ☰', so: 'mobile', abrir: p => p.click('#nav-h'), x: p => p.click('.gav-x'), fora: [378, 400] },
  { n: 'AssistONE (caixa com busca)', abrir: p => p.click('#ao-btn'), x: p => p.click('#ao-box .ao-h button'),
    texto: async p => { await p.locator('#ao-box .ao-it', { hasText: /Procurar|Search/ }).first().click(); await p.locator('#ao-box input').first().fill('glos'); }, semPergunta: true },
  { n: 'AssistONE (tour)', abrir: async p => { await p.click('#ao-btn'); await p.locator('#ao-box .ao-it', { hasText: /tour/i }).first().click(); await p.locator('#ao-box .ao-passo').waitFor(); }, x: p => p.click('#ao-box .ao-h button') },
  { n: 'seletor de idioma', so: 'desktop', abrir: p => p.click('#idi-b'), x: null },
  { n: 'seleção múltipla', hash: '#macrotemas', abrir: p => p.locator('#v-macrotemas .ms > button:visible').first().click(), x: null },
  { n: 'compartilhar', abrir: p => p.click('#share-b'), x: p => p.locator('.shr-pop button').first().click() },
  { n: 'seletor Presidência/Congresso', so: 'desktop', abrir: p => p.click('#modo-b'), x: null }
];

async function preparar(p, j) {
  if (j.hash) { await p.evaluate(h => { location.hash = h; }, j.hash); await p.waitForTimeout(900); }
  if (j.voz) await p.evaluate(v => { localStorage.setItem('planos2026:voz', JSON.stringify(v)); }, j.voz);
  if (j.voz) { await p.reload(); await p.waitForTimeout(700); }
  await p.evaluate(() => scrollTo(0, 300));
  return p.evaluate(() => scrollY);
}

async function abreJ(p, j) {
  try { await j.abrir(p); } catch (e) { if (process.env.DEPURA) console.log('DEPURA', await p.evaluate(() => [location.href, document.querySelectorAll('#v-infograficos td button.i').length, document.querySelector('#v-infograficos').className, document.querySelectorAll('dialog.sj[open]').length])); throw e; }
  const ok = await espera(p, j.volta ? 1 : 1);
  if (ok && j.volta) await p.waitForSelector('#tts-dlg', { state: 'visible', timeout: 3000 }).catch(() => {});
  return ok;
}

async function fechouVoltando(p, j) {
  if (j.volta) {   /* a janela de baixo volta; fecha ela também */
    const ok = await espera(p, 1) && await p.locator(j.volta).isVisible();
    await p.evaluate(() => EJ.fecha(document.getElementById('cfg'))); await espera(p, 0);
    return ok;
  }
  return espera(p, 0);
}

async function ciclo(p, j, arq, w) {
  const L = rotulo(arq, w) + j.n + ': ';
  await preparar(p, j);
  if (!await abreJ(p, j)) { conferir(false, L + 'abre pela janela comum'); return; }
  conferir(await p.evaluate(() => document.querySelectorAll('dialog.sj[open]').length >= 1), L + 'abre pela janela comum (<dialog class="sj"> aberto)');
  let y0 = await p.evaluate(() => scrollY);   /* a rolagem no instante em que a janela abriu */
  /* página de trás travada */
  await p.mouse.move(5, 5); await p.mouse.wheel(0, 500); await folga(p);
  const t = await p.evaluate(() => {
    const pts = [[innerWidth / 2, innerHeight / 2], [10, 10], [innerWidth - 10, innerHeight - 10], [innerWidth / 2, 30]];
    return { ov: getComputedStyle(document.documentElement).overflow, y: scrollY, atras: pts.every(([x, y]) => { const e = document.elementFromPoint(x, y); return !!(e && e.closest('dialog.sj')); }) };
  });
  conferir(t.ov === 'hidden' && t.y === y0, L + 'a página de trás não rola (overflow ' + t.ov + ', rolagem ' + t.y + ' = ' + y0 + ')');
  conferir(t.atras, L + 'o toque em qualquer ponto da página de trás cai na janela (nenhum botão de trás recebe)');
  const fecha = async (como) => { await como(); return fechouVoltando(p, j); };
  const reabre = async () => { const ok = await abreJ(p, j); y0 = await p.evaluate(() => scrollY); return ok; };
  const url0 = await p.evaluate(() => location.href);
  /* 1. botão da própria janela */
  if (j.x) {
    const ok = await fecha(() => j.x(p));
    conferir(ok, L + 'fecha pelo botão da própria janela');
    const y1 = await p.evaluate(() => scrollY);
    conferir(y1 === y0 || j.recarrega, L + 'a página volta à mesma rolagem (' + y1 + ' = ' + y0 + ')');
    await reabre();
  }
  /* 2. Esc */
  await p.keyboard.press('Escape');
  conferir(await fechouVoltando(p, j), L + 'fecha pelo Esc');
  await reabre();
  /* 3. Voltar do celular */
  await p.evaluate(() => history.back());
  conferir(await fechouVoltando(p, j), L + 'fecha pelo Voltar do celular');
  conferir(await p.evaluate(() => location.href) === url0, L + 'o Voltar não mudou de tela (o endereço é o mesmo)');
  await reabre();
  /* 4. toque na parte escura */
  const [fx, fy] = j.fora || [4, 4];
  await p.mouse.click(fx, fy);
  conferir(await fechouVoltando(p, j), L + 'fecha tocando na parte escura');
  await quieto(p);
  /* com texto digitado: pergunta "Descartar?" */
  if (j.texto) {
    await reabre(); await j.texto(p);
    if (j.semPergunta) {   /* campo de busca não é texto a perder: nenhuma das três saídas pergunta "Descartar?" */
      for (const [como, nome] of [[() => p.mouse.click(fx, fy), 'tocar fora'], [() => p.evaluate(() => history.back()), 'Voltar'], [() => p.keyboard.press('Escape'), 'Esc']]) {
        await como();
        conferir(await espera(p, 0) && !(await p.locator('dialog.sj-pergunta').count()), L + nome + ' com busca digitada fecha sem perguntar "Descartar?"');
        await quieto(p); if (nome !== 'Esc') { await reabre(); await j.texto(p); }
      }
      return;
    }
    const perguntou = async (como, nome) => {
      await como();
      const ok = await espera(p, 2) && await p.locator('dialog.sj-pergunta [data-sj=continuar]').isVisible();
      conferir(ok, L + nome + ' com texto digitado pergunta "Descartar?"');
      await p.locator('dialog.sj-pergunta [data-sj=continuar]').click(); await espera(p, 1);
    };
    await perguntou(() => p.mouse.click(fx, fy), 'tocar fora');
    await perguntou(() => p.evaluate(() => history.back()), 'Voltar');
    await perguntou(() => p.keyboard.press('Escape'), 'Esc');
    conferir(await quantas(p) === 1, L + '"Continuar" mantém a janela com o texto');
    await p.keyboard.press('Escape'); await espera(p, 2);
    await p.locator('dialog.sj-pergunta [data-sj=descartar]').click();
    conferir(await espera(p, 0), L + '"Descartar" fecha a pergunta e a janela juntas');
    await quieto(p);
  }
  if (j.n === 'AssistONE (tour)') conferir(await p.evaluate(() => !document.querySelector('.ao-foco')), L + 'o realce da página some quando o tour fecha');
}

(async () => {
  const srv = await servir(PORTA);
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const erros = [];
  const tarefas = [];
  for (const [arq] of PAGINAS) {
    for (const w of [390, 1100]) {
      tarefas.push((async () => {
        const mob = w < 700, so = mob ? 'mobile' : 'desktop';
        /* tela estreita: abre sozinha ao entrar numa tela da Presidência no celular */
        if (mob && !process.env.FILTRO) {
          const { ctx, p, erros: e } = await pagina(browser, arq, w, '#inicio', { telaCiente: false });
          await p.waitForSelector('#tela-dlg', { state: 'visible', timeout: 6000 }).catch(() => {});
          const L = rotulo(arq, w) + 'tela estreita: ';
          conferir(await espera(p, 1) && await p.evaluate(() => getComputedStyle(document.documentElement).overflow) === 'hidden', L + 'abre sozinha pela janela comum e trava a página de trás');
          await p.keyboard.press('Escape'); conferir(await espera(p, 0), L + 'fecha pelo Esc (e não conta como ciente)');
          conferir(await p.evaluate(() => !JSON.parse(localStorage.getItem('planos2026:prefs') || '{}').telaCiente), L + 'Esc não grava "ciente"');
          await quieto(p);
          await p.reload(); await p.waitForSelector('#tela-dlg', { state: 'visible', timeout: 6000 }).catch(() => {});
          await p.evaluate(() => history.back()); conferir(await espera(p, 0), L + 'fecha pelo Voltar do celular');
          await quieto(p); await p.reload(); await p.waitForSelector('#tela-dlg', { state: 'visible', timeout: 6000 }).catch(() => {});
          await p.mouse.click(4, 4); conferir(await espera(p, 0), L + 'fecha tocando na parte escura');
          await quieto(p); await p.reload(); await p.waitForSelector('#tela-dlg', { state: 'visible', timeout: 6000 }).catch(() => {});
          await p.locator('#tela-dlg .tela-ok').click(); conferir(await espera(p, 0), L + 'fecha pelo botão "Estou ciente"');
          conferir(await p.evaluate(() => !!JSON.parse(localStorage.getItem('planos2026:prefs') || '{}').telaCiente), L + '"Estou ciente" grava e não volta');
          erros.push(...e.map(m => arq + ': ' + m)); await ctx.close();
        }
        for (const j of J) {
          if (j.so && j.so !== so) continue;
          if (process.env.FILTRO && !j.n.includes(process.env.FILTRO)) continue;
          const { ctx, p, erros: e } = await pagina(browser, arq, w, '#inicio', null, j.voz ? { 'planos2026:voz': j.voz } : null);
          await ciclo(p, j, arq, w);
          erros.push(...e.map(m => arq + ': ' + j.n + ': ' + m)); await ctx.close();
        }
        if (process.env.FILTRO) return;
        /* regras entre janelas, no computador e no celular */
        const { ctx, p, erros: e } = await pagina(browser, arq, w, '#inicio', null, { 'planos2026:voz': { motor: 'gemini' } });
        const L = rotulo(arq, w);
        await p.evaluate(() => PG.abreConfig()); await espera(p, 1);
        /* toque que começa dentro da caixa e termina fora não fecha */
        const cx = await p.locator('#cfg').boundingBox();
        await p.mouse.move(cx.x + 30, cx.y + 30); await p.mouse.down(); await p.mouse.move(4, 4); await p.mouse.up(); await folga(p);
        conferir(await quantas(p) === 1, L + 'arrastar de dentro da caixa e soltar na parte escura não fecha');
        /* uma janela por vez: a segunda espera a vez */
        await p.evaluate(() => PG.abreGloss('vies')); await folga(p);
        conferir(await p.evaluate(() => SolverJanela.quantas() === 1 && SolverJanela.esperando() === 1 && document.querySelectorAll('dialog.sj[open]').length === 1), L + 'uma janela por vez: a segunda espera a primeira fechar');
        await p.click('#cfg-x');
        conferir(await p.locator('#gloss').isVisible({ timeout: 3000 }).catch(() => false) && await quantas(p) === 1, L + 'ao fechar a primeira, a segunda abre');
        await p.evaluate(() => EJ.fecha(document.getElementById('gloss'))); await espera(p, 0); await quieto(p);
        /* confirmação curta por cima da janela aberta; fecha junto */
        await p.evaluate(() => PG.abreConfig()); await espera(p, 1);
        await p.evaluate(() => { window.__sim = 0; EJ.confirma('Apagar isto?', 'Apagar', () => { window.__sim++; }); }); await espera(p, 2);
        conferir(await p.evaluate(() => { const a = document.querySelectorAll('dialog.sj[open]'); return a.length === 2 && a[1].getAttribute('role') === 'alertdialog'; }), L + 'a confirmação curta abre por cima (alertdialog) e a janela de baixo continua');
        await p.keyboard.press('Escape'); await espera(p, 1);
        conferir(await quantas(p) === 1 && await p.evaluate(() => window.__sim === 0), L + 'Esc na confirmação fecha só ela, sem confirmar');
        await p.evaluate(() => EJ.confirma('Apagar isto?', 'Apagar', () => { window.__sim++; })); await espera(p, 2);
        await p.locator('dialog.sj[role=alertdialog] button', { hasText: /Apagar|Clear/ }).click(); await espera(p, 1);
        conferir(await p.evaluate(() => window.__sim === 1), L + '"Apagar" confirma e fecha só a confirmação');
        await p.evaluate(() => EJ.confirma('Apagar isto?', 'Apagar')); await espera(p, 2);
        await p.evaluate(() => EJ.fecha(document.getElementById('cfg')));
        conferir(await espera(p, 0), L + 'fechar a janela de baixo fecha a confirmação junto');
        await quieto(p);
        /* aviso no lugar do alert() */
        await p.evaluate(() => EJ.aviso('Pronto.')); await espera(p, 1);
        conferir(await p.evaluate(() => document.querySelector('dialog.sj[open]').getAttribute('role')) === 'alertdialog', L + 'o aviso (no lugar do alert) é uma janela comum');
        await p.locator('dialog.sj[role=alertdialog] button').click(); conferir(await espera(p, 0), L + 'o aviso fecha pelo OK');
        await quieto(p);
        /* nenhum confirm()/alert()/prompt() nativo sobrou no código */
        conferir(await p.evaluate(() => !/(^|[^.\w])(confirm|alert|prompt)\(/.test([...document.scripts].map(s => s.textContent).join('\n').replace(/\/\*[\s\S]*?\*\//g, ''))), L + 'nenhum confirm()/alert()/prompt() nativo no código');
        /* Colinha: "Começar de novo" usa a confirmação da janela comum */
        await p.evaluate(() => { location.hash = '#colinha'; }); await p.waitForTimeout(900);
        await p.locator('.ck-mini button', { hasText: /Começar de novo|Start over/ }).click(); await espera(p, 1);
        conferir(await p.evaluate(() => document.querySelector('dialog.sj[open]').getAttribute('role')) === 'alertdialog', L + 'Colinha "Começar de novo" pergunta pela confirmação da janela comum');
        await p.locator('dialog.sj[role=alertdialog] button').first().click(); conferir(await espera(p, 0), L + '"Cancelar" fecha a confirmação sem apagar');
        erros.push(...e.map(m => arq + ': ' + m)); await ctx.close();
      })());
    }
  }
  await Promise.all(tarefas);
  conferir(erros.length === 0, 'nenhuma tela com erro de JavaScript' + (erros.length ? ' — ' + erros.slice(0, 3).join(' | ') : ''));
  await browser.close(); srv.close();
  if (falhas.length) { console.log('\n' + falhas.length + ' falha(s)'); process.exit(1); }
  console.log('\ntudo certo');
})().catch(e => { console.error(e); process.exit(1); });
