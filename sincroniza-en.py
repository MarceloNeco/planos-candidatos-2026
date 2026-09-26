#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Regenera o index-en.html a partir do index.html.

Os dois arquivos têm o MESMO código (HTML, CSS, JS e o dicionário `traden`);
o que muda é só o conteúdo dos blocos de dados (<script id="dados">, "ig",
"bio", "glos", "patr", "dlinks", "proc"), a variável IDIOMA, o atributo lang
e os links hreflang. Então: edite sempre o index.html e rode

    python3 sincroniza-en.py

O script pega o código novo do index.html e encaixa nele os blocos de dados
em inglês que já estão no index-en.html. Nada de editar o index-en.html à mão.
"""
import re, sys, io

PT = 'index.html'
EN = 'index-en.html'
DADOS = ['dados', 'ig', 'bio', 'glos', 'patr', 'dlinks', 'proc']

def bloco(texto, ident):
    ini = '<script id="%s" type="application/json">' % ident
    a = texto.index(ini) + len(ini)
    b = texto.index('</script>', a)
    return a, b

def main():
    pt = io.open(PT, encoding='utf-8').read()
    en = io.open(EN, encoding='utf-8').read()
    novo = pt
    # 1) blocos de dados: mantém os que já estão em inglês
    for ident in DADOS:
        a, b = bloco(novo, ident)
        c, d = bloco(en, ident)
        novo = novo[:a] + en[c:d] + novo[b:]
    # 2) idioma da página
    trocas = [
        ('<html lang="pt-BR">', '<html lang="en-US">'),
        ('<link rel="alternate" hreflang="pt-BR" href="index.html">', '<link rel="alternate" hreflang="en-US" href="index.html">'),
        ('<a class="brand" href="./"', '<a class="brand" href="./index-en.html"'),
        ('var IDIOMA="pt";', 'var IDIOMA="en";'),
    ]
    for de, para in trocas:
        if novo.count(de) != 1:
            sys.exit('esperava exatamente 1 ocorrência de %r, achei %d' % (de, novo.count(de)))
        novo = novo.replace(de, para)
    io.open(EN, 'w', encoding='utf-8').write(novo)
    print('index-en.html regenerado: %d linhas' % novo.count('\n'))

if __name__ == '__main__':
    main()
