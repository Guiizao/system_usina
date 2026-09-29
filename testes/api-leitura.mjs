/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * API só de leitura para o sistema do escritório (api-leitura.js): senha de leitura, nada da configuração da usina
 * saindo, e o dia inteiro com os nomes dos campos iguais às pranchetas.
 * Com EXEMPLO=pasta, grava os JSON de exemplo (um dia completo) nessa pasta.   node testes/api-leitura.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { teste, certo, igual, novoGrupo, resumo } from './teste.mjs';
import { centralNode } from './servidores.mjs';

const pad2 = (n) => String(n).padStart(2, '0');
const diaSeguinte = (iso) => { const [y, m, d] = iso.split('-').map(Number); const x = new Date(y, m - 1, d + 1); return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`; };
const diaProducao = (n = 0) => { const d = new Date(Date.now() - 7 * 3600000 - n * 86400000); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };

/** Um dia completo da usina, com os valores do exemplo do aplicativo. */
export function diaDeExemplo(data) {
  const quando = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return new Date(`${h < 7 ? diaSeguinte(data) : data}T${pad2(h)}:${pad2(m)}:00`).getTime(); };
  const reg = (pid, setor, chave, valores, operador, extra = {}) => {
    const hora = valores.inicio || valores.horario || valores.hora || (/^\d+$/.test(String(chave)) && (pid.startsWith('ins_') || /^(caldeira|destilaria)$/.test(pid)) ? `${pad2(chave)}:05` : '07:40');
    const t = quando(hora) + 120000;
    return Object.assign({ id: `${data}|${pid}|${chave}`, data, prancheta: pid, setor, chave: String(chave), valores, operador, criadoEm: t, atualizadoEm: t, aparelho: 'exemplo', apagado: false }, extra);
  };
  const l = [];
  [['08:43', '09:00', '3.5', '4', '20', '6.0', '70', '20', 'FINI'], ['09:00', '09:18', '3.5', '4', '21', '6.0', '70', '20', 'FINI'], ['09:31', '09:55', '5.1', '', '17', '5.2', '70', '20', 'MASSA'],
    ['09:55', '10:14', '5.0', '', '18', '5.1', '70', '19', 'MASSA'], ['10:35', '10:55', '4.8', '2', '26', '5.0', '70', '22', 'MASSA'], ['10:55', '', '5.2', '', '19', '5.2', '70', '18', 'FINI']]
    .forEach((x, i) => l.push(reg('hid_anexo1', 'hidrolise', i + 1, { inicio: x[0], fim: x[1], phf: x[2], cal: x[3], brix: x[4], phf2: x[5], enzi: x[6], bhx: x[7], produto: x[8] }, 'Guilherme')));
  [['08:43', '6.0', '20'], ['09:00', '6.0', '20'], ['09:31', '5.2', '20'], ['09:55', '5.1', '19'], ['10:35', '5.0', '22']]
    .forEach((x, i) => l.push(reg('hid_anexo2', 'hidrolise', i + 1, { horario: x[0], sac: '4', phf: x[1], bhx: x[2] }, 'Guilherme')));
  [[8, '70', '4', '100', '100'], [9, '210', '4', '300', '300'], [10, '70', '2', '100', '100']].forEach(([h, lp, cal, sac, alc]) => {
    l.push(reg('ins_lphera', 'hidrolise', h, { qtd: lp, unidade: 'mL' }, 'Guilherme'));
    l.push(reg('ins_cal', 'hidrolise', h, { qtd: cal, unidade: 'copos' }, 'Guilherme'));
    l.push(reg('ins_saczyme', 'hidrolise', h, { qtd: sac, unidade: 'mL' }, 'Guilherme'));
    l.push(reg('ins_alcolina', 'hidrolise', h, { qtd: alc, unidade: 'mL' }, 'Guilherme'));
  });
  l.push(reg('ins_materia_prima', 'ralo', 9, { qtd: '160', unidade: 'kg', produto: 'MASSA', fornecedor: 'COOPERATIVA', nf: '12345', lote: 'L-0927' }, 'Jair'));
  l.push(reg('ins_materia_prima', 'ralo', 10, { qtd: '188.8', unidade: 'kg', produto: 'FINI' }, 'Jair'));
  l.push(reg('ins_ureia', 'destilaria', 11, { qtd: '20', unidade: 'kg' }, 'Mateus'));
  [[7, '6', '42', '02', 'OK'], [8, '6', '33', '03', ''], [9, '6', '56', '01', '']]
    .forEach((x) => l.push(reg('caldeira', 'caldeira', x[0], { pressao: x[1], temp_agua: x[2], descarga_fundo: x[3], descarga_garrafa: x[4] }, 'Alberto')));
  l.push(reg('caldeira', 'caldeira', 'obs1', { texto: 'DESCARGA DE GARRAFA FEITA AS 07:00' }, 'Alberto'));
  [[7, '107.3', '150', '371', '2', '93.7'], [8, '107.3', '150', '375', '2', '93.7'], [9, '107.3', '180', '800', '2', '93.9']]
    .forEach((x) => l.push(reg('destilaria', 'destilaria', x[0], { temp_pe_a: x[1], producao: x[2], carregamento: x[3], vapor: x[4], inpm: x[5] }, 'Mateus')));
  l.push(reg('med_dornas', 'destilaria', 'sac', { hora: '07:30', sac1_folga: '0.15', sac1_vol: '7229.25', sac1_brix: '18', sac2_folga: '0.2', sac2_vol: '7087.50', sac2_brix: '18', sac4_folga: '0.14', sac4_vol: '7257.60', sac4_brix: '19' }, 'Mateus'));
  l.push(reg('med_dornas', 'destilaria', 'param', { brix_ralo: '18', hora_ralo: '09:30', brix_hid: '18', hora_hid: '09:30' }, 'Mateus'));
  // configuração da usina e avisos: não podem sair pela API
  l.push(Object.assign(reg('config', 'central', 'geral', { operadores: { hidrolise: [{ nome: 'Guilherme', senha: 'segredo-embaralhado' }] }, whatsapp: '14999999999' }, 'escritório'), { id: 'config|sistema|geral', data: 'config', prancheta: 'sistema' }));
  l.push(reg('avisos', 'central', 'a1', { texto: 'AVISO INTERNO', para: 'hidrolise' }, 'escritório'));
  return l;
}

export async function testarApiLeitura(c, grupo, pastaExemplo) {
  const token = () => JSON.parse(fs.readFileSync(path.join(c.pastaServidor, 'config.json'), 'utf8')).tokenLeitura;
  const pedir = async (rota, { senha = token(), metodo = 'GET' } = {}) => {
    const r = await fetch(c.url + rota, { method: metodo, headers: senha ? { Authorization: 'Bearer ' + senha } : {} });
    const texto = await r.text();
    let json = null; try { json = JSON.parse(texto); } catch { /* não é JSON */ }
    return { status: r.status, json, texto };
  };
  const data = diaProducao(1);
  await c.api('/api/sync', { aparelho: 'exemplo', registros: diaDeExemplo(data) });

  await teste(grupo, 'sem a senha de leitura (ou com a senha errada, ou escrevendo) a API recusa', async () => {
    igual((await pedir('/api/v1/esquema', { senha: '' })).status, 401, 'sem senha');
    igual((await pedir('/api/v1/esquema', { senha: 'errada' })).status, 401, 'senha errada');
    igual((await pedir(`/api/v1/dias/${data}`, { metodo: 'POST' })).status, 405, 'escrever');
    certo(/[\w-]{20,}/.test(token() || ''), 'senha de leitura sorteada');
  });
  let dia;
  await teste(grupo, 'o dia inteiro: setores, pranchetas e cada campo com rótulo, valor e unidade', async () => {
    const r = await pedir(`/api/v1/dias/${data}`);
    igual(r.status, 200); dia = r.json;
    igual(dia.data, data);
    const folha = (pid) => dia.setores.flatMap((s) => s.pranchetas).find((p) => p.id === pid);
    const hid = folha('hid_anexo1');
    igual(hid.linhas.length, 6, 'dornas da Hidrólise');
    igual(hid.linhas[0].dorna, 1); igual(hid.linhas[0].etapa, 'anotada'); igual(hid.linhas[5].etapa, 'enviando');
    igual(hid.linhas[0].campos.phf, { rotulo: 'PHF', valor: 3.5 }, 'pH com número');
    igual(hid.linhas[0].campos.cal, { rotulo: 'Cal', valor: 4, unidade: 'copos' }, 'cal com unidade');
    igual(hid.linhas[0].campos.produto.valor, 'FINI'); igual(hid.linhas[0].operador, 'Guilherme');
    const lp = folha('ins_lphera');
    igual(lp.total, [{ quantidade: 350, unidade: 'mL' }], 'total da LPHERA'); igual(lp.linhas[1].hora, '09:00');
    const mp = folha('ins_materia_prima');
    igual(mp.linhas[0].campos.fornecedor.valor, 'COOPERATIVA'); igual(mp.linhas[0].campos.nf.valor, '12345');
    const cal = folha('caldeira');
    igual(cal.linhas.length, 3); igual(cal.linhas[0].campos.pressao, { rotulo: 'Pressão', valor: 6, unidade: 'kgf' }); igual(cal.observacoes[0].texto, 'DESCARGA DE GARRAFA FEITA AS 07:00');
    const med = folha('med_dornas');
    const sac = med.grupos.find((g) => g.id === 'sac');
    igual(sac.subtotal, 21574.35, 'subtotal da Sacarificação'); igual(sac.dornas[0].volume, 7229.25); igual(med.parametros.brix_ralo.valor, 18);
    certo(dia.totais.insumos.some((x) => x.prancheta === 'ins_lphera' && x.quantidade === 350), 'totais dos insumos');
  });
  if (pastaExemplo) { // o dia completo, para mandar ao sistema do escritório
    fs.mkdirSync(pastaExemplo, { recursive: true });
    const salvar = async (nome, rota) => fs.writeFileSync(path.join(pastaExemplo, nome), JSON.stringify((await pedir(rota)).json, null, 2));
    await salvar('exemplo-dia.json', `/api/v1/dias/${data}`);
    await salvar('exemplo-esquema.json', '/api/v1/esquema');
    await salvar('exemplo-registros.json', '/api/v1/registros?desde=0&limite=5');
    await salvar('exemplo-dias.json', '/api/v1/dias');
  }
  await teste(grupo, 'a configuração da usina (senhas, telefone) e os avisos internos não saem', async () => {
    const tudo = JSON.stringify(dia) + (await pedir('/api/v1/registros?desde=0&limite=2000')).texto + (await pedir('/api/v1/esquema')).texto;
    for (const s of ['segredo-embaralhado', '14999999999', 'AVISO INTERNO']) certo(!tudo.includes(s), `"${s}" saiu pela API`);
  });
  await teste(grupo, 'o que mudou depois de um número: em lotes, com as apagadas', async () => {
    const r1 = await pedir('/api/v1/registros?desde=0&limite=10');
    igual(r1.json.registros.length, 10); igual(r1.json.maisDepois, true);
    const r2 = await pedir(`/api/v1/registros?desde=${r1.json.seq}&limite=2000`);
    certo(r2.json.registros.length > 10 && r2.json.maisDepois === false, 'segundo lote');
    certo(r2.json.registros.every((x) => x.seq > r1.json.seq), 'só o que veio depois');
    const um = r1.json.registros.find((x) => x.prancheta === 'hid_anexo1');
    igual(um.campos.phf.rotulo, 'PHF', 'campo com nome');
    // uma anotação apagada chega como apagada
    const apagada = Object.assign({}, diaDeExemplo(data)[0], { apagado: true, atualizadoEm: Date.now() });
    await c.api('/api/sync', { aparelho: 'exemplo', registros: [apagada] });
    const r3 = await pedir(`/api/v1/registros?desde=${r2.json.seq}`);
    certo(r3.json.registros.some((x) => x.id === apagada.id && x.apagado), 'apagada');
  });
  await teste(grupo, 'dias com anotação e o esquema das pranchetas', async () => {
    const r = await pedir('/api/v1/dias');
    certo(r.json.dias.some((d) => d.data === data && d.anotacoes > 30), 'dia na lista');
    const e = (await pedir('/api/v1/esquema')).json;
    const hid = e.setores.find((s) => s.id === 'hidrolise').pranchetas.find((p) => p.id === 'hid_anexo1');
    certo(hid.campos.some((x) => x.id === 'phf' && x.tipo === 'numero' && x.casasDecimais === 1), 'campo do esquema');
    certo(e.setores.find((s) => s.id === 'destilaria').pranchetas.some((p) => p.id === 'med_dornas' && p.grupos.length), 'grupos da medição');
  });
}

if (process.argv[1] && process.argv[1].endsWith('api-leitura.mjs')) {
  const g = novoGrupo('API só de leitura para o sistema do escritório');
  const c = await centralNode(8141);
  try { await testarApiLeitura(c, g, process.env.EXEMPLO); } finally { await c.desligar(); }
  const r = resumo([g]);
  console.log(`\n${r.passaram} de ${r.total} testes passaram${r.falharam ? `, ${r.falharam} falharam` : ''}`);
  process.exitCode = r.falharam ? 1 : 0;
}
