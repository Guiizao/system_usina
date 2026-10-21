/* Pranchetas Ubirálcool - grades sem caixa sozinha na última linha
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * 2.16.1 (pedido de 21/10): grade de botões e de cartões não deixa caixa sozinha embaixo com um vazio do lado.
   * Até 4 ficam numa linha só (as caixas diminuem); mais de 4, as linhas ficam iguais: 6 = 3 + 3, 8 = 4 + 4 (5 = 3 + 2).
   * Onde não cabem (celular), divide igual do mesmo jeito: 4 = 2 + 2.
   * [grade, largura mínima de cada caixa em px, máximo por linha]. Grade nova de botões ou cartões: ponha aqui.
   * Uma grade com duas classes da lista fica com a primeira (ex.: as "escolhas" dos formatos de envio).
   * ========================================================= */
  const GRADES = [
    ['.grade-acoes', 96, 4], ['.escolhas', 200, 4], ['.opcoes:not(.nomes)', 150, 4], ['.opcoes.nomes', 220, 4],
    ['.papeis', 180, 4], ['.turnos', 200, 4], ['.setores-grade', 260, 4], ['.chips-escolha', 170, 4],
    ['.relatorio-dia .linha-botoes', 150, 4], ['.boas-vindas.conectar .linha-botoes', 220, 3],
  ];
  /** Quantas colunas: o máximo que cabe (até o limite), com as linhas o mais iguais possível. */
  function colunasDaGrade(n, largura, minimo, maximo, vao) {
    const cabem = Math.max(1, Math.floor((largura + vao) / (minimo + vao)));
    const linhas = Math.ceil(n / Math.min(maximo, cabem, n));
    const colunas = Math.ceil(n / linhas);
    return colunas === 2 && n === 3 ? 1 : colunas; // 3 em 2 colunas deixaria um sozinho: um por linha
  }
  function equilibrarGrades(raiz = document) {
    const vistas = new Set();
    for (const [sel, minimo, maximo] of GRADES) {
      const grades = raiz.matches && raiz.matches(sel) ? [raiz] : raiz.querySelectorAll(sel);
      grades.forEach((g) => {
        if (vistas.has(g)) return;
        vistas.add(g);
        const largura = g.clientWidth;
        if (!largura) return; // escondida: arruma quando aparecer
        const n = [...g.children].filter((x) => x.getClientRects().length).length;
        if (!n) return;
        const colunas = String(colunasDaGrade(n, largura, minimo, maximo, parseFloat(getComputedStyle(g).columnGap) || 0));
        if (g.dataset.colunas !== colunas) { g.dataset.colunas = colunas; g.style.gridTemplateColumns = `repeat(${colunas}, minmax(0, 1fr))`; }
      });
    }
  }
