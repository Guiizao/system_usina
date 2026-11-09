# Próxima versão: lógica

Data: 09/11/2026. Base: o pedido de 08/11 do Guilherme. O layout já foi aprovado e fica fora deste texto (protótipos em `.handoff/design-3.1/`, fora do git).

Nada aqui autoriza código. Depois do sim neste texto vem o plano de cada entrega, e o commit das versões 3.0 e 3.0.1 tem de acontecer antes da primeira mudança no sistema.

## O que muda, em ordem de entrega

| Entrega | Conteúdo | Reinstala? |
|---|---|---|
| 1 | Login, período e soma, cálculo no envio e no resumo, ligação cálculo, rastreamento e etiqueta, relatórios | Não |
| 2 | Leitura de folhas: folhas que faltam, foto deitada, memória de correções, operador que falta | Não |
| 3 | Painel novo de celular e tablet, chave para ligar e desligar, aberturas e sons | Não |
| 4 | Painel novo do Windows, Configurações no PC | Não |
| 5 | Assistente por texto | Não |
| 6 | Microfone do assistente e ícone novo | Sim, uma vez |

A central existe duas vezes. Regra que mudar em `server.js` muda em `ServidorCentral.java`, e os testes rodam nas duas.

## Entrega 1

### 1.1 Login e tempo de sessão

Causa confirmada no código de "pede a senha toda vez": no celular a pessoa entra com papel de central, e `travarPorInatividade` (`public/nucleo/operador.js:22-25`) chama `sairDoChefe` quando o turno muda, sem olhar `cfg.soNuvem`. A sessão cai na primeira troca de turno, e a associação do aparelho é apagada na nuvem. `pessoaAtual` (`public/chefe/pessoas.js:22`) diz o contrário: "vale até sair".

Regras novas para quem entra pela nuvem:

- A troca de turno não encerra mais essa sessão.
- Prazo guardado no servidor, junto da sessão, e conferido em toda autenticação. Hoje não existe prazo (`nuvem/schema.sql:66-74`).
- Conexão ao vivo também respeita o prazo: ao vencer, ela é encerrada e não repassa mais rascunhos. Hoje a conferência só acontece ao abrir (`nuvem/src/banco.js:747`, `:793-800`).
- Celular: 5 dias. PC: 1 dia, ou 7 com "Lembrar". O prazo é fixo: não renova com o uso. O aparelho informa o tipo, o servidor limita a 7 dias em qualquer caso, e sem tipo informado vale 1 dia.
- Sessões antigas, sem prazo, deixam de valer quando a versão entrar, inclusive as chaves da 2.16 sem sessão (`nuvem/src/index.js:96`). Cada pessoa entra de novo uma vez.
- "Lembrar" não guarda a senha, só mantém a sessão.
- Os prazos ficam em Configurações, por administrador.
- Tablets de setor e tablet chefe na rede da usina continuam como estão.

Login que não entra com internet: a causa real do episódio não dá para saber pelo código. Cada recusa ganha mensagem própria: senha, bloqueado por administrador, muitas tentativas (com o tempo de espera) e sem conexão com o servidor. "Sem permissão" continua junto de "senha errada" de propósito, para a tela não confirmar que uma senha existe (`nuvem/src/index.js:160`).

Os limites de tentativas não mudam agora: 5 senhas erradas por IP, aparelho e pessoa, e 20 por hora na nuvem inteira. Só os erros contam, porque quem acerta devolve a tentativa. Aumentar sem saber o erro real enfraquece a proteção da senha. Se a mensagem nova mostrar que o IP compartilhado da usina é o problema, isso volta como decisão à parte.

### 1.2 Período e soma

Como é hoje: em período, o Excel sempre gera todas as abas, e "Somar" só acrescenta uma aba de totais de insumos (`public/chefe/exportar.js:64-70`). PDF e XML ignoram a opção. O Resumo de vários dias só traz totais de insumos, marcado ou não (`public/nucleo/janelas.js:201-212`).

Como passa a ser:

| Escolha | Excel e PDF | Resumo |
|---|---|---|
| Um dia | Uma folha por área, nas áreas e turnos marcados | O dia, por área |
| Período, sem somar | Uma folha por dia e por área, em ordem, nos turnos marcados | Um bloco por dia, com o que cada área marcada gastou |
| Período, somando | Uma folha por área, com o período todo | Um bloco por área, com o período todo |

