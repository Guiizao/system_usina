/* Versão 3.0: o banco é a fonte. node testes/banco30.mjs
 * Roda o Worker real em SQLite (nuvem-sqlite.mjs) e as duas centrais como ponte do Wi-Fi.
 * O que nada pode quebrar: falta de dado não apaga, reenviar não muda nada, mais novo ganha por campo,
 * apagado com hora propaga, e o que veio do banco não volta para ele.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ligarNuvemSQLite } from './nuvem-sqlite.mjs';
import { centralNode, centralJava, APP } from './servidores.mjs';
import { conectarTeste, clienteCifrado } from './cifra.mjs';
import { novoGrupo, teste, certo, igual, resumo } from './teste.mjs';

const { carregarUsina } = createRequire(import.meta.url)('../carregar-usina.js');
const C = carregarUsina(path.join(APP, 'public'));
const g = novoGrupo('Banco 3.0: o banco é a fonte');
const SEGREDO = 'segredo-ficticio-banco30', TOKEN = 'leitura-ficticia-banco30';
const n = await ligarNuvemSQLite(8491, SEGREDO, TOKEN);
const token = (id) => crypto.createHmac('sha256', SEGREDO).update('aparelho|' + id).digest('hex');
const dia = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
let relogio = Date.now() - 3600000;
const reg = (chave, valores, extra = {}) => {
  const em = extra.atualizadoEm || (relogio += 1000);
  return { id: `${dia}|caldeira|${chave}`, data: dia, prancheta: 'caldeira', setor: 'caldeira', chave: String(chave), valores, camposEm: Object.fromEntries(Object.keys(valores).map((k) => [k, em])), criadoEm: em, atualizadoEm: em, apagado: false, ...extra };
};
const banco = (rota, aparelho, corpo, senha) => n.pedir('/banco/' + rota, { aparelho, senha: senha === undefined ? token(aparelho) : senha, corpo });
const syncBanco = (aparelho, registros = [], extra = {}) => banco('api/sync', aparelho, { aparelho, papel: 'caldeira', versao: '3.0.0', registros, ...extra });
const lerBanco = async (aparelho, desde = 0) => (await banco('api/registros?desde=' + desde, aparelho)).json;
const naLinha = (id) => { const l = n.consultar(`SELECT seq, json FROM registros WHERE id = '${id}'`)[0]; return l ? Object.assign(JSON.parse(l.json), { seq: l.seq }) : null; };
const pbkdf = (pin, sal) => crypto.pbkdf2Sync(pin, sal, 1000, 32, 'sha256').toString('hex');
const pessoa = (id, nome, nivel, pin, em = 1, extra = {}) => { const sal = crypto.randomBytes(16).toString('hex'); return { id, nome, nivel, ativo: true, extras: {}, aparelhos: [], em, nuvem: { sal, iteracoes: 1000, verificador: pbkdf(pin, sal) }, ...extra }; };
const sincronia = (corpo) => n.pedir('/central/sincronia', { senha: SEGREDO, corpo });
const limpar = () => { for (const t of ['pendentes', 'registros', 'dias', 'pessoas', 'bloqueios', 'info', 'aparelhos', 'acessos_nuvem', 'liberados_setor', 'tentativas_entrada']) { try { n.consultar(`DELETE FROM ${t}`); } catch (e) { /* tabela de outra versão */ } } };
async function preparar() {
  limpar();
  igual((await n.pedir('/central/enviar', { senha: SEGREDO, corpo: { geracao: 'g30', registros: [], forms: C } })).status, 200);
}
async function esperar(fn, descricao) {
  for (let i = 0; i < 60; i++) { const r = await fn(); if (r) return r; await new Promise((res) => setTimeout(res, 250)); }
  throw new Error('Não aconteceu: ' + descricao);
}

