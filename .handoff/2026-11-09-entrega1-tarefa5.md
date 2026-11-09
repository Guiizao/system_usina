# Entrega 1 — Tarefa 5: cálculo, rastreamento e etiqueta
De: Claude | Para: Codex | Tamanho: M

## Objetivo
Implementar somente a Tarefa 5 do plano docs/superpowers/plans/2026-11-09-entrega-1-logica.md, aprovado pelo dono.
## Escopo
Testes primeiro; sem commit, troca de ramo ou publicação. Sem acesso a dados/ ou alterações no APK e nas centrais.
## Arquivos
public/bibliotecas/rastreamento.js; public/chefe/escritorio.js; public/nucleo/toques.js; testes/rastreio31.mjs; testes/rodar-tudo.mjs.
## Pronto quando
Contas e exportações coerentes; ajustes manuais preservados; suíte nova e regressão aprovadas; imagens conferidas.
## Resposta
Resultado: parcial — implementação concluída; validação visual depende do navegador externo.
Validações: node testes/rastreio31.mjs --so-logica: 8/8; node testes/rodar-rastreamento213.mjs: 20/20.
Validações: node testes/rastreio31.mjs: 8/9, uma falha de infraestrutura (Chrome); cinco arquivos passaram em node --check; git diff --check com core.whitespace=cr-at-eol sem erros.
Testes primeiro: sete testes de lógica falharam antes da implementação (kg não recalculado e APIs ausentes).
Decisão: diferencas compara o resultado atualizável, ignora metadados e linhas vazias acrescentadas pela tela; ajuste manual sozinho não aciona aviso.
Decisão: se qualquer mp.* foi digitado, preserva a lista inteira e recompõe mpKg com essa lista, salvo se o total também foi digitado.
Decisão: usa folhaDoRastreamento em PDF, Excel, XML e impressão no modo soVer; etiqueta usa valoresDaTela e loteDaEtiqueta.
Decisão: troca de dia limpa o rascunho da tela para não carregar valores do dia anterior.
Bloqueios: testes/navegador.mjs:53 — Chrome não abriu na suíte de telas; criação do aparelho também expirou na suíte nova.
Pendência: executar testes/rastreio31.mjs e rodar-telas.mjs fora; conferir fotos escritorio-folhas-mudaram e escritorio-atualizado nos 15 tamanhos.
Revisão: Claude deve revisar o diff da Tarefa 5 antes do fechamento; nenhum commit ou publicação realizado.

## Retorno sobre teste-5.txt
Resultado: parcial — hipótese de corrida entre resize e coordenadas do clique; ainda precisa confirmar no Chrome externo.
Diagnóstico: handler real de toques.js executado em VM produziu [true,9000,250], chamou render e preservou o salvo.
Mudança: rastreio31.mjs aguarda fontes e dois quadros após cada mudança de tamanho; preservados clique real, 15 tamanhos e todas as asserções.
Validações: lógica 8/8; regressão 2.13 20/20; sintaxe e diff sem erros. Suíte com navegador bloqueada por "O Chrome não abriu".
Pendência: repetir rastreio31.mjs fora da caixa e validar as fotos; não considerar a falha original resolvida antes disso.
