# Pranchetas Digitais Ubirálcool

Troca as pranchetas de papel (POP 011, POP-03-FOR-004, controles diários da caldeira e das destilarias) por tablets ligados no Wi-Fi da usina.

Guia com o passo a passo ilustrado: https://claude.ai/artifact/CmJHBvqjeGRWHVYE5R9fWU

## Antes de instalar

1. Troque a senha do encarregado em `public/forms.js` (`pinAdmin: '1234'`).
2. Gere o aplicativo, se mexeu em algo:

```bash
powershell -ExecutionPolicy Bypass -File apk\gerar-apk.ps1
```

O APK sai em `apk/saida/pranchetas.apk`. Na primeira vez, rode antes `apk\instalar-ferramentas.ps1` (baixa Java e Android SDK em `%USERPROFILE%\android-build`).

## Ligar a central

**No tablet chefe (sem computador):** instale o APK, abra e toque em "Ligar como tablet chefe". A tela "Preparando o servidor da usina" cria as pastas, liga o servidor (com aviso fixo na barra, para não desligar com a tela apagada) e mostra o código. Permita as notificações e a bateria quando o Android perguntar.

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

Tudo em `public/forms.js`:

| O quê | Onde |
|---|---|
| Setores, pranchetas e campos | `setores` e `pranchetas` |
| Faixa que acende o aviso vermelho | `min` e `max` de cada campo |
| Avisos do processo (pH abaixo de 5, Brix acima de 25) | `avisos` de cada campo |
| Unidades de cada insumo (kg, g, mL, L) | `insumo(..., [unidades])` |
| Telas juntas (LPHERA / Cal, Saczyme / Alcolina) | `juntas_lphera_cal`, `juntas_saczyme_alcolina` |
| Valor que já vem preenchido | `padrao` |
| Passo dos botões − e + | `passo` |
| Turnos e hora que troca a folha | `turnos`, `inicioDoDia` |
| Senha do encarregado | `pinAdmin` |
| Minutos parado até pedir a senha de novo | `minutosSemMexer` |
| Horas fora da rede até travar | `horasForaDaRede` |

Operadores, senhas dos operadores, WhatsApp e e-mail do escritório, tipos de produto e fornecedores do ralo e quais pranchetas aparecem em cada setor são configurados no tablet chefe, em **Usina** (pede a senha do encarregado).

Tamanho da tela (Menor, Normal, Maior) é por aparelho, na engrenagem.

## Relatórios

- No tablet chefe: "Enviar para o escritório" (direto para o WhatsApp ou e-mail cadastrado), WhatsApp, E-mail, Outros apps, Guardar e Imprimir. Uma janela pergunta se vai Excel, XML ou resumo em texto.
- Todo arquivo gerado fica guardado em RelatoriosUsina e aparece na tela **Relatórios**. No computador com `node server.js`, também em `http://ENDEREÇO:8080/relatorios`.
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

## Começar do zero

No tablet chefe: **Usina** (senha do encarregado) > **Zerar as anotações de teste**. Apaga as anotações de todos os setores, na central e nos tablets (cada tablet limpa quando se conecta). Operadores, senhas, contatos e listas continuam. Uma cópia do que foi apagado fica em `BackupUsina/antes-de-zerar-<data>.json`, e os arquivos de cada dia vão para a pasta `BackupUsina/antes-de-zerar-<data>/`.

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
7. leitura de foto, impressão e o aplicativo abrindo sem rede;
8. todas as telas em 9 tamanhos, procurando texto cortado, palavra quebrada, letra pequena, pouco contraste entre a letra e o fundo e erro de JavaScript (fotos em `testes/saida/telas`).

Os testes usam pastas de dados temporárias: nunca mexem em `dados/`. Só as telas: `node testes/rodar-telas.mjs` (liga uma central de teste sozinho). Só o longo prazo: `node testes/rodar-robustez.mjs`.

O teste para fazer à mão no celular e no tablet está em `Teste-nos-aparelhos-2.3.pdf`, na pasta `Usina`.

## Imagens das telas

Com a central ligada:

```bash
powershell -ExecutionPolicy Bypass -File gerar-telas.ps1
```

Salva em `../telas`.

## O que já foi testado

43 verificações automáticas: conexão com código certo e errado, anotação, botões − e +, aviso de valor fora do normal, cópia da dorna anterior, marcar fim, monitoramento, valores padrão, insumos, senha do operador, trava por inatividade, virada de turno, exportação, relatórios e configurações. Mais: queda de rede com envio depois que volta, sincronização entre dois aparelhos e validação do Excel e do XML.

Versão 2 (16/09/2026): avisos de pH e Brix, telas LPHERA / Cal e Saczyme / Alcolina com a soma das dornas da hora, casinha nas abas, rolagem do painel do chefe que não volta mais para o topo, pastas *Usina, tela de relatórios, janela de Excel ou XML, listas do ralo, cadastro protegido por senha e busca do tablet chefe no Wi-Fi. Testado no navegador contra o servidor: anotação, envio, queda de rede, relatórios e Excel/XML.

Versão 2.3 (24/09/2026), revisão completa: a memória dos tablets não enche mais com o tempo (antes parava de salvar com uns 2 meses de uso); troca de turno e virada das 07:00 no meio da anotação não perdem nada; "Terminou a Nº X" não perde o que estava sendo anotado em outra dorna; limpar uma dorna atualiza a Sacarificação e os insumos; LPHERA confirmada volta para conferir se entrar outra dorna na hora; tablet chefe trocado recebe de novo o que os tablets tinham; servidor do tablet chefe liga sozinho quando o tablet reinicia; engrenagem ao lado do botão de tema; Nova Nº sempre à vista; dorna em andamento não conta como pendência; plural de verdade nos textos; botões verdes legíveis na tela escura; nomes embaixo dos ícones do tablet chefe no celular; mais rápido (índice das anotações, só o quadro mexido é refeito ao teclar) e fonte dentro do aplicativo.

Versão 2.2 (23/09/2026), a partir do teste na área: fluxo da dorna enchendo, enviando e anotada; Sacarificação e insumos acompanhando a Hidrólise; trocar de aba volta na mesma dorna; apagar renumera; cal em copos; Alcolina virou Antibiótico; zerar anotações de teste; setor parado não conta como pendência; permissão de rede local (Motorola); texto que não cabe diminui a letra em vez de quebrar a palavra; animações de notificação, janelas e troca de tela; tabela do monitoramento rola com o dedo e tem setas.

Versão 2.1 (22/09/2026): avisos do escritório, versão e relógio de cada aparelho, erros dos aparelhos guardados na central, telas revisadas no celular (notificação no alto e centralizada, selo "sem senha" embaixo do nome, títulos compridos em duas linhas) e bateria de testes automáticos (`testes/rodar-tudo.mjs`). O servidor do tablet chefe (`ServidorCentral.java`) agora passa pelos mesmos testes que o do computador.

**Falta testar em aparelho real:** o que depende do Android de verdade (serviço com a tela apagada, pastas em Documentos, busca no Wi-Fi, envio direto para a conversa do WhatsApp, impressão pelo Android, câmera e vibração). O roteiro está em `Teste-nos-aparelhos.pdf`.