XML continua sempre dia a dia, porque é o formato do sistema do escritório. A opção "Somar" não vale para ele e a tela avisa.

Regra para somar, campo a campo, definida em `pranchetas.js` de cada setor:

| Tipo de campo | No período | Exemplos |
|---|---|---|
| Quantidade | Soma | kg, litros, insumos, produção, bags |
| Medição | Média, mínima e máxima | Temperatura, pressão, pH, Brix, INPM, GL |
| Hora, observação, assinatura | Não entra | Início, fim, responsável |
| Operadores | Lista sem repetir | |

Dia sem anotação não entra na média. A folha somada diz quais dias faltaram. A classificação final de cada campo vem no plano, para conferência.

Uma função só faz a conta, sem tela, em arquivo próprio, e Excel, PDF e Resumo usam a mesma. Tem teste automático com dia faltando, turno filtrado e unidade misturada.

### 1.3 Cálculo de produção no envio e no resumo

Como é hoje: Salvar grava por dia em `AAAA-MM-DD|rastreamento|dia`, mas o envio geral só percorre folhas de setores, e o cálculo não pertence a nenhum (`public/config/forms.js:246-259`, `public/chefe/exportar.js:54`). Por isso nunca sai no relatório geral nem no Resumo.

- "Cálculo de produção" e "Rastreamento" entram como opções em Áreas, no envio. Marcados: saem no Excel, no PDF, na impressão e no Resumo.
- O Resumo ganha o bloco de produção: álcool, vinhaça, hidrolisado, vinho e lote. No período, soma quantidades e faz média de INPM e Brix; sem somar, um bloco por dia.
- Se o dia não foi salvo, os números saem das folhas com o aviso "calculado, não conferido".
- A tela do cálculo ganha "Enviar ou imprimir", que abre o envio já com ele marcado.
- O painel novo mostra a produção por dia a partir desse mesmo registro. Dia incompleto aparece marcado "faltam leituras".
- O envio para o sistema Base44 não muda nesta versão.

### 1.4 Ligação entre cálculo, rastreamento e etiqueta

Já é tudo por dia de produção e já lê matéria-prima, hidrólise e destilarias. Defeitos a corrigir:

- Corrigir uma folha depois de salvar não atualiza nada. Passa a aparecer "as folhas mudaram, atualizar?", que refaz só os campos que ninguém ajustou à mão. Hoje "Refazer" perde os ajustes.
- Mudar o kg da matéria-prima no rastreamento não atualiza o cálculo. Passa a atualizar.
- A etiqueta imprime o lote geral (`escritorio.js:249`), não o lote editado do álcool. Passa a imprimir o editado.
- No modo só de ver, a tela deixa mudar números, e a impressão ignora. Ou a impressão usa o que está na tela, ou a tela não deixa editar: fica a primeira opção.

Precisam de resposta do processo real, antes do plano desta parte:

- O pH da hidrólise deve ser o de antes da cal (`phf`, usado hoje) ou o de depois (`phf2`)?
- A produção da Nova Destilaria é somada como litros, mas o campo é LT/H. Está certo? E o "Carregamento" da Destilaria é quantidade a somar? Até a resposta, os dois saem com média no período somado.
- O lote da vinhaça deve ser o mesmo do álcool? Hoje sai vazio.

O áudio do Ademir não foi encontrado neste computador.

### 1.5 Relatórios

"Apagar o arquivo" apaga o Excel guardado no servidor, não as anotações, e só existe nos dias que têm Excel guardado. Por isso aparece em alguns cartões. Sai do cartão e vai para dentro de "Abrir e corrigir", onde só aparece com arquivo guardado. O cartão fica com três ações iguais em todos os dias, o que também resolve o tamanho.

### 1.6 Acertos pequenos de tela

Símbolos de certo e X alinhados ao texto nas opções do envio. Nome comprido do operador não quebra a linha.

## Entrega 2: leitura de folhas

**Folhas que faltam.** `moldeDaFolha` só conhece anexo 1, anexo 2, POP 03 e caldeira (`public/chefe/ler-folha.js:11-19`). Entram Destilaria, Nova Destilaria, Medição e Fermentação. Cada molde é medido em foto real: são necessárias ao menos duas fotos de cada folha preenchida.

