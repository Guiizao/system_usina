/* Versão 3.0: o leitor de folhas, com o código real rodando no navegador: node testes/leitor30.mjs
 * Folhas desenhadas na hora (sempre rodam) e, se as fotos estiverem no computador, as folhas de verdade com gabarito.
 * O que tem de valer: o cabeçalho nunca vira linha, mesmo com a foto cortada, e a Caldeira é lida hora por hora.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { abrirNavegador, TAMANHOS } from './navegador.mjs';
import { novoGrupo, teste, certo, igual, resumo } from './teste.mjs';
import { centralNode, pastaTemporaria } from './servidores.mjs';

const FOTOS = path.join(os.homedir(), 'Downloads', 'Phone Link');
const g = novoGrupo('Leitor de folhas (3.0)');
const c = await centralNode(8537, pastaTemporaria('leitor30'));
const nav = await abrirNavegador();
const a = await nav.novoAparelho('leitor', TAMANHOS.tablet);

/* Desenha a folha no navegador, com o molde de verdade. `ate` corta a foto antes da fileira pedida. */
const DESENHAR = `
window.folhaDeTeste = async (tipo, ate) => {
  const M = LeitorFolhas.MOLDES[tipo];
  const can = document.createElement('canvas'); const W = tipo === 'caldeira' ? 2000 : 1300, H = tipo === 'caldeira' ? 1100 : 1900;
  can.width = W; can.height = H;
  const x = can.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.strokeStyle = '#000'; x.fillStyle = '#000'; x.lineWidth = 2;
  const linha = (x0, y0, x1, y1) => { x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke(); };
  const L = 110, R = W - 110, T = 150;
  const xs = M.colunas.map((f) => L + f * (R - L));
  // bloco do título: com poucas colunas, como no papel
  x.strokeRect(L, T - 110, R - L, 110); linha(L + 300, T - 110, L + 300, T); x.font = 'bold 34px Arial'; x.fillText('CONTROLE DE TESTE', L + 340, T - 45);
  if (tipo === 'caldeira') {
    const alt = 650, ys = M.fileiras.map((f) => T + 60 + f * alt);
    ys.forEach((y) => linha(L, y, R, y)); xs.forEach((v) => linha(v, ys[0], v, ys[ys.length - 1]));
    x.font = 'bold 24px Arial'; [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7].forEach((h, i) => x.fillText(String(h), xs[i] + 15, ys[1] - 8));
    const escreve = (lin, col, t) => { x.font = '42px Arial'; x.fillText(t, xs[col] + 6, ys[lin + 1] - 22); };
    for (let i = 0; i < 24; i++) { escreve(3, i, '6K'); escreve(5, i, ['01', '02', '03'][i % 3]); }
    escreve(4, 0, '42'); escreve(4, 1, '33'); escreve(6, 0, 'OK');
  } else {
    const s = 58, ys = Array.from({ length: M.linhas + 2 }, (_, i) => T + i * s);
    ys.forEach((y) => linha(L, y, R, y)); xs.forEach((v) => linha(v, ys[0], v, ys[ys.length - 1]));
    x.font = 'bold 26px Arial'; M.nomes.forEach((n, i) => x.fillText(n.toUpperCase().slice(0, 7), xs[i] + 4, ys[1] - 16));
    const k = M.nomes.indexOf(M.chave.coluna), h = M.nomes.indexOf('horario');
    M.chave.textos.forEach((t, m) => {
      x.font = '24px Arial'; x.fillText(t, xs[k] + 6, ys[m + 2] - 18);
      if (h >= 0) { x.font = '38px Arial'; x.fillText(String(m + 7) + ':30', xs[h] + 8, ys[m + 2] - 14); }
    });
    // a tabelinha do rodapé tem poucas colunas
    x.strokeRect(L + 40, ys[ys.length - 1] + 40, R - L - 80, 90); linha(L + 40, ys[ys.length - 1] + 85, R - 40, ys[ys.length - 1] + 85); linha(L + 400, ys[ys.length - 1] + 40, L + 400, ys[ys.length - 1] + 130);
    if (ate) { const o = document.createElement('canvas'); o.width = W; o.height = ys[ate + 1]; o.getContext('2d').drawImage(can, 0, 0); return new Promise((ok) => o.toBlob((b) => ok(new File([b], 'f.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.95)); }
  }
  return new Promise((ok) => can.toBlob((b) => ok(new File([b], 'f.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.95));
};
window.lerParaTeste = async (f, pid, molde) => {
  const bruto = await LeitorFolhas.lerFoto(f, molde, colunasDaLeitura(pid));
  const L = interpretarLeitura(pid, '2026-09-14', bruto);
  return { colunas: Object.keys(L.colunas), linhas: L.linhas.map((l) => ({ chave: l.chave, temValor: l.temValor, celulas: Object.fromEntries(Object.entries(l.celulas).map(([n, x]) => [n, x.valor])), confianca: Object.fromEntries(Object.entries(l.celulas).map(([n, x]) => [n, x.confianca])) })) };
};
true`;

