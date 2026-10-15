/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * Versão 2.14, de ponta a ponta no aplicativo: com a central desligada, os aparelhos trocam as anotações pela nuvem.
 *   - dois tablets da Hidrólise ligados na central pegam o endereço e a chave da nuvem;
 *   - a central desliga; o tablet A anota a dorna 1 e o B recebe pela nuvem, com a luz da nuvem acesa;
 *   - o B anota a dorna 2 e o A recebe: as duas partes se juntam nos dois tablets;
 *   - os dois saem, a central volta, puxa as duas da nuvem e fica com elas.
 */
import { teste, certo } from './teste.mjs';
import { TAMANHOS, dormir } from './navegador.mjs';

const SEGREDO = 'segredo-da-central-de-teste';
const dorna = (n, brix) => `Object.values(JSON.parse(localStorage.getItem('usina.registros') || '{}')).find((r) => r.prancheta === 'hid_anexo1' && String(r.chave) === '${n}' && !r.apagado && r.valores && r.valores.brix === '${brix}')`;

export async function testarHubApp(nav, central, nuvem, grupo) {
  const a = await nav.novoAparelho('tablet A', TAMANHOS.tablet);
  const b = await nav.novoAparelho('tablet B', TAMANHOS.tablet8);
  try {
    await teste(grupo, 'central desligada: A e B anotam dornas diferentes e trocam pela nuvem; a central puxa as duas quando volta', async () => {
      await central.api('/api/nuvem', { acao: 'configurar', url: nuvem.url, segredo: SEGREDO });
      for (const x of [a, b]) {
        await x.relogioFalso();
        await x.ir(central.url + '/', 'document.querySelector("[data-quadro=\\"codigo\\"]")');
        await x.tocar('[data-quadro="codigo"]');
        await x.teclar(central.codigo().split(''));
        await x.tocar('[data-ed="ocultar"]');
        await x.tocar('[data-a="conectar"]');
        await x.tocar('[data-a="papel"][data-id="hidrolise"]', null, { esperarMs: 15000 });
        await x.tocar('[data-a="escolher-operador"][data-nome="Guilherme"]');
        await x.esperar('!!JSON.parse(localStorage.getItem("usina.cfg") || "{}").nuvemToken', 20000, 'chave da nuvem');
      }
      await central.desligar();
      // o aparelho só vai para a nuvem depois de 2 minutos sem a central
      for (const x of [a, b]) await x.avaliar('__adiantar(3 * 60000)');
      // A anota a dorna Nº 1
      await a.tocar('[data-a="abrir-prancheta"][data-id="hid_anexo1"]');
      await a.tocar('[data-quadro="brix"]'); await a.teclar(['1', '9']);
      await a.tocar('[data-ed="ocultar"]');
      await a.tocar('[data-a="salvar"]');
      await a.esperar(`!!${dorna(1, '19')}`, 10000, 'dorna 1 guardada no tablet A');
      await b.esperar(`!!${dorna(1, '19')}`, 90000, 'o tablet B receber a dorna 1 pela nuvem');
      certo(await b.avaliar('document.querySelector("#status-con .luzes i:last-child").className === "ok"'), 'luz da nuvem apagada no tablet B');
      certo(await b.avaliar('document.querySelector("#status-con .luzes i").className === "off"'), 'luz da central acesa no tablet B');
      // B anota a dorna Nº 2 e A recebe: cada um fez uma parte e as duas se juntam
      await b.tocar('[data-a="abrir-prancheta"][data-id="hid_anexo1"]');
      await b.tocar('[data-a="linha"][data-chave="2"]');
      await b.tocar('[data-quadro="brix"]'); await b.teclar(['2', '1']);
      await b.tocar('[data-ed="ocultar"]');
      await b.tocar('[data-a="salvar"]');
      await a.esperar(`!!${dorna(2, '21')}`, 90000, 'o tablet A receber a dorna 2 pela nuvem');
      certo(await b.avaliar(`!!${dorna(1, '19')}`), 'o tablet B perdeu a dorna 1 ao anotar a 2');
      // os dois saem antes da central voltar: assim ela só pode pegar as anotações na nuvem
      await a.fechar(); await b.fechar();
      await central.reiniciar();
      // a central puxa a fila da nuvem a cada minuto e confere cada anotação com as regras do aparelho que fez
      let naCentral = [];
      for (let i = 0; i < 60 && naCentral.length < 2; i++) {
        await dormir(2000);
        try { naCentral = ((await central.api('/api/registros?desde=0')).registros || []).filter((r) => r.prancheta === 'hid_anexo1' && !r.apagado && ((String(r.chave) === '1' && r.valores.brix === '19') || (String(r.chave) === '2' && r.valores.brix === '21'))); } catch { /* ligando */ }
      }
      certo(naCentral.length === 2, `a central puxou ${naCentral.length} de 2 dornas da nuvem`);
    });
  } finally { await a.fechar(); await b.fechar(); }
}
