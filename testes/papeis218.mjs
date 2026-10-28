/* Pranchetas Digitais - © 2026 Guilherme. */
/* Versão 2.18: correções da revisão por papéis (operador, encarregado, escritório) e o S9 longe da central.
   node testes/papeis218.mjs [hora|lembrete|dorna|exemplo|nuvem] */
import { pathToFileURL } from 'node:url';
import { abrirNavegador, TAMANHOS, dormir } from './navegador.mjs';
import { novoGrupo, teste, certo, igual, resumo } from './teste.mjs';
import { centralNode, pastaTemporaria } from './servidores.mjs';
import { ligarNuvemSQLite } from './nuvem-sqlite.mjs';

/** T1: a folha hora a hora abre e acompanha a hora atual (antes voltava na última hora aberta e gravava por cima). */
export async function testarHora218(nav, g) {
  const c = await centralNode(8378, pastaTemporaria('p218-hora'));
  const a = await nav.novoAparelho('caldeira', TAMANHOS.tablet);
  const rotulo = () => a.avaliar('(document.querySelector("[data-a=salvar]") || {}).textContent || ""');
  try {
    await a.relogioFalso();
    await a.ir(c.url + '/?demo&papel=caldeira&op=Alberto', 'typeof irPara === "function" || !!document.querySelector("#app main")');
    // 20h, 21h e 22h estão no mesmo turno (15h às 23h): a troca de turno não entra no teste
    await a.irParaHora(20, 10);
    // ir para as 20h é troca de turno (pede o nome) e conta como tempo sem mexer (trava em 30 min): o teste
    // espera a troca, põe o Alberto no turno novo e marca atividade adiante
    await dormir(1500);
    await a.avaliar('(() => { ultimaAtividade = Date.now() + 6 * 3600000; cfg.op = { nome: "Alberto", chave: chaveTurno() }; salvarCfg(); return 1; })()');
    await teste(g, 'Caldeira aberta parada na virada da hora: passa sozinha para a hora nova', async () => {
      await a.avaliar('(() => { ir({ tela: "prancheta", pid: "caldeira" }); return 1; })()');
      certo((await rotulo()).includes('20:00'), 'às 20h abre na linha das 20:00: ' + await rotulo());
      await a.irParaHora(20, 59, 55);
      await dormir(1200);
      await a.irParaHora(21, 0, 5);
      await a.esperar('(document.querySelector("[data-a=salvar]") || {}).textContent.includes("21:00")', 4000, 'ir para a linha das 21:00');
    });
    await teste(g, 'Caldeira: aberta às 21h e de novo às 22h40, abre na linha das 22:00', async () => {
      await a.avaliar('(() => { pilha = [telaInicial()]; rascunho = null; render(true); return 1; })()');
      await a.irParaHora(22, 40);
      await a.avaliar('(() => { ir({ tela: "prancheta", pid: "caldeira" }); return 1; })()');
      certo((await rotulo()).includes('22:00'), 'às 22h40 devia abrir na linha das 22:00: ' + await rotulo());
    });
    certo(!a.erros.length, a.erros.join(' | '));
  } finally { await a.fechar(); await c.desligar(); }
}

/** T2: o lembrete toca mesmo depois de o tablet travar por 30 minutos sem mexer (no mesmo turno). */
export async function testarLembreteTravado218(nav, g) {
  const c = await centralNode(8379, pastaTemporaria('p218-lembrete'));
  const a = await nav.novoAparelho('destilaria', TAMANHOS.tablet);
  try {
    await teste(g, 'tablet travado por falta de uso: a faixa do lembrete continua', async () => {
      const agora = new Date();
      if (agora.getMinutes() === 59 && agora.getSeconds() > 20) await dormir((62 - agora.getSeconds()) * 1000);
      await a.ir(c.url + '/?demo&papel=destilaria&op=Mateus&lembrete=1', '!!document.querySelector("#lembrete:not([hidden])")');
      await a.avaliar('(() => { ultimaAtividade = Date.now() - 31 * 60000; return 1; })()');
      await a.esperar('!operadorAtual()', 5000, 'travar por falta de uso');
      await dormir(11000); // a conferência do lembrete roda a cada 10 s
      certo(await a.existe('#lembrete:not([hidden])'), 'a faixa sumiu com o tablet travado');
      certo((await a.avaliar('document.getElementById("lembrete").innerText')).includes('seu nome'), 'a faixa diz para tocar no nome');
    });
    certo(!a.erros.length, a.erros.join(' | '));
  } finally { await a.fechar(); await c.desligar(); }
}

