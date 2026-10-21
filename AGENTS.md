# Pranchetas Digitais Ubirálcool (Usina)

Troca as pranchetas de papel da usina por tablets no Wi-Fi. A raiz não tem `package.json`: é Node puro.

## Estrutura (pasta `app`)

- `server.js`: central do computador (1.700 linhas). `api-leitura.js`: API só de leitura (e os totais) para o escritório. `carregar-usina.js`: monta a configuração como o aplicativo (a central e os testes usam).
- `public/` (o aplicativo, em pastas desde a 2.16):
  - `design/`: `cores.css` (a paleta, claro e escuro: mudou ali, muda em tudo), `tipografia.css`, `medidas.css`, `movimento.css` (o `--ritmo` muda a velocidade de todas as animações), ajustes por tamanho de tela (`telas/`), `escala.js` e `texto-que-cabe.js`.
  - `setores/<setor>/`: `pranchetas.js` (o setor e as folhas dele: campos, limites, avisos), `regras.js` (o que só aquele setor faz: dornas da hidrólise, volume do vinho, bags do ralo) e `estilo.css`.
  - `paginas/` (telas de todo aparelho), `chefe/` (telas do tablet chefe e do escritório), `nucleo/` (memória, conexão, teclado, toques, início), `config/` (`forms.js` geral, `folhas.js`, `novidades.js`), `bibliotecas/` (Excel, PDF, papel, leitor, cifra, QR code).
  - `index.html` é a lista do que carrega, na ordem (`data-usina`: configuração; `data-app`: o aplicativo). `styles.css` é a lista dos estilos, na ordem.
  - Os `.js` do aplicativo são scripts comuns que dividem o mesmo escopo (sem import). No APK eles viram um `app.js` só (`apk/juntar-app.js`).
- `apk/`: app Android (Capacitor) e a central do tablet chefe em Java (`apk/nativo/java/br/com/ubiralcool/pranchetas/ServidorCentral.java`).
- `nuvem/`: Cloudflare (wrangler). `testes/`: suíte automática. `dados/`: anotações reais da usina.

## Arquivos grandes

- Não leia `server.js` inteiro nem varra o `public/` todo. Ache a função com `rtk grep` e leia só o arquivo ou o trecho.
- O `LEIA-ME.md` tem 430 linhas: leia só a seção do assunto (os títulos trazem a versão).

## Comandos (na pasta `app`)

| O quê | Comando |
|---|---|
| Ligar a central (porta 8080) | `node server.js` |
| Só as telas, em 15 tamanhos (computador e Full HD, tablets, Tab S9+, tela dividida e celulares, em pé e deitados) | `node testes/rodar-telas.mjs` |
| Só a versão 2.12 | `node testes/rodar-niveis212.mjs` e `node testes/rodar-papel212.mjs` |
| Tudo (cerca de 20 minutos) | `node testes/rodar-tudo.mjs`, resultado em `testes/saida/resultado.txt` |
| Gerar o APK | `powershell -ExecutionPolicy Bypass -File apk\gerar-apk.ps1` |
| Gerar o instalador do Windows | `powershell -ExecutionPolicy Bypass -File windows\gerar-windows.ps1` |

## Regras do projeto

- A central existe duas vezes: `server.js` e `ServidorCentral.java`. Mudou uma regra em uma, mude na outra; os testes rodam nas duas.
- Campos, limites e avisos de um setor ficam em `public/setores/<setor>/pranchetas.js`; turnos, funções e níveis em `public/config/forms.js` (tabela "Onde mudar as coisas" do LEIA-ME). Arquivo novo do aplicativo: ponha a linha no `index.html` (e o CSS no `styles.css`).
- Cor nova: um nome em `design/cores.css` (claro e escuro), nunca a cor escrita direto na tela.
- Os testes usam pastas temporárias. Nunca use nem altere `dados/`.
- Segredos ficam fora do git (`nuvem/segredos.txt`, `%USERPROFILE%\.pranchetas`). Não copie para código nem para log.
- Sistema interno: SEO não se aplica.

## Telas

Tablets de setor, tablet chefe e celular, com tema escuro no turno da noite. O teste de telas do projeto vale no lugar dos seis tamanhos padrão.

Caixa, tela ou página nova (ou mudada): rode o teste das telas e abra as fotos dela em `testes/saida/telas/<tamanho>/`, no computador, nos tablets (inclusive o S9+ e a tela dividida) e nos celulares. O número sozinho não basta: o teste acha texto cortado e rolagem para o lado, mas não acha caixa feia nem texto espremido. Confira também se a tela nova aparece de verdade na foto.

## Trabalho com o Codex

Pedidos novos em `.handoff/`, no formato da skill `handoff-claude-codex`. O histórico antigo está em `.revisao-codex/`.
