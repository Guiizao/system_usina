/* Versão 3.0 (Fase 9): o banco manda a produção ao Servidor da Usina, com um receptor de teste. Nunca chama o endereço de verdade.
   node testes/usina30.mjs */
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { novoGrupo, teste, certo, igual, resumo } from './teste.mjs';
import { APP } from './servidores.mjs';
import { ligarNuvemSQLite } from './nuvem-sqlite.mjs';

const { carregarUsina } = createRequire(import.meta.url)('../carregar-usina.js');
const SEGREDO = 'segredo-ficticio-usina30', CHAVE = 'chave-ficticia-usina30';
const g = novoGrupo('Servidor da Usina: só a produção, às 07:00 (3.0)');
const n = await ligarNuvemSQLite(8591, SEGREDO, 'token-usina30');
const recebidos = [];
let responder = 200, aoReceber = null;
const receptor = http.createServer((req, res) => {
  const partes = [];
  req.on('data', (b) => partes.push(b));
  req.on('end', async () => { recebidos.push({ chave: req.headers['x-pranchetas-segredo'], corpo: JSON.parse(Buffer.concat(partes).toString('utf8')) }); if (aoReceber) await aoReceber(); res.writeHead(responder); res.end('{}'); });
});
await new Promise((ok) => receptor.listen(8592, '127.0.0.1', ok));
const hora = (dia, h) => Date.parse(`${dia}T${String(h).padStart(2, '0')}:00:00-03:00`);
const reg = (dia, pid, chave, valores, seq) => ({ id: `${dia}|${pid}|${chave}`, data: dia, prancheta: pid, chave: String(chave), valores, operador: 'Alberto', atualizadoEm: hora(dia, 12) + seq, seq, aparelho: 'a' });
const PESSOA = { id: 'p1', nome: 'Fulano de Teste', nivel: 'administrador', ativo: true, funcoes: ['relatorios'] };
let seq = 0;
const mandar = async (...regs) => igual((await n.pedir('/central/enviar', { senha: SEGREDO, corpo: { geracao: 'usina30', registros: regs, pessoas: [PESSOA], forms: carregarUsina(path.join(APP, 'public')) } })).status, 200);
const volta = async (ms) => { recebidos.length = 0; await n.agendado(ms); return recebidos.map((r) => r.corpo.de); };

