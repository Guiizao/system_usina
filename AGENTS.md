# AGENTS.md — Pranchetas Digitais (usina)

Instruções para Codex e Claude (o `CLAUDE.md` só importa este arquivo). Curto de propósito: o detalhe fica nas skills de `.agents/skills/`, lidas só quando a tarefa pede.

## Como trabalhar

- Profundidade proporcional ao pedido: pergunta simples tem resposta direta, sem plano nem relatório.
- Leia o código que a mudança toca antes de mudar e reaproveite o que existe. A solução mais simples que é correta; menos linhas só se não perder validação, tratamento de erro, segurança ou acessibilidade.
- Dependência nova só com motivo concreto, escrito na entrega.
- Entregue com evidência: o comando rodado e o resultado. Não diga "testado" sem ter rodado.
- Textos para o dono do projeto em português do Brasil simples: ele não é programador.

## Skills (ler o SKILL.md quando a tarefa pedir)

| Quando | Skill em `.agents/skills/` |
|---|---|
| Criar ou alterar tela, componente ou tema | `verificar-interface` e `direcao-de-design` |
| Rota, regra, permissão, sincronização, nuvem, Base44 | `revisar-backend` |
| Página pública, ou expor algo na internet | `seo-tecnico` |
| Passar ou receber tarefa entre Claude e Codex | `passagem-de-tarefa` |

## Projeto

- `server.js`: central no computador, Node puro sem dependências npm. `apk/nativo/.../ServidorCentral.java`: a mesma central no tablet chefe. Regra de central muda nas duas, e os testes rodam nas duas.
- `public/`: aplicativo (JavaScript puro, PWA). Pranchetas, campos, faixas e senhas padrão em `public/forms.js`.
- `nuvem/`: Cloudflare Worker + D1 (cópia, API do escritório, atualizações). `integracoes/base44`: totais do dia para o escritório.
- Manual e histórico de versões: `LEIA-ME.md`; atualizar a seção da versão quando o comportamento mudar.
- Uso interno na rede da usina: nada aqui é página para buscador.

## Regras que não se quebram

- Permissão é conferida na central, em cada rota e na sincronização; nunca só na tela.
- Senha de desbloqueio e senha do administrador nunca vão para a nuvem.
- Testes usam pastas temporárias; nunca mexer em `dados/`.
- Arquivo de código novo (`.js`, `.mjs`, `.java`, `.html`, `.css`) leva o cabeçalho de direitos autorais igual ao dos existentes.

## Testes

- Tudo (cerca de 20 min): `node testes/rodar-tudo.mjs`. Por parte: `node testes/rodar-<grupo>.mjs` (lista em LEIA-ME.md › Testes automáticos).
- Telas nos 6 tamanhos de referência (mais celular e tablet deitados): `node testes/rodar-telas.mjs ref6`. Liga uma central de teste sozinho; fotos em `testes/saida/telas`, relatório em `testes/saida/telas.json`.
- Fora do Windows o Chrome vem de `CHROME_PATH` ou do Chromium em `/opt/pw-browsers`; a central Java precisa de JDK.
