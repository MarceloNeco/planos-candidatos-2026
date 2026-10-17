/* Roda todos os testes do Eleições 2026 (Chromium/Playwright, só valores de mentira):
     1. index-en.html é EXATAMENTE o que o sincroniza-en.py gera a partir do index.html
     2. caracterizacao.js (voz do aparelho, provedores, 320 px) nas duas páginas
     3. voz-cofre.js (chaves no cofre) nas duas páginas
     4. colinha-interruptor.js (interruptor da Colinha do RootifyONE) nas duas páginas
     5. janelas.js (todas as janelas pela janela comum: trava de trás, ✕/Esc/Voltar/toque fora, "Descartar?", uma por vez) nas duas páginas, 390 px e computador
     6. cofre-protecao.js (PIN ao abrir e ao recarregar, trancar ao sair/esconder/sem uso, painel da digital) nas duas páginas
   Uso: node teste/rodar.js   (precisa do Playwright: npm install -D playwright) */
const { spawnSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const raiz = path.join(__dirname, '..');
let falhou = false;

console.log('\n▶ index-en.html igual ao que o script gera');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eleicoes-en-'));
['index.html', 'index-en.html', 'sincroniza-en.py'].forEach(f => fs.copyFileSync(path.join(raiz, f), path.join(tmp, f)));
const r = spawnSync('python3', ['-I', 'sincroniza-en.py'], { cwd: tmp });
const igual = r.status === 0 && fs.readFileSync(path.join(tmp, 'index-en.html')).equals(fs.readFileSync(path.join(raiz, 'index-en.html')));
console.log(igual ? '  ✓ index-en.html é igual ao gerado pelo sincroniza-en.py' : '  ✗ index-en.html difere do gerado: rode python3 sincroniza-en.py');
if (!igual) falhou = true;
fs.rmSync(tmp, { recursive: true, force: true });

for (const t of ['caracterizacao.js', 'voz-cofre.js', 'colinha-interruptor.js', 'janelas.js', 'cofre-protecao.js']) {
  console.log('\n▶ ' + t);
  if (spawnSync(process.execPath, [path.join(__dirname, t)], { stdio: 'inherit' }).status !== 0) falhou = true;
}
process.exit(falhou ? 1 : 0);
