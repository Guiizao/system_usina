/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * Versão 2.13.4: turnos de cada setor (3 turnos ou 2 de 12 horas, 7h às 19h e 19h às 7h).
 *   - papel: Nova Destilaria e Caldeira com 12 horas ficam com 2 blocos de turno, e o das 19h às 7h pega a madrugada;
 *   - API: o turno de cada linha é o do setor dela;
 *   - aparelho do setor: às 19h o turno vira, o nome de quem anotava sai e o lembrete para;
 *   - Monitorar no tablet chefe: dois blocos, 07:00 às 19:00 e 19:00 às 07:00.
 */
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { teste, certo, igual, usinaNoContexto, caminhoNovo } from './teste.mjs';
import { TAMANHOS, dormir } from './navegador.mjs';

const require = createRequire(import.meta.url);
const DIA = '2026-10-07';
const fonte = (nome) => fs.readFileSync(new URL('../public/' + caminhoNovo(nome), import.meta.url), 'utf8');
function forms() {
  const c = { window: {} };
  usinaNoContexto(c);
  return Object.assign(JSON.parse(JSON.stringify(c.window.USINA)), { turnosSetor: { nova_destilaria: '12h', caldeira: '12h' } });
}
const reg = (prancheta, chave, valores, operador) => ({ id: `${DIA}|${prancheta}|${chave}`, data: DIA, prancheta, chave, valores, operador, atualizadoEm: 1 });
// 08h e 18h no 1º turno (Ana); 19h, 23h e 03h no 2º turno (Beto)
const REGS = [8, 18, 19, 23, 3].flatMap((h) => ['nova_destilaria', 'caldeira'].map((pid) => reg(pid, String(h), {}, h >= 7 && h < 19 ? 'Ana' : 'Beto')))
  .concat([reg('nova_destilaria', 'obs2', { texto: 'Troca de filtro de madrugada' }, 'Beto')]);

