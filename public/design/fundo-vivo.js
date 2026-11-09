/* Pranchetas Ubirálcool - fundo com movimento atrás do painel novo (computador e celular com a chave ligada)
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* Fica fora do #app: o redesenho de 5 em 5 segundos não reinicia o movimento. Quem mostra ou esconde é o CSS (data-painel-novo). */
  (function fundoVivo() {
    const TROCA = 10 * 60 * 1000; // um efeito a cada 10 minutos, igual em todo aparelho e depois de recarregar
    const onda = (amp) => `M0 70 q100 ${-amp} 200 0${' t200 0'.repeat(7)} V200 H0Z`;
    const EFEITOS = {
      ondas: [[46, 34, 46, 0.05], [30, 26, 31, 0.07], [20, 18, 22, 0.09]].map(([amp, h, t, o]) =>
        `<svg class="fv-onda" viewBox="0 0 1600 200" preserveAspectRatio="none" style="--h:${h}%;--t:${t}s;--o:${o}"><path d="${onda(amp)}"/></svg>`).join(''),
      // três nuvens em lugares e tempos diferentes: uma some enquanto a outra aparece
      vapor: [['left:-12%;top:-18%', 21, 0, '14%', '16%'], ['right:-12%;top:22%', 25, -8, '-16%', '-12%'], ['left:22%;bottom:-30%', 23, -15, '12%', '-14%']].map(([onde, t, d, x, y]) =>
        `<span class="fv-nuvem" style="${onde};--t:${t}s;--d:${d}s;--x:${x};--y:${y}"></span>`).join(''),
      bolhas: [[6, 18, 34, 0], [14, 42, 46, -9], [23, 12, 28, -20], [31, 56, 52, -33], [40, 22, 38, -5], [49, 34, 44, -26], [58, 14, 30, -14], [67, 48, 50, -40], [76, 20, 36, -18], [85, 38, 42, -30], [93, 16, 32, -7]].map(([x, s, t, d]) =>
        `<span class="fv-bolha" style="left:${x}%;width:${s}px;height:${s}px;--t:${t}s;--d:${d}s"></span>`).join(''),
      gotas: [[12, 62, 240, 7, 0], [68, 78, 300, 9, -2], [38, 88, 200, 6, -4], [86, 58, 260, 8, -5], [22, 92, 280, 10, -7], [55, 66, 220, 7, -3]].map(([x, y, s, t, d]) =>
        `<span class="fv-pingo" style="left:calc(${x}% - ${s / 2}px);top:calc(${y}% - ${s / 2}px);--s:${s}px;--t:${t}s;--d:${d}s"></span>`).join(''),
      luz: [[34, 58, 0], [20, 44, -19], [26, 70, -40]].map(([l, t, d]) =>
        `<span class="fv-luz" style="width:${l}%;--t:${t}s;--d:${d}s"></span>`).join(''),
    };
    const raiz = document.createElement('div');
    raiz.id = 'fundo-vivo'; raiz.setAttribute('aria-hidden', 'true');
    raiz.innerHTML = Object.entries(EFEITOS).map(([nome, html]) => `<div class="fv" data-fv="${nome}">${html}</div>`).join('');
    document.body.prepend(raiz);
    const nomes = Object.keys(EFEITOS);
    const trocar = () => { const vez = nomes[Math.floor(Date.now() / TROCA) % nomes.length]; raiz.querySelectorAll('.fv').forEach((c) => c.classList.toggle('ativo', c.dataset.fv === vez)); };
    trocar();
    setInterval(trocar, 15000);
  })();
