# Entrega 1 (login, período, cálculo, rastreamento e relatórios) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o login que cai, dar prazo à sessão, fazer o período somar de verdade, levar o cálculo de produção ao envio e ao resumo e fechar as falhas entre cálculo, rastreamento e etiqueta.

**Architecture:** A conta da soma e a atualização do rastreamento ficam em funções puras, testadas em Node, no padrão de `public/bibliotecas/rastreamento.js`. Excel, PDF, impressão e Resumo consomem essas funções. O prazo da sessão vive na nuvem (`nuvem/src`), numa tabela própria, e é conferido em toda autenticação.

**Tech Stack:** Node 24, scripts comuns no navegador, Cloudflare Worker + D1, testes próprios (`testes/teste.mjs`, `testes/nuvem-sqlite.mjs`, `testes/navegador.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-09-proxima-versao-logica-design.md`, seção Entrega 1.

## Global Constraints

- Celular: 5 dias. PC: 1 dia, ou 7 com "Lembrar". Prazo fixo, sem renovar com o uso. Teto no servidor: 7 dias. Sem tipo informado: 1 dia.
- Limites de tentativas não mudam: 5 por IP, aparelho e pessoa; 20 por hora na nuvem inteira.
- "Sem permissão" continua na mesma mensagem de "senha errada".
- XML continua dia a dia; "Somar" não vale para ele.
- Envio para o Base44 não muda.
- Não mexer em `apk/nativo`, `apk/gerar-apk.ps1`, `apk/package.json` nem `apk/capacitor.config.json`.
- Regra de central que mudar em `server.js` muda em `ServidorCentral.java`. Esta entrega não prevê mudança em nenhum dos dois; se surgir, vale a regra.
- Testes só em pastas temporárias. Nunca usar `dados/`. Segredos fora de código e de log.
- Cor nova só em `design/cores.css`. Cada arquivo mantém o fim de linha que já tem.
- Commit termina com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Publicar na nuvem e soltar as telas é passo separado, com o sim do Guilherme.

## Review Focus

1. Celular aberto depois da troca de turno, com ou sem internet: continua logado até o prazo. (Tarefa 1)
2. Sessão vencida ou 401 com anotações no aparelho: volta para Entrar e não apaga nada do aparelho. (Tarefa 1)
3. Período somando com dia sem nenhuma anotação ou área vazia: não quebra, e a folha lista os dias faltantes. (Tarefa 2)
4. Medição com vírgula, vazia ou texto ("12,5", "", "x"): vírgula conta, resto é ignorado, nunca `NaN` na folha. (Tarefa 2)
5. Ajuste à mão seguido de "Atualizar": o valor digitado sobrevive, inclusive em campo calculado. (Tarefa 5)

---

### Tarefa 0: Antes de começar (precisa do sim do Guilherme)

- [ ] **Step 1:** Confirmar que ele autorizou o commit das versões 3.0 e 3.0.1. Sem autorização, parar aqui.
- [ ] **Step 2:** Em `app/`: `git status --short` e conferir que não há segredo nem exportação de banco. Commitar no ramo `v2.18`.
- [ ] **Step 3:** `git switch -c v3.1-entrega1`.
- [ ] **Step 4:** `node testes/rodar-tudo.mjs` como linha de base. Anotar o resultado de `testes/saida/resultado.txt` para comparar no fim.

### Tarefa 1: Sessão que não cai no turno e tem prazo (Codex, G)

**Files:**
- Modify: `public/nucleo/operador.js:23`, `nuvem/schema.sql` (depois da linha 74), `nuvem/src/index.js:92-98,127-180`, `nuvem/src/banco.js:202-208,745-748,776-801`, `public/paginas/entrar-pela-nuvem.js:48-59,73-98`, `public/nucleo/relogio.js`, `public/chefe/configuracoes-da-usina.js` (parte Sistema)
- Create: `testes/sessao31.mjs`
- Modify: `testes/rodar-tudo.mjs:349` (acrescentar o arquivo à lista)

**Interfaces:**
- Produces: tabela `prazos_nuvem(aparelho TEXT PRIMARY KEY, expira INTEGER NOT NULL)`; `POST /aparelho/entrar` aceita `tipo: 'celular'|'pc'` e `lembrar: boolean` e devolve `expira`; `cfg.nuvemExpira`; `leitorDaNuvem` devolve `{ pessoa, nonce, expira }`; `autenticar` devolve `{ aparelho, pc: true, expira }`; opção `sessaoNuvem: { celularDias, pcDias, lembrarDias }` em `configSistema()`.

- [ ] **Step 1: Escrever os testes que falham, em `testes/sessao31.mjs`** (Worker real via `ligarNuvemSQLite`, como `banco30.mjs`)

```js
await teste(g, 'celular recebe 5 dias, pc 1, pc com lembrar 7, sem tipo 1', async () => {
  igual(await diasDe({ tipo: 'celular' }), 5); igual(await diasDe({ tipo: 'pc' }), 1);
  igual(await diasDe({ tipo: 'pc', lembrar: true }), 7); igual(await diasDe({}), 1);
});
await teste(g, 'configuração acima do teto vale 7 dias', ...);       // sessaoNuvem.celularDias = 30 -> 7
await teste(g, 'token vencido recebe 401', ...);                     // UPDATE prazos_nuvem SET expira = 1
await teste(g, 'sessão sem linha de prazo recebe 401', ...);         // DELETE FROM prazos_nuvem; inclui chave da 2.16
await teste(g, 'tablet com token de aparelho não vence', ...);       // autenticar por tokenDoAparelho
await teste(g, 'sala fecha conexão vencida e não repassa rascunho', ...);
await teste(g, 'sala fecha conexão parada ao vencer, sem nenhuma mensagem', ...);   // com wrangler, como sala30.mjs: prazo de 2 s
await teste(g, '429 informa esperaSegundos > 0', ...);
await teste(g, 'limites continuam: 6ª senha errada da mesma pessoa dá 429', ...);
```

Teste de tela no mesmo arquivo (`abrirNavegador`, página com `cfg.soNuvem = true`, `papel: 'central'`, `pessoa` preenchida):

```js
await teste(g, 'troca de turno não derruba quem entrou pela nuvem', async () => {
  // muda cfg.pessoaTurno para um turno anterior e chama travarPorInatividade()
  certo(await a.avaliar('!!cfg.pessoa'));
});
await teste(g, 'prazo vencido volta para Entrar e mantém as anotações', async () => {
  // cfg.nuvemExpira = 1; roda o relógio; pilha na tela nuvem-entrar; localStorage["usina.registros"] igual ao de antes
});
await teste(g, 'depois de vencer, o formulário de entrar não é redesenhado', ...);   // digita no campo de senha, espera 3 s, o valor continua
await teste(g, 'celular no navegador envia tipo celular e não mostra Lembrar', ...);  // TAMANHOS.celular com toque
```

- [ ] **Step 2:** `node testes/sessao31.mjs`. Esperado: falham todos, salvo "limites continuam".
- [ ] **Step 3:** `public/nucleo/operador.js:23`: condição vira `cfg.pessoa && !cfg.demo && !cfg.soNuvem`.
- [ ] **Step 4:** `nuvem/schema.sql`: `CREATE TABLE IF NOT EXISTS prazos_nuvem`. Tabela separada, porque `publicar.ps1` reaplica o arquivo.
- [ ] **Step 5:** `nuvem/src/index.js`: `prazoDaSessao(tipo, lembrar, cfgSessao, agora): number`, com padrão `{ celularDias: 5, pcDias: 1, lembrarDias: 7 }`, teto de 7 dias e mínimo de 1, lendo `sessaoNuvem` dos `valores` de `config|sistema|geral`. `lembrar` só vale para `pc`. `entrar` grava o prazo no mesmo `batch` da linha 173 e devolve `expira`. `leitorDaNuvem` faz `JOIN` em `prazos_nuvem` e devolve `null` sem linha ou com `Date.now() >= expira`.
- [ ] **Step 6:** Trocar o 429 de `entrar` para devolver também `esperaSegundos`, lendo o maior `ate` entre as `chaves`.
- [ ] **Step 7:** `nuvem/src/banco.js`: `autenticar` repassa `expira`; a rota do WebSocket envia `&expira=` à Sala; `serializeAttachment` guarda `expira`. `vencido(ws)` (com `expira` e `Date.now() >= expira`) fecha com código 4401. É conferido em `webSocketMessage` e antes de cada envio em `/avisar` e no repasse de rascunho. Conexão parada: `this.state.storage.setAlarm` no menor `expira` das conexões, e `alarm()` fecha as vencidas e agenda a próxima, porque o `ping` é respondido sem passar pelo código.
- [ ] **Step 8:** `entrar-pela-nuvem.js`: `tipoDoAparelho = () => (NO_APK || matchMedia('(pointer: coarse)').matches ? 'celular' : 'pc')`, porque `NO_APK` só diz se é o aplicativo; envia `tipo` e `lembrar`; caixa "Lembrar neste computador por 7 dias" só com tipo `pc`; grava `cfg.nuvemExpira = d.expira`; 429 mostra "Muitas senhas erradas. Tente de novo em N min." com `esperaSegundos`.
- [ ] **Step 9:** `relogio.js`, junto de `travarPorInatividade()`: `if (cfg.soNuvem && cfg.pessoa && cfg.nuvemExpira && Date.now() >= cfg.nuvemExpira) { sairDaNuvem(); toast('O prazo acabou: entre de novo com a sua senha', 'aviso'); }`. `sairDaNuvem` limpa `cfg.nuvemExpira` junto do token.
- [ ] **Step 10:** Parte Sistema em `configuracoes-da-usina.js`: três linhas (celular, PC, PC com Lembrar), em dias de 1 a 7, só com `pode('sistema')`, gravando em `configSistema()` do mesmo jeito que `ler-folha-ligar`.
- [ ] **Step 11:** `node testes/sessao31.mjs` e `node testes/sala30.mjs`. Esperado: tudo passa.
- [ ] **Step 12:** Commit: `feat(3.1): sessão pela nuvem com prazo e sem cair na troca de turno`.

### Tarefa 2: A conta do período (Codex, M)

**Files:**
- Create: `public/bibliotecas/consolidar.js` (UMD como `rastreamento.js`), `testes/soma31.mjs`
- Modify: `public/index.html:34` (linha nova logo depois de `rastreamento.js`), `public/bibliotecas/rastreamento.js:157` (exportar `numero`), `testes/rodar-tudo.mjs:349`, e os `pranchetas.js` da tabela abaixo

**Interfaces:**
- Produces:
  - `Consolidar.agregaDoCampo(campo): 'soma'|'media'|'nenhum'`
  - `Consolidar.daFolha(prancheta, registrosPorDia, dias)` → `{ quantidades: [{ id, rotulo, unidade, total }], medicoes: [{ id, rotulo, unidade, media, minima, maxima, leituras }], operadores: [string], diasSemAnotacao: [string] }`
  - `Consolidar.producao(lista)`, com `lista: [{ dia, conferido, alcool, vinhaca, hidrolisado, vinho, inpm, brix, lote }]` → `{ alcool, vinhaca, hidrolisado, vinho, inpm, brix, dias, naoConferidos }`

Campo numérico sem marca é medição. Marcar `agrega: 'soma'`:

| Folha | Campos |
|---|---|
| `hid_anexo1` | `cal`, `anti`, `enzi` |
| `hid_anexo2` | `enz`, `anti` |
| `destilaria` | `producao` |

Marcar `agrega: 'nenhum'`: `hid_anexo2.sac`, que é o número da dorna, não uma quantidade.

Ficam como medição até o Guilherme responder: `nova_destilaria.producao_lth` (o campo é LT/H, pergunta da seção 1.4 da especificação) e `destilaria.carregamento` (não está claro se é quantidade). Se a resposta for "é volume", a marca vira `agrega: 'soma'`, sem outra mudança.

Os demais (`phf`, `phf2`, `brix`, `bhx`, `pressao`, `temp_agua`, `temp_pe_a`, `vapor`, `inpm`, `coluna_*`, `cond_*`, `brix_inicial` e os parâmetros de `med_dornas`) são medição. Folhas `tipo: 'insumo'` ficam de fora: a soma delas já existe em `totaisDoEnvio`.

- [ ] **Step 1: Escrever os testes que falham, em `testes/soma31.mjs`**

```js
const dia = (d, chave, valores, operador = 'A') => ({ data: d, chave, valores, operador });
const P = { tipo: 'grade', itens: [{ id: 'producao', label: 'Produção', type: 'num', agrega: 'soma', unidade: 'L' }, { id: 'inpm', label: 'INPM', type: 'num', unidade: '°' }] };
const r = Consolidar.daFolha(P, { '2026-10-01': [dia('2026-10-01', '7', { producao: '10,5', inpm: '90' })], '2026-10-02': [dia('2026-10-02', '7', { producao: '4', inpm: '94' }, 'B')], '2026-10-03': [] }, ['2026-10-01', '2026-10-02', '2026-10-03']);
igual(r.quantidades[0].total, 14.5);
igual([r.medicoes[0].media, r.medicoes[0].minima, r.medicoes[0].maxima, r.medicoes[0].leituras], [92, 90, 94, 2]);
igual(r.operadores, ['A', 'B']);
igual(r.diasSemAnotacao, ['2026-10-03']);
```

Testes com nome próprio: `valor "x" e vazio são ignorados, sem NaN`; `linha obs da grade não entra`; `registro apagado não entra`; `campo com agrega nenhum não aparece em quantidades nem em medições`; `área sem nenhuma anotação devolve listas vazias`; `producao soma quantidades, faz média de INPM e Brix e conta os não conferidos`; `todo campo numérico de todas as folhas tem classificação`, percorrendo `carregarUsina`.

- [ ] **Step 2:** `node testes/soma31.mjs`. Esperado: falha com "Consolidar is not defined".
- [ ] **Step 3:** Implementar `consolidar.js` e colocar as marcas `agrega: 'soma'`. Valores arredondados com `Math.round(x * 100) / 100`. Campos vêm de `campos`, `itens` e `parametros`, filtrados por `type === 'num'`; em `grade`, só chave numérica.
- [ ] **Step 4:** `node testes/soma31.mjs`. Esperado: tudo passa.
- [ ] **Step 5:** Commit: `feat(3.1): conta do período por campo`.

### Tarefa 3: Excel, PDF, impressão e Resumo seguem a soma (Claude, M)

**Files:**
- Modify: `public/bibliotecas/modelos.js:607`, `public/chefe/exportar.js:31-35,56-72,94-102`, `public/nucleo/janelas.js:100-101,180-219`
- Test: `testes/soma31.mjs`

**Interfaces:**
- Consumes: `Consolidar.daFolha`.
- Produces: `ModelosPapel.folhaDeTabela({ nome, titulo, secoes: [{ titulo, colunas: [string], linhas: [[any]] }], rodape: [string] })` → folha aceita por `paraPlanilha`, `paraHtml` e `criarPdf` (com `grade`, `nome`, `nomePlanilha`, `paisagem: false`, `dados`); `folhaSomadaDoSetor(setor, dias)` em `exportar.js`.

- [ ] **Step 1: Escrever os testes que falham** (navegador, página `?demo&papel=central` com dois dias semeados)

```js
await teste(g, 'período somando: uma aba por área, sem as abas dos dias', ...);    // gerarArquivo com somar=true: nomes das abas === áreas marcadas
await teste(g, 'período sem somar: uma aba por folha e por dia', ...);             // quantidade = dias × folhas
await teste(g, 'PDF somando tem uma página por área', ...);                        // conta "/Type /Page"
await teste(g, 'imprimir somando gera uma .folha-imp por área', ...);
await teste(g, 'XML ignora somar e sai dia a dia', ...);
await teste(g, 'Resumo sem somar tem um bloco por dia', ...);                      // conta "Folha de "
await teste(g, 'Resumo somando tem um bloco por área, com média, mínima e máxima', ...);
await teste(g, 'turno desmarcado não entra na soma', ...);                         // via montarEnvio
```

- [ ] **Step 2:** `node testes/soma31.mjs`. Esperado: os novos falham.
- [ ] **Step 3:** `modelos.js`: `folhaDeTabela`, usando `Grade`.
- [ ] **Step 4:** `exportar.js`: `folhaSomadaDoSetor` monta uma seção por folha do setor (usando `listarPapel`, que já filtra turnos), mais a seção de insumos de `totaisDoEnvio(dias, [setor.id])`, com rodapé "Sem anotação em: ...". Com `somar` e mais de um dia, `gerarArquivo`, `gerarPdf` e `imprimirFolhas` usam só essas folhas.
- [ ] **Step 5:** `janelas.js`: `imprimirEscolhendo` e `montarEnvio` repassam `somar`. Chip passa a dizer "Somar as folhas do período (Excel, PDF, impressão e Resumo; o XML sai dia a dia)". `resumoDoEnvio`: sem somar, `escolha.dias.map((d) => resumoDoDia(d, escolha.setores))` separados por linha em branco; somando, um bloco por setor, linha `• Temperatura: média 92 (mín. 90, máx. 94)`.
- [ ] **Step 6:** `node testes/soma31.mjs`. Esperado: tudo passa.
- [ ] **Step 7:** Commit: `feat(3.1): somar período gera uma folha por área`.

### Tarefa 4: Cálculo de produção no envio e no Resumo (Claude, M)

**Files:**
- Modify: `public/chefe/escritorio.js:53-59,103-121`, `public/chefe/exportar.js`, `public/nucleo/janelas.js:84-151,180-212`
- Test: `testes/soma31.mjs`

**Interfaces:**
- Consumes: `Consolidar.producao`, `ModelosPapel.folhaDeTabela`.
- Produces: `producaoDoDia(dia)` → `{ dia, conferido: boolean, alcool, vinhaca, hidrolisado, vinho, inpm, brix, lote }`, lendo `valoresDoDia(dia)`, com `conferido = !!rastreioGuardado(dia)`; `escolha.extras: ('calculo'|'rastreamento')[]`.

Quem abre o envio vê as duas opções (a ação já exige `relatorios`). Salvar continua exigindo a função Escritório. Vêm marcadas. O Excel automático das 07:00 não muda.

- [ ] **Step 1: Escrever os testes que falham**

```js
await teste(g, 'Áreas tem Cálculo de produção e Rastreamento', ...);
await teste(g, 'Resumo traz o bloco de produção com "calculado, não conferido" se o dia não foi salvo', ...);
await teste(g, 'dia salvo sai sem o aviso e com os números salvos', ...);
await teste(g, 'período somando soma álcool e faz média de INPM', ...);
await teste(g, 'período sem somar tem um bloco de produção por dia', ...);
await teste(g, 'desmarcado não sai no Excel, no PDF, na impressão nem no Resumo', ...);
await teste(g, 'botão Enviar ou imprimir no cálculo só com a função relatorios', ...);
```

- [ ] **Step 2:** `node testes/soma31.mjs`. Esperado: os novos falham.
- [ ] **Step 3:** `escritorio.js`: `producaoDoDia`, e botão `data-a="relatorio-enviar" data-data="${v.data}"` na tela de cálculos, se `pode('relatorios')`.
- [ ] **Step 4:** `janelas.js`: `EXTRAS_ENVIO` com as duas opções, desenhadas em `.setores-envio`, marcadas em conjunto próprio e devolvidas em `escolha.extras`. "Escolha pelo menos uma área" aceita extras marcadas.
- [ ] **Step 5:** `exportar.js`: com `extras` incluindo `calculo`, folha "Cálculo de produção" por `folhaDeTabela` (uma por dia, ou uma só somando); com `rastreamento`, `papel().folha('rastreamento', dia)` (uma por dia, mesmo somando, porque cada dia tem seu lote). Bloco de produção no Resumo, com o título `*PRODUÇÃO*` ou `*PRODUÇÃO (calculado, não conferido)*`.
- [ ] **Step 6:** `node testes/soma31.mjs`. Esperado: tudo passa.
- [ ] **Step 7:** Commit: `feat(3.1): cálculo de produção no envio e no resumo`.

### Tarefa 5: Ligação entre cálculo, rastreamento e etiqueta (Codex, M)

**Files:**
- Modify: `public/bibliotecas/rastreamento.js:40-77,157`, `public/chefe/escritorio.js:13-16` (via `papel`, em `exportar.js:13-16`), `:91,198-204,249,270,284`, `public/nucleo/toques.js:168-171`
- Create: `testes/rastreio31.mjs`
- Modify: `testes/rodar-tudo.mjs:349`

**Interfaces:**
- Produces: `Rastreamento.diferencas(salvo, novo)` → `[caminho]`; `Rastreamento.atualizar(salvo, novo)` → valores novos, sem alterar `salvo`; `Rastreamento.loteDaEtiqueta(x)` → `x.alcool.lote || x.lote`.

- [ ] **Step 1: Escrever os testes que falham, em `testes/rastreio31.mjs`**

```js
const v = calcular(C, D, regs);
recalcular(v, { campo: 'mp.0.kg', valor: 150 });
igual(v.calculo.mpKg, 350);                                  // dois produtos, 100 + 200 -> 150 + 200
igual(v.pi.hidrolise, 350 / v.calculo.fator);

const salvo = calcular(C, D, regs); recalcular(salvo, { campo: 'volumeDestilado', valor: 9000 });
const novo = calcular(C, D, regsCorrigidos);
const u = atualizar(salvo, novo);
igual(u.volumeDestilado, 9000);                              // digitado sobrevive
igual(u.calculo.alcoolDestilaria, novo.calculo.alcoolDestilaria);
igual(u.vinhaca.producao, 9000 - u.alcool.producao);         // derivado refeito

recalcular(salvo, { campo: 'pi.hidrolise', valor: 7777 });
const u2 = atualizar(salvo, novo);
igual(u2.pi.hidrolise, 7777);                                // calculado digitado à mão sobrevive
igual(u2.pi.vinho, 7777 * u2.calculo.brixInicial / u2.calculo.brixFinal);   // e o que depende dele usa o digitado
igual(diferencas(salvo, salvo), []);
igual(loteDaEtiqueta({ lote: 'A', alcool: { lote: 'B' } }), 'B');
igual(loteDaEtiqueta({ lote: 'A', alcool: { lote: '' } }), 'A');
```

Teste de tela: `soVer: PDF e etiqueta saem com o que está na tela`; `aviso "as folhas mudaram" aparece só com diferença`; `Atualizar mantém o digitado e pede Salvar`.

- [ ] **Step 2:** `node testes/rastreio31.mjs`. Esperado: falham.
- [ ] **Step 3:** `recalcular`: se alterou `mp.N.kg`, refaz `c.mpKg` pela soma de `v.mp`, com origem "soma da matéria-prima por produto", e marca `calculo.mpKg` como alterado antes das contas. Terceiro parâmetro novo, `recalcular(v, mudanca, { manterDigitados: true })`: com ele, `calcularCampo` não troca campo cuja origem começa com "digitado", mas marca o campo como alterado, para os dependentes serem refeitos com o valor digitado.
- [ ] **Step 4:** `atualizar`: copia `salvo`; para cada caminho de `novo.origem` que não é derivado (`pi.hidrolise`, `pi.vinho`, `alcool.producao`, `vinhaca.producao`) e cuja origem salva não começa com "digitado", aplica com `recalcular(..., { manterDigitados: true })` e restaura a origem de `novo`. `mp` só é trocado inteiro se nenhum `mp.*` foi digitado.
- [ ] **Step 5:** `escritorio.js`: etiqueta usa `loteDaEtiqueta` nas linhas 249, 270 e 284. Em `telaEscritorio`, se há salvo e `diferencas` não vazio, mostra aviso com botão `data-a="esc-atualizar"`, que aplica `atualizar`, marca `v.sujo = true` e deixa salvar. No modo `soVer`, `arquivoEsc`, impressão e etiqueta usam `valoresDaTela(v)`: o `papel()` consulta um `rascunhoRastreio` antes de `pegar`.
- [ ] **Step 6:** `node testes/rastreio31.mjs`. Esperado: tudo passa.
- [ ] **Step 7:** Commit: `fix(3.1): cálculo, rastreamento e etiqueta conversam`.

### Tarefa 6: Relatórios e acertos pequenos de tela (Claude, P)

**Files:**
- Modify: `public/chefe/relatorios.js:22-33`, `public/chefe/painel.js:21`, `public/nucleo/toques.js:386`, `public/chefe/avisos.css:16-21`, `public/chefe/configuracoes-da-usina.js:50-55` e o CSS da linha
- Create: `testes/relatorios31.mjs`
- Modify: `testes/rodar-tudo.mjs:349`

- [ ] **Step 1: Escrever os testes que falham**

```js
await teste(g, 'todo cartão tem exatamente Abrir, Enviar e Resumo', ...);
await teste(g, 'Apagar só aparece dentro do dia com Excel guardado', ...);
await teste(g, 'ícone e texto do chip alinhados ao centro, diferença até 1 px', ...);   // getBoundingClientRect no envio, nos 15 tamanhos
await teste(g, 'nome de 40 letras não quebra a linha do operador', ...);                // altura da linha igual à de nome curto
```

- [ ] **Step 2:** `node testes/relatorios31.mjs`. Esperado: falham.
- [ ] **Step 3:** `relatorios.js`: tira o botão Apagar do cartão e põe `data-arq="${(guardados.get(d) || []).length ? 1 : ''}"` em "Abrir e corrigir". `toques.js:386`: `ir({ tela: 'central', data: b.dataset.data, temArquivo: !!b.dataset.arq })`. `painel.js`: mostra `relatorio-apagar` quando `v.temArquivo`.
- [ ] **Step 4:** Chips com `flex-wrap: nowrap`, `align-items: center`. Nome do operador com `min-width: 0` e reticências; caixas de senha e lixeira com `flex: none`.
- [ ] **Step 5:** `node testes/relatorios31.mjs`, depois `node testes/rodar-telas.mjs`. Abrir as fotos de relatórios e do envio em `testes/saida/telas/<tamanho>/`, incluindo S9+, tela dividida e celulares.
- [ ] **Step 6:** Commit: `fix(3.1): cartões iguais em relatórios e acertos de alinhamento`.

### Tarefa 7: Fechamento (Claude, P)

**Files:** `public/nucleo/base.js:7`, `public/config/novidades.js`, `LEIA-ME.md`, `AGENTS.md`

- [ ] **Step 1:** `VERSAO = '3.1.0'`, novidades em texto simples, seção 3.1 no LEIA-ME e os testes novos na tabela do `AGENTS.md`. `apkMinimo` não muda.
- [ ] **Step 2:** `node testes/rodar-tudo.mjs`. Esperado: tudo que passava na Tarefa 0 continua passando, mais os testes novos. Relatar os números.
- [ ] **Step 3:** O implementador pede revisão do diff `git diff v2.18...v3.1-entrega1` ao outro agente, e corrige o que for válido.
- [ ] **Step 4:** Commit: `chore(3.1): versão, novidades e documentação`.
- [ ] **Step 5:** Parar. Publicar na nuvem e soltar as telas só com o sim do Guilherme, com o aviso de que todos terão de entrar de novo uma vez.
