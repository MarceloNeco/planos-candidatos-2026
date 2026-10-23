#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Protótipo de robô da onda 1 (IBGE e BCB) — F0 da plataforma política.

Mede o CUSTO REAL de ligar as duas primeiras famílias de fontes e confere se os
números oficiais batem com o acervo embutido no index.html (séries `ipca` e `selic`).

    python3 robos/prototipo-ibge-bcb.py [--index /caminho/index.html] [--saida pasta]

O que ele faz (só biblioteca padrão do Python, como o congresso-sync.py):
  1. IBGE, IPCA acumulado no ano (SIDRA tabela 1737, variável 69): lê TODOS os meses
     pela API SIDRA (apisidra.ibge.gov.br), guarda o valor de dezembro de cada ano.
     Observação: em 22/10/2026 o endereço servicodados.ibge.gov.br/api/v3 derrubou a
     conexão a partir deste container; o apisidra respondeu em menos de 1 s.
  2. BCB, meta da Selic (SGS 432): lê em janelas de 5 anos (janela de 10 anos devolve
     "Requisição inválida" em HTML com HTTP 200: por isso o robô CONFERE o tipo da
     resposta e não confia só no status), guarda o último valor de cada ano.
  3. Compara com os pontos do acervo (bloco <script id="ig"> do index.html) e grava
     saida/ipca.json, saida/selic.json e saida/relatorio.json com tempos, tamanhos e
     diferenças. Diferença é só informação: o acervo não é alterado.
Nenhum segredo: as duas fontes são abertas e sem chave.
"""
import json, sys, time, urllib.request, os, argparse
from datetime import date

UA = {'User-Agent': 'solverone-plataforma-politica/f0-prototipo', 'Accept': 'application/json'}

def baixa(url, tentativas=3, timeout=90):
    """GET com insistência; devolve (json, segundos, bytes). Resposta que não é JSON conta como falha."""
    for i in range(tentativas):
        t0 = time.time()
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                dado = r.read(); ctype = r.headers.get('Content-Type', '')
            if 'json' not in ctype:
                raise ValueError('resposta não é JSON (%s)' % ctype.split(';')[0])
            return json.loads(dado.decode('utf-8')), round(time.time() - t0, 2), len(dado)
        except Exception as e:
            print('  falhou (%s) em %s' % (e, url[:90]))
            if i == tentativas - 1: raise
            time.sleep(2 ** (i + 1))

def bloco(html, ident):
    ini = '<script id="%s" type="application/json">' % ident
    a = html.index(ini) + len(ini); b = html.index('</script>', a)
    return json.loads(html[a:b])

def ipca_anual(rel):
    url = 'https://apisidra.ibge.gov.br/values/t/1737/n1/all/v/69/p/all?formato=json'
    j, seg, nbytes = baixa(url)
    rel['chamadas'].append({'fonte': 'IBGE SIDRA 1737 v69 (IPCA acumulado no ano)', 'url': url, 'segundos': seg, 'bytes': nbytes, 'linhas': len(j) - 1})
    out = {}
    for x in j[1:]:
        cod = x.get('D3C', '')          # AAAAMM
        if cod.endswith('12') and x.get('V') not in ('...', '-', '', None):
            out[int(cod[:4])] = float(x['V'])
    return out

def selic_fim_de_ano(rel, de=1998, ate=None):
    ate = ate or date.today().year
    out = {}
    ini = de
    while ini <= ate:
        fim = min(ini + 4, ate)
        url = ('https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados?formato=json&dataInicial=01/01/%d&dataFinal=31/12/%d' % (ini, fim))
        j, seg, nbytes = baixa(url)
        rel['chamadas'].append({'fonte': 'BCB SGS 432 (meta Selic), janela %d-%d' % (ini, fim), 'url': url, 'segundos': seg, 'bytes': nbytes, 'linhas': len(j)})
        for x in j:
            ano = int(x['data'][-4:]); out[ano] = float(x['valor'])   # a lista vem em ordem de data: o último vence
        ini = fim + 1
    return out

def compara(nome, oficial, acervo, rel, so_ano_fechado=True):
    hoje = date.today().year
    difs, iguais = [], 0
    for p in acervo:
        ano = int(p['ano']); v = p.get('valor')
        if v is None or (so_ano_fechado and ano >= hoje): continue
        o = oficial.get(ano)
        if o is None: difs.append({'ano': ano, 'acervo': v, 'oficial': None, 'nota': 'sem valor oficial'}); continue
        if abs(float(v) - o) > 1e-9: difs.append({'ano': ano, 'acervo': v, 'oficial': o})
        else: iguais += 1
    rel['series'][nome] = {'anos_iguais': iguais, 'diferencas': difs}
    print('  %s: %d anos iguais, %d diferença(s)' % (nome, iguais, len(difs)))
    for d in difs: print('     ', d)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--index', default=os.path.join(os.path.dirname(__file__), '..', 'index.html'))
    ap.add_argument('--saida', default=os.path.join(os.path.dirname(__file__), 'saida'))
    a = ap.parse_args()
    os.makedirs(a.saida, exist_ok=True)
    html = open(a.index, encoding='utf-8').read()
    ig = bloco(html, 'ig')
    rel = {'rodado_em': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'chamadas': [], 'series': {}}
    t0 = time.time()
    print('IBGE: IPCA acumulado no ano…'); ipca = ipca_anual(rel)
    print('BCB: meta da Selic em janelas de 5 anos…'); selic = selic_fim_de_ano(rel)
    rel['segundos_total'] = round(time.time() - t0, 1)
    json.dump(ipca, open(os.path.join(a.saida, 'ipca.json'), 'w'), indent=1)
    json.dump(selic, open(os.path.join(a.saida, 'selic.json'), 'w'), indent=1)
    print('Conferindo contra o acervo do index.html (anos fechados):')
    compara('ipca', ipca, ig['series']['ipca']['pontos'], rel)
    compara('selic', selic, ig['series']['selic']['pontos'], rel)
    json.dump(rel, open(os.path.join(a.saida, 'relatorio.json'), 'w'), indent=1, ensure_ascii=False)
    print('Tempo total: %ss · chamadas: %d · relatório em %s' % (rel['segundos_total'], len(rel['chamadas']), a.saida))

if __name__ == '__main__':
    main()
