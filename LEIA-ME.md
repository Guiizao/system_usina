# Pranchetas Digitais Ubirálcool

Troca as pranchetas de papel (POP 011, POP-03-FOR-004, controles diários da caldeira e das destilarias) por tablets ligados no Wi-Fi da usina.

Guia com o passo a passo ilustrado: https://claude.ai/artifact/CmJHBvqjeGRWHVYE5R9fWU

## Antes de instalar

1. A senha do encarregado (ajustes e configurações da usina) fica em `public/forms.js` (`pinAdmin`). Desde a versão 2.4 é 159357.
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

## Nuvem das Pranchetas (versão 2.8)

A central (o computador ou o tablet chefe) manda uma cópia das anotações para a internet, de minuto em minuto. Fica no Cloudflare, no plano grátis, sem cartão. De lá saem a API de leitura do escritório (a mesma da central, com os mesmos nomes) e as atualizações do aplicativo. Sem internet a usina continua igual: quando a internet volta, a central manda o que faltou.

- O código fica em `nuvem/` (`src/index.js`, banco D1 em `schema.sql`). A API usa o mesmo `api-leitura.js` da central, por isso ele não usa mais `fs` nem `vm`.
- Para pôr no ar: `nuvem/publicar.ps1` (o passo a passo está em `nuvem/LEIA-ME.txt`). O banco "pranchetas" já foi criado na conta. No fim aparece o endereço e as duas senhas ficam em `nuvem/segredos.txt` (não vai para o Git).
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
7f. a nuvem (o Cloudflare rodando aqui no computador, com o próprio wrangler): as duas centrais mandando a cópia, a API da nuvem igual à da central, correção e apagado chegando, senha errada, e o APK e as telas saindo da nuvem (telas com outra assinatura recusadas);
7e. a atualização rápida: o pacote assinado, a central entregando, o AtualizadorDeTelas.java baixando, copiando o que não mudou e recusando assinatura errada, arquivo alterado e pacote que pede APK novo, e o aplicativo abrindo a janela sozinho com a barra;
7d. a versão 2.7: a central dizendo a versão do APK (e não oferecendo se o APK não bater com o versao.json), o aplicativo com um Android de mentira (botão Atualizar, novidades, pedido de download com o SHA-256, falta de permissão, arquivo com defeito, novidades uma vez depois de atualizar), a central do computador baixando da nuvem (e recusando APK diferente ou versão mais velha) e o tablet chefe entregando a versão dele; os tanques em m³ e as dornas 7 a 12 entram nos testes da 2.6;
7c. a versão 2.6, nas duas centrais: volume de vinho (a folga vira litros na hora, igual à planilha; aviso de folga maior que a dorna; medidas trocadas pelo escritório), dornas de fermentação (encher, terminar, Brix inicial, medição da manhã no cartão, volante com duas dornas, parar esvaziando ou não, dorna enchida há 6 dias num tablet novo) e o Excel das duas folhas;
7b. a versão 2.5, nas duas centrais: Wi-Fi embaralhado (quem espia não lê nada, pacote alterado, repetido ou com relógio errado, aplicativo antigo, criptografia escrita em JavaScript igual à do Node e à do navegador) e os totais no Base44 (com um Base44 de mentira no computador: sozinho quando o dia fecha, de novo quando a folha é corrigida, erro sem internet ou com segredo errado, e a função que vai no Base44 rodando com um Base44 simulado);
8. leitura de foto, impressão e o aplicativo abrindo sem rede;
9. todas as telas em 9 tamanhos, procurando texto cortado, palavra quebrada, letra pequena, pouco contraste entre a letra e o fundo e erro de JavaScript (fotos em `testes/saida/telas`).

Os testes usam pastas de dados temporárias: nunca mexem em `dados/`. Só as telas: `node testes/rodar-telas.mjs` (liga uma central de teste sozinho). Só o longo prazo: `node testes/rodar-robustez.mjs`.

O teste para fazer à mão no celular e no tablet está em `Teste-nos-aparelhos-2.8.pdf`, na pasta `Usina`. Só a nuvem: `node testes/rodar-nuvem.mjs` (precisa do `npm install` em `nuvem`); só a atualização: `node testes/rodar-atualizacao.mjs`; só a 2.6: `node testes/rodar-pedidos26.mjs`; só a 2.5: `node testes/rodar-pedidos25.mjs`.

## Imagens das telas

Com a central ligada:

```bash
powershell -ExecutionPolicy Bypass -File gerar-telas.ps1
```

Salva em `../telas`.

## O que já foi testado

43 verificações automáticas: conexão com código certo e errado, anotação, botões − e +, aviso de valor fora do normal, cópia da dorna anterior, marcar fim, monitoramento, valores padrão, insumos, senha do operador, trava por inatividade, virada de turno, exportação, relatórios e configurações. Mais: queda de rede com envio depois que volta, sincronização entre dois aparelhos e validação do Excel e do XML.

Versão 2 (16/09/2026): avisos de pH e Brix, telas LPHERA / Cal e Saczyme / Alcolina com a soma das dornas da hora, casinha nas abas, rolagem do painel do chefe que não volta mais para o topo, pastas *Usina, tela de relatórios, janela de Excel ou XML, listas do ralo, cadastro protegido por senha e busca do tablet chefe no Wi-Fi. Testado no navegador contra o servidor: anotação, envio, queda de rede, relatórios e Excel/XML.

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
