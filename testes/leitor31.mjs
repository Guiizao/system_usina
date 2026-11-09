/* 3.1: folhas de destilaria na foto real e o giro certo da foto. Sem as fotos neste computador, só o que não depende delas roda. */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { abrirNavegador, TAMANHOS } from './navegador.mjs';
import { centralNode, pastaTemporaria } from './servidores.mjs';
import { novoGrupo, teste, certo, igual, resumo } from './teste.mjs';

const FOTOS = process.env.FOTOS_USINA || path.join('..', 'IMG');
const g = novoGrupo('Leitor de folhas (3.1)');
const temFotos = fs.existsSync(FOTOS);
const c = await centralNode(8538, pastaTemporaria('leitor31'));
const nav = await abrirNavegador();
const a = await nav.novoAparelho('leitor31', TAMANHOS.tablet);
const srv = http.createServer((q, r) => { r.setHeader('Access-Control-Allow-Origin', '*'); fs.createReadStream(path.join(FOTOS, decodeURIComponent(q.url.slice(1)))).on('error', () => { r.statusCode = 404; r.end(); }).pipe(r); }).listen(8539);
try {
  await a.ir('http://127.0.0.1:8538/?demo&papel=central', 'document.querySelector("#app main")');
  await a.avaliar('LeitorFolhas.carregar().then(() => 1)');
  const ler = (arq, pid, molde) => a.avaliar(`(async () => {
    const b = await (await fetch('http://127.0.0.1:8539/${arq}')).blob();
    const cols = colunasDaLeitura('${pid}');
    const x = await LeitorFolhas.lerFoto(new File([b], 'f.jpg', { type: 'image/jpeg' }), '${molde}', cols);
    const v = interpretarLeitura('${pid}', '2026-11-05', x);
    return { giro: x.giro, linhas: v.linhas.map((l) => Object.fromEntries(Object.entries(l.celulas).map(([k, c]) => [k, c.valor]))) };
  })()`);

  await teste(g, 'Destilaria e Nova Destilaria têm molde e são escolhidas pela folha', async () => {
    igual(await a.avaliar(`['destilaria', 'nova_destilaria', 'caldeira'].map(moldeDaFolha)`), ['destilaria', 'nova', 'caldeira']);
    igual(await a.avaliar(`LeitorFolhas.MOLDES.destilaria.celula(5, 9)`), [12, 0]);
    igual(await a.avaliar(`LeitorFolhas.MOLDES.destilaria.celula(1, 23)`), [15, 5]);
    igual(await a.avaliar(`Object.keys(colunasDaLeitura('nova_destilaria')).includes('coluna_b4')`), false);
  });
  await teste(g, 'memória: 2 parecidas nada, 3 sugerem, 5 preenchem e outro valor parecido só sugere', async () => {
    const r = await a.avaliar(`(() => {
      const V = '9'.repeat(384), L = (v, n) => { for (let i = 0; i < n; i++) lembrarCorrecao('hid_anexo1', 'responsavel', V, v); };
      const res = [];
      L('Cleber', 2); res.push(palpiteDaMemoria('hid_anexo1', 'responsavel', V));
      L('Cleber', 1); res.push(palpiteDaMemoria('hid_anexo1', 'responsavel', V));
      L('Cleber', 2); res.push(palpiteDaMemoria('hid_anexo1', 'responsavel', V));
      L('Arlindo', 1); res.push(palpiteDaMemoria('hid_anexo1', 'responsavel', V));
      res.push(palpiteDaMemoria('hid_anexo1', 'responsavel', '0'.repeat(384)));
      return res;
    })()`);
    igual(r, [null, { valor: 'Cleber', preenche: false }, { valor: 'Cleber', preenche: true }, { valor: 'Cleber', preenche: false }, null]);
  });
  await teste(g, 'dornas de outro turno: hora diferente continua a sequência; hora igual é a mesma e só completa o vazio', async () => {
    const r = await a.avaliar(`(() => {
      const d = '2020-03-03', pid = 'hid_anexo1';
      for (let n = 1; n <= 12; n++) gravar(d, pid, n, n === 3 ? { inicio: pad2(6 + n) + ':00', phf: '5.0' } : { inicio: pad2(6 + n) + ':00', phf: '5.0', brix: '20' }, { operador: 'Turno A' });
      const ler = window.LeitorFolhas.lerCelula; window.LeitorFolhas.lerCelula = (x) => x;
      const cel = (valor) => ({ r: { valor, confianca: 1 }, vazia: false });
      const folha = (linhas) => interpretarLeitura(pid, d, { linhas: linhas.map((x, m) => ({ m, celulas: Object.fromEntries(Object.entries(x).map(([k, v]) => [k, cel(v)])) })) });
      const ver = (L) => L.linhas.map((l) => [l.chave, l.existe, l.incluir]);
      const L = folha([{ inicio: '19:00', phf: '4.8' }, { inicio: '20:00', phf: '4.9' }, { inicio: '08:00', phf: '4.1' }, { inicio: '09:00', phf: '9.9', brix: '22' }]);
      const antes = ver(L);
      salvarLeitura({ pid, leitura: L });
      const salvo = [13, 14, 2, 3].map((n) => { const x = pegar(d, pid, n); return [x.valores.inicio, x.valores.phf, x.valores.brix, x.operador]; });
      const sacarificacao = pegar(d, 'hid_anexo2', 13).valores.horario;
      const denovo = ver(folha([{ inicio: '19:00', phf: '4.8' }]));
      for (let n = 15; n <= prancheta(pid).maxLinhas; n++) gravar(d, pid, n, { inicio: pad2(n % 24) + ':30' }, { operador: 'x' });
      const cheia = folha([{ inicio: '23:59', phf: '5.5' }]).linhas[0];
      window.LeitorFolhas.lerCelula = ler;
      return { antes, salvo, sacarificacao, denovo, semLugar: cheia.semLugar, incluiCheia: cheia.incluir };
    })()`);
    igual(r.antes, [[13, false, true], [14, false, true], [2, true, false], [3, true, true]]);
    igual(r.salvo, [['19:00', '4.8', undefined, 'Lido da folha'], ['20:00', '4.9', undefined, 'Lido da folha'], ['08:00', '5.0', '20', 'Turno A'], ['09:00', '5.0', '22', 'Turno A']].map((x) => x.map((v) => (v === undefined ? null : v))));
    igual(r.sacarificacao, '19:00');
    igual(r.denovo, [[13, true, false]]);
    igual([r.semLugar, r.incluiCheia], [true, false]);
  });
  await teste(g, 'dia com mais de 25 dornas: a folha estica até a última linha e o PDF fica numa página', async () => {
    const r = await a.avaliar(`(async () => {
      const d = '2020-03-04', pid = 'hid_anexo1';
      for (let n = 1; n <= 36; n++) gravar(d, pid, n, { inicio: pad2(n % 24) + ':10', phf: '5.0' }, { operador: 'x' });
      const vazia = papel().folha(pid, '2020-03-05'), cheia = papel().folha(pid, d);
      const num = (f) => Object.values(f.grade.cel).filter((c) => c.st && c.st.b && typeof c.v === 'number').length;
      const pdf = window.criarPdf([cheia], Object.assign({ fmtNum, titulo: 't' }, await pecasPdf()));
      let s = ''; for (let i = 0; i < pdf.length; i++) s += String.fromCharCode(pdf[i]);
      return [num(vazia), num(cheia), (s.match(/\\/Type \\/Page /g) || []).length];
    })()`);
    igual(r, [25, 36, 1]);
  });
  if (temFotos) {
    await teste(g, 'Destilaria deitada: acha o giro e lê os blocos na ordem das horas', async () => {
      const r = await ler('20261106_071636.jpg.jpeg', 'destilaria', 'destilaria');
      igual(r.giro, 270);
      igual(r.linhas.slice(0, 3).map((l) => l.producao), ['160', '180', '180']);
      igual(r.linhas.slice(9, 12).map((l) => l.inpm), ['94.0', '94.0', '93.6']);
    });
    await teste(g, 'Nova Destilaria de cabeça para baixo: acha o giro e lê sem vírgula', async () => {
      const r = await ler('20261105_071157.jpg.jpeg', 'nova_destilaria', 'nova');
      igual(r.giro, 270);
      igual(r.linhas.slice(1, 4).map((l) => l.coluna_hidro), ['92.1', '91.7', '92.3']);
      certo(r.linhas.filter((l) => l.vapor === '1.7').length >= 12, 'vapor 1,7 na maior parte do dia');
    });
  } else console.log('  (sem as fotos da usina neste computador: testes com foto real não rodaram)');
} finally { await nav.fechar(); await c.desligar(); srv.close(); }

const r = resumo([g]);
console.log(`\n${r.passaram} de ${r.total} testes passaram; ${r.falharam} falharam`);
process.exit(r.falharam ? 1 : 0);