const ler = (tipo, ate, pid) => a.avaliar(`folhaDeTeste(${JSON.stringify(tipo)}, ${ate || 0}).then((f) => lerParaTeste(f, ${JSON.stringify(pid)}, ${JSON.stringify(tipo)}))`);

try {
  await a.ir(c.url + '/');
  await a.avaliar(DESENHAR);
  await a.avaliar('LeitorFolhas.carregar().then(() => true)');

  await teste(g, '03 é 3 (cal em copos), 50 é 5,0 (a vírgula sumiu), e na Caldeira 6K é 6 e 42 é 42', async () => {
    const r = await a.avaliar(`(() => {
      const v = (spec, s) => (LeitorFolhas.candidatos(spec).filter(([f]) => f === s).map(([, x]) => x));
      const d = { tipo: 'decimal', min: 0, max: 20 }, k = { tipo: 'decimal', inteiro: true, min: 0, max: 12, sufixos: ['K'] }, t = { tipo: 'decimal', inteiro: true, min: 0, max: 200 };
      return { tres: v(d, '03'), cinco: v(d, '50'), seisK: v(k, '6K'), seis: v(k, '6'), temp: v(t, '42'), comVirgula: v(t, '5,6'), tracos: v(t, '---'), dois: v({ tipo: 'opcoes', exato: true, opcoes: ['01', '02'] }, '2') };
    })()`);
    igual(r.tres, ['3.0']); igual(r.cinco, ['5.0']); igual(r.seisK, ['6']); igual(r.seis, ['6']); igual(r.temp, ['42']); igual(r.comVirgula, ['5.6']); igual(r.tracos, ['']); igual(r.dois, ['02']);
  });
  await teste(g, 'folha inteira: a 1ª linha é a linha 1 e o cabeçalho não entra', async () => {
    const r = await ler('anexo2', 0, 'hid_anexo2');
    igual(r.linhas.length, 25);
    igual(r.linhas[0].celulas.horario, '07:30'); igual(r.linhas[1].celulas.horario, '08:30');
  });
  await teste(g, 'foto com o fim cortado: continua começando na linha 1, sem ler o cabeçalho', async () => {
    const r = await ler('anexo2', 18, 'hid_anexo2');
    igual(r.linhas[0].chave, 1); igual(r.linhas[0].celulas.horario, '07:30'); igual(r.linhas[5].celulas.horario, '12:30');
  });
  await teste(g, 'Caldeira: as horas são as linhas, a coluna das 7 do dia seguinte fica de fora, campo novo não entra', async () => {
    const r = await ler('caldeira', 0, 'caldeira');
    igual(r.linhas.length, 24);
    igual(r.linhas[0].chave, 7); igual(r.linhas[23].chave, 6);
    igual(r.linhas[0].celulas.pressao, '6'); igual(r.linhas[0].celulas.temp_agua, '42'); igual(r.linhas[1].celulas.temp_agua, '33');
    igual(r.linhas[0].celulas.descarga_fundo, '01'); igual(r.linhas[1].celulas.descarga_fundo, '02');
    igual(r.linhas[0].celulas.descarga_garrafa, 'OK'); igual(r.linhas[1].celulas.descarga_garrafa, '');
    igual(r.linhas[0].celulas.parada, '');
    igual(r.colunas.sort(), ['descarga_fundo', 'descarga_garrafa', 'inicio_aquec', 'parada', 'pressao', 'retirada_cinza', 'temp_agua']);
  });
  await teste(g, 'dá para escolher qual Caldeira a foto é: as duas aparecem na lista, com o nome', async () => {
    const lista = await a.avaliar('folhasQueLeio().map((x) => [x.pid, prancheta(x.pid).nome])');
    const nomes = Object.fromEntries(lista);
    igual(nomes.caldeira, 'Caldeira 1'); igual(nomes.caldeira_2, 'Caldeira 2');
  });
  await teste(g, 'salvar a folha da Hidrólise preenche a Sacarificação e os insumos, como no tablet', async () => {
    const r = await a.avaliar(`(() => {
      const data = somarDias(dataProducao(), -1), colunas = colunasDaLeitura('hid_anexo1');
      const cel = (valor) => ({ valor, confianca: 1, alternativas: [], tinta: !!valor });
      const linha = (chave, inicio, fim) => {
        const celulas = Object.fromEntries(Object.keys(colunas).map((n) => [n, cel('')]));
        Object.assign(celulas, { inicio: cel(inicio), fim: cel(fim), phf: cel('6.4'), phf2: cel('5.2'), bhx: cel('17'), enzi: cel('70'), cal: cel('3.0'), responsavel: cel('Cleber') });
        return { chave, celulas, temValor: true, existe: false, incluir: true, riscos: {} };
      };
      salvarLeitura({ leitura: { pid: 'hid_anexo1', data, colunas, linhas: [linha(1, '08:10', '08:40'), linha(2, '08:40', '09:15')] } });
      const v = (pid, chave) => { const x = pegar(data, pid, chave); return x ? x.valores : null; };
      return { sac1: v('hid_anexo2', 1), sac2: v('hid_anexo2', 2), lphera: v('ins_lphera', 8), cal: v('ins_cal', 8), saczyme: v('ins_saczyme', 8), alcolina: v('ins_alcolina', 8), conferir: pegar(data, 'ins_lphera', 8).conferir };
    })()`);
    igual(r.sac1.horario, '08:10'); igual(r.sac1.phf, '5.2'); igual(r.sac1.bhx, '17'); igual(r.sac2.horario, '08:40');
    igual(r.lphera.qtd, '140'); igual(r.cal.qtd, '6');
    certo(r.conferir === true, 'o insumo somado tem de ficar para o operador conferir');
    certo(r.saczyme && Number(r.saczyme.qtd) > 0, 'Saczyme não foi somado: ' + JSON.stringify(r.saczyme));
    certo(r.alcolina && Number(r.alcolina.qtd) > 0, 'Antibiótico não foi somado: ' + JSON.stringify(r.alcolina));
  });

  /* Fotos de verdade: ficam fora do projeto. Sem elas, estes testes não contam. */
  const foto = (nome) => path.join(FOTOS, nome);
  const carregarFoto = (nome) => a.avaliar(`(() => { const bin = atob(${JSON.stringify(fs.readFileSync(foto(nome)).toString('base64'))}); const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); window.__foto = new File([b], 'f.jpg', { type: 'image/jpeg' }); return true; })()`);
  if (fs.existsSync(foto('Hidro Exem.jpg'))) {
    await teste(g, 'foto real cortada: a Sacarificação continua começando em 07:49', async () => {
      await carregarFoto('Hidro Exem.jpg');
      const r = await a.avaliar(`(async () => {
        const bmp = await createImageBitmap(window.__foto, { imageOrientation: 'from-image' });
        const o = document.createElement('canvas'); o.width = bmp.width; o.height = Math.round(bmp.height * 0.67); o.getContext('2d').drawImage(bmp, 0, 0);
        const f = await new Promise((ok) => o.toBlob((b) => ok(new File([b], 'f.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.95));
        return lerParaTeste(f, 'hid_anexo2', 'anexo2');
      })()`);
      igual(r.linhas[0].celulas.horario, '07:49'); igual(r.linhas[1].celulas.horario, '08:07');
    });
  } else console.log('  (sem a foto Hidro Exem.jpg: teste da foto real não rodou)');
  for (const nome of ['Caldeira 2.jpg', 'Caldeira.jpg']) {
    if (!fs.existsSync(foto(nome))) { console.log(`  (sem a foto ${nome}: teste não rodou)`); continue; }
    await teste(g, `foto real da Caldeira (${nome}): 85% ou mais, e quase nenhum erro com confiança alta`, async () => {
      await carregarFoto(nome);
      const r = await a.avaliar(`lerParaTeste(window.__foto, 'caldeira', 'caldeira')`);
      const P = [6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5, 6, 7, 6, 7, 6, 8, 8, 8, 8].map(String), V = (n) => Array(n).fill('');
      const gab = { pressao: P, temp_agua: ['42', '33', '5.6', ...V(21)], descarga_fundo: Array.from({ length: 24 }, (_, i) => ['02', '03', '01'][i % 3]), descarga_garrafa: ['OK', ...V(23)], retirada_cinza: [...V(15), 'OK', ...V(8)], inicio_aquec: V(24), parada: V(24) };
      let ok = 0, total = 0, seguros = 0, segurosOk = 0;
      r.linhas.forEach((l, i) => Object.keys(gab).forEach((n) => {
        const certoAqui = String(l.celulas[n] ?? '') === gab[n][i];
        total++; if (certoAqui) ok++;
        if (l.confianca[n] >= 0.8) { seguros++; if (certoAqui) segurosOk++; }
      }));
      console.log(`    ${nome}: ${ok} de ${total} células (${Math.round(ok / total * 100)}%); com confiança alta ${segurosOk} de ${seguros}`);
      certo(ok / total >= 0.85, `${ok} de ${total}`);
      certo(seguros - segurosOk <= 6, `${seguros - segurosOk} erros com confiança alta`);
    });
  }
} finally {
  await a.fechar().catch(() => {});
  await nav.fechar();
  await c.desligar();
}
const r = resumo([g]);
console.log(`\n${r.passaram} de ${r.total} testes passaram; ${r.falharam} falharam`);
process.exitCode = r.falharam ? 1 : 0;