/** T3: dois toques rápidos no "Enviar Nº X" não terminam a dorna. */
export async function testarToqueDuplo218(nav, g) {
  const c = await centralNode(8380, pastaTemporaria('p218-dorna'));
  const a = await nav.novoAparelho('hidrólise', TAMANHOS.tablet);
  try {
    await teste(g, 'Enviar com dois toques a 150 ms: a dorna continua enviando', async () => {
      await a.ir(c.url + '/?demo&papel=hidrolise&op=Guilherme', 'typeof dornasDoDia === "function" && !!document.querySelector("#app main")');
      // uma dorna nova (a demonstração já tem uma enviando)
      await a.avaliar(`(() => { const l = dornasDoDia(dataProducao(), 'hid_anexo1'); ir({ tela: 'prancheta', pid: 'hid_anexo1', chave: Math.max(0, ...l.map((r) => Number(r.chave))) + 1 }); return 1; })()`);
      await a.esperar('!!document.querySelector("[data-a=enviar-dorna]")', 5000, 'botão Enviar');
      const chave = await a.avaliar('rascunho && rascunho.chave');
      await a.avaliar(`(() => { document.querySelector('[data-a=enviar-dorna]').click();
        setTimeout(() => { const b = document.querySelector('[data-a=terminar-dorna]'); if (b) b.click(); }, 150); return 1; })()`);
      await dormir(800);
      const r = await a.avaliar(`JSON.stringify(Object.values(registros).find((x) => x.prancheta === 'hid_anexo1' && String(x.chave) === '${chave}' && x.data === dataProducao()) || null)`).then(JSON.parse);
      certo(r && r.valores.inicio, 'a dorna não foi enviada');
      igual(r.valores.fim || '', '', 'a dorna terminou com o segundo toque');
    });
    certo(!a.erros.length, a.erros.join(' | '));
  } finally { await a.fechar(); await c.desligar(); }
}

/** T4: "Preencher com dados de exemplo" só existe na demonstração. */
export async function testarExemplo218(nav, g) {
  const c = await centralNode(8381, pastaTemporaria('p218-exemplo'));
  const a = await nav.novoAparelho('chefe', TAMANHOS.tablet);
  try {
    await teste(g, 'Ajustes fora da demonstração: sem o botão de dados de exemplo', async () => {
      await a.ir(c.url + '/?demo&papel=hidrolise&op=Guilherme&tela=admin', '!!document.querySelector("[data-a=exemplo]")');
      await a.avaliar('(() => { cfg.demo = false; render(true); return 1; })()');
      certo(!(await a.existe('[data-a=exemplo]')), 'o botão aparece fora da demonstração');
    });
  } finally { await a.fechar(); await c.desligar(); }
}

/** T13 (S9 do Lucas): longe da central, "Conferir agora" troca as anotações pela nuvem na hora e diz o motivo quando falha. */
export async function testarNuvemNaHora218(nav, g) {
  const c = await centralNode(8382, pastaTemporaria('p218-nuvem'));
  const n = await ligarNuvemSQLite(8383, 'segredo-da-central-de-teste', 'leitura-p218');
  const a = await nav.novoAparelho('tablet A', TAMANHOS.tablet), b = await nav.novoAparelho('S9', TAMANHOS.s9);
  const conferir = async (x) => { await x.tocar('#status-con'); await x.tocar('.modal [data-k="conferir"]'); };
  try {
    await teste(g, 'central desligada: o Conferir agora manda e puxa da nuvem sem esperar 2 minutos', async () => {
      await c.api('/api/nuvem', { acao: 'configurar', url: n.url, segredo: 'segredo-da-central-de-teste' });
      for (const x of [a, b]) {
        await x.ir(c.url + '/', 'document.querySelector("[data-quadro=\\"codigo\\"]")');
        await x.tocar('[data-quadro="codigo"]'); await x.teclar(c.codigo().split('')); await x.tocar('[data-ed="ocultar"]');
        await x.tocar('[data-a="conectar"]');
        await x.tocar('[data-a="papel"][data-id="hidrolise"]', null, { esperarMs: 15000 });
        await x.tocar('[data-a="escolher-operador"][data-nome="Guilherme"]');
        await x.esperar('!!JSON.parse(localStorage.getItem("usina.cfg") || "{}").nuvemToken', 20000, 'chave da nuvem');
      }
      await c.desligar();
      await a.avaliar(`(() => { gravar(dataProducao(), 'hid_anexo1', 1, { brix: '19' }, { operador: 'Guilherme' }); return 1; })()`);
      await dormir(1500);
      await conferir(a);
      await a.esperar('Object.values(registros).every((r) => r.naNuvem === r.atualizadoEm || r.sincronizado)', 8000, 'A mandar para a nuvem na hora');
      await conferir(b);
      await b.esperar(`Object.values(registros).some((r) => r.prancheta === 'hid_anexo1' && String(r.chave) === '1' && r.valores.brix === '19')`, 8000, 'o S9 puxar da nuvem na hora');
    });
    await teste(g, 'nuvem recusa a chave: a janela Conexão diz o motivo', async () => {
      await b.avaliar('(() => { cfg.nuvemToken = "chave-errada"; salvarCfg(); return 1; })()');
      await conferir(b);
      await dormir(3000);
      await b.tocar('#status-con');
      certo((await b.avaliar('document.querySelector(".modal").innerText')).includes('recusou'), 'a janela não diz que a nuvem recusou a chave');
    });
    for (const x of [a, b]) certo(!x.erros.length, x.erros.join(' | '));
  } finally { await a.fechar(); await b.fechar(); await c.desligar().catch(() => {}); await n.desligar(); }
}

