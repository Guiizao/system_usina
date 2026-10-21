# Pranchetas Digitais Ubirálcool

Troca as pranchetas de papel (POP 011, POP-03-FOR-004, controles diários da caldeira e das destilarias) por tablets ligados no Wi-Fi da usina.

Guia com o passo a passo ilustrado: https://claude.ai/artifact/CmJHBvqjeGRWHVYE5R9fWU

## Antes de instalar

1. A senha do administrador fica em `public/forms.js` (`pinAdmin`, 159357 desde a versão 2.4). Na primeira vez que a central liga na versão 2.9, ela cadastra o Guilherme como administrador com essa senha. Nos tablets dos setores ela só vale quando a central está fora do ar.
2. Gere o aplicativo, se mexeu em algo:

```bash
powershell -ExecutionPolicy Bypass -File apk\gerar-apk.ps1
```

O APK sai em `apk/saida/pranchetas.apk`. Na primeira vez, rode antes `apk\instalar-ferramentas.ps1` (baixa Java e Android SDK em `%USERPROFILE%\android-build`).

## Ligar a central

**Num tablet (sem computador):** instale o APK, abra e toque em **Usar como servidor**. A tela "Preparando o servidor" cria as pastas, liga o servidor (com aviso fixo na barra, para não desligar com a tela apagada) e mostra o código. Permita as notificações e a bateria quando o Android perguntar. Depois escolha a função deste aparelho: normalmente **Tablet chefe**, mas pode ser um setor.

Desde a versão 2.4, ser o **tablet chefe** (o painel do escritório) e ser o **servidor** são coisas separadas: o tablet chefe pode usar um servidor que está em outro aparelho (outro tablet ou o computador), e ligar o servidor nunca apaga nada do que já está guardado. Nos ajustes do aparelho: **Usar este aparelho como servidor** ou **Desligar o servidor deste aparelho**.

Pastas no tablet chefe: `Documentos/Usina/RelatoriosUsina` (Excel e XML), `Documentos/Usina/BackupUsina` (um arquivo por dia) e `ServidorUsina` (dentro do app).

