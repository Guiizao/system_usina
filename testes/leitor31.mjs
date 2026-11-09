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
