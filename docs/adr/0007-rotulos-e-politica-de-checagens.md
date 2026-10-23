# ADR 0007 — Rótulos públicos e política de checagens (decisão 5 do dono e sua mitigação)

**Estado:** decidida pelo dono (18/10/2026, 13h); este ADR fixa a mitigação como regra de código

## Contexto

O parecer recomendou os rótulos "Checagens" e "Imprensa" até parecer jurídico, porque "Mentirômetro" afirma intenção de mentir
e "Fumaçômetro" sugere julgamento da imprensa. O dono decidiu **manter "Mentirômetro" e "Fumaçômetro"** como rótulos públicos,
com mitigação obrigatória. A especificação já separa: a unidade de análise é a afirmação, "contradita" descreve incompatibilidade
com evidência sem inferir intenção (seção 14); o Fumaçômetro é multidimensional e não mede intenção coletiva da mídia (seção 17).
Decisão 4: começar por checagens agregadas de terceiros; checagem própria só com duas pessoas revisando.

## Decisão (regras que o código e o conteúdo obedecem)

1. **Todo veredito mostrado é de terceiro**, com agência, rótulo original, data e link (Google Fact Check Tools, Lupa, Aos Fatos,
   Comprova). O `ClaimCard` nunca mostra só um selo colorido: mostra a afirmação, a agência e o rótulo dela (UX22: nenhum
   velocímetro de "honestidade" da pessoa).
2. **Taxonomia interna** é a da especificação (confirmada, parcialmente sustentada, contradita pela evidência, sem conclusão, não
   verificável, em revisão); a palavra "mentira" não aparece em campo de dado, exportação, URL ou texto gerado.
3. **Página de método e de contestação** visível em todo cartão ("Como ler o Mentirômetro", "Contestar"), com protocolo (T44).
4. **Agregado individual** (índice de contradição, T32) só depois do piloto e do gate de elegibilidade (T33); até lá, cartões
   individuais. Comparação entre pessoas só com a mesma janela e política de seleção.
5. **Checagem própria** (veredito da SolverONE) só com apurador e revisor distintos **e** parecer de advogado registrado no
   RootifyONE antes da primeira publicação. O recurso `checagens` nasce desligado.
6. **Fumaçômetro**: nasce desligado (`imprensa`); quando ligar, mostra volume, diversidade, tom e vínculo documental como medidas
   separadas; "atenção sem vínculo documental localizado" nunca é chamada de falsidade (seção 18); o índice experimental fica em P2.
7. O nome dos rótulos é conteúdo do RootifyONE (`apelidos`): se um advogado pedir troca, muda sem commit.

## Alternativas (registradas; a escolha já foi feita)

| | A · "Checagens" e "Imprensa" (recomendação do parecer) | **B · "Mentirômetro" e "Fumaçômetro" com mitigação (decisão do dono)** |
|---|---|---|
| Prós | menor risco de leitura como acusação de intenção; alinhado à taxonomia interna | nomes memoráveis, já conhecidos do público do app |
| Contras | menos apelo | exige disciplina de conteúdo (itens 1 a 6) e revisão jurídica antes de veredito próprio |

## Condição de mudar

Parecer jurídico contrário, notificação extrajudicial ou decisão do dono → trocar os rótulos pelo RootifyONE (item 7), sem mudar dados.

## Como se prova

Teste de texto: nenhum campo publicado contém "mentira/mentiroso"; todo `ClaimCard` tem agência e link; recurso `checagens`
desligado esconde a tela; página de método acessível de todo cartão.