export async function testarTurnos213(nav, url, grupo) {
  const C = forms();

  await teste(grupo, 'papel com 2 turnos de 12 horas: dois blocos, e o da noite pega a madrugada', async () => {
    const window = {}, c = { window, TextEncoder, Blob };
    vm.runInNewContext(fonte('modelos.js'), c);
    const listar = (data, pid) => REGS.filter((r) => r.data === data && r.prancheta === pid);
    const papel = window.ModelosPapel.montar({
      C, prancheta: (pid) => C.pranchetas[pid], listar, pegar: (data, pid, chave) => listar(data, pid).find((r) => r.chave === chave),
      setorDaPrancheta: () => null, turnos: (pid) => (C.turnosSetor[pid] === '12h' ? C.turnos12h : C.turnos),
      fmtNum: String, fmtData: (d) => d.split('-').reverse().join('/'), rotuloHoraPapel: String,
      HORAS: [...Array(24).keys()].map((i) => (i + 7) % 24), linhasDeHora: (regs) => regs.filter((r) => /^\d+$/.test(r.chave)),
      somarDias: (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10),
    });
    const textos = (pid) => Object.values(papel.folha(pid, DIA).grade.cel).map((x) => String(x.v));
    const nova = textos('nova_destilaria');
    certo(nova.includes('1° TURNO: Ana') && nova.includes('2° TURNO: Beto'), 'blocos da Nova Destilaria: ' + nova.filter((t) => /TURNO/.test(t)).join(' | '));
    certo(!nova.some((t) => /3° TURNO/.test(t)), 'sobrou o 3º turno na Nova Destilaria');
    certo(nova.some((t) => t.includes('Troca de filtro de madrugada')), 'observação do 2º turno');
    const cal = textos('caldeira');
    certo(cal.includes('HORÁRIO/TURNO: 19:00 às 07:00') && cal.includes('OPERADOR: Beto'), 'blocos da Caldeira: ' + cal.filter((t) => /TURNO|OPERADOR/.test(t)).join(' | '));
  });

  await teste(grupo, 'API: o turno de cada linha é o do setor dela (19h às 7h inteiro)', async () => {
    const api = require('../api-leitura.js').criar(C, () => null);
    const d = api.dia(DIA, REGS);
    const folha = d.setores.find((s) => s.id === 'nova_destilaria').pranchetas.find((p) => p.id === 'nova_destilaria');
    const turnoDe = Object.fromEntries(folha.linhas.map((l) => [l.hora, l.turno]));
    igual(turnoDe['08:00'], '1º Turno', '08:00'); igual(turnoDe['18:00'], '1º Turno', '18:00');
    igual(turnoDe['19:00'], '2º Turno', '19:00'); igual(turnoDe['03:00'], '2º Turno', '03:00');
    certo(folha.observacoes.some((o) => o.turno === '2º Turno' && o.texto.includes('madrugada')), 'observação do 2º turno');
    const esquema = api.esquema().setores;
    igual(esquema.find((s) => s.id === 'nova_destilaria').turnos.map((t) => `${t.inicio}-${t.fim}`).join(' '), '07:00-19:00 19:00-07:00', 'turnos da Nova Destilaria');
    igual(esquema.find((s) => s.id === 'hidrolise').turnos.length, 3, 'a Hidrólise continua com 3 turnos');
  });

  const cel = await nav.novoAparelho('celular Nova Destilaria', TAMANHOS.motorola);
  try {
    await teste(grupo, 'às 19h o turno de 12 horas vira: o nome de quem anotava sai e o lembrete para', async () => {
      await cel.relogioFalso();
      await cel.ir(url + '/?demo', 'document.querySelector("#app main")');
      // relógio às 18:57 de hoje (no 1º turno de 12 horas, e já passou das :30)
      const ms = await cel.avaliar('(() => { const d = new Date(); d.setHours(18, 57, 0, 0); return d.getTime() - Date.now(); })()');
      await cel.avaliar(`__adiantar(${ms})`);
      await cel.ir(url + '/?demo&papel=nova_destilaria&op=Mateus&turnos=12h&lembrete=1', '!!document.querySelector("#lembrete:not([hidden])")');
      igual(await cel.avaliar('document.getElementById("turno-topo").textContent'), '1º Turno', 'turno às 18:57');
      // o relógio da tela confere o turno a cada segundo; a demonstração liga os 12 horas depois de ele guardar o turno
      await dormir(1500);
      await cel.avaliar('__adiantar(4 * 60000)');
      await cel.esperar('document.body.innerText.includes("2º Turno, das 19:00 às 07:00")', 15000, 'pedir o nome no 2º turno às 19:01');
      await cel.esperar('document.getElementById("lembrete").hidden', 12000, 'o lembrete parar sem ninguém no turno');
    });
  } finally { await cel.fechar(); }

  const chefe = await nav.novoAparelho('tablet chefe', TAMANHOS.tablet);
  try {
    await teste(grupo, 'Monitorar no tablet chefe: a Nova Destilaria de 12 horas mostra os dois turnos', async () => {
      await chefe.ir(url + '/?demo&papel=central&turnos=12h&tela=prancheta&pid=nova_destilaria&monitor=1', '!!document.querySelector(".turnos .turno h3")');
      const blocos = await chefe.avaliar('[...document.querySelectorAll(".turnos .turno h3")].map((h) => h.textContent).join(" | ")');
      igual(blocos, '1º Turno, 07:00 às 19:00 | 2º Turno, 19:00 às 07:00', 'blocos de turno');
    });
    await teste(grupo, 'Configurações da usina: o tablet chefe volta a Nova Destilaria para 3 turnos (com confirmação)', async () => {
      const botao = (modelo) => `[data-a="turnos-setor"][data-id="nova_destilaria"][data-modelo="${modelo}"]`;
      await chefe.ir(url + '/?demo&papel=central&tela=config&turnos=12h', `!!document.querySelector('${botao('12h')}.sel')`);
      await chefe.tocar(botao('padrao'));
      await chefe.tocar('.modal [data-k="sim"]');
      await chefe.esperar(`!!document.querySelector('${botao('padrao')}.sel')`, 5000, 'marcar 3 turnos');
      certo((await chefe.avaliar(`document.querySelector('${botao('padrao')}').closest('.linha-config').innerText`)).includes('3º Turno'), 'os horários dos 3 turnos');
    });
  } finally { await chefe.fechar(); }
}
