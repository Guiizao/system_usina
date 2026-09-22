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

## Imagens das telas

Com a central ligada:

```bash
powershell -ExecutionPolicy Bypass -File gerar-telas.ps1
```

Salva em `../telas`.

## O que já foi testado

43 verificações automáticas: conexão com código certo e errado, anotação, botões − e +, aviso de valor fora do normal, cópia da dorna anterior, marcar fim, monitoramento, valores padrão, insumos, senha do operador, trava por inatividade, virada de turno, exportação, relatórios e configurações. Mais: queda de rede com envio depois que volta, sincronização entre dois aparelhos e validação do Excel e do XML.

Versão 2 (16/09/2026): avisos de pH e Brix, telas LPHERA / Cal e Saczyme / Alcolina com a soma das dornas da hora, casinha nas abas, rolagem do painel do chefe que não volta mais para o topo, pastas *Usina, tela de relatórios, janela de Excel ou XML, listas do ralo, cadastro protegido por senha e busca do tablet chefe no Wi-Fi. Testado no navegador contra o servidor: anotação, envio, queda de rede, relatórios e Excel/XML.

**Falta testar em aparelho real (o APK compila, mas não há Android aqui):** servidor dentro do tablet chefe, serviço com a tela apagada, pastas em Documentos, busca no Wi-Fi e envio direto para a conversa do WhatsApp.
