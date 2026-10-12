/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * Versão 2.13.2, no aplicativo (demonstração): o lembrete de anotar a cada hora.
 *   - passou das :30 com a linha vazia: faixa vermelha e apito chato repetindo;
 *   - tocar em "Anotar agora" cala o apito, tira a faixa (até a próxima hora) e abre a linha daquela hora;
 *   - 2.13.3: fora do horário de trabalho do setor não toca (o celular da firma vai para casa com a pessoa).
 */
import { teste, certo, igual } from './teste.mjs';
import { TAMANHOS, dormir } from './navegador.mjs';

export async function testarLembrete213(nav, url, grupo) {
  const a = await nav.novoAparelho('celular', TAMANHOS.motorola);
  try {
    await teste(grupo, '"Anotar agora" cala o apito chato, tira a faixa e abre a linha da hora', async () => {
      // perto da virada da hora o lembrete muda de hora no meio do teste: espera a hora virar
      const agora = new Date();
      if (agora.getMinutes() === 59 && agora.getSeconds() > 30) await dormir((62 - agora.getSeconds()) * 1000);
      await a.ir(url + '/?demo&papel=destilaria&op=Mateus&lembrete=urgente', '!!document.querySelector("#lembrete:not([hidden])")');
      // conta os apitos (cada apito abre um AudioContext) sem fazer barulho no teste
      await a.avaliar('(() => { window.__apitos = 0; window.AudioContext = function () { window.__apitos++; throw new Error("sem som"); }; return 1; })()');
      await dormir(2800);
      certo((await a.avaliar('window.__apitos')) >= 1, 'o apito chato não repetiu');
      const h = String(new Date().getHours()).padStart(2, '0');
      certo((await a.avaliar('document.getElementById("lembrete").innerText')).includes(`Ainda falta a leitura das ${h}:00`), 'texto da faixa');
      await a.tocar('#lembrete [data-pid]');
      await a.esperar('document.getElementById("lembrete").hidden', 3000, 'a faixa sumir');
      await a.esperar(`document.body.innerText.includes('leitura das ${h}:00')`, 5000, 'abrir a linha das ' + h + ':00');
      await a.avaliar('window.__apitos = 0');
      // passa de uma conferência do lembrete (a cada 10 s) e de vários apitos (a cada 2,5 s)
      await dormir(12000);
      igual(await a.avaliar('window.__apitos'), 0, 'apitos depois de tocar em Anotar agora');
      certo(await a.avaliar('document.getElementById("lembrete").hidden'), 'a faixa voltou sem a linha ser anotada');
    });

    await teste(grupo, 'fora do horário do setor o lembrete não toca, mesmo com a linha vazia e alguém no turno', async () => {
      await a.ir(url + '/?demo&papel=destilaria&op=Mateus&lembrete=fora', 'document.querySelector("#app main")');
      await dormir(1500);
      certo(!(await a.existe('#lembrete:not([hidden])')), 'a faixa apareceu fora do horário');
      // a mesma hora, dentro do horário (o dia todo): a faixa aparece
      await a.ir(url + '/?demo&papel=destilaria&op=Mateus&lembrete=1', '!!document.querySelector("#lembrete:not([hidden])")');
    });
  } finally { await a.fechar(); }
}
