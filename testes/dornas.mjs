/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * O dia da Hidrólise como é feito na área (áudios do teste de 23/09/2026):
 *   dorna enche -> anota -> Enviar (marca início) -> a próxima Enviar termina a anterior -> Terminou (marca fim);
 *   Sacarificação acompanha a Hidrólise até alguém mudar à mão; LPHERA / Cal e Saczyme / Antibiótico somados por hora;
 *   trocar de aba volta na mesma dorna; apagar renumera; zerar limpa central e tablets.
 */
import { TAMANHOS, dormir } from './navegador.mjs';
import { SENHA_PROGRAMADOR_TESTE } from './servidores.mjs';
import { teste, certo, igual, teclasDaSenha } from './teste.mjs';

export async function testarDornas(nav, central, grupo) {
  const api = async (rota) => (await fetch(central.url + rota, { headers: { 'X-Chave': central.chave() } })).json();
  const regs = async () => (await api('/api/registros?desde=0')).registros.filter((r) => !r.apagado);
  const esperarCentral = async (filtro, descricao, ms = 25000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const lista = await regs();
      const r = filtro(lista);
      if (r) return r;
      await dormir(700);
    }
    throw new Error(`não aconteceu na central em ${ms / 1000}s: ${descricao}`);
  };
  const um = (lista, pid, chave) => lista.find((r) => r.prancheta === pid && r.chave === String(chave));

  const esc = await nav.novoAparelho('escritório', TAMANHOS.computador);
  const tab = await nav.novoAparelho('tablet Hidrólise', TAMANHOS.tablet);
  const aparelhos = [esc, tab];
  async function conectar(a, papel, operador) {
    await a.ir(central.url + '/', 'document.querySelector("[data-quadro=\\"codigo\\"]")');
    await a.tocar('[data-quadro="codigo"]');
    await a.teclar(central.codigo().split(''));
    await a.tocar('[data-ed="ocultar"]');
    await a.tocar('[data-a="conectar"]');
    await a.tocar(`[data-a="papel"][data-id="${papel}"]`, null, { esperarMs: 15000 });
    if (operador) await a.tocar(`[data-a="escolher-operador"][data-nome="${operador}"]`);
  }
  const selecionada = () => tab.avaliar('(document.querySelector(".seletor button.sel") || {}).textContent || ""');
  async function anotar(campo, teclas) { await tab.tocar(`[data-quadro="${campo}"]`); await tab.teclar(teclas); }

  try {
    await teste(grupo, 'conectar o escritório e o tablet da Hidrólise', async () => {
      await conectar(esc, 'central');
      await conectar(tab, 'hidrolise', 'Guilherme');
      await tab.tocar('[data-a="abrir-prancheta"][data-id="hid_anexo1"]');
      certo((await selecionada()).includes('Nº 1'), 'não abriu na dorna 1');
    });
    await teste(grupo, 'salvar a dorna enchendo continua nela (não pula para uma nova)', async () => {
      await anotar('brix', ['1', '8']); await anotar('phf', ['5', ',', '2']); await anotar('phf2', ['5', ',', '1']); await anotar('bhx', ['1', '7']);
      await tab.tocar('[data-ed="ocultar"]');
      await tab.tocar('[data-a="salvar"]');
      await dormir(400);
      certo((await selecionada()).includes('Nº 1'), 'pulou para outra dorna: ' + (await selecionada()));
      certo(await tab.existe('.seletor button.sel small', 'enchendo'), 'não mostra "enchendo"');
      certo(await tab.existe('[data-a="enviar-dorna"]'), 'sem o botão Enviar');
    });
    await teste(grupo, 'duas dornas enchendo ao mesmo tempo', async () => {
      await tab.tocar('[data-a="linha"][data-chave="2"]');
      await anotar('brix', ['2', '0']); await anotar('phf2', ['5', ',', '0']); await anotar('bhx', ['1', '9']);
      await tab.tocar('[data-ed="ocultar"]');
      await tab.tocar('[data-a="salvar"]');
      const lista = await esperarCentral((l) => um(l, 'hid_anexo1', 2) && um(l, 'hid_anexo2', 2) && l, 'dorna 2 e a Sacarificação dela');
      certo(!um(lista, 'hid_anexo1', 1).valores.inicio && !um(lista, 'hid_anexo1', 2).valores.inicio, 'início marcado antes de enviar');
      igual(um(lista, 'hid_anexo2', 1).valores.phf, '5.1', 'PHF da Sacarificação = pHf da Hidrólise');
      igual(um(lista, 'hid_anexo2', 1).valores.bhx, '17', 'BHX da Sacarificação');
      igual(um(lista, 'hid_anexo2', 1).valores.enz, '100', 'Saczyme padrão');
    });
    let inicio1 = '';
    await teste(grupo, 'Enviar a dorna 1 marca o início nela e na Sacarificação', async () => {
      await tab.tocar('[data-a="linha"][data-chave="1"]');
      await tab.tocar('[data-a="enviar-dorna"]');
      const lista = await esperarCentral((l) => { const r = um(l, 'hid_anexo1', 1); return r && r.valores.inicio && l; }, 'início da dorna 1');
      inicio1 = um(lista, 'hid_anexo1', 1).valores.inicio;
      await esperarCentral((l) => { const r = um(l, 'hid_anexo2', 1); return r && r.valores.horario === inicio1; }, 'horário da Sacarificação');
      certo(await tab.existe('.seletor button.sel small', 'enviando'), 'não mostra "enviando"');
      return `início ${inicio1}`;
    });
    await teste(grupo, 'trocar de aba abre a mesma dorna na Sacarificação e volta nela na Hidrólise', async () => {
      await tab.tocar('[data-a="aba"][data-id="hid_anexo2"]');
      certo((await selecionada()).includes('Nº 1'), 'Sacarificação abriu em: ' + (await selecionada()));
      await tab.tocar('[data-a="aba"][data-id="hid_anexo1"]');
      certo((await selecionada()).includes('Nº 1'), 'Hidrólise voltou em: ' + (await selecionada()));
    });
    await teste(grupo, 'Enviar a dorna 2 termina a dorna 1 no mesmo horário', async () => {
      await tab.tocar('[data-a="linha"][data-chave="2"]');
      await dormir(1100);
      await tab.tocar('[data-a="enviar-dorna"]');
      const lista = await esperarCentral((l) => { const a = um(l, 'hid_anexo1', 1); const b = um(l, 'hid_anexo1', 2); return a && b && a.valores.fim && b.valores.inicio && l; }, 'fim da 1 e início da 2');
      igual(um(lista, 'hid_anexo1', 1).valores.fim, um(lista, 'hid_anexo1', 2).valores.inicio, 'fim da 1 = início da 2');
    });
    await teste(grupo, 'LPHERA e Saczyme somados sozinhos só das dornas terminadas da hora, para conferir', async () => {
      // a Nº 1 terminou (a Nº 2 foi enviada); a Nº 2 ainda está indo para cima: só a Nº 1 entra na soma
      await dormir(1500);
      const lista = await esperarCentral((l) => {
        const lph = l.filter((r) => r.prancheta === 'ins_lphera');
        const soma = lph.reduce((s, r) => s + Number(r.valores.qtd), 0);
        return soma === 70 && l;
      }, 'LPHERA = 70 (só a dorna 1, que terminou)');
      const sac = lista.filter((r) => r.prancheta === 'ins_saczyme').reduce((s, r) => s + Number(r.valores.qtd), 0);
      const anti = lista.filter((r) => r.prancheta === 'ins_alcolina').reduce((s, r) => s + Number(r.valores.qtd), 0);
      igual(sac, 100, 'Saczyme'); igual(anti, 100, 'Antibiótico');
      certo(lista.filter((r) => r.prancheta === 'ins_lphera').every((r) => r.conferir && r.auto), 'não ficou marcado para conferir');
      return `LPHERA 70, Saczyme 100, Antibiótico 100 (a dorna 2 ainda não terminou)`;
    });
    await teste(grupo, 'confirmar a hora dos insumos: deixa de "conferir" e fica com quem confirmou', async () => {
      await tab.tocar('[data-a="aba"][data-id="juntas_lphera_cal"]');
      await tab.esperar('document.querySelector("[data-a=\\"salvar\\"]") && document.querySelector("[data-a=\\"salvar\\"]").textContent.includes("Confirmar")', 5000, 'botão Confirmar');
      await tab.tocar('[data-a="salvar"]');
      await esperarCentral((l) => { const r = l.find((x) => x.prancheta === 'ins_lphera' && Number(x.valores.qtd) > 0); return r && !r.conferir && !r.auto && r.operador === 'Guilherme'; }, 'hora confirmada');
    });
    await teste(grupo, 'Sacarificação mudada à mão para de copiar; "Copiar da Hidrólise" volta a acompanhar', async () => {
      await tab.tocar('[data-a="aba"][data-id="hid_anexo2"]');
      await tab.tocar('[data-a="linha"][data-chave="2"]');
      await anotar('phf', ['4', ',', '9']);
      await tab.tocar('[data-ed="ocultar"]');
      await tab.tocar('[data-a="salvar"]');
      await esperarCentral((l) => { const r = um(l, 'hid_anexo2', 2); return r && r.valores.phf === '4.9' && (r.manuais || []).includes('phf'); }, 'PHF mudado à mão');
      await tab.tocar('[data-a="aba"][data-id="hid_anexo1"]');
      certo((await selecionada()).includes('Nº 2'), 'Hidrólise abriu em: ' + (await selecionada()));
      await anotar('phf2', ['5', ',', '3']); await anotar('bhx', ['2', '1']);
      await tab.tocar('[data-ed="ocultar"]');
      await tab.tocar('[data-a="salvar"]');
      const lista = await esperarCentral((l) => { const r = um(l, 'hid_anexo2', 2); return r && r.valores.bhx === '21' && l; }, 'BHX acompanhou');
      igual(um(lista, 'hid_anexo2', 2).valores.phf, '4.9', 'PHF mudado à mão foi sobrescrito');
      await tab.tocar('[data-a="aba"][data-id="hid_anexo2"]');
      await tab.tocar('[data-a="copiar-vemde"]');
      await esperarCentral((l) => { const r = um(l, 'hid_anexo2', 2); return r && r.valores.phf === '5.3' && !(r.manuais || []).length; }, 'voltou a acompanhar');
    });
    await teste(grupo, 'Terminou de enviar marca o fim e a dorna fica anotada', async () => {
      await tab.tocar('[data-a="aba"][data-id="hid_anexo1"]');
      await tab.tocar('[data-a="linha"][data-chave="2"]');
      await tab.tocar('[data-a="terminar-dorna"][data-chave="2"]');
      await esperarCentral((l) => { const r = um(l, 'hid_anexo1', 2); return r && r.valores.fim; }, 'fim da dorna 2');
      await tab.tocar('[data-a="linha"][data-chave="2"]');
      certo(await tab.existe('.seletor button.sel small', 'anotada'), 'não ficou "anotada"');
    });
    await teste(grupo, 'a dorna 2 terminou: a hora da LPHERA confirmada volta para conferir, agora com 140', async () => {
      await esperarCentral((l) => {
        const lph = l.filter((r) => r.prancheta === 'ins_lphera');
        return lph.reduce((s, r) => s + Number(r.valores.qtd), 0) === 140 && lph.some((r) => r.conferir);
      }, 'LPHERA = 140 para conferir');
    });
    await teste(grupo, 'apagar a dorna 1: a 2 vira 1 na Hidrólise e na Sacarificação', async () => {
      await tab.tocar('[data-a="linha"][data-chave="1"]');
      await tab.tocar('[data-a="apagar-linha"]');
      await tab.tocar('[data-k="sim"]');
      const lista = await esperarCentral((l) => { const r = um(l, 'hid_anexo1', 1); return r && r.valores.brix === '20' && !um(l, 'hid_anexo1', 2) && l; }, 'renumerar a Hidrólise');
      const s1 = um(lista, 'hid_anexo2', 1);
      certo(s1 && s1.valores.phf === '5.3', 'Sacarificação não renumerou: ' + JSON.stringify(s1 && s1.valores));
      certo(!um(lista, 'hid_anexo2', 2), 'sobrou a Sacarificação 2');
    });
    await teste(grupo, 'setor que não começou o dia não aparece como pendência no escritório', async () => {
      await esc.esperar('document.querySelector("[data-a=\\"abrir-setor\\"][data-id=\\"caldeira\\"]")', 10000);
      const pendente = await esc.avaliar('document.querySelector("[data-a=\\"abrir-setor\\"][data-id=\\"caldeira\\"]").classList.contains("pendente")');
      certo(!pendente, 'Caldeira sem nenhuma leitura aparece como pendente');
      certo(!(await esc.existe('[data-id="caldeira"]', 'Falta a leitura')), 'Caldeira ainda diz "Falta a leitura"');
    });
    await teste(grupo, 'apagar todos os dados do sistema (senha do programador) limpa a central e o tablet', async () => {
      await esc.tocar('[data-a="config"]');
      await esc.teclar(teclasDaSenha());
      await esc.tocar('[data-a="zerar-tudo"]');
      await esc.tocar('[data-k="sim"]');
      await esc.teclar([...SENHA_PROGRAMADOR_TESTE.split(''), 'ok']);
      await esperarCentral((l) => l.every((r) => r.data === 'config') && l.length >= 0, 'central sem anotações');
      await tab.esperar(`(() => { const r = JSON.parse(localStorage.getItem('usina.registros') || '{}'); return Object.values(r).every((x) => x.data === 'config'); })()`, 30000, 'tablet limpo');
      await dormir(9000);
      const sobrou = (await regs()).filter((r) => r.data !== 'config');
      certo(!sobrou.length, `o tablet mandou de novo ${sobrou.length} anotação(ões) antigas`);
    });
    await teste(grupo, 'nenhum erro de JavaScript', async () => {
      const erros = aparelhos.flatMap((a) => a.erros.map((e) => `${a.nome}: ${e}`));
      certo(!erros.length, erros.join(' | ').slice(0, 500));
    });
  } finally {
    for (const a of aparelhos) await a.fechar();
  }
}
