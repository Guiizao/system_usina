# Pranchetas Digitais Ubirálcool (Usina)

Troca as pranchetas de papel da usina por tablets no Wi-Fi. A raiz não tem `package.json`: é Node puro.

## Estrutura (pasta `app`)

- `server.js`: central do computador (1.500 linhas). `api-leitura.js`: API só de leitura para o escritório.
- `public/`: o aplicativo. `app.js` (5.700 linhas, 398 KB), `forms.js` (setores, pranchetas, campos e limites), `folhas.js`, `styles.css`.
- `apk/`: app Android (Capacitor) e a central do tablet chefe em Java (`apk/nativo/java/br/com/ubiralcool/pranchetas/ServidorCentral.java`).
- `nuvem/`: Cloudflare (wrangler). `testes/`: suíte automática. `dados/`: anotações reais da usina.

## Arquivos grandes

- Não leia `public/app.js` nem `server.js` inteiros. Ache a função com `rtk grep` e leia só o trecho.
- O `LEIA-ME.md` tem 430 linhas: leia só a seção do assunto (os títulos trazem a versão).

## Comandos (na pasta `app`)

| O quê | Comando |
|---|---|
| Ligar a central (porta 8080) | `node server.js` |
| Só as telas, em 9 tamanhos | `node testes/rodar-telas.mjs` |
| Só a versão 2.12 | `node testes/rodar-niveis212.mjs` e `node testes/rodar-papel212.mjs` |
| Tudo (cerca de 20 minutos) | `node testes/rodar-tudo.mjs`, resultado em `testes/saida/resultado.txt` |
| Gerar o APK | `powershell -ExecutionPolicy Bypass -File apk\gerar-apk.ps1` |

## Regras do projeto

- A central existe duas vezes: `server.js` e `ServidorCentral.java`. Mudou uma regra em uma, mude na outra; os testes rodam nas duas.
- Setores, campos, limites, avisos e turnos ficam em `public/forms.js` (tabela "Onde mudar as coisas" do LEIA-ME).
- Os testes usam pastas temporárias. Nunca use nem altere `dados/`.
- Segredos ficam fora do git (`nuvem/segredos.txt`, `%USERPROFILE%\.pranchetas`). Não copie para código nem para log.
- Sistema interno: SEO não se aplica.

## Telas

Tablets de setor, tablet chefe e celular, com tema escuro no turno da noite. O teste de telas do projeto vale no lugar dos seis tamanhos padrão.

## Trabalho com o Codex

Pedidos novos em `.handoff/`, no formato da skill `handoff-claude-codex`. O histórico antigo está em `.revisao-codex/`.
