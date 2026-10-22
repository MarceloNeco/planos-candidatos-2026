# Limites dos planos gratuitos (conferidos nas páginas oficiais em 22/10/2026)

Tudo na plataforma política roda no plano gratuito: GitHub Free, Supabase Free e Cloudflare Free. Os valores abaixo foram lidos
nas páginas oficiais em **22/10/2026** por um leitor automático; o que não pôde ser lido está marcado. Reconferir antes de cada fase.

| Serviço | Limite que pesa aqui | Valor lido | Link (consultado em 22/10/2026) |
|---|---|---|---|
| GitHub Pages | tamanho do repositório-fonte | recomendado até 1 GB | https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits |
| GitHub Pages | tamanho do site publicado | no máximo 1 GB | idem |
| GitHub Pages | banda mensal | "soft limit" de 100 GB por mês | idem |
| GitHub Pages | builds | "soft limit" de 10 por hora (não vale quando o site é publicado por workflow próprio do Actions); deploy com timeout de 10 min | idem |
| GitHub Pages | Pages grátis só em repositório público no plano Free | **não aparece nessa página**; a diretriz da SolverONE já assume isso (repositório privado com Pages exige plano pago) | — |
| GitHub Actions | minutos no plano Free | 2.000 min/mês; 500 MB de artefatos; cache de 10 GB por repositório | https://docs.github.com/en/billing/managing-billing-for-your-products/about-billing-for-github-actions |
| GitHub Actions | repositório público | uso gratuito com os runners padrão hospedados pelo GitHub (por isso os robôs ficam num repositório **público** de dados) | idem |
| GitHub Actions | agendamento (cron) | pode atrasar em horário de pico, inclusive no início de cada hora; com carga muito alta, jobs na fila podem ser descartados | https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#schedule |
| GitHub Actions | desativação | em repositório público, workflows agendados são **desativados após 60 dias sem atividade** no repositório (o robô que grava commits mantém a atividade; se nada mudar por 60 dias, o dono precisa reativar) | idem |
| GitHub | arquivos grandes | aviso acima de 50 MiB; bloqueio acima de 100 MiB (Git LFS); upload pelo navegador até 25 MiB; repositório idealmente < 1 GB, fortemente recomendado < 5 GB | https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github |
| Supabase Free | banco | 500 MB por projeto | https://supabase.com/pricing |
| Supabase Free | storage | 1 GB; 50 MB por arquivo | idem |
| Supabase Free | egress | 5 GB (+ 5 GB cached) | idem |
| Supabase Free | Edge Functions e Auth | 500.000 invocações; 50.000 usuários ativos por mês | idem |
| Supabase Free | pausa | projeto pausado **após 1 semana sem uso**; máximo de 2 projetos ativos (o RootifyONE já tem o "pulso" que mantém o projeto acordado) | idem |
| Cloudflare Workers Free | requisições | 100.000 por dia (zera às 00:00 UTC; erro 1027 ao passar); 10 ms de CPU por requisição | https://developers.cloudflare.com/workers/platform/limits/ e https://developers.cloudflare.com/workers/platform/pricing/ |
| Cloudflare Pages Free | builds | 500 por mês, 1 por vez, timeout de 20 min; Functions contam na cota do Workers | https://developers.cloudflare.com/pages/platform/limits/ |
| BCB SGS | janela de consulta | séries diárias limitadas a 10 anos por consulta desde 26/03/2025 (observação na página da série 11); na prática, em 22/10/2026 a janela de 10 anos devolveu "Requisição inválida" e as de 5 anos levaram 13–27 s | https://dadosabertos.bcb.gov.br/dataset/11-taxa-de-juros---selic |

## O que isso decide

- **Repositório de dados público**: é o que torna o Actions gratuito e sem limite de minutos. O site também é público (Pages).
- **Séries longas em CSV por indicador, não num JSON único**: o site publicado tem teto de 1 GB e o `index.html` atual já tem 2,9 MB com 20 mil linhas de dados.
- **Cadência diária**: o cron do Actions não garante minuto; "tempo real" não é prometido (parecer, seção 1).
- **Supabase só com login** (editorial do RootifyONE): leitura pública nunca bate no banco, então 500 MB e 5 GB de egress bastam; o pulso evita a pausa de 7 dias.
- **Cloudflare Workers só se um dia for preciso chamar uma API com chave na hora da consulta**: 100 mil requisições/dia dão folga, mas a preferência continua sendo lote no Actions sem chave em tempo de execução.
- **Atividade mínima no repositório de dados**: um robô que grava todo dia mantém os workflows ligados; o manifesto registra a última gravação para o dono ver se algo parou.

## Não lido em 22/10/2026 (conferir à mão)

- Calendário do TSE para 2028 (páginas devolveram 403 ao leitor automático). Datas calculadas pela Lei 9.504/1997, art. 1º: 1º turno em 01/10/2028 e 2º turno em 29/10/2028 (1º e último domingo de outubro).
- Documentação da API de agregados do IBGE (503) e Swagger da Câmara e do Senado (não renderizam sem navegador): o contrato se lê pelos JSON do OpenAPI (R05, R07).
