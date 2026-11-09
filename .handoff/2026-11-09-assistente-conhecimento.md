# Assistente com conhecimento da usina
De: Claude | Para: Codex | Tamanho: G

## Objetivo
Contextualizar o assistente com vocabulário, configuração e perguntas da usina antes da 3.1.5.
## Escopo
Contexto gerado de forms, sinônimos, exemplos e ferramenta fora_do_limite com permissão relatorios.
Preservar memória e travas existentes; sem APK, dados, versão, novidades, telas, commit ou publicação.
## Arquivos
nuvem/src/assistente.js; testes/assistente31.mjs.
## Pronto quando
Suíte do assistente passa; prompt abaixo de 24.000 caracteres; limites testados com e sem permissão e alertas.
## Resposta
Resultado: feito — contexto, catálogo com setor/unidade/agregação, 12 exemplos e fora_do_limite implementados.
Validações: node testes/assistente31.mjs — 46/46; prompt do sistema: 10.341 caracteres.
Validações: git -c core.whitespace=cr-at-eol diff --check — sem erros.
Limites: 403 antes da leitura, revogação durante AI, dia vazio e equivalência com a função real do painel.
Decisão: painel.js intacto; regras-usina.js não é carregado no aplicativo e a extração exigiria mudar seu carregamento.
Decisão: prompt identifica vinho, hidrolisado e vinhaça no rastreamento, mas informa que consulta não acessa esses volumes.
Bloqueios: nenhum. Testes usam AI falso; não medem a escolha semântica do modelo real.
Revisão: diff destes dois arquivos disponível para Claude; alterações anteriores de memória preservadas.
Sem commit nem publicação. Nenhuma alteração em telas nesta tarefa.