try {
  await preparar();
  await teste(g, 'sem a chave do aparelho o banco não responde', async () => {
    igual((await banco('api/sync', 'a-sem-chave', { registros: [] }, '')).status, 401);
    igual((await banco('api/registros?desde=0', 'a-chave-errada', undefined, token('outro'))).status, 401);
    igual((await n.pedir('/central/novidades?desde=0', { senha: 'errada' })).status, 401);
    igual((await banco('api/dias', 'a-sem-chave', undefined, '')).status, 401);
    igual((await banco('api/dias', 'a-chave-errada', undefined, token('outro'))).status, 401);
  });
  await teste(g, 'dias: lista autenticada, sem limite de idade, decrescente e só com anotações', async () => {
    igual((await banco('api/dias', 'a-dias')).json, { dias: [] });
    const antigo = (data, chave, extra = {}) => reg(chave, { pressao: '6' }, { data, id: `${data}|caldeira|${chave}`, ...extra });
    const a = antigo('2020-01-01', 'a'), b = antigo('2020-01-01', 'b'), c = antigo('2021-01-01', 'c');
    await n.pedir('/central/enviar', { senha: SEGREDO, corpo: { geracao: 'g30', registros: [a, b, c, antigo('2019-01-01', 'apagada', { apagado: true })] } });
    igual((await banco('api/dias', 'a-dias')).json, { dias: ['2021-01-01', '2020-01-01'] });
    await n.pedir('/central/enviar', { senha: SEGREDO, corpo: { geracao: 'g30', registros: [{ ...a, apagado: true, atualizadoEm: (relogio += 1000) }] } });
    igual((await banco('api/dias', 'a-dias')).json.dias, ['2021-01-01', '2020-01-01']);
    await n.pedir('/central/enviar', { senha: SEGREDO, corpo: { geracao: 'g30', registros: [{ ...b, apagado: true, atualizadoEm: (relogio += 1000) }] } });
    igual((await banco('api/dias', 'a-dias')).json.dias, ['2021-01-01']);
    igual((await banco('api/dias', 'a-dias', {})).status, 404, 'dias só aceita GET');
  });
  await teste(g, 'o que um aparelho manda o outro recebe; reenviar não muda nada', async () => {
    const r = reg('um', { pressao: '6' });
    igual((await syncBanco('a-um', [r])).json.aceitos > 0, true);
    const { registros } = await lerBanco('a-dois');
    certo(registros.some((x) => x.id === r.id && x.valores.pressao === '6'), 'o outro aparelho não recebeu');
    const antes = naLinha(r.id).seq, seqAntes = (await lerBanco('a-dois')).seq;
    await syncBanco('a-um', [r]); await syncBanco('a-dois', [r]);
    igual(naLinha(r.id).seq, antes, 'reenvio renumerou');
    igual((await lerBanco('a-dois')).seq >= seqAntes, true);
  });
  await teste(g, 'dois aparelhos na mesma linha: campos diferentes ficam os dois; no mesmo campo vale o mais novo, em qualquer ordem', async () => {
    const em = (relogio += 1000);
    const a = reg('junta', { pressao: '5', vapor: '1' }, { atualizadoEm: em, aparelho: 'a-um' });
    const b = { ...reg('junta', { vapor: '2' }, { atualizadoEm: em + 500, aparelho: 'a-dois' }), criadoEm: em };
    await syncBanco('a-um', [a]); await syncBanco('a-dois', [b]);
    igual(naLinha(a.id).valores, { pressao: '5', vapor: '2' });
    await syncBanco('a-um', [a]); // o mais velho chegando depois não desfaz
    igual(naLinha(a.id).valores, { pressao: '5', vapor: '2' });
  });
  await teste(g, 'apagar propaga, e a cópia velha não ressuscita', async () => {
    const r = reg('apaga', { pressao: '6' });
    await syncBanco('a-um', [r]);
    const apagada = { ...r, apagado: true, atualizadoEm: (relogio += 1000) };
    await syncBanco('a-dois', [apagada]);
    igual(naLinha(r.id).apagado, true);
    const { registros } = await lerBanco('a-um');
    igual(registros.find((x) => x.id === r.id).apagado, true);
    await syncBanco('a-tres', [r]);
    igual(naLinha(r.id).apagado, true, 'a cópia velha voltou');
  });
  await teste(g, 'lista vazia e aparelho sem nada não apagam nada', async () => {
    const antes = n.consultar('SELECT id, seq FROM registros ORDER BY id');
    await syncBanco('a-quatro', []);
    await n.pedir('/central/enviar', { senha: SEGREDO, corpo: { geracao: 'g30', registros: [], pessoas: [] } });
    await sincronia({ pessoas: [], estado: {} });
    const depois = n.consultar('SELECT id, seq FROM registros ORDER BY id').filter((x) => !x.id.includes('|registro|'));
    igual(depois, antes.filter((x) => !x.id.includes('|registro|')));
  });
  await teste(g, 'relógio adiantado não ganha para sempre: a correção de quem está certo vale', async () => {
    const futuro = Date.now() + 2 * 3600000;
    const r = reg('relogio', { pressao: 'errada' }, { atualizadoEm: futuro });
    await syncBanco('a-um', [r]);
    certo(naLinha(r.id).atualizadoEm <= Date.now() + 1000, 'guardou a hora do futuro');
    await new Promise((res) => setTimeout(res, 20));
    const agora = Date.now();
    await syncBanco('a-dois', [reg('relogio', { pressao: 'certa' }, { atualizadoEm: agora })]);
    igual(naLinha(r.id).valores.pressao, 'certa');
  });
  await teste(g, 'a configuração não volta para uma revisão mais velha', async () => {
    const em = (relogio += 1000);
    const nova = { id: 'config|sistema|geral', data: 'config', prancheta: 'sistema', chave: 'geral', valores: { operadores: { caldeira: ['Novo'] } }, atualizadoEm: em, rev: 5 };
    const velha = { ...nova, valores: { operadores: { caldeira: ['Velho'] } }, atualizadoEm: em - 500, rev: 4 };
    await n.pedir('/central/enviar', { senha: SEGREDO, corpo: { geracao: 'g30', registros: [nova] } });
    await n.pedir('/central/enviar', { senha: SEGREDO, corpo: { geracao: 'g30', registros: [velha] } });
    igual(naLinha(nova.id).valores.operadores.caldeira, ['Novo']);
  });
  const dono = pessoa('p-dono', 'Dona Fictícia', 'administrador', '112233', 10);
  const enc = pessoa('p-enc', 'Encarregado Fictício', 'encarregado', '445566', 10);
  await teste(g, 'pessoas, níveis e código sobem; a senha pura e o verificador não ficam guardados', async () => {
    const r = await sincronia({ pessoas: [dono, enc], estado: { donoId: dono.id, aparelhosChefe: { 'a-chefe': { nivel: 2, em: 5 } }, codigo: '123456', chave: 'chave-ficticia-da-rede', codigoEm: 5 } });
    igual(r.status, 200);
    igual(r.json.pessoas.length, 2);
    const guardado = JSON.stringify(n.consultar('SELECT * FROM pessoas')) + JSON.stringify(n.consultar("SELECT * FROM info WHERE chave = 'estado'"));
    certo(!guardado.includes(dono.nuvem.verificador), 'verificador guardado sem selar');
    certo(!guardado.includes('chave-ficticia-da-rede') && !guardado.includes('"123456"'), 'código ou chave guardados sem selar');
  });
  await teste(g, 'entrar: senha errada não entra; a certa entra com as funções dela; inativa não entra mais', async () => {
    const entrar = (pin) => banco('api/pessoas', 'a-chefe', { acao: 'entrar', pin });
    igual((await entrar('999999')).status, 403);
    const ok = await entrar('445566');
    igual(ok.status, 200); igual(ok.json.pessoa.nome, enc.nome);
    certo(Array.isArray(ok.json.funcoes) && ok.json.funcoes.length > 0, 'sem funções na sessão');
    await sincronia({ pessoas: [{ ...enc, ativo: false, em: 20, nuvem: undefined }], estado: {} });
    igual((await entrar('445566')).status, 403);
    await sincronia({ pessoas: [{ ...enc, ativo: true, em: 21 }], estado: {} });
  });
  await teste(g, 'quem não pode é recusado também no banco', async () => {
    const lista = await banco('api/pessoas', 'a-setor', { acao: 'lista' });
    igual(lista.status, 403);
    const aviso = { id: `${dia}|avisos|x`, data: dia, prancheta: 'avisos', chave: 'x', valores: { texto: 'sem permissão' }, atualizadoEm: (relogio += 1000) };
    const r = await syncBanco('a-setor', [aviso]);
    certo(r.json.recusados.some((x) => x.id === aviso.id), 'aviso de quem não pode entrou');
    igual(naLinha(aviso.id), null);
    const config = { id: 'config|sistema|geral', data: 'config', prancheta: 'sistema', chave: 'geral', valores: { niveisChefe: { invadido: true } }, atualizadoEm: (relogio += 1000), base: naLinha('config|sistema|geral').rev };
    const rc = await syncBanco('a-setor', [config]);
    certo(rc.json.recusados.some((x) => x.id === config.id), 'tablet de setor mudou os níveis');
  });
  await teste(g, 'ativar pelo banco: código errado não entra; o certo devolve a chave do aparelho', async () => {
    const ativar = (codigo) => n.pedir('/banco/ativar', { senha: '', corpo: { aparelho: 'a-novo', codigo } });
    igual((await ativar('000000')).status, 403);
    const ok = await ativar('123456');
    igual(ok.status, 200); igual(ok.json.nuvemToken, token('a-novo'));
    certo(/^[a-f0-9]{64}$/.test(ok.json.chave), 'chave da rede não veio');
    igual((await syncBanco('a-novo', [])).status, 200);
  });

  await teste(g, 'zerar: cópia completa e limpeza são atômicas; sem autorização da geração nada muda', async () => {
    const antes = n.consultar('SELECT * FROM registros ORDER BY id');
    const diasAntes = n.consultar('SELECT * FROM dias ORDER BY data');
    certo(antes.some((r) => r.apagado) && antes.some((r) => r.data === 'config'), 'a cópia precisa cobrir apagados e configuração');
    const zerar = (extra = {}) => n.pedir('/central/enviar', { senha: SEGREDO, corpo: { geracao: 'g31', registros: [], ...extra } });
    igual((await zerar()).status, 409);
    igual(n.consultar('SELECT * FROM registros ORDER BY id'), antes);
    igual(n.consultar('SELECT * FROM registros_apagados'), []);
    n.env.DB.prepare("INSERT INTO info (chave, valor) VALUES ('usinaSeq', '9000'), ('usinaDesde', '2020-01-01')").run();
    n.env.DB.prepare("CREATE TRIGGER falha_zerar BEFORE DELETE ON registros BEGIN SELECT RAISE(ABORT, 'falha de teste'); END").run();
    try {
      igual((await zerar({ geracoesZeradas: ['g30'] })).status, 500);
      igual(n.consultar('SELECT * FROM registros ORDER BY id'), antes);
      igual(n.consultar('SELECT * FROM dias ORDER BY data'), diasAntes);
      igual(n.consultar('SELECT * FROM registros_apagados'), [], 'falha deixou cópia parcial');
      igual(n.consultar("SELECT valor FROM info WHERE chave = 'geracao'")[0].valor, 'g30');
      igual(n.consultar("SELECT valor FROM info WHERE chave = 'usinaSeq'")[0].valor, '9000');
    } finally { n.env.DB.prepare('DROP TRIGGER falha_zerar').run(); }
    const inicio = Date.now();
    igual((await zerar({ geracoesZeradas: ['g30'] })).status, 200);
    const copia = n.consultar('SELECT * FROM registros_apagados ORDER BY id');
    igual(copia.map(({ apagado_em, ...r }) => r), antes);
    certo(copia.every((r) => r.apagado_em >= inicio && r.apagado_em <= Date.now()), 'cópia sem a hora do zeramento');
    igual(new Set(copia.map((r) => r.apagado_em)).size, 1);
    igual(n.consultar("SELECT * FROM registros WHERE data <> 'config'"), []);
    certo(n.consultar("SELECT * FROM registros WHERE data = 'config'").length > 0, 'zerar apagou a configuração');
    igual(n.consultar('SELECT * FROM dias'), []);
    igual(n.consultar("SELECT * FROM info WHERE chave IN ('usinaSeq', 'usinaDesde')"), []);
    certo(n.consultar('SELECT * FROM pessoas').length > 0, 'zerar apagou as pessoas');
    // O banco mantém seqBanco crescente; o cursor da usina também foi limpo para um eventual reinício.
    const seq = Number(n.consultar("SELECT valor FROM info WHERE chave = 'seqBanco'")[0].valor);
    const repetida = JSON.parse(antes.find((r) => r.prancheta === 'caldeira' && !r.apagado).json);
    igual((await n.pedir('/central/enviar', { senha: SEGREDO, corpo: { geracao: 'g31', registros: [repetida] } })).status, 200);
    const segunda = n.consultar("SELECT * FROM registros WHERE data <> 'config'")[0];
    certo(segunda.seq > seq, 'seqBanco voltou para trás');
    igual((await n.pedir('/central/enviar', { senha: SEGREDO, corpo: { geracao: 'g32', geracoesZeradas: ['g31'], registros: [] } })).status, 200);
    const configs = antes.filter((r) => r.data === 'config').length; // a configuração fica e vai para a cópia de novo
    igual(n.consultar('SELECT COUNT(*) AS n FROM registros_apagados')[0].n, antes.length + 1 + configs);
    const copiasDaLinha = n.consultar(`SELECT * FROM registros_apagados WHERE id = '${repetida.id}' ORDER BY seq`);
    igual(copiasDaLinha.length, 2, 'novo zeramento sobrescreveu a cópia anterior');
    const { apagado_em, ...guardada } = copiasDaLinha[1];
    igual(guardada, segunda);
  });

  await teste(g, 'sincronia não desfaz o que o dono mudou enquanto ela lia: fica o dele, e a central tenta de novo', async () => {
    const original = n.env.DB.prepare.bind(n.env.DB), doDono = JSON.stringify({ donoId: 'dono-teste', aparelhosChefe: { tablet: { nivel: 2, teto: ['relatorios'], em: 9 } } });
    let mudou = false;
    n.env.DB.prepare = (sql) => {
      if (!mudou && /FROM pessoas/.test(sql)) { mudou = true; original("UPDATE info SET valor = ? WHERE chave = 'estado'").bind(doDono).run(); }
      return original(sql);
    };
    try {
      igual((await n.pedir('/central/sincronia', { senha: SEGREDO, corpo: { estado: {}, pessoas: [] } })).status, 503);
    } finally { n.env.DB.prepare = original; }
    certo(mudou, 'o teste não chegou a mudar o estado');
    igual(n.consultar("SELECT valor FROM info WHERE chave = 'estado'")[0].valor, doDono);
    igual((await n.pedir('/central/sincronia', { senha: SEGREDO, corpo: { estado: {}, pessoas: [] } })).status, 200, 'na volta seguinte passa');
  });

  for (const [nome, ligar, porta] of [['Node', centralNode, 8492], ['Java', centralJava, 8493]]) {
    await preparar();
    const c = await ligar(porta);
    const local = async (id) => ((await c.api('/api/registros?desde=0')).registros || []).find((x) => x.id === id);
    const ciclo = () => c.api('/api/nuvem', { acao: 'enviar' });
    const config = () => JSON.parse(fs.readFileSync(path.join(c.pastaServidor, 'config.json'), 'utf8'));
    try {
      const estado = await c.api('/api/nuvem', { acao: 'configurar', url: n.url, segredo: SEGREDO });
      certo(!estado.erro, estado.erro);
      await c.api('/api/nuvem', { acao: 'forms', forms: C });
      await ciclo();
      await esperar(async () => { await ciclo(); return n.consultar('SELECT id FROM pessoas').length > 0; }, 'pessoas no banco');
      const remoto = await conectarTeste(c.url, c.codigo(), 'ponte-' + nome);
      const syncLocal = (registros) => remoto.pedir('/api/sync', { corpo: { aparelho: remoto.aparelho, papel: 'caldeira', registros } });

      await teste(g, `${nome}: o que chega no banco vai para a central, e o que chega na central vai para o banco`, async () => {
        const noBanco = reg('veio-do-banco-' + nome, { pressao: '1' }), naCentral = reg('veio-da-rede-' + nome, { pressao: '2' });
        await syncBanco('a-fora', [noBanco]); await syncLocal([naCentral]);
        await ciclo();
        const lido = await esperar(async () => { await ciclo(); return local(noBanco.id); }, 'chegar na central');
        igual(lido.valores.pressao, '1');
        certo(naLinha(naCentral.id) && naLinha(naCentral.id).valores.pressao === '2', 'não subiu');
      });
      await teste(g, `${nome}: aparelho 2.18 pela rota antiga continua chegando, pela ponte`, async () => {
        const r = reg('antigo-' + nome, { pressao: '7' });
        igual((await n.pedir('/aparelho/sync', { aparelho: remoto.aparelho, senha: token(remoto.aparelho), corpo: { registros: [r] } })).status, 200);
        await esperar(async () => { await ciclo(); const x = naLinha(r.id); return x && x.valores.pressao === '7'; }, 'a anotação do 2.18 chegar no banco');
      });
      await teste(g, `${nome}: o que veio do banco não volta para ele (nem gasta numeração)`, async () => {
        await ciclo(); await ciclo();
        const antes = n.consultar("SELECT valor FROM info WHERE chave = 'seqBanco'");
        await ciclo(); await ciclo();
        const depois = n.consultar("SELECT valor FROM info WHERE chave = 'seqBanco'");
        const anotacoes = (x) => Number(x[0].valor);
        certo(anotacoes(depois) - anotacoes(antes) <= 1, `numerou ${anotacoes(depois) - anotacoes(antes)} a mais sem ninguém mexer`);
      });
      await teste(g, `${nome}: apagar no banco apaga na central; apagar na rede apaga no banco`, async () => {
        const a = reg('apaga-banco-' + nome, { pressao: '3' }), b = reg('apaga-rede-' + nome, { pressao: '4' });
        await syncBanco('a-fora', [a, b]);
        await esperar(async () => { await ciclo(); return (await local(a.id)) && (await local(b.id)); }, 'as duas na central');
        await syncBanco('a-fora', [{ ...a, apagado: true, atualizadoEm: (relogio += 1000) }]);
        await syncLocal([{ ...b, apagado: true, atualizadoEm: (relogio += 1000) }]);
        await esperar(async () => { await ciclo(); const x = await local(a.id); return x && x.apagado; }, 'apagar na central');
        await esperar(async () => { await ciclo(); const x = naLinha(b.id); return x && x.apagado; }, 'apagar no banco');
      });
      await teste(g, `${nome}: mesma linha nos dois lados: os campos de cada um ficam nos dois`, async () => {
        const em = (relogio += 1000);
        const a = reg('dois-lados-' + nome, { pressao: '8' }, { atualizadoEm: em }), b = reg('dois-lados-' + nome, { vapor: '9' }, { atualizadoEm: em + 100 });
        await syncBanco('a-fora', [a]); await syncLocal([b]);
        await esperar(async () => { await ciclo(); const x = naLinha(a.id), y = await local(a.id); return x && y && x.valores.vapor === '9' && y.valores.pressao === '8'; }, 'juntar nos dois');
      });
      const novaPessoa = pessoa('p-banco-' + nome, 'Veio do Banco ' + nome, 'encarregado', '778899', Date.now());
      await teste(g, `${nome}: pessoa que nasceu no banco chega na central e a senha dela vale lá, sem internet depois`, async () => {
        await sincronia({ pessoas: [novaPessoa], estado: {} });
        await esperar(async () => { await ciclo(); return config().pessoas.some((p) => p.id === novaPessoa.id); }, 'pessoa na central');
        const r = await (await c.cliente()).pedir('/api/pessoas', { corpo: { acao: 'verificar', pin: '778899' } });
        igual(r.status, 200, JSON.stringify(r.json)); igual(r.json.pessoa.nome, novaPessoa.nome);
        const guardada = config().pessoas.find((p) => p.id === novaPessoa.id);
        certo(guardada.resumo, 'central não guardou o resumo para quando faltar internet');
        igual((await (await c.cliente()).pedir('/api/pessoas', { corpo: { acao: 'verificar', pin: '111999' } })).status, 403);
      });
      await teste(g, `${nome}: desativar no banco tira o acesso na central`, async () => {
        await sincronia({ pessoas: [{ ...novaPessoa, ativo: false, em: Date.now() + 1, nuvem: undefined }], estado: {} });
        await esperar(async () => { await ciclo(); const p = config().pessoas.find((x) => x.id === novaPessoa.id); return p && p.ativo === false; }, 'desativar na central');
        igual((await (await c.cliente()).pedir('/api/pessoas', { corpo: { acao: 'verificar', pin: '778899' } })).status, 403);
      });
      await teste(g, `${nome}: a senha nova e o nível dados na central sobem com a hora, e o banco não perde o resto`, async () => {
        const antes = (await c.api('/api/pessoas', { acao: 'lista' })).pessoas.find((p) => p.nome === 'Guilherme');
        const r = await c.api('/api/pessoas', { acao: 'salvar', pessoa: { id: antes.id, nome: antes.nome, nivel: antes.nivel, extras: antes.extras, aparelhos: antes.aparelhos, ativo: true, pin: '778811' } });
        certo(!r.erro, r.erro);
        await esperar(async () => {
          await ciclo();
          const l = n.consultar(`SELECT json FROM pessoas WHERE id = '${antes.id}'`)[0];
          return l && JSON.parse(l.json).em > 0;
        }, 'hora da pessoa no banco');
        const a = await banco('api/pessoas', 'a-chefe-2', { acao: 'verificar', pin: '778811' });
        igual(a.status, 200, 'a senha nova não vale no banco'); igual(a.json.pessoa.id, antes.id);
        certo(n.consultar('SELECT id FROM pessoas').some((p) => p.id === novaPessoa.id), 'a pessoa do banco sumiu');
      });
      await teste(g, `${nome}: aparelho ativado pelo banco, quando chega no Wi-Fi, fala com a central com a mesma chave`, async () => {
        await esperar(async () => { await ciclo(); return (await n.pedir('/banco/ativar', { senha: '', corpo: { aparelho: 'a-fora-de-casa', codigo: c.codigo() } })).status === 200; }, 'o código chegar no banco');
        const a = await n.pedir('/banco/ativar', { senha: '', corpo: { aparelho: 'a-fora-de-casa', codigo: c.codigo() } });
        const cli = clienteCifrado(c.url, 'a-fora-de-casa', a.json.chave);
        const r = await cli.pedir('/api/sync', { corpo: { aparelho: 'a-fora-de-casa', papel: 'caldeira', registros: [] } });
        igual(r.status, 200, 'a central não reconheceu a chave dada pelo banco');
      });
      await teste(g, `${nome}: central zerada que volta adota o banco e não apaga os dados de ninguém`, async () => {
        const antes = n.consultar("SELECT id FROM registros WHERE prancheta = 'caldeira'").length;
        const outra = await ligar(porta + 10);
        try {
          await outra.api('/api/nuvem', { acao: 'configurar', url: n.url, segredo: SEGREDO });
          await esperar(async () => { await outra.api('/api/nuvem', { acao: 'enviar' }).catch(() => null); return JSON.parse(fs.readFileSync(path.join(outra.pastaServidor, 'config.json'), 'utf8')).geracao === 'g30'; }, 'adotar a geração');
          igual(n.consultar("SELECT valor FROM info WHERE chave = 'geracao'")[0].valor, 'g30');
          certo(n.consultar("SELECT id FROM registros WHERE prancheta = 'caldeira'").length >= antes, 'o banco perdeu anotações');
        } finally { await outra.desligar(); }
      });
    } finally { await c.desligar(); }
  }
} finally {
  await n.desligar();
}
const r = resumo([g]);
console.log(`\n${r.passaram} de ${r.total} testes passaram; ${r.falharam} falharam`);
process.exitCode = r.falharam ? 1 : 0;
