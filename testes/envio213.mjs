/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * Versão 2.13, no aplicativo (demonstração): a folha de enviar com áreas, turnos, um dia ou um período e o formato.
 *   - Resumo de um período soma os insumos de todos os dias;
 *   - tirar um turno tira as anotações daquele turno da soma;
 *   - Excel de um período: uma aba por folha de cada dia, e a aba "Totais do período" quando pede para somar.
 */
import { teste, certo, igual } from './teste.mjs';
import { TAMANHOS, dormir } from './navegador.mjs';

export async function testarEnvio213(nav, url, grupo) {
  const a = await nav.novoAparelho('tablet', TAMANHOS.tablet);
  try {
    const abrir = async () => {
      await a.ir(url + '/?demo&papel=central', 'document.querySelector("#app main")');
      await dormir(400);
      // guarda o que o aplicativo abriria (WhatsApp) e os arquivos que ele baixaria
      await a.avaliar(`(() => { window.__abertos = []; window.open = (u) => { window.__abertos.push(u); return null; };
        window.__blobs = []; const o = URL.createObjectURL.bind(URL); URL.createObjectURL = (b) => { window.__blobs.push(b); return o(b); }; return 1; })()`);
    };
    const escolherPeriodo = async (de, ate) => {
      await a.tocar('.modal [data-k="m:periodo"]'); await dormir(150);
      await a.avaliar(`(() => { document.getElementById('env-de').value = '${de}'; document.getElementById('env-ate').value = '${ate}'; return 1; })()`);
    };
    const textoDoWhatsApp = async () => {
      for (let i = 0; i < 30; i++) {
        const u = await a.avaliar('window.__abertos[0] || ""');
        if (u) return decodeURIComponent(u.split('text=')[1] || '');
        await dormir(150);
      }
      return '';
    };
    const hoje = await a.avaliar(`(() => { const d = new Date(Date.now() - 7 * 3600000); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })()`);
    const ontem = await a.avaliar(`(() => { const d = new Date(Date.now() - 31 * 3600000); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })()`);

    let totalTodos = '';
    await teste(grupo, 'Resumo de um período: soma os insumos dos dias escolhidos', async () => {
      await abrir();
      await a.tocar('[data-a="compartilhar"][data-destino="whatsapp"]'); await dormir(300);
      await escolherPeriodo(ontem, hoje);
      await a.tocar('.modal [data-k="f:texto"]');
      const t = await textoDoWhatsApp();
      certo(/Período de .* \(2 dias\)/.test(t), 'cabeçalho do período: ' + t.slice(0, 160));
      certo(t.includes('TOTAIS DO PERÍODO'), 'totais do período');
      totalTodos = (t.match(/• LPHERA: ([^\n]*)/) || [])[1] || '';
      certo(totalTodos && totalTodos !== 'nada adicionado', 'LPHERA somado: ' + totalTodos);
    });

    await teste(grupo, 'tirar um turno tira as anotações dele da soma', async () => {
      await abrir();
      await a.tocar('[data-a="compartilhar"][data-destino="whatsapp"]'); await dormir(300);
      await escolherPeriodo(ontem, hoje);
      // fica só o 3º turno (00:00 às 07:00): a demonstração anota os insumos de dia
      await a.tocar('.modal [data-k="t:1"]'); await a.tocar('.modal [data-k="t:2"]');
      await a.tocar('.modal [data-k="f:texto"]');
      const t = await textoDoWhatsApp();
      certo(t.includes('turnos: 3º Turno'), 'o resumo diz o turno: ' + t.slice(0, 200));
      const lphera = (t.match(/• LPHERA: ([^\n]*)/) || [])[1] || '';
      certo(lphera !== totalTodos, `a soma mudou sem os turnos do dia (${lphera} x ${totalTodos})`);
    });

    await teste(grupo, 'Excel de um período: uma aba por folha de cada dia e a aba dos totais', async () => {
      await abrir();
      await a.tocar('[data-a="compartilhar"][data-destino="outros"]'); await dormir(300);
      await escolherPeriodo(ontem, hoje);
      await a.tocar('.modal [data-k="f:xlsx"]');
      let info = null;
      for (let i = 0; i < 40 && !info; i++) {
        info = await a.avaliar(`(async () => { const b = window.__blobs.find((x) => x.type && x.type.includes('spreadsheet')); if (!b) return null;
          const t = new TextDecoder('latin1').decode(new Uint8Array(await b.arrayBuffer())); return { tamanho: b.size, totais: t.includes('Totais do per'), abas: (t.match(/<sheet /g) || []).length }; })()`);
        if (!info) await dormir(200);
      }
      certo(info, 'o Excel não foi montado');
      certo(info.tamanho > 2000, 'Excel com conteúdo');
      certo(info.totais, 'aba Totais do período');
      certo(info.abas >= 5 && info.abas % 2 === 1, `abas: ${info.abas} (as folhas dos 2 dias e a dos totais)`);
    });
  } finally { await a.fechar(); }
}
