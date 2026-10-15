/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * Versão 2.13.5: o aplicativo não trava sem a central.
 *   - a central desliga e o relógio anda 13 horas: o tablet continua funcionando (antes, depois de 12 horas,
 *     ficava preso na tela "Conecte no Wi-Fi da usina");
 *   - o botão Conexão mostra a luz da central apagada e explica que pode continuar anotando.
 */
import { teste, certo } from './teste.mjs';
import { TAMANHOS, dormir } from './navegador.mjs';

export async function testarConexao2135(nav, central, grupo) {
  const a = await nav.novoAparelho('tablet Hidrólise', TAMANHOS.tablet);
  let ligada = true;
  try {
    await teste(grupo, 'central desligada há 13 horas: o tablet não trava e o botão Conexão mostra a central apagada', async () => {
      await a.relogioFalso();
      await a.ir(central.url + '/', 'document.querySelector("[data-quadro=\\"codigo\\"]")');
      await a.tocar('[data-quadro="codigo"]');
      await a.teclar(central.codigo().split(''));
      await a.tocar('[data-ed="ocultar"]');
      await a.tocar('[data-a="conectar"]');
      await a.tocar('[data-a="papel"][data-id="hidrolise"]', null, { esperarMs: 15000 });
      await a.tocar('[data-a="escolher-operador"][data-nome="Guilherme"]');
      await a.esperar('!!document.querySelector("#status-con .luzes i.ok")', 15000, 'luz da central acesa');
      await central.desligar(); ligada = false;
      await a.avaliar('__adiantar(13 * 3600000)');
      // a sincronização (a cada 5 s) falha algumas vezes e a luz da central apaga
      await a.esperar('document.querySelector("#status-con .luzes i").className === "off"', 30000, 'luz da central apagada');
      await dormir(2000);
      certo(!(await a.avaliar('document.body.innerText.includes("Conecte no Wi-Fi da usina")')), 'o tablet travou na tela de conectar');
      certo(await a.avaliar('!!document.querySelector("#app main")'), 'a tela do aplicativo sumiu');
      await a.tocar('#status-con');
      await a.esperar('!!document.querySelector(".modal .status-linha")', 5000, 'janela da conexão');
      const texto = await a.avaliar('document.querySelector(".modal").innerText');
      certo(texto.includes('Central: desligada') && texto.includes('Pode anotar com as duas desligadas'), 'janela da conexão: ' + texto.slice(0, 200));
    });
  } finally {
    await a.fechar();
    if (ligada) await central.desligar();
  }
}
