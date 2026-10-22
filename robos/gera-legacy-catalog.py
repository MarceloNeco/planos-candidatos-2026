#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Gera o manifesto legacy_catalog (T01/T25) a partir do bloco <script id="ig"> do index.html atual.

    python3 robos/gera-legacy-catalog.py --index ../planos-candidatos-2026/index.html --saida docs

Uma entrada por item de IG.graficos (as 43 entradas do índice de infográficos), com slug (o mesmo id
que o site usa na âncora #g-…), âncora antiga, título, classe, dataset(s), cálculo, fonte, unidade e
estado de migração. Só lê; não muda o site.
"""
import json, re, unicodedata, argparse, os, hashlib

BASE_ANTIGA = 'https://solverone.com.br/planos-candidatos-2026/'

def slug_g(t):
    s = unicodedata.normalize('NFD', t.lower()); s = ''.join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r'[^a-z0-9]+', '-', s).strip('-')
    return 'g-' + s[:44]

def bloco_txt(html, ident):
    ini = '<script id="%s" type="application/json">' % ident
    a = html.index(ini) + len(ini); b = html.index('</script>', a)
    return html[a:b]

# como cada forma calcula o que mostra (lido do código do index.html, bloco dos infográficos)
CALCULO = {
    'linha': 'uma linha: valor da série por ano, sem transformação',
    'barra': 'barras: valor da série por ano, sem transformação',
    'pontos': 'pontos em datas esparsas (sem linha entre eles), valor na data',
    'duas-linhas': 'duas séries no mesmo eixo, sem emenda entre elas',
    'categorias-linhas': 'uma linha por categoria da série (seleção inicial = sel_inicial), mesmo eixo',
    'barra-linha': 'barras = 1ª série; linha = 2ª série; mesmo eixo',
    'paineis': 'um painel por série, um sob o outro, mesma linha do tempo (unidades diferentes)',
    'area-empilhada': 'áreas empilhadas por categoria; a altura total é a soma',
    'uf-barras': 'barras por UF no ano escolhido (padrão: último ano) + partido do governador na data (ig.governadores)',
    'titulacao-so': 'barras empilhadas por governo (assentadas × títulos), visão por governo ou por ano (ig.titulacao)',
    'mandato-barras': 'contagem de empresas que entraram e saíram por mandato (ig.estatais_lista); barras por mandato',
    'marcos-lista': 'lista datada por governo, sem gráfico de série; contagens por mandato quando há anexo',
    'pesos-radar': 'pesos do leitor por dimensão (soma 100%), guardados no aparelho; valem para todos os marcos',
    'marcos-radar': 'radar 0–3 por dimensão de cada marco (ig.marcos_legais.classificados) × pesos do leitor; comparação de até 2 marcos',
    'dossie-stf': 'dossiê textual de decisões do STF (ig.stf), por governo, sem nota',
}
CLASSE = {
    'marcos-lista': 'regulatorio-lista', 'pesos-radar': 'regulatorio-comparador', 'marcos-radar': 'regulatorio-comparador',
    'dossie-stf': 'dossie', 'uf-barras': 'serie-territorial', 'titulacao-so': 'serie-composta', 'mandato-barras': 'contagem-por-mandato',
}
# tipo de acesso à fonte de cada série, pelo órgão (para o estado de migração e a onda)
def tipo_fonte(orgao, codigo):
    o = (orgao or '').lower(); c = (codigo or '').lower()
    if 'sidra' in c or 'ibge' in o: return 'api', 'IBGE e BCB'
    if 'sgs' in c or 'banco central' in o: return 'api', 'IBGE e BCB'
    if 'banco mundial' in o: return 'api', 'demais'
    if 'inep' in o or 'datasus' in c or 'sim/datasus' in c or 'inpe' in o: return 'arquivo', 'demais'
    if 'receita federal' in o: return 'relatorio', 'Tesouro e Siconfi'
    if 'mds' in o or 'vis data' in c: return 'painel', 'demais'
    return 'relatorio', 'demais'

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--index', required=True); ap.add_argument('--saida', default='docs'); a = ap.parse_args()
    html = open(a.index, encoding='utf-8').read()
    ig_txt = bloco_txt(html, 'ig'); ig = json.loads(ig_txt); dados = json.loads(bloco_txt(html, 'dados'))
    S = ig['series']; G = ig['graficos']
    itens = []
    for i, g in enumerate(G, 1):
        ids = g.get('ids') or []
        ds = []
        for sid in ids:
            s = S.get(sid) or {}
            tf, onda = tipo_fonte(s.get('orgao'), s.get('serie_codigo'))
            ds.append({'serie_id': sid, 'titulo': s.get('titulo'), 'orgao': s.get('orgao'), 'serie_codigo': s.get('serie_codigo'),
                       'unidade': s.get('unidade'), 'criterio': s.get('criterio'), 'fonte_url': (s.get('fonte') or {}).get('url'),
                       'pontos': len(s.get('pontos') or []), 'categorias': s.get('categorias'), 'acesso_fonte': tf, 'onda': onda})
        if g.get('dados'): ds.append({'bloco_ig': g['dados'], 'nota': 'bloco de conteúdo editorial do ig (lista/dossiê), sem série numérica'})
        if g.get('anexo'): ds.append({'bloco_ig': g['anexo'], 'nota': 'anexo com contagens'})
        if g['forma'] in ('pesos-radar', 'marcos-radar'): ds.append({'bloco_ig': 'marcos_legais + dimensoes', 'nota': 'rubricas 0–3 por dimensão e as 6 dimensões'})
        if g['forma'] == 'dossie-stf': ds.append({'bloco_ig': 'stf', 'nota': 'decisões, estatísticas e pendentes'})
        n_series = len([d for d in ds if d.get('serie_id')])
        classe = CLASSE.get(g['forma'], 'comparacao' if n_series > 1 else 'serie')
        unid = sorted(set(d['unidade'] for d in ds if d.get('unidade')))
        orgs = sorted(set(d['orgao'] for d in ds if d.get('orgao')))
        acesso = sorted(set(d['acesso_fonte'] for d in ds if d.get('acesso_fonte')))
        estado = 'legado-embutido'                      # hoje: dado dentro do index.html, servido pelo adaptador legado
        if n_series and all(x == 'api' for x in acesso): estado += ' · robô possível (fonte com API)'
        elif n_series: estado += ' · acervo mantido à mão (fonte sem API)'
        else: estado += ' · conteúdo editorial (vai para o RootifyONE)'
        itens.append({
            'n': i, 'slug': slug_g(g['titulo']), 'ancora_antiga': BASE_ANTIGA + '#' + slug_g(g['titulo']),
            'alias_novo': None, 'titulo': g['titulo'], 'macro': g.get('macro'), 'sub': g.get('sub'), 'classe': classe, 'forma': g['forma'],
            'dataset': ds, 'calculo': CALCULO.get(g['forma'], g['forma']) + (' · categorias: %s' % ', '.join(g['cats']) if g.get('cats') else '') + (' · inclui marcos: %s' % g['marcos_extra'] if g.get('marcos_extra') else ''),
            'fonte': '; '.join(orgs) if orgs else 'conteúdo editorial do próprio site (bloco ig)',
            'unidade': '; '.join(unid) if unid else (g.get('sub') or ''),
            'estado_migracao': estado, 'teste_equivalencia': 'teste/paridade.js (CSV do bloco)' if n_series else 'teste/paridade.js (texto do bloco)',
            'responsavel': 'F1 (PR "dados fora do HTML"): mover; F2: contrato canônico quando houver robô'
        })
    manif = {
        'formato': 1, 'gerado_em': __import__('time').strftime('%Y-%m-%d'), 'fonte': 'index.html ' + dados.get('versao', ''),
        'snapshot_ig_sha256': hashlib.sha256(ig_txt.encode('utf-8')).hexdigest(), 'total_entradas': len(itens),
        'fora_das_43': [
            {'id': 'g-sobrepor', 'titulo': 'Sobrepor indicadores no mesmo gráfico (comparador de 2 a 6 séries)', 'ancora_antiga': BASE_ANTIGA + '#g-sobrepor', 'classe': 'comparador', 'nota': 'T02: catálogo das séries temporais das 43 entradas (exceto marcos-lista, dossie-stf, uf-barras, titulacao-so); base 100 quando as unidades diferem'},
            {'id': 'g-marcos-comp', 'titulo': 'Impacto estimado de marcos regulatórios (comparador consolidado)', 'ancora_antiga': BASE_ANTIGA + '#g-marcos-comp', 'classe': 'comparador', 'nota': 'T03/T22: radar consolidado com pesos comuns'},
            {'id': 'ig-indice', 'titulo': 'Buscar e filtrar todos os gráficos', 'ancora_antiga': BASE_ANTIGA + '#ig-indice', 'classe': 'indice', 'nota': 'T01: busca por nome e unidade, filtros por categoria e tipo'},
        ],
        'series_distintas': len(S), 'marcos_linha_do_tempo': len(ig.get('marcos') or []), 'governos': len(ig.get('governos') or []), 'dimensoes': len(ig.get('dimensoes') or []),
        'entradas': itens,
    }
    os.makedirs(a.saida, exist_ok=True)
    json.dump(manif, open(os.path.join(a.saida, 'legacy_catalog.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    # versão legível
    L = ['# Manifesto legacy_catalog — as 43 entradas do índice de infográficos (T01, T25)', '',
         'Gerado por `robos/gera-legacy-catalog.py` a partir do `index.html` %s em %s. Snapshot `ig` sha256 `%s…`.' % (dados.get('versao', ''), manif['gerado_em'], manif['snapshot_ig_sha256'][:16]),
         'Total: **%d entradas** em `IG.graficos` (o mesmo número que a especificação cita), sobre **%d séries distintas** (`IG.series`), %d marcos na linha do tempo, %d governos e %d dimensões.' % (len(itens), len(S), manif['marcos_linha_do_tempo'], manif['governos'], manif['dimensoes']), '',
         'Fora das 43, mas preservados: `#g-sobrepor` (comparador de 2 a 6 séries), `#g-marcos-comp` (comparador de marcos) e `#ig-indice` (busca e filtros).', '',
         'Estado de migração de todas: **legado-embutido** (o dado mora no `index.html`; na F1 sai para arquivos sem mudar). A coluna "fonte" diz se um robô é possível já na F2 (API) ou se o acervo segue mantido à mão (relatório, painel, arquivo).', '',
         '| # | slug (âncora `#…`) | Título | Classe | Séries (id) | Fonte | Unidade | Cálculo | Estado |', '|---|---|---|---|---|---|---|---|---|']
    for it in itens:
        ids = ', '.join(d['serie_id'] for d in it['dataset'] if d.get('serie_id')) or ', '.join(d['bloco_ig'] for d in it['dataset'] if d.get('bloco_ig'))
        L.append('| %d | `%s` | %s | %s | %s | %s | %s | %s | %s |' % (it['n'], it['slug'], it['titulo'].replace('|', '/'), it['classe'], ids, it['fonte'].replace('|', '/')[:90], it['unidade'].replace('|', '/')[:60], it['calculo'].replace('|', '/')[:110], it['estado_migracao']))
    open(os.path.join(a.saida, 'legacy_catalog.md'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')
    print('legacy_catalog: %d entradas, %d séries → %s' % (len(itens), len(S), a.saida))

if __name__ == '__main__':
    main()