**Num computador do escritório:** precisa do [Node.js](https://nodejs.org).

```bash
node server.js
```

A tela mostra o endereço para os tablets, o código de conexão de 6 números e a página `/baixar`.
Os dados ficam em `dados/ServidorUsina`, `dados/RelatoriosUsina` e `dados/BackupUsina`.

Uma vez só, rode `liberar-firewall.ps1` (botão direito > Executar com o PowerShell). Sem isso o Windows bloqueia os tablets, principalmente quando a rede está marcada como "Pública".

## Cada tablet de setor

1. Conecte no Wi-Fi da usina.
2. Aponte a câmera para o QR code do tablet chefe (abre a página de baixar).
3. Se o Chrome avisar que o download não é seguro, toque em "Baixar mesmo assim".
4. Instale e abra: o app procura o tablet chefe sozinho no Wi-Fi. Digite o código e escolha o setor.
5. Se o endereço do tablet chefe mudar, os tablets procuram de novo sozinhos.
6. Trave o tablet: Android > Segurança > **Fixar app**. O app já abre em tela cheia e mantém a tela acesa.

Também funciona sem instalar, abrindo o endereço da central no Chrome.

## Demonstração sem central

Na primeira tela, toque em **"Só demonstração, sem central"**. Senha dos ajustes: a que você definiu em `pinAdmin`.
Nos ajustes existe "Preencher com dados de exemplo".

## Onde mudar as coisas

Desde a 2.16 cada setor tem a sua pasta: `public/setores/<setor>/pranchetas.js` (o setor, as folhas, os campos, os limites e os avisos dele). O resto fica em `public/config/forms.js`. Cores, letras e animações ficam em `public/design/` (veja a seção da 2.16).

| O quê | Onde |
|---|---|
| Setores, pranchetas e campos | `setores/<setor>/pranchetas.js` |
| Faixa que acende o aviso vermelho | `min` e `max` de cada campo |
| Avisos do processo (pH abaixo de 5, Brix acima de 25) | `avisos` de cada campo |
| Unidades de cada insumo (kg, g, mL, L) | `insumo(..., [unidades])` |
| Telas juntas (LPHERA / Cal, Saczyme / Alcolina) | `juntas_lphera_cal`, `juntas_saczyme_alcolina` |
| Valor que já vem preenchido | `padrao` |
| Passo dos botões − e + | `passo` |
| Turnos e hora que troca a folha | `turnos`, `inicioDoDia` |
| Senha do encarregado | `pinAdmin` (`config/forms.js`) |
| Minutos parado até pedir a senha de novo | `minutosSemMexer` |
| O que cada nível de tablet chefe faz | `niveisDoAparelho` |

Operadores, senhas dos operadores, WhatsApp e e-mail do escritório, tipos de produto e fornecedores do ralo e quais pranchetas aparecem em cada setor são configurados no tablet chefe, em **Usina** (só quem entrou com permissão para isso). Pessoas e senhas do tablet chefe ficam em **Pessoas e permissões** (só o administrador).

Tamanho da tela (Menor, Normal, Maior) é por aparelho, na engrenagem.

## Relatórios

- No tablet chefe: "Enviar para o escritório" (direto para o WhatsApp ou e-mail cadastrado), WhatsApp, E-mail, Outros apps, Guardar e Imprimir. Uma janela pergunta **de quais setores** (todos vêm marcados) e se vai Excel, XML ou resumo em texto.
- O **resumo em texto** (WhatsApp) sai organizado: cada setor em negrito, e no fim os **totais do dia de cada insumo** (LPHERA, Cal, Saczyme, Antibiótico, matéria-prima...), que é o que o escritório lança no sistema dele.
- Tela **Relatórios**: **um por dia**, com todos os setores. Cada dia tem **Abrir e corrigir** (abre o painel daquele dia), **Enviar ou imprimir** (o arquivo é montado na hora, com as últimas correções) e **Apagar o arquivo** (apaga o Excel e o XML guardados; as anotações continuam). O XML não aparece na lista: é só outro tipo de arquivo que dá para escolher ao enviar.
- O Excel do dia com todos os setores fica em RelatoriosUsina. No computador com `node server.js`, também em `http://ENDEREÇO:8080/relatorios`.
- Às 07:00 o dia fecha sozinho e o arquivo do dia anterior é guardado.

## Relatórios iguais ao papel

Excel, XML e impressão saem com o mesmo desenho das folhas de papel (`public/modelos.js`): cabeçalho com logo, códigos do documento (POP 011, POP-03-FOR-004), todas as linhas impressas (25 dornas ou 07:00 a 06:00), rodapé de aprovação, TOTAL e "Verificado por". Caldeira, Destilaria e Nova Destilaria saem deitadas, com os blocos de turno.
Os nomes do cabeçalho (elaborador, revisor, datas de revisão) ficam em `public/forms.js`, em `documentos`.

## Tela cheia e barra do Android

O aplicativo respeita a barra de cima (bateria e hora) e a de baixo. Só esconde as barras quando **Tela cheia** está ligada na engrenagem (ajustes do aparelho). Arrastar o dedo da borda mostra as barras por um instante.

## Ler folha de papel (tablet chefe)

No painel do tablet chefe: **Tirar foto da folha**. O leitor funciona **sem internet**, dentro do aparelho:

1. acha a tabela pelos cruzamentos das linhas impressas (aguenta foto torta, em perspectiva e de lado);
2. recorta cada célula usando o molde da folha;
3. uma rede neural pequena (`public/lib/leitor.onnx`, rodando no OpenCV.js) lê a letra de mão;
4. cada coluna diz o que é possível (hora, pH, número, MASSA/FINI, nome do operador) e o leitor escolhe o valor mais provável, com confiança.

Na tela de conferência aparece a foto de cada célula em cima do valor lido. Amarelo = conferir. Toque para corrigir (com sugestões "Pode ser"). Só salva o que você marcar.
Folhas lidas hoje: Hidrólise (Anexo I), Sacarificação (Anexo II) e todas as de insumo (POP-03-FOR-004). Caldeira e destilarias ainda não.

O treino da rede fica fora do aplicativo (Python + PyTorch), com a base EMNIST de letras de mão, 90 fontes cursivas e de mão do Google Fonts, números desenhados no jeito brasileiro (1 com gancho, 7 cortado) e células reais das folhas da usina.

## Dia da Hidrólise (versão 2.2)

Do jeito que é feito na área:

1. **Enchendo:** a dorna de baixo enche. O operador anota Brix, pH, cal (em copos de 1 litro) e enzima e toca em **Salvar**. A tela continua na mesma dorna. Duas dornas podem estar enchendo juntas.
2. **Enviando:** ligou a bomba, toca em **Enviar Nº X**. O início é marcado na hora do aparelho (dá para corrigir no quadro). Se outra dorna ainda estava indo para cima, ela termina no mesmo horário: a bomba manda uma de cada vez.
3. **Anotada:** quando esvaziar, **Terminou de enviar** marca o fim. Se houve uma pausa entre uma dorna e outra, é só tocar em Terminou na hora certa.

- **Sacarificação:** a dorna de mesmo número é criada sozinha e recebe o horário de início, o pH final (pHf) e o Brix final (BHX) da Hidrólise. Quadro mudado à mão na Sacarificação para de acompanhar; o botão **Copiar da Hidrólise** volta a acompanhar.
- **LPHERA / Cal e Saczyme / Antibiótico:** cada hora é somada sozinha das dornas enviadas naquela hora (duas dornas = 140 de LPHERA, 200 de Saczyme e de Antibiótico). A hora fica marcada **conferir** até o operador tocar em **Confirmar**. Hora com valor digitado à mão não é mais mexida. Hora só confirmada (sem mudar o valor) volta para **conferir** se depois entrar ou sair uma dorna daquela hora (versão 2.3).
- A **Nova Nº** fica sempre à vista, à direita das dornas do dia (versão 2.3).
- **Trocar de aba** volta na mesma dorna (e nos insumos, na hora em que ela foi enviada).
- **Apagar esta dorna** sobe as seguintes um número (3 vira 2), na Hidrólise e na Sacarificação, como na folha de papel.

## Apagar dados

- **Apagar dados deste aparelho** (ajustes do aparelho): tira deste aparelho as anotações e a função dele, para usar em outro setor. O que já foi enviado continua na central. No aparelho que é o servidor, desligue o servidor antes.
- **Apagar todos os dados do sistema** (Usina > senha do encarregado): pede também a **senha do programador**, que a própria central confere (ela guarda só o resumo da senha, não a senha).

No tablet chefe: **Usina** (senha do encarregado) > **Apagar todos os dados do sistema** > senha do programador. Apaga as anotações de todos os setores, na central e nos tablets (cada tablet limpa quando se conecta). Operadores, senhas, contatos e listas continuam. Uma cópia do que foi apagado fica em `BackupUsina/antes-de-zerar-<data>.json`, e os arquivos de cada dia vão para a pasta `BackupUsina/antes-de-zerar-<data>/`.

## Memória dos aparelhos e dias antigos (versão 2.3)

A memória do navegador do Android guarda uns 5 milhões de letras, o que dá perto de 2 meses de anotações da usina inteira. Até a versão 2.2, cada tablet guardava tudo desde o primeiro dia e, com uns 2 meses de uso, parava de salvar. Agora:

- **Tablet do setor:** guarda os últimos 3 dias (o que ainda não foi enviado nunca sai da memória).
- **Tablet chefe:** guarda os últimos 20 dias. Um dia mais antigo é buscado na central quando alguém abre (o painel mostra "Buscando as anotações na central...").
- **Central:** guarda na memória os últimos 60 dias. Os mais antigos ficam só em `BackupUsina`, um arquivo por dia, e continuam abrindo no painel, no Excel e no XML.
- Aparelho que ficou muito tempo sem Wi-Fi manda as anotações em lotes de 300.

## Tablet chefe trocado, reinstalado ou reiniciado (versão 2.3)

- **Reiniciou** (acabou a bateria, atualização do Android) ou o aplicativo foi **atualizado**: o servidor liga sozinho, sem ninguém abrir o aplicativo.
- **Trocado ou reinstalado** (a central começa vazia, com código novo): cada tablet de setor pede o código de novo. Depois de conectar, ele manda para a central nova o que tinha guardado (os últimos 3 dias), para a folha não começar vazia. Os dias mais antigos ficam na pasta `BackupUsina` do tablet chefe antigo (Documentos > Usina).
- Um tablet que tinha anotações de antes de **Zerar** continua sendo mandado limpar, mesmo que conecte de novo.

## Velocidade (versão 2.3)

Medido num tablet simulado 4 vezes mais lento que o computador, com a central guardando 90 dias: tecla e Próximo em 12 a 14 ms, painel do tablet chefe em 10 a 21 ms, trocar de aba em 41 a 53 ms e salvar uma dorna em 64 ms. Todos abaixo de 100 ms. Para medir de novo: `node testes/desempenho.mjs` (resultado em `testes/saida/desempenho.json`).

- As anotações têm um índice por dia e folha, montado de novo só quando alguma muda.
- Ao teclar, só o quadro que mudou e o teclado são refeitos (e só neles a letra é ajustada para caber).
- A tabela do monitoramento só é montada quando alguém abre o monitoramento; o QR code do painel é guardado.
- A fonte (Atkinson Hyperlegible) vem dentro do aplicativo, em `public/fonts` (licença em `public/fonts/OFL.txt`). Antes ela vinha da internet e, num Wi-Fi sem internet, a tela podia demorar para aparecer.

## Pedidos do teste de 24/09 (versão 2.4)

- **Aviso curto** do lado do número (pH baixo, Brix alto): a caixa do quadro e o teclado não mudam de tamanho, e o dedo não erra a tecla. O aviso de pH vale só para o primeiro pH (o segundo já é depois da cal). No teclado, o nome do quadro fica vermelho com o aviso do lado.
- **LPHERA / Cal e Saczyme / Antibiótico** somam só as dornas que terminaram de enviar (anotadas). Dorna enchendo, enviando ou de teste não entra.
- **Blocos mais juntos** e "Apagar a Nº X" lá em cima, do lado de "Enchendo": no tablet deitado cabe tudo sem rolar.
- **Monitorar**: a folha rola com o dedo para baixo e para o lado, em todas as folhas. O botão **Folha inteira / Letra maior** diminui a tabela para caber na tela.
- **Turno** do lado do nome da tela; o relógio fica só com a hora.
- **Sincronização a cada 5 segundos** em todos os aparelhos. A atualização acontece por trás: não mexe na rolagem das abas, do seletor nem da folha.
- **Animação**: trocar de tela anima a tela; trocar de dorna ou de hora anima só os quadros.
- **Tablet chefe corrigindo** o que um operador anotou: pede a senha do operador (sem senha cadastrada, a do encarregado). Fica registrado quem autorizou. Linha nova e campos do escritório não pedem.
- **Trocar o código de conexão** desconecta todos os outros aparelhos (aparelho perdido ou roubado): eles só voltam com o código novo.
- Dois aparelhos criando a mesma linha sem um saber do outro (o chefe corrigiu nos segundos antes de receber): os valores se juntam, nada se perde.
- **Código embaralhado no APK**: quem abrir o APK não lê o código do jeito que foi escrito (o mapa para entender erros fica só em `apk/saida/mapas`).

## Pastas, duas caldeiras, atualização sozinha e totais na API (versão 2.16)

A 2.16 mexe no APK (as centrais mudaram): instale por cima, primeiro no tablet chefe. Pedidos do Guilherme de 20/10/2026.

- **O aplicativo em pastas** (para achar as coisas no VS Code). Nenhuma linha de código mudou de lugar na ordem: só foi dividida.
  - `public/design/`: `cores.css` é a paleta (claro e escuro). Toda cor tem um nome ali; mudou o valor, muda em todas as telas. `tipografia.css` (a letra), `medidas.css`, `movimento.css` (`--ritmo: 1`; 2 deixa todas as animações duas vezes mais lentas), `telas/` (ajustes por tamanho de tela), `escala.js` e `texto-que-cabe.js`.
  - `public/setores/<setor>/`: `pranchetas.js` (as folhas do setor), `regras.js` (o que só aquele setor faz: as dornas da hidrólise e a sacarificação, o volume do vinho, os bags do ralo) e `estilo.css`. Mexer na hidrólise não mexe nos outros setores.
  - `public/paginas/` (telas de todo aparelho), `public/chefe/` (telas do tablet chefe e do escritório), `public/nucleo/` (memória, conexão, teclado, toques, início), `public/config/`, `public/bibliotecas/`.
  - `index.html` é a lista do que carrega, na ordem; `styles.css` é a lista dos estilos. Arquivo novo: uma linha em cada.
  - No APK as partes voltam a ser um `app.js` só e embaralhado (`apk/juntar-app.js`, chamado pelo `gerar-apk.ps1`).
- **Duas caldeiras**: o tablet da Caldeira mostra a Caldeira 1 e a Caldeira 2 (cada uma com a sua folha, relatório e gráficos). A folha `caldeira` continua com o mesmo id: o que já foi anotado é da Caldeira 1. A nova é `caldeira_2`.
- **Ralo, vários bags na mesma hora**: do lado de "Anote o peso do bag" ficam duas caixinhas, + e lixeira. O + guarda o peso digitado (ele sobe pequeno no quadro) e deixa o quadro vazio para o próximo bag; o quadro mostra a soma. As pesagens ficam em `pesagens` ("160+170+"); o total continua em `qtd`, então relatórios, API e totais não mudam (`setores/ralo/regras.js`).
- **Apagar pergunta antes**: a lixeira (a caixinha do ralo e a do teclado, só o desenho) pergunta "Apagar?"; com o quadro vazio no ralo, ela tira o último bag.
- **Totais do dia no painel**: o tablet chefe e o computador mostram os insumos e os quilos do ralo somados no dia e por turno (`blocoTotais` em `chefe/painel.js`).
- **Atualização sozinha**: a central põe a versão mais nova em toda resposta da sincronização (`atualizacao`), e a nuvem também (`telas`, para quem está sem central). O aparelho fica sabendo em segundos. A atualização rápida (só as telas) instala sozinha quando ninguém mexe no aparelho há um minuto; a do APK abre a janela (o Android pergunta). A central do computador baixa da nuvem as telas novas assim que fica sabendo.
- **Totais na API**: `GET /api/v1/totais?dia=AAAA-MM-DD` ou `?de=...&ate=...` (até 62 dias), por insumo, unidade, turno e, no ralo, por produto, e as dornas terminadas. O que mudou para o Evandro está em `Usina/API-mudancas-2.16.txt`. Teste: `testes/totais216.mjs`.
- **Aplicativo para Windows** (`windows/`, decisão de 21/10): é só o painel administrativo pela nuvem. A central continua no tablet chefe; o computador não liga central, não abre porta no firewall e não leva APK. Instala em Arquivos de Programas (fora dela o Electron não lê a pasta e a janela fica branca). Sem service worker (o Chromium do Electron derrubava a página ao gravar no cache). Gerar: `windows\gerar-windows.ps1`.
- **Entrar pela nuvem** (`paginas/entrar-pela-nuvem.js`, nuvem `POST /aparelho/entrar`): o PC e o celular fora da usina entram com a senha da pessoa. A central manda para a nuvem as pessoas e uma conferência leve da senha (PBKDF2, 1000 voltas; nunca a senha nem o resumo da central), gerada quando a pessoa entra, é cadastrada ou troca a senha no tablet chefe: **cada pessoa antiga entra uma vez no tablet chefe depois de atualizar**. Pela nuvem é só ver (painel, relatórios, gráficos, escritório); a nuvem recusa o que esse aparelho mandar. Sem internet, abre com o que já chegou. 5 senhas erradas: espera 1 min, depois 15. Testes: `testes/nuvem-entrar216.mjs`, `testes/painel-nuvem216.mjs` (com fotos).
- **Segurança da nuvem (2.16.1)**: quem entra pela nuvem recebe uma chave só de ver, presa à pessoa e à senha (`leitura|aparelho|pessoa|selo`), que nunca vale como a chave de um tablet. Só entra quem tem Relatórios ou Escritório; trocar a senha, desativar ou tirar essas funções corta a chave na hora e o aplicativo volta para a tela de entrar. Além do limite por IP e por aparelho, a nuvem inteira aceita no máximo 20 senhas erradas por hora. A nuvem guarda a conferência da senha selada com o segredo da central (`senha|verificador`): o banco sozinho não revela o PIN. Envio dos totais por turno: `http://` só na rede da usina; pela internet, `https://`.
- **Computador = painel administrativo** (`chefe/menu-pc.js` e `.css`): menu fixo à esquerda (seções e setores, só o que a pessoa pode), escala 0,9, números de painel.
- **Resumo do dia** nos Relatórios (ver, copiar e enviar), **gráficos da semana** (média de cada dia e total dos insumos), **Ler folha** pode ser desligado em Usina, **Brix alto a partir de 25** (também no BHX da Hidrólise), **totais numa unidade só** (`somarEm` em `config/forms.js`) e **envio dos totais ao fim de cada turno** para o sistema do Evandro (Usina > Totais ao fim do turno; Codex, `envio-turnos.js`).
- **Telas**: tela de Conectar sem o logo repetido (fica só na barra) e com a assinatura no pé; relatórios da mesma altura; botões e quadros vizinhos com a mesma letra (`igualarVizinhos` em `design/texto-que-cabe.js`).
- **Demonstração** já abre com 5 dias anotados (hoje e os 4 de antes), com relatórios.
- Pedidos ao Codex em `.handoff/2026-10-20-*.md`.

## Produção: permissões, escritório no tablet chefe e telas (versão 2.15)

A 2.15 mexe no APK (a central do tablet chefe mudou): instale por cima, primeiro no tablet chefe. Pedido do Guilherme no áudio de 18/10/2026.

- **Escritório dentro do tablet chefe**: os cálculos da produção, o rastreamento de lotes e a etiqueta viram um bloco do painel (`blocoEscritorio` no `app.js`), para quem tem a função Escritório. Não existe mais o aparelho "Escritório" na escolha da função: o que era Escritório vira tablet chefe ao abrir (a central pede para liberar na primeira senha). A central continua aceitando as rotas da 2.13.
- **Uma senha por turno**: quem entra no tablet chefe fica até o fim do turno (`cfg.pessoaTurno`); acabaram os 30 minutos parado (o operador do setor continua com os 30 minutos).
- **Cada um vê o que pode**: com alguém dentro, o que a pessoa (ou o nível, ou o limite do aparelho) não deixa fazer some da tela: atalhos do alto, Compartilhar, Escritório, QR code e Trocar código (só com Conexão). Sem ninguém dentro, os botões aparecem e pedem a senha (menos o QR). Sem Corrigir, o setor abre só para consultar (Monitorar, sem o botão de anotar).
- **Níveis configuráveis**: o dono escolhe o que o nível 1 e o 2 podem (Pessoas e permissões > Tablets chefe > O que cada nível pode fazer), guardado em `configSistema().niveisChefe`. Sem escolha: nível 1 = corrigir, relatórios e escritório; nível 2 = tudo menos conectar tablets e trocar o código. O limite do aparelho vale também para o administrador nos níveis 1 e 2.
- **Código protegido**: se um tablet chefe que não é nível 3 troca o código, os aparelhos nível 3 (o do dono) continuam conectados e recebem o aviso "O código de conexão foi trocado": Manter o novo ou Voltar ao anterior (`/api/codigo-trocado`). Enquanto o dono não decide, outra troca é recusada. Sem nenhum aparelho nível 3, a troca vale como antes.
- **Telas**: painel com Ir para e Aparelhos agora; gráficos do mesmo tamanho (sem anotação, a caixa fica igual com o aviso no meio) e 4 horas no eixo dos pequenos; o início do setor cresce com a altura do tablet; as configurações em colunas que se encaixam; o cabeçalho e os textos ajustáveis sem a folga de 1 px (com o zoom ela cortava a última letra). No computador (mouse) o zoom é 1 e a tela usa a largura toda (até 1880 px), com mais setores e até 6 gráficos.
- **Teste das telas**: 15 tamanhos (os 10 de antes, o Galaxy Tab S9+ deitado e em pé, a tela dividida em metade e em dois terços, e o monitor Full HD `pcGrande`). Demonstração com permissão limitada: `&funcoes=relatorios,escritorio`.
- **Centrais (Codex)**: gravação por arquivo temporário (não corrompe se faltar luz no meio), a lista de aparelhos usa a identidade cifrada, a configuração validada não volta pelo relógio. Teste: `testes/producao215.mjs`. Pedido e resposta em `.handoff/2026-10-18-producao-215-central.md`.
- **Arquivo ilegível**: a central guarda a versão anterior do config.json e do registros.json (`.bak`). Se ao ligar um deles não abre (falta de luz no meio da gravação), ela usa a `.bak`; sem `.bak` boa, guarda o ilegível como `*.ilegivel-<data>` (nunca apaga) e só então recomeça. Fica anotado no registro do sistema.
- **Cada aparelho no seu setor**: a central guarda o setor de cada tablet de setor (o primeiro que ele declarou) e recusa folha de outro setor. Trocar o setor nos ajustes pede a senha de quem tem Ajustes ou Usina; o que ficou na fila antes da troca ainda entra.
- **/relatorios com senha**: a página dos Excel no navegador do computador não é mais aberta a todos no Wi-Fi. Abra o endereço da central no navegador, conecte como tablet chefe (nível 1 basta), entre com a senha de quem tem Relatórios e depois abra `/relatorios` (vale 30 minutos).
- **Envio automático**: o relatório das 07:05 e os totais do Base44 saem sozinhos do tablet chefe quando o nível e o limite dele deixam (às 07:05 o turno virou e ninguém está dentro); se falhar, o aplicativo tenta de novo a cada minuto até as 07:59. Pedidos em `.handoff/2026-10-19-*.md`.

## Sem a central, os aparelhos se falam pela nuvem (versão 2.14)

A 2.14 mexe no APK (a central do tablet chefe mudou): instale por cima, primeiro no tablet chefe. Na nuvem, rode o `nuvem/publicar.ps1`: ele cria a tabela `pendentes` antes de subir o Worker.

- **Com a central desligada ou em outra rede** (a outra Starlink, 4G): depois de 2 minutos sem achar a central, o aparelho troca as anotações direto com a nuvem (`POST /aparelho/sync`). Manda o que fez e recebe o que os outros fizeram, então um vê o que o outro anotou mesmo sem a central.
- **Cada hora de cada folha (ou cada dorna) é uma anotação separada.** O tablet que anotou das 7h às 8h e o celular que anotou o resto do dia se juntam sem um apagar o outro. Na mesma anotação, vale a mais nova, como na central; a que espera alguém entrar não é trocada.
- **Quando a central volta**, ela puxa tudo da nuvem e passa pelas regras de sempre (quem pode anotar o quê, aparelho bloqueado). O que não podia, ela desfaz: publica a versão dela (ou apaga) e a correção chega nos aparelhos. Pessoas, senhas e configurações só mudam pela central.
- Na nuvem: as anotações dos aparelhos ficam na tabela `pendentes` (a `fila` antiga fica vazia); a nuvem devolve até 500 por vez. Aplicativos 2.13 continuam usando `/fila`. A API do escritório só mostra o que a central publicou.
- Divisão com o Codex (15/10/2026): nuvem e as duas centrais com ele; o aplicativo e o teste de ponta a ponta comigo. Pedido e resposta em `.handoff/2026-10-15-nuvem-ponto-de-encontro.md`.

## Escritório, lembrete, envio por período e fila da nuvem (versão 2.13)

A 2.13 mexe no APK (botão voltar e a central do tablet chefe): instale por cima, primeiro no tablet chefe.

- **Escritório**: um aparelho à parte (na primeira tela, toque em Escritório). Entra quem tem a função Escritório, com a senha conferida na central; depois de 10 minutos sem mexer pede de novo. A função é nova: o administrador e o dono já têm; para o encarregado, ligue em Pessoas e permissões.
  - **Cálculos da produção**: matéria-prima do dia (soma do Ralo), hidrolisado = matéria-prima ÷ 0,29, vinho = hidrolisado × Brix inicial ÷ Brix final (conta do Lucas), álcool (soma da Produção das duas destilarias), volume destilado (digitado) e vinhaça = volume destilado − álcool. Cada número mostra de onde veio; o que for digitado vale por cima.
  - **Rastreamento de lotes** (POP 03 - FOR 011): a folha inteira para conferir e salvar, com parâmetros, tanques (folgas do Volume de vinho), insumos com lote, validade, NF e fornecedor das folhas de insumo, matéria-prima, lenha e operadores. Imprime, PDF, Excel e XML iguais ao papel (`public/modelos.js`). Fica guardada como a folha `rastreamento`, uma por dia.
  - **Lote**: UB + ano + letra do mês + dia + 0700 (08/10/2026 = UB26I080700). Letras: fevereiro A, março B... outubro I, novembro J, dezembro K, janeiro L (`forms.js`, `rastreamento.letrasDosMeses`). O dia de produção vai das 07:00 às 07:00; o lote leva a data do fechamento. Validade do álcool: 36 meses; da vinhaça: 5 dias.
  - **Etiqueta das bombonas**: igual ao adesivo de 01/10/2026 (ONU 1170, classe 3, lote, fabricação, validade). Peso líquido = volume × 0,809 kg/L e bruto + 2,25 kg da bombona (50 L = 40,45 e 42,70 kg). Duas por folha A4. Os textos ficam em `forms.js`, `rastreamento.etiqueta`.
  - As contas ficam em `public/rastreamento.js` (o mesmo arquivo nos testes).
- **Lembrete de anotar a cada hora**: liga por setor em Configurações da usina (setores com folha hora a hora). Na virada da hora, faixa no alto e apito tranquilo; passou das :30 sem a linha daquela hora, apito chato até anotar. Tocar em Anotar agora cala o apito e fecha a faixa até a hora seguinte. Cada setor tem o horário do lembrete (botão "Toca das ... às ..." do lado do liga e desliga; os dois iguais é o dia todo, e 19h às 07h passa pela noite): fora dele não toca, porque o celular da firma vai para casa com a pessoa. Fica em `configSistema().lembretes[setor] = { de, ate }` (o `true` antigo vale o dia todo).
- **Enviar e imprimir**: a janela sobe de baixo (puxa para baixo para fechar, ou tela inteira). Escolha as áreas, os turnos e um dia ou um período. O Resumo soma os insumos do período; o Excel de um período tem uma aba por folha de cada dia e, com "Somar", a aba Totais do período. O relatório só é guardado na central quando é o dia inteiro, com todos os setores e turnos.
- **Monitorar**: setas para os dias anteriores. No tablet do setor, dia anterior é só para consultar.
- **Longe da central** (outra rede, 4G): depois de 2 minutos sem achar a central, o aparelho manda o que falta para a fila da nuvem (`/fila`, com uma chave do aparelho que a central dá). A central puxa a fila a cada minuto e passa cada anotação pelas mesmas regras da sincronização (a mais nova vale, bloqueado não entra). A fila não aparece na API do Evandro.
- **Telas**: o botão voltar do Android volta dentro do aplicativo e não fecha mais; os quadros crescem até ocupar a tela (no Ralo, os dois quadros ficam grandes) e o painel do teclado não rola mais (some a dica se não couber).
- Divisão com o Codex (12/10/2026): contas e folha de papel do rastreamento, centrais (função Escritório e fila) e nuvem foram dele; telas, envio, lembrete e o resto do aplicativo, meus. Testes: `testes/rastreamento213.mjs`, `testes/escritorio213.mjs`, `testes/envio213.mjs`, `testes/nuvem.mjs`.
- Projeto do totem para o Galaxy Tab A11+ (moldura, janela, camadas e peças): `documentos/totem-tab-a11.html`.

## Níveis do tablet chefe e configurações do sistema (versão 2.12)

A 2.12 mexe no APK (a central do tablet chefe mudou): instale por cima da 2.11, sem desinstalar, primeiro no tablet chefe. Depois atualize os outros tablets: até atualizar, eles continuam anotando, e de uma mudança de configuração feita num tablet velho a central aceita só o que ele podia mudar (o resto volta para ele como está na central).

- **Níveis do tablet chefe** (guardados só na central, em `config.json`, `aparelhosChefe`):
  - Nível 1: vê, corrige e envia (as funções Corrigir e Relatórios). Corrigir inclui pôr a linha que faltou numa folha de setor; Vinho e Fermentação, avisos, Usina e pessoas não.
  - Nível 2: tudo, e libera outros tablets chefe (função nova "Liberar tablets chefe e escolher o nível").
  - Nível 3: tudo, mais as configurações do sistema. Só o dono do sistema: o administrador mais antigo quando a 2.12 entrou (`donoId`). O dono continua administrador e ativo, ninguém tira.
  - O que uma pessoa faz num tablet é o que ela pode e o que o nível do tablet deixa, ao mesmo tempo (mais o limite do tablet, que não vale para o administrador).
- **Tablets chefe que já existiam viram nível 2 sozinhos.** Para usar as configurações do sistema, o dono põe o próprio tablet no nível 3: Pessoas e permissões > Tablets chefe > este aparelho > Nível 3, e entra de novo com a senha dele.
- **Tablet chefe novo**: ao escolher "Tablet chefe", o aplicativo pede o nível e a senha de quem libera (nível 2 ou 3). O nível 3 só sai com a senha do dono. Mudar o nível de um tablet derruba quem estava nele, e tudo vai para o registro do sistema.
- **Dono sem a senha ou sem o tablet**: na tela de liberar, "Sou o dono e perdi a senha ou o tablet" pede a senha do programador; o aparelho vira o tablet do dono (nível 3) e dá para escolher uma senha nova. A senha do programador agora é conferida com PBKDF2 (600 mil voltas, com sal), no máximo 5 tentativas por minuto em cada aparelho.
- **Configurações do sistema** (em Folhas e avisos, só no nível 3):
  - a vírgula de cada quadro (sem vírgula, 1 ou 2 casas). Valor antigo com mais casas continua aparecendo como foi anotado;
  - esconder um quadro do operador (o tablet chefe continua vendo e corrigindo);
  - nos insumos, campos do escritório que o operador também preenche (o Nº NF, por exemplo);
  - campos novos em cada folha (número, texto, opções, hora ou marcar OK), com unidade e vírgula. Campo novo não entra no desenho do papel (Excel, PDF e impressão): aparece no aplicativo, no Monitorar, no XML (`camposNovos`) e na API (`"novo": true`). Campo tirado da folha fica arquivado e as anotações antigas continuam.
- **Unidades**: escolhidas numa lista (°C, °F, g, kg, t, mL, L, m³...) ou escritas. Trocar a unidade só troca o nome, nada é convertido. A troca vale a partir do dia em que foi feita: os dias antes continuam com a unidade antiga (`historico`), no aplicativo, no papel e na API.
- **A central confere tudo**: cada rota e cada coisa que chega pela sincronização passa pelo que a pessoa e o tablet podem. A configuração tem número de revisão (`rev`): se dois tablets mudaram ao mesmo tempo, a segunda mudança é recusada, o tablet recebe a configuração de agora e avisa. As duas centrais (computador e tablet chefe) fazem igual.
- Anotação feita num tablet chefe precisa de alguém dentro e da função que a tela pede (Corrigir ou Ler folha nas folhas dos setores, Anotar no Vinho e Fermentação, Avisos nos avisos). Se a central recusar, a anotação não se perde: fica guardada no aparelho e sobe quando entrar alguém que pode.
- Revisado pelo Codex em 06/10/2026: na primeira rodada ele achou 11 pontos (configuração disfarçada de anotação, permissões vindas das folhas, função de quem anota, senha do dono no setor, apagar a configuração, dia arquivado, Base44 e relatório só do tablet chefe, tablet ainda na 2.11, campo arquivado, unidade nova e campo do escritório liberado ao operador). Tudo corrigido; na segunda rodada sobraram dois, também corrigidos (testes em `testes/niveis212.mjs`, `testes/pedidos212.mjs` e `testes/papel212.mjs`).
- A folha em vigor (o `forms.js` com as mudanças do tablet chefe) é montada por `public/folhas.js`, o mesmo arquivo no aplicativo e na API do computador. A central do tablet chefe recebe a folha em vigor do tablet chefe liberado e manda para a nuvem.

## Aparelhos, bloqueio e vírgula na caldeira e na destilaria (versão 2.11)

A 2.11 mexe no APK (o código nativo mudou): instale primeiro no tablet chefe e confira se ele abre, depois os outros.

- **Aparelhos** (painel do tablet chefe, toque em "aparelhos ligados"): em cima quem está usando, embaixo o nome do aparelho no Android e o modelo; no + o endereço na rede, a versão e quando conectou. O MAC não aparece: o Android 10 em diante não deixa o aplicativo ler.
- **Bloquear aparelho** (só o administrador): na hora escolhe se pede uma senha para liberar (4 a 8 números) ou se trava de vez, e se apaga as anotações guardadas nele. A central responde 423 a tudo que vem do aparelho bloqueado. Longe da usina, com internet, o aplicativo pergunta à nuvem (`GET /aparelho/<id>`, no máximo a cada 10 minutos). Tudo vai para o registro do sistema.
  - A senha de desbloqueio (sal e resumo) só vai da central para o aparelho, pelo canal cifrado; para a nuvem sobe só se está bloqueado, desde quando, o modo e o "apagar". Se o bloqueio chegou só pela nuvem, a senha é conferida pela central, no Wi-Fi da usina.
  - Cada bloqueio tem um número de revisão (`rev`): a central guarda um contador (`bloqueiosRev`) que sobe a cada bloquear, desbloquear ou liberar, e nunca volta (não depende do relógio). A lista vai para a nuvem junto com a revisão tirada no mesmo instante, e a nuvem devolve como `revisao`: o aparelho só destrava pela nuvem se a lista for mais nova que o bloqueio dele (nuvem atrasada não destrava).
  - A liberação com a senha vale só para aquele bloqueio (o `rev` dele) e daquela central (a `geracao`): se o administrador bloqueou de novo, mesmo com a mesma senha, a central responde 423 com o bloqueio novo.
  - A revisão é um contador de cada central e recomeça numa central nova. Por isso tudo que fala de bloqueio leva a geração da central: o 423 e o 403, a sincronização (que também diz `bloqueiosRev`, "livre até esta revisão") e a rota da nuvem (`geracao`, gravada junto com a lista). O aparelho guarda `blqGeracao` e `revLiberada` (até onde está livre naquela central) e ignora resposta de outra central, bloqueio já coberto por uma liberação e bloqueio mais velho que o dele, venha da central ou da nuvem (`aplicarBloqueio`). A sincronização confere o bloqueio de novo na hora de responder.
  - Mais de 500 aparelhos bloqueados: a lista não vai para a nuvem (a central mostra o erro), e as anotações continuam subindo.
  - Revisado pelo Codex em 06/10/2026, em sete rodadas até ele aprovar (testes em `testes/seguranca.mjs`, `testes/pedidos211.mjs`, com uma nuvem de mentira, e `testes/nuvem.mjs`). Riscos aceitos: a rota pública da nuvem pode gastar a cota de pedidos (a usina não depende dela; volta às 21h) e quem tem o aparelho na mão e consegue ler o armazenamento dele poderia testar senhas de desbloqueio (liberar a tela não libera a central, que continua respondendo 423).
- **Assinatura do APK**: o aplicativo confere a própria assinatura (`Protecao.java`) e uma cópia alterada não abre. O `gerar-apk.ps1` grava a assinatura esperada (da chave deste computador) em `Assinatura.java` e confere o APK no fim. APK assinado com outra chave não abre: guarde o `%USERPROFILE%\.android\debug.keystore`. Isso atrapalha quem altera o APK, mas quem sabe mexer no código consegue tirar a conferência: o que protege os dados é a central (código de conexão e bloqueio). Valor esperado vazio não abre; erro do Android ao ler a assinatura abre, para não travar o tablet da usina.
- **Vírgula** na Temperatura da água (Caldeira) e na Produção Álcool e no Carregamento (Destilaria): uma casa decimal, como o Pé da coluna A. Na API eles passam a vir com `"casasDecimais": 1`.
- A nuvem não guarda mais a senha do administrador (`pinAdmin`) que ia junto com as folhas.
- A licença da Ubirálcool (trava do sistema por contrato) ficou de fora, por decisão de 02/10/2026.

## PDF, gráficos e Folhas e avisos (versão 2.10)

A 2.10 só mexeu nas telas: quem já tem a 2.10 instalada recebe as próximas pela atualização rápida.

- **Exportar em PDF**: na janela de enviar ou guardar a folha do dia apareceu o PDF, ao lado do Excel e do XML. Vale a mesma escolha de setores, e cada folha de papel vira uma página do arquivo (em pé ou deitada, como no papel, com o logo). O PDF é montado dentro do aparelho, sem internet e sem biblioteca de fora (`public/pdf.js`). A letra é a do aplicativo, em `public/fonts/atkinson-pdf-400.ttf` e `-700.ttf` (só as letras do português, licença OFL), e vai dentro do arquivo. Ele não é guardado na central: lá ficam só o Excel e o XML.
- **Gráficos do dia**: no painel do tablet chefe, embaixo dos setores, aparecem os quatro primeiros gráficos que têm anotação no dia; "Ver todos" abre a tela com todos e o filtro por setor. Folha hora a hora: o ponto fica na hora da linha. Dornas: na hora em que começou o envio (ou no horário da dorna). As linhas tracejadas são os avisos do quadro (pH 5, Brix 25). Quais gráficos existem fica em `forms.js` (`graficos`). Quem tem a função Relatórios vê.
- **Folhas e avisos** (função nova "Mudar as folhas", só o administrador ou quem ganhar): nome do quadro, nome curto, unidade, dica, faixa esperada e os avisos de cada quadro; nos insumos, as unidades. Fica na configuração da usina (`folhas`) e chega em todos os tablets pela sincronização. O `forms.js` continua sendo o original: "Voltar ao original" apaga só a mudança. O desenho das folhas de papel não muda. Toda mudança vai para o registro, com o antes e o depois.
- Tablet do setor com uma anotação pela metade só pega o aviso novo depois de salvar (a tela não se redesenha no meio da anotação).

## Pessoas, permissões e registro (versão 2.9)

No tablet chefe cada pessoa entra com a sua senha, e a senha já diz quem é. O nome fica no alto da tela; tocando nele dá para sair, abrir Pessoas e permissões ou o Registro do sistema. Depois de 30 minutos sem mexer (`minutosSemMexer`) precisa entrar de novo.

- **Níveis prontos**: Administrador (pode tudo, inclusive pessoas), Encarregado (anotar e corrigir, avisos, relatórios, ler folha, Usina, conexão e ajustes) e Consulta (só relatórios). Em cada pessoa dá para ligar ou desligar uma função a mais ou a menos. A lista fica em `forms.js` (`funcoes` e `niveis`).
- **Cada tablet chefe** pode ganhar um nome e um limite do que se faz nele, seja quem for. O administrador pode tudo em qualquer um.
- **Senhas**: a central guarda só o resumo de cada senha (com sal), em `ServidorUsina/config.json`. Duas pessoas não podem ter a mesma senha, e não dá para desativar o último administrador. Cinco senhas erradas em um minuto fazem esperar um minuto.
- **Tablets dos setores**: os ajustes abrem com a senha de quem tem a permissão de ajustes (a central confere). Sem central, vale a `pinAdmin`.
- **Corrigir o que um operador anotou**: operador com senha continua digitando a dele; operador sem senha não pede nada se quem entrou pode corrigir (fica no registro quem foi).
- **Registro do sistema**: uma lista por dia (das 07:00 às 06:59), com filtro. O aplicativo escreve quem anotou ou mudou o quê, com o antes e o depois de cada quadro; a central escreve quem entrou e saiu, senha errada, aparelho novo, sem sinal, que voltou ou que atualizou, código trocado, dados apagados e mudanças em pessoas e na Usina. As linhas ficam na central, como anotações da folha `registro`: não vão para os tablets dos setores, nem para a API e a nuvem.
- O aparelho manda o próprio nome junto com a sincronização ("Tablet da Hidrólise"), e é esse nome que aparece no registro e na lista de aparelhos.
- Se o tablet chefe está com uma linha aberta, sem mexer, e chega a anotação daquela linha vinda do setor, a tela passa a mostrar o que foi anotado (antes ficava a linha vazia e, se salvasse, apagava o que o operador tinha posto).

## Nuvem das Pranchetas (versão 2.8)

A central (o computador ou o tablet chefe) manda uma cópia das anotações para a internet, de minuto em minuto. Fica no Cloudflare, no plano grátis, sem cartão. De lá saem a API de leitura do escritório (a mesma da central, com os mesmos nomes) e as atualizações do aplicativo. Sem internet a usina continua igual: quando a internet volta, a central manda o que faltou.

- O código fica em `nuvem/` (`src/index.js`, banco D1 em `schema.sql`). A API usa o mesmo `api-leitura.js` da central, por isso ele não usa mais `fs` nem `vm`.
- Para pôr no ar: `nuvem/publicar.ps1` (o passo a passo está em `nuvem/LEIA-ME.txt` e, com onde clicar no site do Cloudflare, em `Nuvem-passo-a-passo.pdf` na pasta `Usina`). A conta já tem o endereço `guiizao.workers.dev`, então a nuvem fica em `https://pranchetas-nuvem.guiizao.workers.dev`. O banco "pranchetas" já foi criado na conta. No fim aparece o endereço e as duas senhas ficam em `nuvem/segredos.txt` (não vai para o Git).
- No tablet chefe: Usina > Nuvem (internet) > endereço e senha da central. A situação mostra o último envio, o que falta e o erro, se houver.
- A configuração da usina (senhas, contatos) e os avisos internos não sobem.
- O servidor do tablet chefe não lê o `forms.js`: o aplicativo manda as folhas para ele ao abrir, e ele leva para a nuvem.
- Cada envio grava tudo numa consulta só (o plano grátis deixa 50 consultas por pedido e 10 ms de processamento): lotes de 150 anotações.

## Atualização rápida (versão 2.8)

Quase todo o aplicativo é a pasta `public`. Quando só ela muda, os tablets não precisam instalar APK:

- O `gerar-apk.ps1` monta o pacote das telas (`apk/saida/telas`): os arquivos, o `pacote.json` (versão, apkMinimo e o SHA-256 de cada arquivo) e a assinatura (`pacote.sig`).
- A assinatura usa uma chave que fica só neste computador, em `.pranchetas\chave-telas.pem` na pasta do usuário. A chave pública vai dentro do APK (`public/chave-telas.txt`). Guarde uma cópia da pasta `.pranchetas`, como a do `.android`: sem ela, a próxima atualização rápida não é aceita e os tablets precisam do APK.
- O aplicativo acha a versão nova, abre a janela com as novidades e, em Atualizar agora, o `AtualizadorDeTelas.java` baixa só o que mudou, confere a assinatura e cada arquivo, e o Capacitor passa a abrir as telas novas. A barra mostra o andamento. Se a versão nova não abrir duas vezes, o aplicativo volta sozinho para a de antes.
- `apkMinimo`: a versão em que a parte em Java mudou pela última vez (`apk/nativo-versao.json`, calculado sozinho). Tablet com APK mais velho recebe o APK.
- Quem entrega: o computador (`/telas/`, de `apk/saida/telas`), o tablet chefe (as telas que ele usa) e a nuvem (o `publicar.ps1` leva junto).

## Vinho e Fermentação só no tablet chefe (versão 2.8)

O Volume de vinho e as Dornas de fermentação (o que o Lucas pediu) saíram da Destilaria e foram para a área "Vinho e Fermentação", que só o tablet chefe vê e anota (`soChefe` no `forms.js`). A Destilaria ficou com a planilha do Mateus. Nas anotações dessas folhas vai o nome do tablet chefe. Cada quadro do vinho mostra o número da dorna ("Folga Nº 7"); se nem com a letra mínima couber, fica "Folga 7".

## Atualização pelo próprio aplicativo (versão 2.7)

A 2.7 é a última versão instalada à mão. Daqui para frente o aplicativo se atualiza sozinho:

- Cada tablet pergunta para a central, logo depois de abrir e a cada 30 minutos, qual versão ela tem (`/api/versao`). Se for mais nova, aparece o botão amarelo **Atualizar** no alto da tela. Também dá para procurar na hora em Ajustes > Aplicativo > Procurar atualização.
- Tocando em Atualizar, aparece o que mudou. Tocando de novo, o APK desce pelo Wi-Fi, o aplicativo confere o tamanho e o SHA-256 e abre a janela do Android, que pergunta se pode atualizar. As anotações do tablet continuam.
- Na primeira vez, o Android pede para liberar "Permitir desta fonte" para as Pranchetas. É só ligar, voltar e tocar em Atualizar de novo.
- Depois de atualizar, a janela com as novidades aparece uma vez. Em Ajustes > Aplicativo tem "Novidades desta versão" para ver de novo. As novidades ficam em `public/novidades.js` e a primeira da lista tem de ser a versão do `app.js` (o teste confere).
- **Tablet chefe como central:** ele entrega para os outros o próprio aplicativo instalado nele. Então basta instalar a versão nova à mão só no tablet chefe, e os outros tablets atualizam pelo botão.
- **Computador como central:** ele entrega o que estiver em `apk/saida` (o `pranchetas.apk` com o `versao.json` do lado, os dois feitos pelo `gerar-apk.ps1`). Se o APK for trocado sem o versao.json, a central não oferece nada, para não mandar arquivo errado.
- **Nuvem (quando tiver):** em `forms.js`, `atualizacaoOnline` é o endereço da pasta na internet com o `versao.json` e o `pranchetas.apk`. A central do computador olha lá a cada 6 horas, baixa, confere e passa a entregar pelo Wi-Fi. O tablet chefe também olha lá direto. Hoje está vazio.
- O número de versão do APK sai do `VERSAO` do app.js (2.7.0 vira 20700). O Android só atualiza por cima se o número for maior e se o APK foi assinado no mesmo computador (a chave de assinatura fica em `.android` na pasta do usuário deste computador: não pode perder).

## Respostas do Lucas (versão 2.7)

- Dornas de fermentação: 7 a 12 (2,7 m de altura, 2,835 m² de base). O caderno de encher, Brix inicial e volante fica nelas.
- Dornas de descanso: 1, 2 e 4 a 11 (6 m, 4,908 m²).
- Tanques de álcool em m³, como na planilha: (altura − folga) × base, sem o × 1000. O total dos tanques também sai em m³.
- As medidas trocadas pelo escritório na 2.6 eram dos grupos antigos. Por isso a lista de medidas tem um número de versão (`versao` em `medicaoPadrao`): medida guardada de outra versão é deixada de lado e valem as da planilha.
- Ainda falta perguntar: quais são as outras dornas "da família" e a medida do Tanque Destilaria.

## Quadros das folhas (versão 2.7)

Os quadros de cada folha ficam do mesmo tamanho e alinhados, e dividem a largura toda: 2 campos ficam meio a meio, 4 ficam em quartos. A altura se ajusta para caber tudo sem esconder nada atrás da barra de Salvar. Se não couber nem assim, a tela rola. Quem faz a conta é `arrumarQuadros()` no app.js, toda vez que a tela muda de tamanho. O botão Apagar tem a mesma altura do aviso de envio.

## API só de leitura para o sistema do escritório (versão 2.7)

A central do computador tem uma API em JSON para o sistema novo do escritório (Evandro, E.C. Tec). Só lê, não muda nada.

- `GET /api/v1/esquema`: as folhas, os campos e as unidades.
- `GET /api/v1/dias`: os dias que têm anotação.
- `GET /api/v1/dias/AAAA-MM-DD`: o dia inteiro, folha por folha, igual ao XML.
- `GET /api/v1/registros?desde=0&limite=500`: as anotações, em ordem, para ir buscando só o que mudou.
- Precisa do cabeçalho `Authorization: Bearer <senha de leitura>`. A senha é criada sozinha em `ServidorUsina/config.json` (`tokenLeitura`) ou vem de `TOKEN_LEITURA`.
- Os exemplos que foram para o Evandro estão em `Usina/API-exemplos.zip`. O código fica em `api-leitura.js`.

## Volume de vinho e dornas de fermentação (versão 2.6)

Pedido do escritório (Lucas, 26/09/2026), a partir da planilha `CONTROLE LTS`. Fica na **Destilaria e Fermentação**: são os destiladores que medem as dornas e cuidam da fermentação (quando os logins forem separados, só eles terão essas folhas). A Nova Destilaria não mudou.

**Volume de vinho** (medição da manhã, com a trena):
- Grupos como na planilha: Hidrólise (1 a 5), Sacarificação (1 a 6), Fermentação (7 a 12), Dornas de descanso (1, 2 e 4 a 11), Tanques de álcool (em m³) e Brix da produção (ralo, hidrólise e fermentação, com horário). Os grupos de fermentação e descanso mudaram na 2.7, com as respostas do Lucas.
- O destilador digita a **folga** de cada dorna e o volume aparece na hora, do lado: **volume (L) = (altura − folga) × área da base × 1000**. Folga maior que a altura avisa do lado do número. Nas dornas de fermentação e descanso também vão o Brix e "Fermentando: Sim/Não" (quem marca é o destilador; o sistema não decide sozinho).
- No alto: subtotal do grupo e o **total de vinho da produção** (Hidrólise + Sacarificação + Fermentação + Descanso, como na planilha). Os tanques de álcool têm o total deles, em m³.
- O volume é guardado junto com a medição: se a medida da dorna mudar depois, o que já foi medido continua igual.
- **Medidas das dornas**: tablet chefe > Usina > Medidas das dornas > Trocar (altura e área da base de cada dorna). Começam com os números da planilha; o Tanque Destilaria está sem medida (a planilha não tem). "Voltar para as medidas da planilha" desfaz.
- Excel e impressão no desenho da planilha CONTROLE LTS (folha "Destilaria - Volume de vinho").

**Dornas de fermentação** (o caderno dos destiladores), dornas 7 a 12 (na 2.6 eram 1, 2 e 4 a 11):
- Cada dorna: **Começar a encher** (hora e quem encheu) → **Terminou de encher** (hora; o teclado já abre no Brix inicial) → fermentando → **Mandar para a volante** (hora e quem mandou) → **Parou de mandar** (pergunta se esvaziou: sim, fica vazia; não, fica "com vinho" e pode mandar de novo).
- O cartão da dorna mostra: enchida em tal dia, por quem, das tantas às tantas, Brix inicial; e a última medição da manhã (Brix, volume, fermentando). O Brix e o volume vêm da folha Volume de vinho: ninguém anota duas vezes.
- No alto aparece quem está na volante. Mandar uma dorna com outra já na volante pede confirmação.
- Cada enchimento é uma anotação no dia em que começou a encher. O último enchimento de cada dorna fica sempre nos tablets e a central manda sempre (uma dorna pode passar vários dias fermentando; o tablet do setor guarda só 3 dias).
- Excel e impressão: folha "Dornas de fermentação", com o enchimento, a medição e a volante do dia.

## Wi-Fi embaralhado (versão 2.5)

Tudo que passa entre os aparelhos e a central vai embaralhado (`public/cifra.js`, igual no `server.js` e no `ServidorCentral.java`). Quem espiar o Wi-Fi não lê anotação, nome de operador, código nem chave.

- **Conectar:** o código de 6 números não passa aberto. O aparelho e a central combinam um segredo (X25519) que quem só escuta o Wi-Fi não consegue calcular, e o aparelho manda só uma prova do código. A central devolve a chave deste aparelho, embaralhada. Quem chuta códigos é bloqueado (6 por minuto por aparelho, 30 no total).
- **Depois:** cada aparelho tem a sua chave (sai da chave da rede) e cada pedido vai embaralhado com ela (AES-256-GCM). Pacote alterado no caminho, pedido gravado e mandado de novo e resposta trocada são recusados.
- **Relógio:** a central só aceita pedido dos últimos 5 minutos. Se o relógio do aparelho estiver errado, a central manda a hora certa e o aparelho acerta sozinho (continua o aviso de acertar a hora do Android).
- **Aplicativo instalado:** usa a criptografia do próprio Android. **Navegador do computador** aberto por `http://endereço`: usa a versão escrita em `cifra.js` (mesmo resultado, conferido nos testes contra a do Node).
- Só o "ping" (a central está aí?), a página `/baixar` e o download do APK continuam abertos. A página `/relatorios` também continua aberta na rede da usina (o escritório baixa os arquivos pelo navegador).

**Atualizando da 2.4:** atualize primeiro o servidor (o tablet chefe, ou o `server.js` do computador) e depois os outros aparelhos (pela página `/baixar`). Aparelho ainda na 2.4 não recebe nada da central nova, mas não perde o que anotou: guarda e manda quando for atualizado, sem pedir o código de novo. Depois que todos estiverem na 2.5, toque **uma vez** em **Trocar código** no tablet chefe: a chave da 2.4 passava aberta no Wi-Fi e assim ela deixa de valer (todos pedem o código novo uma vez).

## Totais do dia no Base44 (versão 2.5)

O Lucas lança os totais do dia num sistema feito no Base44. Agora os totais de cada insumo vão sozinhos:

1. Quem montou o sistema no Base44 cria a tabela e a função que estão em `integracoes/base44` (`entities/total-insumo-dia.jsonc` e `functions/receberTotaisPranchetas/entry.ts`) e cadastra o segredo `PRANCHETAS_SEGREDO` nos segredos do app.
2. No tablet chefe: **Usina** (senha do encarregado) > **Totais do dia no Base44**: cadastre o endereço da função e o segredo. Com o segredo em branco, o aplicativo cria um e mostra para passar a quem montou o Base44.
3. Quando o dia fecha (07:00), o tablet chefe soma cada insumo e a central manda pela internet, com o segredo. Se alguém corrigir a folha depois, os totais mudam e vão de novo (a função atualiza o dia, não duplica). Os dias de antes de ligar não vão sozinhos (o escritório já lançou à mão); dá para mandar um por um na mesma tela.
4. A mesma tela mostra os últimos 7 dias: enviado (e quando), ou o erro (sem internet, segredo recusado). Com erro, tenta de novo a cada 10 minutos e avisa o tablet chefe uma vez.

O endereço e o segredo ficam só no servidor (`ServidorUsina/config.json`), não vão para os tablets. **Precisa de internet no servidor da usina** (no tablet chefe, se ele for o servidor; ou no computador).

## Troca de turno e virada das 07:00 no meio da anotação (versão 2.3)

Se o turno trocar (07:00, 16:00, 00:00) com a pessoa no meio de uma anotação, o que ela digitou é salvo no nome dela e no dia da folha que estava aberta. Depois o aplicativo pede o nome de quem entrou. Antes, o que estava digitado podia se perder, ou ir para a folha do dia seguinte.

## Rede local no Android 16 e 17

Alguns Android (como o Motorola) bloqueiam a rede local até a pessoa permitir **Dispositivos por perto** (Android 16) ou **Rede local** (Android 17). Sem isso, o tablet não acha o tablet chefe e o tablet chefe não recebe ninguém, mesmo no mesmo Wi-Fi. O aplicativo pede a permissão ao procurar a central, ao conectar e ao ligar como tablet chefe. Se ela estiver bloqueada, aparece um aviso com o botão **Abrir ajustes**.

## Avisos do escritório

No painel do tablet chefe: **Avisos**. Escolha o setor e a pessoa (ou "Quem estiver no setor"), escreva e toque em **Enviar aviso**.

- Se a pessoa está trabalhando, o aviso aparece grande na tela dela em poucos segundos, com o fundo escuro, vibração e dois bipes.
- Se não está, o aviso fica guardado e aparece quando ela entrar com o nome dela.
- O aviso só sai da tela no botão **OK, entendi** (toque fora e o Voltar do Android não fecham).
- Na lista de avisos, o escritório vê a situação de cada um: esperando, na tela de fulano desde tal hora, lido por fulano às tantas, ou cancelado. Aviso que ainda não foi lido pode ser cancelado.
- Por dentro, o aviso viaja como uma anotação (folha `avisos`), e a leitura é outra anotação (`avisos-recibo`) escrita só pelo aparelho que leu. Por isso funciona com o computador ou com o tablet chefe como central, e quem estava sem Wi-Fi recebe quando a rede volta.

## Versão, relógio e erros dos aparelhos

- A versão aparece nos ajustes do aparelho (engrenagem) e em Usina > **Aparelhos conectados**, junto com quem está em cada aparelho. Aparelho com versão antiga aparece com "(atualizar)".
- Se o relógio de um aparelho estiver 5 minutos ou mais diferente da central, ele avisa para acertar a hora (a folha do dia e o turno dependem da hora certa).
- Erros inesperados de qualquer aparelho vão para a central, no arquivo `ServidorUsina/erros.log`, e aparecem em Usina > **Ver erros dos aparelhos**.

## Testes automáticos

Na pasta `app`:

```bash
node testes/rodar-tudo.mjs
```

Leva uns 20 minutos e grava o resultado em `testes/saida/resultado.txt`. Testa:

1. o código (sem erro de escrita) e a configuração das folhas (`forms.js`);
2. a central pela rede, **nas duas centrais**: a do computador (`server.js`) e a do tablet chefe (`ServidorCentral.java`, que roda no computador com peças do Android simuladas em `testes/java`);
3. aparelhos virtuais usando o aplicativo como uma pessoa (escritório, tablet da Hidrólise e celular da Caldeira), nas duas centrais: anotações, avisos, sem Wi-Fi, senhas, relatório, virada do dia, relógio errado e travas;
4. o dia da Hidrólise (enchendo, enviando, anotada; Sacarificação e insumos acompanhando), nas duas centrais;
5. longo prazo, nas duas centrais: 90 dias de uso da usina inteira (a memória do tablet não enche), dias antigos no BackupUsina, troca de turno e virada das 07:00 no meio da anotação, "Terminou a Nº X", tablet chefe trocado e 700 anotações guardadas sem Wi-Fi;
6. velocidade: cada toque num tablet 4 vezes mais lento, com 90 dias de uso, tem que responder em menos de 100 ms;
7. os pedidos do teste de 24/09 (aviso curto, senha do operador no tablet chefe, relatórios, WhatsApp, rolagem, trocar o código), nas duas centrais, e o aplicativo com o código embaralhado como vai no APK;
7l. a versão 2.14 (precisa do wrangler): a nuvem como ponto de encontro, com a recusa desfeita nas duas centrais, e dois tablets trocando anotações pela nuvem com a central desligada;
7k. a versão 2.13: as contas do Escritório, o lote e as validades, a etiqueta e a folha de rastreamento igual ao papel; a folha só com a função Escritório e a fila da nuvem, nas duas centrais; e o envio com período, turnos, resumo somado e o Excel com os totais;
7j. a versão 2.12, nas duas centrais: tablet chefe que não foi liberado não entra, liberar no nível 1, 2 e 3 (o 3 só com a senha do dono), nível 1 só vê, corrige e envia, o dono que não sai de administrador, a recuperação com a senha do programador, o que chega pela sincronização sem permissão (folhas do sistema, outras partes da Usina, configuração apagada, aviso) e o conflito de revisão; no aplicativo, a vírgula de um quadro, a troca de °C para °F com os dias antigos na unidade antiga (também na API), quadro escondido do operador, campo novo anotado no setor e o Nº NF liberado para o operador; e as folhas de papel e o XML com campo novo, casas decimais e a unidade de cada dia;
7i. a versão 2.11, nas duas centrais: o aparelho manda nome, modelo e Android e a central guarda com o endereço; só o administrador bloqueia; bloqueio que pede senha (o aplicativo trava, confere a senha e avisa a central que liberou), trava de vez e apagar; a tela Aparelhos com o + e o aparelho bloqueado consultando a nuvem;
7h. a versão 2.10, nas duas centrais: o setor anotando e o painel do chefe com os gráficos (pontos e a linha do aviso), a tela com todos os gráficos e o filtro, o PDF só da Hidrólise (uma página por folha, com o logo), o chefe mudando o aviso do pH e o nome do Brix e o tablet do setor usando o novo, o registro com o antes e o depois e o voltar ao original;
7g. a versão 2.9, nas duas centrais: o administrador criado sozinho, cadastro só pelo administrador (senha repetida e último administrador recusados), pessoa desativada, cinco senhas erradas, Consulta barrado e Encarregado liberado, limite do tablet chefe, ajustes do setor com a senha de quem pode, o registro com o antes e o depois, aparelho sem sinal, a tela do registro com o filtro e o cadastro pela tela;
7f. a nuvem (o Cloudflare rodando aqui no computador, com o próprio wrangler): as duas centrais mandando a cópia, a API da nuvem igual à da central, correção e apagado chegando, senha errada, e o APK e as telas saindo da nuvem (telas com outra assinatura recusadas);
7e. a atualização rápida: o pacote assinado, a central entregando, o AtualizadorDeTelas.java baixando, copiando o que não mudou e recusando assinatura errada, arquivo alterado e pacote que pede APK novo, e o aplicativo abrindo a janela sozinho com a barra;
7d. a versão 2.7: a central dizendo a versão do APK (e não oferecendo se o APK não bater com o versao.json), o aplicativo com um Android de mentira (botão Atualizar, novidades, pedido de download com o SHA-256, falta de permissão, arquivo com defeito, novidades uma vez depois de atualizar), a central do computador baixando da nuvem (e recusando APK diferente ou versão mais velha) e o tablet chefe entregando a versão dele; os tanques em m³ e as dornas 7 a 12 entram nos testes da 2.6;
7c. a versão 2.6, nas duas centrais: volume de vinho (a folga vira litros na hora, igual à planilha; aviso de folga maior que a dorna; medidas trocadas pelo escritório), dornas de fermentação (encher, terminar, Brix inicial, medição da manhã no cartão, volante com duas dornas, parar esvaziando ou não, dorna enchida há 6 dias num tablet novo) e o Excel das duas folhas;
7b. a versão 2.5, nas duas centrais: Wi-Fi embaralhado (quem espia não lê nada, pacote alterado, repetido ou com relógio errado, aplicativo antigo, criptografia escrita em JavaScript igual à do Node e à do navegador) e os totais no Base44 (com um Base44 de mentira no computador: sozinho quando o dia fecha, de novo quando a folha é corrigida, erro sem internet ou com segredo errado, e a função que vai no Base44 rodando com um Base44 simulado);
8. leitura de foto, impressão e o aplicativo abrindo sem rede;
9. todas as telas em 9 tamanhos, procurando texto cortado, palavra quebrada, letra pequena, pouco contraste entre a letra e o fundo e erro de JavaScript (fotos em `testes/saida/telas`).

Os testes usam pastas de dados temporárias: nunca mexem em `dados/`. Só as telas: `node testes/rodar-telas.mjs` (liga uma central de teste sozinho). Só o longo prazo: `node testes/rodar-robustez.mjs`.

O teste para fazer à mão no celular e no tablet está em `Teste-nos-aparelhos-2.10.pdf`, na pasta `Usina`; o que conferir depois de pôr a 2.11 no tablet chefe está na parte 3 do `Nuvem-passo-a-passo.pdf`. Só a 2.12: `node testes/rodar-niveis212.mjs`, `node testes/rodar-pedidos212.mjs` e `node testes/rodar-papel212.mjs`. Só a 2.11: `node testes/rodar-seguranca.mjs` e `node testes/rodar-pedidos211.mjs`. Só a 2.10: `node testes/rodar-pedidos210.mjs`; só pessoas e registro: `node testes/rodar-pessoas.mjs`. Só a 2.15: `node testes/rodar-producao215.mjs` (as duas centrais) e, nas telas, `node testes/rodar-telas.mjs s9,s9EmPe,s9Metade,s9DoisTercos,pcGrande`. Só a 2.14: `node testes/hub214.mjs` e `node testes/rodar-hubapp214.mjs`. Só a nuvem: `node testes/rodar-nuvem.mjs` (precisa do `npm install` em `nuvem`); só a atualização: `node testes/rodar-atualizacao.mjs`; só a 2.6: `node testes/rodar-pedidos26.mjs`; só a 2.5: `node testes/rodar-pedidos25.mjs`.

## Imagens das telas

Com a central ligada:

```bash
powershell -ExecutionPolicy Bypass -File gerar-telas.ps1
```

Salva em `../telas`.

## O que já foi testado

43 verificações automáticas: conexão com código certo e errado, anotação, botões − e +, aviso de valor fora do normal, cópia da dorna anterior, marcar fim, monitoramento, valores padrão, insumos, senha do operador, trava por inatividade, virada de turno, exportação, relatórios e configurações. Mais: queda de rede com envio depois que volta, sincronização entre dois aparelhos e validação do Excel e do XML.

Versão 2 (16/09/2026): avisos de pH e Brix, telas LPHERA / Cal e Saczyme / Alcolina com a soma das dornas da hora, casinha nas abas, rolagem do painel do chefe que não volta mais para o topo, pastas *Usina, tela de relatórios, janela de Excel ou XML, listas do ralo, cadastro protegido por senha e busca do tablet chefe no Wi-Fi. Testado no navegador contra o servidor: anotação, envio, queda de rede, relatórios e Excel/XML.

Versão 2.14.0 (15/10/2026): sem a central, os aparelhos trocam as anotações pela nuvem (`sincronizarNuvem` no `app.js`, `/aparelho/sync` na nuvem); a central confere e desfaz o que não podia quando volta (`corrigirRecusaNuvem` no `server.js` e no `ServidorCentral.java`). Testes: `testes/hub214.mjs` (a nuvem e a recusa nas duas centrais) e `testes/rodar-hubapp214.mjs` (dois tablets, a central desligada, cada um anota uma dorna e recebe a do outro; as duas centrais puxam da nuvem). Cabeçalho: o botão Conexão da 2.13.5 cortava o nome da tela no celular e no tablet em pé; agora, quando o nome não cabe nem com a letra menor, o `caberTextos` põe a classe `apertado` no `.topo` (botões só com o ícone, Voltar só com a seta, luzes uma em cima da outra). Testes: o toque fecha a notificação que estiver em cima do botão (`navegador.mjs`), porque das 07:05 às 07:59 o tablet chefe avisa "Folha de ontem guardada" e o aviso cobria o Entrar.

Versão 2.13.5 (15/10/2026): sem a trava de 12 horas fora da rede (`horasForaDaRede` saiu do forms.js): o aplicativo funciona sempre e guarda tudo no aparelho. Botão Conexão no cabeçote, com a luz da central (`sync.modo`) e a da nuvem (`conferirNaNuvem`, a cada 2 minutos, e a fila de 2.13). Sem a central e com a nuvem, a faixa diz "Sem a central. Enviando pela nuvem". Teste: `testes/conexao2135.mjs`.

Versão 2.13.4 (12/10/2026): turnos de cada setor nas Configurações da usina (tablet chefe nível 2 ou 3, função usina): 3 turnos (forms.js `turnos`) ou 2 de 12 horas (forms.js `turnos12h`, 7h às 19h e 19h às 7h), guardado em `configSistema().turnosSetor[setor] = '12h'`. O turno de cada hora conta no dia de produção (7h às 7h), então o das 19h às 7h fica inteiro. Na virada do turno o operador sai (o lembrete para no celular de quem foi embora). Seguem o turno do setor: a observação de cada turno, o Monitorar, os blocos de turno do papel (Caldeira, Destilaria e Nova Destilaria), o filtro de turnos do Enviar e a API (`turno` de cada linha e `turnos` de cada setor). Teste: `testes/turnos213.mjs`.

Versão 2.13.3 (12/10/2026): horário de trabalho de cada setor no lembrete; fora dele o celular não apita (antes ele só respeitava o turno do aplicativo, e quem levava o celular para casa antes de o turno acabar ouvia o apito em casa).

Versão 2.13.2 (12/10/2026): "Anotar agora" cala o apito do lembrete e fecha a faixa até a próxima hora; no celular a faixa ficou menor (botão embaixo do texto). O teste das telas passou a rodar em 10 tamanhos, com o computador, e a demonstração do lembrete deixa a hora atual vazia (antes, dependendo da hora, a faixa nem aparecia na foto). Teste novo: `testes/lembrete213.mjs`.

Versão 2.13.1 (12/10/2026): a tela não pisca mais quando a sincronização (a cada 5 s) redesenha; o efeito de entrada fica só na troca de tela (`render` em `app.js`). O teste "não pisca a tela" está em `testes/pedidos24.mjs`.

Versão 2.13.0 (12/10/2026): Escritório (cálculos da produção, rastreamento de lotes POP 03 - FOR 011 e etiqueta das bombonas), lembrete de anotar a cada hora, enviar e imprimir com áreas, turnos e período, Monitorar com os dias anteriores, aparelho longe da central mandando pela nuvem, botão voltar do Android dentro do aplicativo e quadros que crescem até ocupar a tela.

Versão 2.12.0 (06/10/2026): três níveis de tablet chefe (vê, corrige e envia; tudo e libera outros; tudo mais as configurações do sistema, só o dono), liberação de tablet chefe com senha, recuperação do dono com a senha do programador, configurações do sistema (vírgula, quadro escondido do operador, campos do escritório para o operador e campos novos fora do papel), unidades com os dias antigos na unidade antiga, e a central conferindo a permissão em cada rota e na sincronização.

Versão 2.11.0 (05/10/2026): tela Aparelhos (quem usa, nome no Android, modelo e o + com endereço, versão e quando conectou), bloqueio de aparelho pelo administrador (pede senha ou trava de vez, com opção de apagar, também longe da usina pela nuvem), o aplicativo conferindo a própria assinatura, vírgula na Temperatura da água da Caldeira e na Produção e no Carregamento da Destilaria, e a nuvem sem a senha do administrador.

Versão 2.10.0 (01/10/2026): exportar em PDF escolhendo os setores (uma página por folha, igual ao papel), gráficos do dia no painel do tablet chefe e a tela Folhas e avisos para mudar nomes, unidades e avisos sem versão nova. Foi junto com a 2.9 no mesmo APK.

Versão 2.9.0 (01/10/2026): cada pessoa entra no tablet chefe com a sua senha, níveis Administrador, Encarregado e Consulta com ajuste por pessoa, limite do que cada tablet chefe faz, registro do sistema com o antes e o depois, ajustes dos setores com a senha de quem pode, e a linha aberta no tablet chefe que agora mostra a anotação que chegou do setor.

Versão 2.8.0 (01/10/2026): nuvem no Cloudflare (cópia das anotações, API do escritório e atualizações pela internet), atualização rápida das telas sem instalar APK (com barra e volta automática), janela da versão nova, Volume de vinho e Dornas de fermentação só no tablet chefe, número da dorna em cada quadro do vinho.

Versão 2.7.1 (30/09/2026), pedido do Bruno no painel da Nova Destilaria: entrou a Coluna B4 (temperatura do carregamento da coluna B) entre a Coluna B e a Coluna P, e saiu o Início Aquecimento. É a primeira versão que os tablets recebem pelo botão Atualizar.

Versão 2.7 (29/09/2026): o aplicativo se atualiza sozinho (botão Atualizar, APK pelo Wi-Fi, novidades depois de atualizar, e a nuvem pronta para quando tiver); quadros alinhados, do mesmo tamanho e ocupando a tela toda; respostas do Lucas (fermentação 7 a 12, descanso 1, 2 e 4 a 11, tanques em m³); API só de leitura para o sistema do escritório.

Versão 2.6 (26/09/2026), pedido do escritório: volume de vinho (folga medida com a trena vira litros na hora, com as medidas das dornas da planilha CONTROLE LTS e o total da produção) e dornas de fermentação (encher, Brix inicial, Brix e volume do dia, mandar para a volante), na Destilaria e Fermentação.

Versão 2.5 (24/09/2026), ideias aprovadas depois do teste na área: Wi-Fi embaralhado (conectar sem o código passar aberto, uma chave por aparelho, pacote alterado ou repetido recusado, também no navegador do computador) e totais do dia no Base44 (sozinhos quando o dia fecha e de novo se a folha for corrigida, com a função para o Base44 em `integracoes/base44`).

Versão 2.4 (24/09/2026), pedidos do teste na área: aviso curto do lado do número (caixa e teclado não mudam de tamanho) e só no primeiro pH; insumos somados só de dorna terminada; blocos mais juntos e Apagar lá em cima; Monitorar rola com o dedo e tem folha inteira; turno do lado do nome; sincronização a cada 5 s sem mexer onde a pessoa está; animação só nos quadros ao trocar de dorna; tablet chefe separado do servidor; senha do operador para o chefe corrigir; relatórios um por dia (abrir, enviar, apagar); escolher os setores ao enviar e imprimir; WhatsApp com os totais dos insumos; trocar o código desconecta todos; apagar tudo com a senha do programador; senha do encarregado 159357; código embaralhado no APK.

Versão 2.3 (24/09/2026), revisão completa: a memória dos tablets não enche mais com o tempo (antes parava de salvar com uns 2 meses de uso); troca de turno e virada das 07:00 no meio da anotação não perdem nada; "Terminou a Nº X" não perde o que estava sendo anotado em outra dorna; limpar uma dorna atualiza a Sacarificação e os insumos; LPHERA confirmada volta para conferir se entrar outra dorna na hora; tablet chefe trocado recebe de novo o que os tablets tinham; servidor do tablet chefe liga sozinho quando o tablet reinicia; engrenagem ao lado do botão de tema; Nova Nº sempre à vista; dorna em andamento não conta como pendência; plural de verdade nos textos; botões verdes legíveis na tela escura; nomes embaixo dos ícones do tablet chefe no celular; mais rápido (índice das anotações, só o quadro mexido é refeito ao teclar) e fonte dentro do aplicativo.

Versão 2.2 (23/09/2026), a partir do teste na área: fluxo da dorna enchendo, enviando e anotada; Sacarificação e insumos acompanhando a Hidrólise; trocar de aba volta na mesma dorna; apagar renumera; cal em copos; Alcolina virou Antibiótico; zerar anotações de teste; setor parado não conta como pendência; permissão de rede local (Motorola); texto que não cabe diminui a letra em vez de quebrar a palavra; animações de notificação, janelas e troca de tela; tabela do monitoramento rola com o dedo e tem setas.

Versão 2.1 (22/09/2026): avisos do escritório, versão e relógio de cada aparelho, erros dos aparelhos guardados na central, telas revisadas no celular (notificação no alto e centralizada, selo "sem senha" embaixo do nome, títulos compridos em duas linhas) e bateria de testes automáticos (`testes/rodar-tudo.mjs`). O servidor do tablet chefe (`ServidorCentral.java`) agora passa pelos mesmos testes que o do computador.

**Falta testar em aparelho real:** o que depende do Android de verdade (serviço com a tela apagada, pastas em Documentos, busca no Wi-Fi, envio direto para a conversa do WhatsApp, impressão pelo Android, câmera e vibração). O roteiro está em `Teste-nos-aparelhos.pdf`.
