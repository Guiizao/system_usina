/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * O que acontece com o tempo e nas horas difíceis (revisão da versão 2.3):
 *   - 90 dias de uso: a memória do tablet não enche (antes enchia em uns 2 meses e o tablet parava de salvar);
 *   - dias com mais de 60 dias saem da memória da central e continuam no BackupUsina;
 *   - troca de turno e virada das 07:00 no meio da anotação: nada se perde e vai para o dia certo;
 *   - "Terminou a Nº X" não perde o que estava sendo anotado em outra dorna;
 *   - LPHERA confirmada volta para conferir quando entra outra dorna na mesma hora;
 *   - tablet chefe trocado ou reinstalado: os tablets mandam de novo o que têm;
 *   - aparelho muito tempo sem Wi-Fi manda tudo, em lotes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { TAMANHOS, dormir } from './navegador.mjs';
import { teste, certo, igual } from './teste.mjs';
import { pastaTemporaria } from './servidores.mjs';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const diasAtras = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

/** Um dia inteiro da usina, como no uso de verdade (217 anotações, uns 88 KB). */
export function diaDaUsina(data, aparelho = 'semeado') {
  const t = Date.now() - 3600000;
  const reg = (pid, setor, chave, valores, extra = {}) => ({ id: `${data}|${pid}|${chave}`, data, prancheta: pid, setor, chave: String(chave), valores, criadoEm: t, atualizadoEm: t, aparelho, apagado: false, operador: 'Guilherme', ...extra });
  const l = [];
  for (let n = 1; n <= 22; n++) {
    l.push(reg('hid_anexo1', 'hidrolise', n, { inicio: '08:43', fim: '09:00', phf: '5.1', cal: '2', brix: '20', phf2: '5.2', enzi: '70', bhx: '19', produto: 'MASSA' }));
    l.push(reg('hid_anexo2', 'hidrolise', n, { horario: '08:43', sac: '4', phf: '5.2', bhx: '19', enz: '100', anti: '100' }, { manuais: [] }));
  }
  for (const pid of ['ins_lphera', 'ins_cal', 'ins_saczyme', 'ins_alcolina']) for (let h = 0; h < 18; h++) l.push(reg(pid, 'hidrolise', h, { qtd: '140', unidade: 'mL' }, { auto: false, conferir: false }));
  for (let h = 0; h < 24; h++) {
    l.push(reg('caldeira', 'caldeira', h, { pressao: '6', temp_agua: '42', descarga_fundo: '02', descarga_garrafa: 'OK' }, { operador: 'Alberto' }));
    l.push(reg('destilaria', 'destilaria', h, { temp_pe_a: '107.3', producao: '150', carregamento: '371', vapor: '2', inpm: '93.7' }, { operador: 'Mateus' }));
    l.push(reg('nova_destilaria', 'nova_destilaria', h, { coluna_hidro: '90.1', coluna_b: '80', coluna_p: '70', cond_hidro: '40', cond_b: '41', cond_p: '42', vapor: '2', producao_lth: '300', inpm: '93' }, { operador: 'Operador 1' }));
  }
  for (let h = 0; h < 20; h++) l.push(reg('ins_materia_prima', 'ralo', h, { qtd: '160', unidade: 'kg', produto: 'MASSA' }, { operador: 'Jair' }));
  for (let t2 = 1; t2 <= 3; t2++) for (const pid of ['caldeira', 'destilaria', 'nova_destilaria']) l.push(reg(pid, pid, 'obs' + t2, { texto: 'TUDO NORMAL NO TURNO' }));
  return l;
}

