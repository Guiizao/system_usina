/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * Versão 2.6, pedido do escritório (Lucas, 26/09/2026), na Destilaria e Fermentação:
 *   - Volume de vinho: a folga de cada dorna medida com a trena; o volume sai na hora, com a conta da planilha
 *     CONTROLE LTS: (altura - folga) x área da base x 1000.
 *   - Dornas de fermentação (1, 2, 4 a 11): começou e terminou de encher, Brix inicial, Brix e volume do dia
 *     (vindos da medição da manhã) e mandar para a volante.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { TAMANHOS, dormir } from './navegador.mjs';
import { teste, certo, igual, teclasDaSenha } from './teste.mjs';

const diaProducao = () => { const d = new Date(Date.now() - 7 * 3600000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export async function testarPedidos26(nav, ligar, porta, grupo) {
  const c = await ligar(porta);
  const regs = async () => (await c.api('/api/registros?desde=0')).registros.filter((r) => !r.apagado);
  const esperarCentral = async (filtro, descricao, ms = 25000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { const r = filtro(await regs()); if (r) return r; await dormir(700); }
    throw new Error(`não aconteceu na central em ${ms / 1000}s: ${descricao}`);
  };
  const aparelhos = [];
  async function novo(nome, tamanho) { const a = await nav.novoAparelho(nome, tamanho); aparelhos.push(a); return a; }
  async function conectar(a, papel, operador) {
    await a.ir(c.url + '/', 'document.querySelector("[data-quadro=\\"codigo\\"]")');
    await a.tocar('[data-quadro="codigo"]');
    await a.teclar(c.codigo().split(''));
    await a.tocar('[data-ed="ocultar"]');
    await a.tocar('[data-a="conectar"]');
    await a.tocar(`[data-a="papel"][data-id="${papel}"]`, null, { esperarMs: 15000 });
    if (operador) await a.tocar(`[data-a="escolher-operador"][data-nome="${operador}"]`);
  }
  const semNotificacao = async (a) => { await a.avaliar('(() => { const t = document.getElementById("toast"); if (!t.hidden) t.click(); })()'); await dormir(350); };
  const texto = (a, sel) => a.avaliar(`(document.querySelector(${JSON.stringify(sel)}) || {}).textContent || ''`);
  const hoje = diaProducao();
  const medicao = (l, grupo) => l.find((r) => r.id === `${hoje}|med_dornas|${grupo}`);
  const ciclos = (l, n) => l.filter((r) => r.prancheta === 'fermentacao' && Number(r.valores.dorna) === n).sort((a, b) => b.valores.inicioEm - a.valores.inicioEm);

  try {
    const tab = await novo('tablet da Destilaria', TAMANHOS.tablet);
    const esc = await novo('tablet chefe', TAMANHOS.computador);
    await teste(grupo, 'a Destilaria e Fermentação tem as duas folhas novas', async () => {
      await conectar(esc, 'central');
      await conectar(tab, 'destilaria', 'Mateus');
      const lista = await tab.avaliar('[...document.querySelectorAll("[data-a=\\"abrir-prancheta\\"]")].map((b) => b.dataset.id)');
      certo(lista.includes('med_dornas') && lista.includes('fermentacao'), 'folhas do setor: ' + lista.join(', '));
    });

    await teste(grupo, 'volume de vinho: a folga vira litros na hora, igual à planilha (21.574,35 L na Sacarificação)', async () => {
      await tab.tocar('[data-a="abrir-prancheta"][data-id="med_dornas"]');
      await tab.tocar('[data-a="linha"][data-chave="sac"]');
      await tab.tocar('[data-quadro="sac1_folga"]'); await tab.teclar(['0', ',', '1', '5']);
      igual((await texto(tab, '[data-quadro="sac1_folga"] .tag-calc')).trim(), '7.229 L', 'volume da dorna 1 do lado da folga');
      certo((await texto(tab, '.calc-painel')).includes('7.229 L'), 'volume no teclado');
      await tab.tocar('[data-quadro="sac1_brix"]'); await tab.teclar(['1', '8']);
      await tab.tocar('[data-quadro="sac2_folga"]'); await tab.teclar(['0', ',', '2']);
      await tab.tocar('[data-quadro="sac4_folga"]'); await tab.teclar(['0', ',', '1', '4']);
      const totais = await texto(tab, '#totais-medicao');
      certo(totais.includes('21.574,35 L'), 'subtotal enquanto digita: ' + totais);
      await tab.tocar('[data-ed="ocultar"]');
      await tab.tocar('[data-a="salvar"]');
      const r = await esperarCentral((l) => medicao(l, 'sac'), 'medição da Sacarificação');
      igual(r.valores.sac1_vol, '7229.25'); igual(r.valores.sac2_vol, '7087.50'); igual(r.valores.sac4_vol, '7257.60');
      igual(r.valores.sac1_brix, '18'); igual(r.operador, 'Mateus');
      certo(/^\d\d:\d\d$/.test(r.valores.hora || ''), 'hora da medição: ' + r.valores.hora);
    });

    await teste(grupo, 'folga maior que a altura da dorna avisa do lado do número', async () => {
      await tab.tocar('[data-quadro="sac3_folga"]'); await tab.teclar(['3']);
      certo((await texto(tab, '[data-quadro="sac3_folga"] .tag-aviso')).includes('Maior que a dorna'), 'sem aviso');
      await tab.tocar('[data-ed="limpar"]');
      await tab.tocar('[data-ed="ocultar"]');
    });

    await teste(grupo, 'dorna de fermentação: começar a encher, terminar e anotar o Brix inicial', async () => {
      await tab.tocar('[data-a="aba"][data-id="fermentacao"]');
      await tab.tocar('[data-a="linha"][data-chave="1"]');
      await tab.tocar('[data-a="ferm-encher"]');
      let c1 = await esperarCentral((l) => ciclos(l, 1)[0], 'enchimento da Nº 1');
      igual(c1.operador, 'Mateus'); certo(/^\d\d:\d\d$/.test(c1.valores.enche_inicio), 'começou a encher'); igual(c1.data, hoje);
      await tab.tocar('[data-a="ferm-terminou"]');
      // já abre o teclado no Brix inicial
      await tab.esperar('!!document.querySelector("[data-quadro=\\"brix_inicial\\"].ativo")', 8000, 'teclado no Brix inicial');
      await tab.teclar(['8']);
      await tab.tocar('[data-ed="ocultar"]');
      await tab.tocar('[data-a="salvar"]');
      c1 = await esperarCentral((l) => { const x = ciclos(l, 1)[0]; return x && x.valores.brix_inicial === '8' && x.valores.enche_fim ? x : null; }, 'Nº 1 cheia com Brix 8');
      certo((await texto(tab, '.cartao-dorna')).includes('Ainda não foi medida'), 'o cartão devia dizer que falta a medição');
    });

    await teste(grupo, 'a medição da manhã aparece na dorna (Brix, volume e fermentando)', async () => {
      await tab.tocar('[data-a="aba"][data-id="med_dornas"]');
      await tab.tocar('[data-a="linha"][data-chave="vin"]');
      await tab.tocar('[data-quadro="hora"]'); await tab.tocar('[data-ed="agora"]');
      await tab.tocar('[data-quadro="vin1_folga"]'); await tab.teclar(['0', ',', '9']);
      await tab.tocar('[data-quadro="vin1_brix"]'); await tab.teclar(['5']);
      await tab.tocar('[data-quadro="vin1_ferm"]'); await tab.tocar('[data-ed="o:0"]');
      await tab.tocar('[data-ed="ocultar"]');
      await tab.tocar('[data-a="salvar"]');
      await esperarCentral((l) => { const m = medicao(l, 'vin'); return m && m.valores.vin1_vol === '25030.80'; }, 'medição do vinho');
      await tab.tocar('[data-a="aba"][data-id="fermentacao"]');
      await tab.tocar('[data-a="linha"][data-chave="1"]');
      const cartao = await texto(tab, '.cartao-dorna');
      certo(cartao.includes('Brix 5') && cartao.includes('25.031 L') && cartao.includes('Fermentando: Sim') && cartao.includes('Brix inicial 8'), 'cartão: ' + cartao);
    });

    await teste(grupo, 'mandar para a volante; outra dorna junto pede confirmação; o tablet chefe vê', async () => {
      await tab.tocar('[data-a="ferm-volante"]');
      await esperarCentral((l) => { const x = ciclos(l, 1)[0]; return x && (x.valores.volante || []).some((s) => !s.fim && s.operador === 'Mateus'); }, 'Nº 1 na volante');
      certo((await texto(tab, '#volante-agora')).includes('Nº 1 desde'), 'volante no alto');
      // a Nº 2 enche e também vai para a volante
      await tab.tocar('[data-a="linha"][data-chave="2"]');
      await tab.tocar('[data-a="ferm-encher"]');
      await tab.tocar('[data-a="ferm-terminou"]');
      await tab.tocar('[data-ed="ocultar"]');
      await semNotificacao(tab);
      await tab.tocar('[data-a="ferm-volante"]');
      await tab.esperar('document.querySelector(".modal") && document.querySelector(".modal").textContent.includes("já está recebendo")', 8000, 'pergunta da volante');
      await tab.tocar('[data-k="sim"]');
      await esperarCentral((l) => { const x = ciclos(l, 2)[0]; return x && (x.valores.volante || []).some((s) => !s.fim); }, 'Nº 2 na volante');
      // tablet chefe: o painel mostra quem está na volante
      await esc.esperar('document.body.innerText.includes("Volante: Nº 1 e 2")', 25000, 'painel do tablet chefe');
    });

    await teste(grupo, 'parou de mandar: esvaziou (fica vazia) ou ainda tem vinho', async () => {
      await tab.tocar('[data-a="linha"][data-chave="1"]');
      await tab.tocar('[data-a="ferm-parar"]');
      await tab.tocar('[data-k="sim"]');
      await esperarCentral((l) => { const x = ciclos(l, 1)[0]; return x && x.valores.esvaziada && x.valores.volante.every((s) => s.fim) ? x : null; }, 'Nº 1 vazia');
      certo((await texto(tab, '[data-a="linha"][data-chave="1"]')).includes('vazia'), 'Nº 1 não ficou vazia no seletor');
      await tab.tocar('[data-a="linha"][data-chave="2"]');
      await tab.tocar('[data-a="ferm-parar"]');
      await tab.tocar('[data-k="nao"]');
      await esperarCentral((l) => { const x = ciclos(l, 2)[0]; return x && !x.valores.esvaziada && x.valores.volante.every((s) => s.fim) ? x : null; }, 'Nº 2 parou com vinho');
      certo((await texto(tab, '[data-a="linha"][data-chave="2"]')).includes('com vinho'), 'Nº 2 devia ficar com vinho');
    });

    await teste(grupo, 'relatório do dia: Volume de vinho e Dornas de fermentação no Excel, com a conta da planilha', async () => {
      await semNotificacao(esc);
      await esc.tocar('[data-a="relatorios"]');
      await esc.tocar('[data-a="gerar-hoje"]');
      await esc.esperar('document.body.innerText.includes("Excel e XML de hoje guardados")', 20000);
      const pasta = path.join(c.pastaRelatorios, hoje);
      const xlsx = fs.readdirSync(pasta).find((n) => n.endsWith('.xlsx'));
      const saida = execFileSync('python', ['-X', 'utf8', '-c', `
import json, sys, openpyxl
wb = openpyxl.load_workbook(sys.argv[1])
vol = next(ws for ws in wb.worksheets if 'Volume de vinho' in ws.title)
fer = next(ws for ws in wb.worksheets if 'fermenta' in ws.title.lower())
valores = [c.value for r in vol.iter_rows() for c in r if c.value is not None]
ferm = [c.value for r in fer.iter_rows() for c in r if c.value is not None]
print(json.dumps({'folhas': wb.sheetnames, 'v7229': 7229.25 in valores, 'sub': 21574.35 in valores, 'vin1': 25030.8 in valores, 'ferm': ferm[:60]}, default=str))
`, path.join(pasta, xlsx)], { encoding: 'utf8' });
      const r = JSON.parse(saida);
      certo(r.v7229 && r.sub, 'faltou o volume ou o subtotal na folha Volume de vinho');
      certo(r.vin1, 'faltou o volume da dorna de vinho');
      certo(r.ferm.includes('Mateus') && r.ferm.some((x) => String(x).includes('Mateus') && String(x).includes('-')), 'faltou o enchimento ou a volante: ' + JSON.stringify(r.ferm).slice(0, 300));
      return r.folhas.filter((f) => /Volume|ferment/i.test(f)).join(' e ');
    });

    await teste(grupo, 'medidas das dornas: o escritório troca e o volume do tablet muda', async () => {
      await semNotificacao(esc);
      await esc.tocar('[data-a="voltar"]');
      await esc.tocar('[data-a="config"]');
      await esc.teclar(teclasDaSenha());
      await esc.tocar('[data-a="medida-grupo"][data-grupo="sac"]');
      await esc.avaliar('(() => { const i = document.getElementById("alt2"); i.value = "3"; return true; })()');
      await esc.tocar('[data-k="ok"]');
      await esperarCentral((l) => { const cfg = l.find((r) => r.id === 'config|sistema|geral'); return cfg && cfg.valores.medicao && cfg.valores.medicao.grupos.find((g) => g.id === 'sac').dornas[2].altura === 3; }, 'medidas novas na central');
      // no tablet, a Dorna 3 da Sacarificação (altura 3 m): folga 0,5 -> (3 - 0,5) x 2,835 x 1000 = 7.087,5
      await tab.tocar('[data-a="aba"][data-id="med_dornas"]');
      await tab.tocar('[data-a="linha"][data-chave="sac"]');
      await tab.tocar('[data-quadro="sac3_folga"]'); await tab.tocar('[data-ed="limpar"]'); await tab.teclar(['0', ',', '5']);
      await tab.tocar('[data-ed="ocultar"]');
      await tab.tocar('[data-a="salvar"]');
      const t0 = Date.now();
      let tag = '';
      while (Date.now() - t0 < 25000) {
        tag = (await texto(tab, '[data-quadro="sac3_folga"] .tag-calc')).trim();
        if (tag === '7.088 L') break;
        await dormir(1500);
        // sai e volta para a folha: a tela é montada de novo com as medidas que chegaram
        await tab.tocar('[data-a="aba"][data-id="fermentacao"]');
        await tab.tocar('[data-a="aba"][data-id="med_dornas"]');
      }
      igual(tag, '7.088 L', 'volume com a medida nova');
    });

    await teste(grupo, 'dorna enchida há 6 dias (o tablet guarda só 3) continua aparecendo num tablet que acabou de conectar', async () => {
      const d = new Date(Date.now() - 7 * 3600000 - 6 * 86400000);
      const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const t = Date.now() - 6 * 86400000;
      await c.api('/api/sync', { aparelho: 'teste-antigo', registros: [{ id: `${dia}|fermentacao|9-antigo`, data: dia, prancheta: 'fermentacao', setor: 'destilaria', chave: '9-antigo',
        valores: { dorna: 9, enche_inicio: '08:00', enche_fim: '10:00', brix_inicial: '9', inicioEm: t, volante: [], esvaziada: null }, criadoEm: t, atualizadoEm: t, aparelho: 'teste-antigo', apagado: false, operador: 'Mateus' }] });
      const outro = await novo('tablet novo da Destilaria', TAMANHOS.tablet);
      await conectar(outro, 'destilaria', 'Mateus');
      await outro.tocar('[data-a="abrir-prancheta"][data-id="fermentacao"]');
      await outro.esperar('!!document.querySelector("[data-a=\\"linha\\"][data-chave=\\"9\\"]") && document.querySelector("[data-a=\\"linha\\"][data-chave=\\"9\\"]").textContent.includes("fermentando")', 20000, 'Nº 9 fermentando');
      await outro.tocar('[data-a="linha"][data-chave="9"]');
      certo((await texto(outro, '.cartao-dorna')).includes('Brix inicial 9'), 'enchimento antigo no cartão');
      // e continua depois de limpar os dias antigos da memória do tablet
      await dormir(6000);
      certo(await outro.avaliar(`Object.keys(JSON.parse(localStorage.getItem('usina.registros') || '{}')).includes('${dia}|fermentacao|9-antigo')`), 'o tablet apagou o enchimento que ainda está na dorna');
    });

    await teste(grupo, 'nenhum erro de JavaScript', async () => {
      const erros = aparelhos.flatMap((a) => a.erros.map((e) => `${a.nome}: ${e}`));
      certo(!erros.length, erros.join(' | ').slice(0, 500));
    });
  } finally {
    await Promise.all(aparelhos.map((a) => a.fechar()));
    await c.desligar();
  }
}