try {
  await mandar(
    reg('2019-01-01', 'caldeira', 8, { pressao: '2' }, ++seq),
    reg('2020-01-01', 'caldeira', 8, { pressao: '3' }, ++seq),
    reg('2025-01-01', 'caldeira', 8, { pressao: '4' }, ++seq),
    reg('2026-10-20', 'caldeira', 8, { pressao: '4' }, ++seq),
    reg('2026-10-27', 'caldeira', 8, { pressao: '4' }, ++seq),
    reg('2026-10-29', 'caldeira', 8, { pressao: '5' }, ++seq),
    reg('2026-10-30', 'caldeira', 8, { pressao: '6' }, ++seq),
    reg('2026-10-30', 'hid_anexo1', 1, { brix: '19' }, ++seq),
    reg('2026-10-30', 'ins_cal', 9, { qtd: '2' }, ++seq),
    reg('2026-10-30', 'registro', 'x1', { texto: 'Fulano de Teste entrou', em: 1 }, ++seq),
    reg('2026-10-30', 'avisos', 'x2', { texto: 'aviso interno de teste' }, ++seq),
    reg('2026-10-31', 'caldeira', 8, { pressao: '7' }, ++seq));

  await teste(g, 'sem o endereço e a chave nos segredos da nuvem, não manda nada', async () => {
    igual(await volta(hora('2026-10-31', 8)), []);
  });
  n.env.USINA_URL = 'http://exemplo.invalid/producao-receber'; n.env.USINA_CHAVE = CHAVE;
  await teste(g, 'endereço sem https na internet não recebe: a chave iria aberta', async () => {
    igual(await volta(hora('2026-10-31', 8)), []);
    igual(n.consultar('SELECT dia FROM usina_envios').length, 0);
  });
  n.env.USINA_URL = 'http://127.0.0.1:8592/producao-receber';
  await teste(g, 'antes das 07:00 o dia ainda não fechou; às 07:00 vai o dia que fechou', async () => {
    igual(await volta(hora('2026-10-31', 6) + 59 * 60000), ['2026-10-29'], 'às 06:59 do dia 31 o dia 30 ainda está aberto');
    igual(await volta(hora('2026-10-31', 7)), ['2026-10-30'], 'às 07:00 fecha o dia 30; o 31 ainda está aberto');
  });
  await teste(g, 'vai com a chave no cabeçalho, com todas as áreas e os totais', async () => {
    await mandar(reg('2026-10-30', 'ins_lphera', 9, { qtd: '140' }, ++seq));
    await volta(hora('2026-10-31', 7) + 600000);
    const { chave, corpo } = recebidos[0];
    igual(chave, CHAVE);
    // o mesmo formato do envio por turno que o Evandro recebeu: o corpo de /api/v1/totais?dia=, mais turnoEncerrado
    igual([corpo.de, corpo.ate, corpo.dias[0].data], ['2026-10-30', '2026-10-30', '2026-10-30']);
    certo(corpo.total && corpo.total.insumos, 'sem o total do dia');
    igual(corpo.turnoEncerrado, { id: 3, nome: '3º Turno', inicio: 0, fim: 7 });
    const areas = corpo.producao.setores.filter((s) => s.pranchetas.some((p) => p.linhas && p.linhas.length)).map((s) => s.id);
    certo(areas.includes('caldeira') && areas.includes('hidrolise'), 'faltou área: ' + areas);
  });
  await teste(g, 'pessoas, senhas, histórico do sistema e avisos internos nunca vão', async () => {
    const texto = JSON.stringify(recebidos);
    for (const s of ['Fulano de Teste', 'aviso interno de teste', 'funcoes', 'verificador', SEGREDO]) certo(!texto.includes(s), s + ' foi para o Servidor da Usina');
  });
  await teste(g, 'sem mudança, não manda de novo; dia corrigido vai de novo, inteiro', async () => {
    igual(await volta(hora('2026-10-31', 7) + 1200000), []);
    await mandar(reg('2026-10-30', 'caldeira', 8, { pressao: '6.5' }, ++seq));
    igual(await volta(hora('2026-10-31', 7) + 1800000), ['2026-10-30']);
    const p = recebidos[0].corpo.producao.setores.find((s) => s.id === 'hidrolise');
    certo(JSON.stringify(p).includes('19'), 'a correção de um setor tem de levar o dia inteiro');
    certo(JSON.stringify(recebidos[0].corpo.producao).includes('6.5') || JSON.stringify(recebidos[0].corpo.producao).includes('6,5'), 'sem a correção');
  });
  await teste(g, 'o servidor caiu: tenta de novo na próxima volta, e o banco diz o que houve', async () => {
    responder = 500;
    igual(await volta(hora('2026-11-01', 7)), ['2026-10-31']);
    const erro = n.consultar("SELECT ok, status, erro FROM usina_envios WHERE dia = '2026-10-31'")[0];
    igual([erro.ok, erro.status], [0, 500]); certo(/500/.test(erro.erro), erro.erro);
    responder = 200;
    igual(await volta(hora('2026-11-01', 7) + 600000), ['2026-10-31']);
    igual(n.consultar("SELECT ok FROM usina_envios WHERE dia = '2026-10-31'")[0].ok, 1);
  });
  await teste(g, 'sem resposta nenhuma também não perde: fica para a próxima volta', async () => {
    const url = n.env.USINA_URL;
    n.env.USINA_URL = 'http://127.0.0.1:8593/ninguem-aqui';
    await mandar(reg('2026-10-31', 'caldeira', 9, { pressao: '8' }, ++seq));
    await n.agendado(hora('2026-11-01', 8));
    igual(n.consultar("SELECT ok FROM usina_envios WHERE dia = '2026-10-31'")[0].ok, 0);
    n.env.USINA_URL = url;
    igual(await volta(hora('2026-11-01', 8) + 600000), ['2026-10-31']);
  });
  await teste(g, 'primeira carga: dias passados só com USINA_DESDE, sem repetir o que já foi', async () => {
    igual(await volta(hora('2026-11-01', 9)), [], 'o dia 27 não vai sozinho');
    n.env.USINA_DESDE = '2026-10-27';
    igual(await volta(hora('2026-11-01', 9) + 600000), ['2026-10-27']);
    igual(await volta(hora('2026-11-01', 9) + 1200000), []);
  });
  await teste(g, 'correção de dia muito antigo chega mesmo se nunca havia sido enviado', async () => {
    certo(n.consultar("SELECT CAST(valor AS INTEGER) AS seq FROM info WHERE chave = 'usinaSeq'")[0].seq > 0, 'sem cursor após a primeira volta');
    await mandar(reg('2025-01-01', 'caldeira', 8, { pressao: '9' }, ++seq));
    igual(await volta(hora('2026-11-01', 10)), ['2025-01-01']);
    const producao = recebidos[0].corpo.producao;
    certo(JSON.stringify(producao).includes('9'), 'sem a correção antiga');
    igual(await volta(hora('2026-11-01', 10) + 600000), []);
  });
  await teste(g, 'dia que fechou sem nenhuma volta do envio (nuvem parada) ainda vai', async () => {
    // anotado antes de fechar, numa volta de antes das 07:00; a volta seguinte só roda dois dias depois
    await mandar(reg('2026-11-20', 'hid_anexo1', 3, { brix: '15' }, ++seq));
    await volta(hora('2026-11-21', 6));
    certo(!recebidos.some((x) => x.corpo.de === '2026-11-20'), 'ainda não tinha fechado');
    igual(n.consultar("SELECT dia FROM usina_envios WHERE dia = '2026-11-20'"), []);
    await volta(hora('2026-11-22', 8));
    certo(recebidos.some((x) => x.corpo.de === '2026-11-20'), 'o dia ficou para trás: ' + recebidos.map((x) => x.corpo.de));
  });
  await teste(g, 'correção recente ainda não enviada também chega pelo novo seq', async () => {
    await mandar(reg('2026-10-20', 'caldeira', 8, { pressao: '7' }, ++seq));
    igual(await volta(hora('2026-11-01', 10) + 1200000), ['2026-10-20']);
    igual(await volta(hora('2026-11-01', 10) + 1800000), []);
  });
  await teste(g, 'mais de cinco dias antigos: o cursor espera o restante e nenhuma correção some', async () => {
    const cursor = n.consultar("SELECT valor FROM info WHERE chave = 'usinaSeq'")[0].valor;
    const dias = Array.from({ length: 7 }, (_, i) => `2024-01-0${i + 1}`);
    await mandar(...dias.map((dia) => reg(dia, 'caldeira', 8, { pressao: '5' }, ++seq)));
    igual(await volta(hora('2026-11-01', 11)), dias.slice(0, 5));
    igual(n.consultar("SELECT valor FROM info WHERE chave = 'usinaSeq'")[0].valor, cursor, 'avançou deixando dias antigos fora do lote');
    igual(await volta(hora('2026-11-01', 11) + 600000), dias.slice(5));
    igual(Number(n.consultar("SELECT valor FROM info WHERE chave = 'usinaSeq'")[0].valor), n.consultar('SELECT MAX(seq) AS seq FROM registros')[0].seq);
    igual(await volta(hora('2026-11-01', 11) + 1200000), []);
  });
  await teste(g, 'erro em dia de qualquer idade tenta de novo mesmo atrás do cursor', async () => {
    await mandar(reg('2000-01-01', 'caldeira', 8, { pressao: '6' }, ++seq));
    responder = 500;
    igual(await volta(hora('2026-11-01', 12)), ['2000-01-01']);
    const envio = n.consultar("SELECT seq, ok FROM usina_envios WHERE dia = '2000-01-01'")[0];
    igual(envio.ok, 0);
    certo(Number(n.consultar("SELECT valor FROM info WHERE chave = 'usinaSeq'")[0].valor) >= envio.seq, 'teste precisa de erro atrás do cursor');
    responder = 200;
    igual(await volta(hora('2026-11-01', 12) + 600000), ['2000-01-01']);
    igual(n.consultar("SELECT ok FROM usina_envios WHERE dia = '2000-01-01'")[0].ok, 1);
    igual(await volta(hora('2026-11-01', 12) + 1200000), []);
  });
  await teste(g, 'USINA_DESDE abre primeira carga antiga mesmo depois de o cursor avançar', async () => {
    n.env.USINA_DESDE = '2020-01-01';
    igual(await volta(hora('2026-11-01', 13)), ['2020-01-01']);
    igual(n.consultar("SELECT dia FROM usina_envios WHERE dia = '2019-01-01'").length, 0, 'mandou dia anterior à primeira carga');
    igual(await volta(hora('2026-11-01', 13) + 600000), []);
    n.env.USINA_DESDE = '2019-01-01';
    igual(await volta(hora('2026-11-01', 13) + 1200000), ['2019-01-01']);
    igual(await volta(hora('2026-11-01', 13) + 1800000), []);
  });
  await teste(g, 'correção durante o envio fica depois do snapshot e vai na próxima volta', async () => {
    await mandar(reg('2023-02-01', 'caldeira', 8, { pressao: '4' }, ++seq));
    const antes = n.consultar('SELECT MAX(seq) AS seq FROM registros')[0].seq;
    aoReceber = async () => {
      aoReceber = null;
      await mandar(reg('2023-02-01', 'caldeira', 8, { pressao: '8' }, ++seq));
    };
    igual(await volta(hora('2026-11-01', 14)), ['2023-02-01']);
    igual(Number(n.consultar("SELECT valor FROM info WHERE chave = 'usinaSeq'")[0].valor), antes, 'cursor passou da correção que chegou durante o envio');
    igual(await volta(hora('2026-11-01', 14) + 600000), ['2023-02-01']);
    certo(JSON.stringify(recebidos[0].corpo.producao).includes('8'), 'a segunda volta não levou a correção');
    igual(await volta(hora('2026-11-01', 14) + 1200000), []);
  });
  await teste(g, 'correções recentes acima do lote também ficam para a próxima volta', async () => {
    n.env.USINA_DESDE = '2026-10-27';
    igual(await volta(hora('2026-11-01', 14) + 900000), []);
    const dias = Array.from({ length: 7 }, (_, i) => `2026-10-${17 + i}`);
    const cursor = n.consultar("SELECT valor FROM info WHERE chave = 'usinaSeq'")[0].valor;
    await mandar(...dias.map((dia) => reg(dia, 'caldeira', 8, { pressao: '6' }, ++seq)));
    igual(await volta(hora('2026-11-01', 14) + 1800000), dias.slice(0, 5));
    igual(n.consultar("SELECT valor FROM info WHERE chave = 'usinaSeq'")[0].valor, cursor);
    igual(await volta(hora('2026-11-01', 14) + 2400000), dias.slice(5));
    igual(await volta(hora('2026-11-01', 14) + 3000000), []);
  });
  await teste(g, 'volta sem mudança consulta histórico por seq e erros por dia, usando os índices', async () => {
    const consultas = [], preparar = n.env.DB.prepare;
    n.env.DB.prepare = (sql) => {
      const consulta = preparar(sql);
      if (!sql.includes('FROM registros r') && !sql.includes('JOIN registros r')) return consulta;
      return { ...consulta, bind: (...parametros) => { consultas.push({ sql, parametros }); return consulta.bind(...parametros); } };
    };
    try { igual(await volta(hora('2026-11-01', 15)), []); }
    finally { n.env.DB.prepare = preparar; }
    igual(consultas.length, 3);
    const planos = [];
    for (const { sql, parametros } of consultas) {
      const { results } = await preparar('EXPLAIN QUERY PLAN ' + sql).bind(...parametros).all();
      planos.push(results.map((r) => r.detail).join('; '));
    }
    certo(planos.some((p) => /SEARCH r USING INDEX registros_seq/.test(p)), 'sem busca incremental pelo índice de seq: ' + planos.join(' / '));
    certo(planos.every((p) => !/SCAN r(?: |$)/.test(p)), 'varredura de registros: ' + planos.join(' / '));
  });
} finally {
  await new Promise((ok) => { receptor.closeAllConnections(); receptor.close(ok); });
  await n.desligar();
}
const r = resumo([g]);
console.log(`\n${r.passaram} de ${r.total} testes passaram; ${r.falharam} falharam`);
process.exitCode = r.falharam ? 1 : 0;