/** T5 e T11: o painel do encarregado mostra o que ficou fora do limite e as horas sem leitura; a Usina esconde o que ele não pode. */
export async function testarPainel218(nav, g) {
  const c = await centralNode(8385, pastaTemporaria('p218-painel'));
  const a = await nav.novoAparelho('tablet chefe', TAMANHOS.tablet);
  try {
    await a.relogioFalso();
    await a.ir(c.url + '/?demo&papel=central', 'typeof resumoPrancheta === "function" && !!document.querySelector("#app main")');
    await a.irParaHora(16, 18);
    await dormir(1500);
    await teste(g, 'painel: Brix 28 aparece em "Fora do limite" com o valor e quem anotou', async () => {
      await a.avaliar(`(() => { gravar(dataProducao(), 'hid_anexo1', 99, { brix: '28' }, { operador: 'Felipe' }); pilha = [telaInicial()]; render(true); return 1; })()`);
      const t = await a.avaliar('(document.querySelector(".fora-limite") || {}).innerText || ""');
      certo(t.includes('28') && t.includes('Felipe'), 'faltou a faixa com o Brix 28: ' + t.slice(0, 200));
    });
    await teste(g, 'pendências: Caldeira 2 só com a leitura das 16h conta as horas que passaram', async () => {
      const r = await a.avaliar(`(() => { const d = dataProducao();
        listar(d, 'caldeira_2').forEach((x) => { delete registros[x.id]; });
        gravar(d, 'caldeira_2', 16, { pressao: '6' }, { operador: 'Alberto' });
        return JSON.stringify(resumoPrancheta('caldeira_2', d)); })()`).then(JSON.parse);
      igual(r.estado, 'pendente', 'estado da Caldeira 2: ' + r.texto);
    });
    await teste(g, 'gráfico com um ponto muito acima do limite: a linha do limite aparece', async () => {
      const h = await a.avaliar(`htmlDoGrafico({ titulo: 'Brix', unidade: '', series: [{ nome: 'Brix', pontos: [{ x: 600, y: 28 }] }], faixas: [{ valor: 25, nivel: 'alerta', texto: 'Brix alto' }] })`);
      certo(h.includes('graf-faixa'), 'a linha do limite sumiu');
    });
    await teste(g, 'Usina do encarregado: sem Base44, Nuvem e Apagar tudo', async () => {
      await a.ir(c.url + '/?demo&papel=central&funcoes=corrigir,relatorios,usina,avisos&tela=config', '!!document.querySelector("#app main")');
      for (const s of ['#bloco-base44', '#bloco-nuvem', '[data-a="zerar-tudo"]']) certo(!(await a.existe(s)), s + ' aparece para o encarregado');
    });
    certo(!a.erros.length, a.erros.join(' | '));
  } finally { await a.fechar(); await c.desligar(); }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const nav = await abrirNavegador();
  const g = novoGrupo('Versão 2.18: revisão por papéis');
  try {
    const so = process.argv[2];
    if (!so || so === 'hora') await testarHora218(nav, g);
    if (!so || so === 'lembrete') await testarLembreteTravado218(nav, g);
    if (!so || so === 'dorna') await testarToqueDuplo218(nav, g);
    if (!so || so === 'exemplo') await testarExemplo218(nav, g);
    if (!so || so === 'nuvem') await testarNuvemNaHora218(nav, g);
    if (!so || so === 'painel') await testarPainel218(nav, g);
  } finally { await nav.fechar(); }
  const r = resumo([g]);
  console.log(`\n${r.passaram} de ${r.total} testes passaram${r.falharam ? `, ${r.falharam} falharam` : ''}`);
  process.exitCode = r.falharam ? 1 : 0;
}
