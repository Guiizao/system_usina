/* Pranchetas Ubirálcool - Ralo: vários bags pesados na mesma hora
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * Vários bags na mesma hora (2.16, pedido do Guilherme): das 08:00 às 08:59 podem passar 5 bags.
   * O operador anota o peso do primeiro e toca em "+ Outro bag": o peso sobe pequeno no quadro, o visor fica vazio
   * para o próximo, e o quadro mostra a soma. Cada pesagem fica guardada em "pesagens" ("160+170+"; a última é a
   * que está no visor). O total continua em "qtd": relatórios, Excel, API e totais não mudam.
   * Liga na folha com somaPesagens: true (setores/ralo/pranchetas.js).
   * ========================================================= */
  function pesagensNaHora(val) {
    const bags = () => (val.pesagens ? String(val.pesagens).split('+') : null);
    const somar = (lista) => (lista.some((x) => !vazio(x)) ? String(Math.round(lista.reduce((s, x) => s + (parseFloat(x) || 0), 0) * 100) / 100) : '');
    const guardar = (lista) => {
      if (lista.length < 2) { val.pesagens = ''; val.qtd = lista[0] || ''; return; }
      val.pesagens = lista.join('+'); val.qtd = somar(lista);
    };
    return {
      // o visor mostra só o bag que está sendo pesado; o quadro mostra a soma
      get: () => { const b = bags(); return b ? b[b.length - 1] : val.qtd; },
      set: (x) => { const b = bags(); if (!b) { val.qtd = x; return; } b[b.length - 1] = x; guardar(b); },
      total: () => val.qtd,
      parcelas: () => (bags() || []).slice(0, -1).filter((x) => !vazio(x)),
      somar: () => {
        const b = bags() || [val.qtd];
        if (!(parseFloat(b[b.length - 1]) > 0)) { toast('Anote o peso deste bag antes de somar outro', 'erro'); return false; }
        guardar([...b, '']);
        return true;
      },
      // visor vazio e lixeira: tira o último bag que já tinha subido
      ultimaParcela: () => { const b = bags(); return b && b.length > 1 && vazio(b[b.length - 1]) ? b[b.length - 2] : ''; },
      tirarUltima: () => { const b = bags(); if (!b || b.length < 2) return; b.splice(b.length - 2, 1); guardar(b.length === 1 && vazio(b[0]) ? [] : b); },
    };
  }