**Foto deitada.** Quando a grade não for encontrada, a leitura tenta os outros três giros e fica com o de melhor encaixe. O aviso só aparece se nenhum servir.

**Aprender com as correções.** Discordo de usar uma LLM aqui: uma LLM não roda em tablet de 8" e não compara assinaturas. O certo é uma memória de recortes:

- Toda correção guarda o recorte reduzido, a coluna e o valor certo, no banco, valendo para todos os aparelhos.
- Na leitura seguinte, cada célula é comparada com os recortes daquela coluna da mesma folha.
- Com 3 correções parecidas para o mesmo valor, sugere. Com 5 ou mais e sem conflito, já preenche, marcado "aprendido", e a pessoa ainda confere.
- Vale para todas as colunas: assinatura vira nome da lista, número, hora.
- De tempos em tempos os recortes servem para retreinar o leitor (`treino-leitor/`). Isso não precisa reinstalar.
- Assinatura é dado pessoal: fica no banco privado, nunca no git, e só quem pode ler folhas acessa.

**Operador que falta.** Na correção do nome aparece "Cadastrar quem falta", para quem tem permissão. O cadastro abre por cima, e o nome entra na lista na hora. A leitura em andamento fica guardada no aparelho: se sair, ao voltar ela retoma.

## Entrega 3: painel novo

Chave "Painel novo" por aparelho, em Mais e em Configurações, desligada no início. Desligada, tudo volta ao painel de antes, sem perder nada.

Abertura: sorteia uma das 10, com até 2 segundos, e um toque pula. Aparece ao abrir no celular e no PC. Tablet de setor com pessoa logada não tem abertura.

Som: abertura com o som dela, avisos e confirmações com os quatro sons escolhidos. Chave para desligar. Tablets de setor ficam sem som.

Fundos só atrás de login, cartão verde, menu, cabeçalho e tela vazia, com versão para o tema escuro.

## Entrega 4: Windows

Painel próprio, conforme as telas aprovadas. Configurações no PC com "Você está como" e "Entrar com outra pessoa", sempre respeitando o que cada nível pode. Mesma chave para voltar ao painel de antes.

## Entrega 5: assistente

- Serviço: Cloudflare Workers AI, que a usina já usa para a nuvem. Plano grátis com cerca de 70 perguntas por dia, estimativa a confirmar. Testar português antes de decidir o modelo.
- Gemini grátis fica fora: o Google usa o conteúdo enviado, e pessoas podem revisar.
- A IA não acessa o banco direto. Só chama ferramentas fechadas: produção, folhas, quem está trabalhando, avisos, relatórios.
- Cada ferramenta confere a permissão de quem está logado no servidor. Sem permissão, responde que não pode.
- Os números vêm sempre do sistema, nunca do modelo.
- Ação que muda algo (mandar aviso, imprimir) pede confirmação na tela.
- Sem cota: o assistente avisa, e o resto do sistema segue normal.
- Testes: lista fixa de perguntas, com resposta certa conhecida, incluindo tentativa de passar da permissão.

## Entrega 6: instalação única

Um APK e um instalador do Windows, com permissão de microfone e ícone novo. Até lá, a voz sai do microfone do teclado e do Windows+H.

## Estrutura do código

Discordo de revisar tudo de uma vez: o risco é parar a usina em plena safra. Cada entrega reorganiza só os arquivos que toca, com teste antes e depois.

## Divisão do trabalho

| Parte | Quem faz | Quem revisa |
|---|---|---|
| Especificação, planos, telas e aberturas | Claude | Codex |
| Soma, sessão, cálculo no envio, memória de correções, assistente, testes | Codex | Claude |

## Pronto quando

Cada entrega termina com `node testes/rodar-tudo.mjs` passando nas duas centrais, as fotos das telas conferidas nos 15 tamanhos e os números no relatório.

## O que falta do Guilherme

1. Autorizar o commit das versões 3.0 e 3.0.1.
2. Fotos das folhas que faltam, ao menos duas de cada.
3. Mensagem exata do erro de login, se acontecer de novo.
4. Áudio do Ademir, ou respostas às três perguntas de 1.4.
