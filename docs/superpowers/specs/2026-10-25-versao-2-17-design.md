# Versão 2.17: escritório em gramas, nível pela pessoa, PC repaginado

Pedido do Guilherme e do Ademir em 25/10/2026, desenho aprovado no chat ("Pode seguir").
Divisão: Claude faz as telas (blocos 1-telas, 3, 4-telas, 5, 6); Codex faz regras, centrais e nuvem (blocos 1-API, 2, 4-dados) e a revisão do bloco 7. Quem faz não revisa o próprio trabalho.

## Objetivo

Deixar o sistema pronto para entrar em produção com mais tablets (Galaxy Tab A11+): o escritório vê os insumos em peso, o nível de cada aparelho segue a pessoa que entra (com aparelho fixo), o PC vira um painel administrativo completo com entrada por nome e senha, e a interface ganha logo própria, abertura animada no PC e notificações melhores. Nada que funciona hoje na produção pode mudar para o operário.

## 1. Gramas no escritório

- Cal: 1 copo = 680 g. Uréia: 1 caneca = 780 g. Somados em kg.
- A folha da uréia (`setores/destilaria/pranchetas.js`, `ins_ureia`) ganha a unidade `canecas` (primeira da lista); `kg` e `g` continuam para o que já foi anotado.
- Onde aparece em kg: Resumo do dia (`chefe/exportar.js`), Totais do painel (`nucleo/registros.js totaisPorTurno`), Escritório e o arquivo dele (`bibliotecas/rastreamento.js`), API `/api/v1/totais` (`api-leitura.js`, usada pelas duas centrais e pela nuvem).
- Onde NÃO muda: tela de anotar do operário, folha impressa (`bibliotecas/modelos.js`), anotação guardada (o valor continua o que o operário digitou, em copos ou canecas).
- Uma fonte só: `config/forms.js somarEm` ganha `copos: { unidade: 'kg', fator: 0.68 }` e `canecas: { unidade: 'kg', fator: 0.78 }`. O Escritório usa a mesma tabela.
- Pronto quando: um dia com 3 copos de cal e 2 canecas de uréia mostra 2,04 kg e 1,56 kg no resumo, no painel, no escritório e na API (Node, Java e nuvem); a tela do operário mostra copos e canecas.

## 2. Nível pela pessoa, com aparelho fixo (Codex)

- Liberar um aparelho como tablet chefe não pergunta mais o nível: só a senha de quem libera (função `pessoas`, ou o dono).
- Cada pessoa ganha `aparelhos` (lista de ids, opcional). Vazio = o nível dela vale em qualquer tablet chefe. Com aparelhos = o nível dela só vale neles; em outro aparelho ela entra só para ver (funções de Consulta).
- O limite do aparelho (teto, tela Aparelhos) continua valendo por cima.
- Tela Pessoas e permissões: "Vale em: qualquer aparelho / só nos aparelhos fixos" com a lista dos tablets chefe conhecidos.
- Aparelho já liberado continua com o nível que tem até alguém mudar: nada quebra ao atualizar.
- `server.js` e `ServidorCentral.java` iguais; a nuvem recebe `aparelhos` junto com a pessoa (para o PC pela nuvem seguir a mesma regra).
- Pronto quando: o Lucas com aparelho fixo A entra no tablet B e só vê; no A tem o nível dele; teste nas duas centrais.

## 3. Entrar no PC por nome e senha

- Tela com o logo, "Nome" (lista para escolher), "Senha" e "Entrar". O endereço da nuvem vai para a aba "Servidor" (botão pequeno no canto), já preenchido com `nuvemPadrao`.
- Nuvem: `GET /aparelho/pessoas` devolve `[{ id, nome }]` só de quem pode ver pela nuvem (Relatórios ou Escritório). `POST /aparelho/entrar` passa a aceitar `pessoa` (id): confere só a senha dessa pessoa, e o limite de tentativas ganha a chave por pessoa (além de IP, aparelho e geral).
- Sem a lista (sem internet): campo de nome fica desligado e a tela diz por quê.
- Risco aceito: quem souber o endereço da nuvem vê os nomes de quem entra pela nuvem.

## 4. Painel do PC

- "Aparelhos agora": ponto verde/cinza, setor, quem opera, último sinal e versão. A central manda a lista dos aparelhos para a nuvem em `/central/enviar` (só nome, setor, operador, último contato, versão; nada de chave, endereço ou código) e a nuvem devolve no sync de quem lê. Atualiza em até cerca de 1 minuto (Codex: central e nuvem; Claude: tela).
- "Últimas anotações": as anotações mais recentes do dia (quem, folha, hora), das anotações que já chegam.
- Escritório pela nuvem abre direto (quem entrou pela nuvem já tem a função Escritório): Cálculos da produção e Rastreamento e etiqueta, com Enviar (PDF, Excel, XML) e Imprimir. Pela nuvem continua só ver: salvar fica escondido.
- Totais em kg (bloco 1).

## 5. Logo e abertura

- Logo nova: só o U da Ubirálcool, em SVG (`public/icons/logo.svg`), verde da paleta, sem texto. Gera os PNG do ícone (192, 512) e o ícone do Windows a partir dele.
- Abertura no PC (só no computador, uma vez ao abrir): o U se desenha (traço), preenche, e aparece "Pranchetas Ubirálcool" com a mensagem embaixo; cerca de 1,2 s; sem animação quando o sistema pede menos movimento.
- Transições de tela e de janela curtas (150 a 220 ms), com os tokens de `design/movimento.css`.

## 6. Notificações rápidas

- `#toast` ganha botão × e ícone por tipo: certo (ok), erro, atenção, informação.
- Tempo: ok e informação de 2,2 s a 4 s conforme o texto; erro 6 s. Tocar fecha.
- Os avisos do escritório para o funcionário não mudam.

## 7. Revisão completa (Codex)

- Codex: regras, folhas, centrais e nuvem contra o escopo (anotar, somar, sincronizar, permissões, sem perder dado). Lista com gravidade; corrige crítico e alto com teste.
- Claude: telas em todos os tamanhos (inclusive A11+ 11", 1920 × 1200), tema escuro.

## Testes

- `node testes/rodar-tudo.mjs` verde (hoje 789 de 789) e o teste das telas sem problema novo.
- Teste novo por bloco (`testes/versao217.mjs`), nas duas centrais quando tocar nelas.
- Fotos das telas novas olhadas no PC, tablets e celulares.

## Fora desta versão

- Gravar pela nuvem (o PC continua só ver).
- Revogar a chave no servidor ao tocar em Sair no PC (cartão separado, ainda pendente).