/** Testes direto na central (sem navegador). ligar(porta, pasta) liga a central; roda nas duas. */
export async function testarRobustezCentral(ligar, porta, grupo) {
  let c = await ligar(porta);
  const pedir = async (rota, corpo) => {
    const r = await fetch(c.url + rota, { method: corpo ? 'POST' : 'GET', headers: { 'X-Chave': c.chave(), 'Content-Type': 'application/json' }, body: corpo ? JSON.stringify(corpo) : undefined });
    return r.json();
  };
  const reg = (data, pid, chave, valores, extra = {}) => ({ id: `${data}|${pid}|${chave}`, data, prancheta: pid, setor: 'caldeira', chave: String(chave), valores, criadoEm: Date.now(), atualizadoEm: Date.now(), aparelho: 'teste', apagado: false, operador: 'Teste', ...extra });
  try {
    await teste(grupo, 'cada aparelho recebe só os dias que guarda (configuração e avisos vão sempre)', async () => {
      await pedir('/api/sync', { aparelho: 't1', registros: [
        reg(diasAtras(0), 'caldeira', 9, { pressao: '6' }), reg(diasAtras(5), 'caldeira', 9, { pressao: '7' }),
        reg('config', 'sistema', 'geral', { whatsapp: '14999999999' }), reg(diasAtras(10), 'avisos', 'a1', { texto: 'Passe no escritório.' }),
      ] });
      const lista = (await pedir(`/api/registros?desde=0&aPartirDe=${diasAtras(2)}`)).registros;
      const tem = (d, pid) => lista.some((r) => r.data === d && r.prancheta === pid);
      certo(tem(diasAtras(0), 'caldeira'), 'faltou o dia de hoje');
      certo(!tem(diasAtras(5), 'caldeira'), 'mandou um dia que o aparelho não guarda');
      certo(tem('config', 'sistema'), 'faltou a configuração da usina');
      certo(tem(diasAtras(10), 'avisos'), 'faltou o aviso');
      const semFiltro = (await pedir('/api/registros?desde=0')).registros;
      certo(semFiltro.some((r) => r.data === diasAtras(5)), 'aparelho antigo (sem o filtro) deixou de receber tudo');
    });
    await teste(grupo, 'o tablet chefe busca um dia inteiro que não guarda mais', async () => {
      const lista = (await pedir(`/api/registros?dia=${diasAtras(5)}`)).registros;
      igual(lista.map((r) => r.valores.pressao), ['7'], 'dia 5 atrás');
    });
    await teste(grupo, 'dia com mais de 60 dias vai direto para o BackupUsina e volta quando o tablet chefe abre', async () => {
      const velho = diasAtras(90);
      const r = await pedir('/api/sync', { aparelho: 't1', registros: [reg(velho, 'caldeira', 8, { pressao: '5' }), reg(velho, 'caldeira', 9, { pressao: '5.5' })] });
      igual(r.aceitos, 2, 'aceitos');
      certo(!(await pedir('/api/registros?desde=0')).registros.some((x) => x.data === velho), 'dia antigo ficou na memória da central');
      certo(fs.existsSync(path.join(c.pastaBackup, `${velho}.json`)), 'sem o arquivo do dia no BackupUsina');
      await pedir('/api/sync', { aparelho: 't1', registros: [Object.assign(reg(velho, 'caldeira', 9, { pressao: '6.5' }), { atualizadoEm: Date.now() + 1000 })] });
      const lista = (await pedir(`/api/registros?dia=${velho}`)).registros;
      igual(lista.length, 2, 'anotações do dia antigo');
      igual(lista.find((x) => x.chave === '9').valores.pressao, '6.5', 'correção do dia antigo');
    });
    await teste(grupo, 'ao ligar, a central tira da memória os dias antigos e eles continuam no BackupUsina', async () => {
      await dormir(900); // a central do computador grava no disco meio segundo depois
      await c.desligar();
      const arquivo = path.join(c.pastaServidor, 'registros.json');
      const db = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
      const velho = diasAtras(75);
      db.seq += 1;
      db.registros[`${velho}|destilaria|10`] = Object.assign(reg(velho, 'destilaria', 10, { inpm: '93.1' }), { seq: db.seq });
      fs.writeFileSync(arquivo, JSON.stringify(db));
      c = await ligar(porta, c.pasta);
      certo(!(await pedir('/api/registros?desde=0')).registros.some((x) => x.data === velho), 'o dia antigo continuou na memória');
      const lista = (await pedir(`/api/registros?dia=${velho}`)).registros;
      igual(lista.map((x) => x.valores.inpm), ['93.1'], 'dia antigo lido do BackupUsina');
    });
    let geracao = '';
    await teste(grupo, 'tablet chefe trocado: a central nova aceita o que o aparelho tem (só logo depois de conectar)', async () => {
      geracao = (await pedir('/api/sync', { aparelho: 't1', registros: [] })).geracao;
      const semConectar = await pedir('/api/sync', { aparelho: 't2', geracao: 'de-outra-central', registros: [reg(diasAtras(0), 'caldeira', 11, { pressao: '6' })] });
      certo(semConectar.zerar === true, 'aparelho de outra geração sem reconectar não foi mandado limpar');
      const conectado = await pedir('/api/sync', { aparelho: 't2', geracao: 'de-outra-central', novaConexao: true, registros: [reg(diasAtras(0), 'caldeira', 11, { pressao: '6' })] });
      certo(conectado.ok && conectado.aceitos === 1, 'a central nova recusou as anotações do aparelho: ' + JSON.stringify(conectado));
    });
    await teste(grupo, 'depois de zerar, a geração antiga é mandada limpar mesmo reconectando; os arquivos dos dias vão para uma pasta', async () => {
      const z = await pedir('/api/zerar', { confirmar: 'ZERAR' });
      certo(z.ok, 'não zerou');
      const r = await pedir('/api/sync', { aparelho: 't3', geracao, novaConexao: true, registros: [reg(diasAtras(0), 'caldeira', 12, { pressao: '6' })] });
      certo(r.zerar === true, 'aceitou anotações de antes de zerar');
      const soltos = fs.readdirSync(c.pastaBackup).filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n));
      igual(soltos, [], 'arquivos de dias que ficaram soltos no BackupUsina');
      certo(fs.readdirSync(c.pastaBackup).some((n) => n.startsWith('antes-de-zerar-') && fs.statSync(path.join(c.pastaBackup, n)).isDirectory()), 'sem a pasta com os dias de antes de zerar');
      igual((await pedir(`/api/registros?dia=${diasAtras(90)}`)).registros, [], 'dia antigo voltou depois de zerar');
    });
    await teste(grupo, '90 dias de anotações da usina inteira: a central aceita e continua rápida', async () => {
      const tudo = [];
      for (let n = 89; n >= 0; n--) tudo.push(...diaDaUsina(diasAtras(n)));
      const t0 = Date.now();
      for (let i = 0; i < tudo.length; i += 1500) {
        const r = await pedir('/api/sync', { aparelho: 'semeador', registros: tudo.slice(i, i + 1500) });
        certo(r.ok, 'lote recusado');
      }
      const tEnvio = Date.now() - t0;
      const t1 = Date.now();
      const setor = (await pedir(`/api/registros?desde=0&aPartirDe=${diasAtras(2)}`)).registros;
      const tSetor = Date.now() - t1;
      const t2 = Date.now();
      const antigo = (await pedir(`/api/registros?dia=${diasAtras(80)}`)).registros;
      const tAntigo = Date.now() - t2;
      certo(setor.length < 1000, `tablet do setor receberia ${setor.length} anotações`);
      igual(antigo.length, 217, 'dia de 80 dias atrás');
      certo(tSetor < 3000 && tAntigo < 3000, `lento: setor ${tSetor} ms, dia antigo ${tAntigo} ms`);
      return `${tudo.length} anotações em ${(tEnvio / 1000).toFixed(1)} s; tablet do setor recebe ${setor.length} (${tSetor} ms); dia antigo ${tAntigo} ms`;
    });
  } finally { await c.desligar(); }
}

/** Testes com aparelhos virtuais. */
export async function testarRobustezAparelhos(nav, ligar, porta, grupo) {
  let c = await ligar(porta);
  const api = async (rota, corpo) => (await fetch(c.url + rota, { method: corpo ? 'POST' : 'GET', headers: { 'X-Chave': c.chave(), 'Content-Type': 'application/json' }, body: corpo ? JSON.stringify(corpo) : undefined })).json();
  const regs = async () => (await api('/api/registros?desde=0')).registros.filter((r) => !r.apagado);
  const esperarCentral = async (filtro, descricao, ms = 30000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const r = filtro(await regs());
      if (r) return r;
      await dormir(800);
    }
    throw new Error(`não aconteceu na central em ${ms / 1000}s: ${descricao}`);
  };
  const aparelhos = [];
  async function novo(nome, tamanho, relogio) {
    const a = await nav.novoAparelho(nome, tamanho);
    if (relogio) await a.relogioFalso();
    aparelhos.push(a);
    return a;
  }
  async function conectar(a, papel) {
    await a.ir(c.url + '/', 'document.querySelector("[data-quadro=\\"codigo\\"]")');
    await a.tocar('[data-quadro="codigo"]');
    await a.teclar(c.codigo().split(''));
    await a.tocar('[data-ed="ocultar"]');
    await a.tocar('[data-a="conectar"]');
    await a.tocar(`[data-a="papel"][data-id="${papel}"]`, null, { esperarMs: 15000 });
  }
  const tamanhoGuardado = (a) => a.avaliar('(localStorage.getItem("usina.registros") || "").length');
  const diasGuardados = (a) => a.avaliar('[...new Set(Object.values(JSON.parse(localStorage.getItem("usina.registros") || "{}")).map((r) => r.data))].sort()');
  async function anotar(a, campo, teclas) { await a.tocar(`[data-quadro="${campo}"]`); await a.teclar(teclas); }
  // dorna nova: no dia vazio a "Nova Nº 1" já vem aberta
  async function dornaNova(a) { if (await a.existe('.seletor button.nova')) await a.tocar('.seletor button.nova'); }

  try {
    await teste(grupo, 'central com 90 dias de uso: preparar', async () => {
      const tudo = [];
      for (let n = 89; n >= 1; n--) tudo.push(...diaDaUsina(diasAtras(n)));
      for (let i = 0; i < tudo.length; i += 1500) certo((await api('/api/sync', { aparelho: 'semeador', registros: tudo.slice(i, i + 1500) })).ok, 'lote recusado');
      return `${tudo.length} anotações de 89 dias`;
    });

    const tab = await novo('tablet Hidrólise', TAMANHOS.tablet);
    await teste(grupo, '90 dias de uso: o tablet do setor guarda só os últimos dias e continua salvando', async () => {
      await conectar(tab, 'hidrolise');
      await tab.tocar('[data-a="escolher-operador"][data-nome="Felipe"]');
      await tab.esperar('JSON.parse(localStorage.getItem("usina.cfg") || "{}").ultimoSeq > 0', 20000, 'primeira sincronização');
      const tamanho = await tamanhoGuardado(tab);
      const dias = (await diasGuardados(tab)).filter((d) => d !== 'config');
      certo(tamanho < 600000, `o tablet guardou ${tamanho} letras (a memória aguenta uns 5 milhões)`);
      certo(dias.every((d) => d >= diasAtras(4)), 'guardou dias antigos: ' + dias.slice(0, 3).join(', '));
      certo(dias.includes(diasAtras(1)), 'não conseguiu guardar nem os dias recentes (memória cheia?)');
      await tab.tocar('[data-a="abrir-prancheta"][data-id="hid_anexo1"]');
      await anotar(tab, 'brix', ['1', '6']);
      await tab.tocar('[data-ed="ocultar"]');
      await tab.tocar('[data-a="salvar"]');
      await esperarCentral((l) => l.some((r) => r.prancheta === 'hid_anexo1' && r.valores.brix === '16' && r.operador === 'Felipe'), 'dorna salva pelo tablet');
      return `${Math.round(tamanho / 1000)} mil letras guardadas (${dias.length} dia(s))`;
    });

    const esc = await novo('escritório', TAMANHOS.computador);
    await teste(grupo, '90 dias de uso: o tablet chefe guarda 20 dias e busca na central um dia antigo', async () => {
      await conectar(esc, 'central');
      await esc.esperar('JSON.parse(localStorage.getItem("usina.cfg") || "{}").ultimoSeq > 0', 30000, 'primeira sincronização');
      const tamanho = await tamanhoGuardado(esc);
      certo(tamanho < 2600000, `o tablet chefe guardou ${tamanho} letras`);
      const dias = (await diasGuardados(esc)).filter((d) => d !== 'config');
      certo(dias.every((d) => d >= diasAtras(22)), 'guardou dias demais');
      certo(dias.includes(diasAtras(10)) && dias.includes(diasAtras(18)), 'não guardou os últimos 20 dias: ' + dias.length + ' dia(s)');
      for (let i = 0; i < 40; i++) await esc.tocar('[data-a="dia"][data-n="-1"]');
      await esc.esperar('Number(document.querySelector(".numeros b").textContent) > 200', 20000, 'anotações do dia de 40 dias atrás');
      const n = await esc.avaliar('document.querySelector(".numeros b").textContent');
      return `${Math.round(tamanho / 1000)} mil letras guardadas; dia de 40 dias atrás com ${n} anotações`;
    });
    await esc.fechar();

    const rel = await novo('tablet com relógio adiantado', TAMANHOS.tablet, true);
    let folhaDaVirada = '';
    await teste(grupo, 'troca de turno no meio da anotação: salva no nome de quem anotou', async () => {
      await conectar(rel, 'hidrolise');
      await rel.irParaHora(15, 58, 0);
      await dormir(1500);
      await rel.tocar('[data-a="escolher-operador"][data-nome="Carlindo"]');
      await rel.tocar('[data-a="abrir-prancheta"][data-id="hid_anexo1"]');
      await dornaNova(rel);
      await anotar(rel, 'brix', ['1', '7']);
      await rel.irParaHora(16, 0, 5);
      await dormir(1500);
      await rel.tocar('[data-a="salvar"]');
      await esperarCentral((l) => l.some((r) => r.prancheta === 'hid_anexo1' && r.valores.brix === '17' && r.operador === 'Carlindo'), 'dorna do turno anterior salva no nome de Carlindo');
      certo(await rel.existe('.opcoes.nomes'), 'não pediu o nome do novo turno');
    });
    await teste(grupo, 'virada das 07:00 no meio da anotação: vai para a folha do dia que estava aberta', async () => {
      await rel.irParaHora(6, 58, 0);
      await dormir(1500);
      await rel.tocar('[data-a="escolher-operador"][data-nome="Cleber"]');
      await rel.tocar('[data-a="abrir-prancheta"][data-id="hid_anexo1"]');
      folhaDaVirada = await rel.avaliar('(document.getElementById("subtitulo-topo") || {}).textContent || ""');
      const [dd, mm, aaaa] = (folhaDaVirada.match(/(\d\d)\/(\d\d)\/(\d{4})/) || []).slice(1);
      certo(dd, 'não achei a data da folha: ' + folhaDaVirada);
      await dornaNova(rel);
      await anotar(rel, 'brix', ['2', '3']);
      await rel.irParaHora(7, 0, 5);
      await dormir(2500);
      await esperarCentral((l) => l.some((r) => r.prancheta === 'hid_anexo1' && r.valores.brix === '23' && r.data === `${aaaa}-${mm}-${dd}` && r.operador === 'Cleber'), `dorna salva na folha de ${dd}/${mm}`);
      certo(await rel.existe('.opcoes.nomes'), 'não pediu o nome depois da virada');
      return `folha de ${dd}/${mm}/${aaaa}`;
    });
    await teste(grupo, '"Terminou a Nº 1" não perde o que estava sendo anotado na dorna 2', async () => {
      await rel.irParaHora(10, 10, 0);
      await dormir(1200);
      await rel.tocar('[data-a="escolher-operador"][data-nome="Romenique"]');
      await rel.tocar('[data-a="abrir-prancheta"][data-id="hid_anexo1"]');
      await anotar(rel, 'brix', ['1', '9']);
      await rel.tocar('[data-ed="ocultar"]');
      await rel.tocar('[data-a="enviar-dorna"]');
      await dornaNova(rel);
      await anotar(rel, 'brix', ['2', '0']);
      await rel.tocar('[data-a="terminar-dorna"][data-chave="1"]');
      const dia = await rel.avaliar('(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })()');
      await esperarCentral((l) => {
        const um = (n) => l.find((r) => r.id === `${dia}|hid_anexo1|${n}`);
        return um(1) && um(1).valores.fim === '10:10' && um(2) && um(2).valores.brix === '20';
      }, 'fim da dorna 1 e o Brix 20 da dorna 2');
    });
    await teste(grupo, 'LPHERA confirmada volta para conferir quando outra dorna é enviada na mesma hora', async () => {
      const dia = await rel.avaliar('(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })()');
      const lph = (l) => l.find((r) => r.id === `${dia}|ins_lphera|10`);
      await esperarCentral((l) => lph(l) && lph(l).valores.qtd === '70' && lph(l).conferir, 'LPHERA das 10h somada (70)');
      await rel.tocar('[data-a="aba"][data-id="juntas_lphera_cal"]');
      await rel.tocar('[data-a="linha"][data-chave="10"]');
      await rel.tocar('[data-a="salvar"]', 'Confirmar');
      await esperarCentral((l) => lph(l) && !lph(l).conferir && lph(l).somaConfirmada, 'LPHERA confirmada');
      await rel.tocar('[data-a="aba"][data-id="hid_anexo1"]');
      await rel.tocar('[data-a="linha"][data-chave="2"]');
      await rel.tocar('[data-a="enviar-dorna"]');
      await esperarCentral((l) => lph(l) && lph(l).valores.qtd === '140' && lph(l).conferir, 'LPHERA das 10h volta para conferir com 140');
    });
    await rel.fechar();

    await teste(grupo, 'tablet chefe trocado: o tablet do setor conecta na central nova e manda o que tinha', async () => {
      await dormir(900);
      const antigos = (await regs()).filter((r) => r.data >= diasAtras(1) && r.data !== 'config').length;
      await c.desligar();
      c = await ligar(porta, pastaTemporaria('nova-central'));
      await tab.esperar('document.querySelector("[data-quadro=\\"codigo\\"]")', 30000, 'o tablet pedir o código da central nova');
      await tab.tocar('[data-quadro="codigo"]');
      await tab.teclar(c.codigo().split(''));
      await tab.tocar('[data-ed="ocultar"]');
      await tab.tocar('[data-a="conectar"]');
      const lista = await esperarCentral((l) => l.some((r) => r.valores && r.valores.brix === '16' && r.operador === 'Felipe') && l, 'a dorna que o tablet salvou chegou na central nova', 40000);
      const chegaram = lista.filter((r) => r.data >= diasAtras(1) && r.data !== 'config').length;
      certo(chegaram >= Math.min(antigos, 200), `só chegaram ${chegaram} de ${antigos} anotações`);
      return `${chegaram} anotações de volta na central nova`;
    });
    await teste(grupo, 'aparelho com 700 anotações guardadas sem Wi-Fi manda tudo, em lotes, e depois tira as antigas da memória', async () => {
      const velho = diasAtras(10);
      await tab.avaliar(`(() => {
        const regs = JSON.parse(localStorage.getItem('usina.registros') || '{}');
        const t = Date.now();
        for (let i = 0; i < 700; i++) {
          const id = '${velho}|ins_materia_prima|x' + i;
          regs[id] = { id, data: '${velho}', prancheta: 'ins_materia_prima', setor: 'ralo', chave: 'x' + i, valores: { qtd: String(i) }, criadoEm: t, atualizadoEm: t, aparelho: 'ap-teste', apagado: false, sincronizado: false, operador: 'Jair' };
        }
        localStorage.setItem('usina.registros', JSON.stringify(regs));
        location.reload(); // na mesma hora, antes de o app gravar a memória de novo
      })()`);
      await dormir(800);
      await tab.esperar('document.readyState === "complete" && document.querySelector("#app header")', 20000, 'recarregar');
      await esperarCentral((l) => l.filter((r) => r.data === velho && r.prancheta === 'ins_materia_prima').length === 700, '700 anotações na central', 60000);
      await tab.recarregar();
      await tab.esperar(`!Object.values(JSON.parse(localStorage.getItem('usina.registros') || '{}')).some((r) => r.data === '${velho}')`, 20000, 'tirar da memória as antigas já enviadas');
    });
    await teste(grupo, 'nenhum erro de JavaScript', async () => {
      const erros = aparelhos.flatMap((a) => a.erros.map((e) => `${a.nome}: ${e}`));
      certo(!erros.length, erros.join(' | ').slice(0, 500));
    });
  } finally {
    for (const a of aparelhos) await a.fechar().catch(() => {});
    await c.desligar();
  }
}
