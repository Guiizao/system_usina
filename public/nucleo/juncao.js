/* Pranchetas Digitais - © 2026 Guilherme. Junção usada pela central, nuvem e aplicativo. */
(function (raiz) {
  'use strict';
  const objeto = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
  function valido(r) {
    return r.camposEm === undefined || (objeto(r.camposEm) && objeto(r.valores)
      && Object.entries(r.camposEm).every(([k, em]) => !['__proto__', 'constructor', 'prototype'].includes(k)
        && Number.isSafeInteger(em) && em >= 0 && em <= r.atualizadoEm));
  }
  function juntar(a, b) {
    if (!a || !b || a.id !== b.id || a.data === 'config' || b.data === 'config' || a.apagado || b.apagado
      || !a.camposEm || !b.camposEm || !valido(a) || !valido(b)) return null;
    const novo = b.atualizadoEm >= a.atualizadoEm ? b : a;
    const valores = {}, camposEm = {};
    for (const k of new Set([...Object.keys(a.valores), ...Object.keys(b.valores), ...Object.keys(a.camposEm), ...Object.keys(b.camposEm)])) {
      if (['__proto__', 'constructor', 'prototype'].includes(k)) continue;
      const ea = a.camposEm[k] || 0, eb = b.camposEm[k] || 0;
      // Empate tem resultado estável nos dois sentidos, inclusive para campo removido.
      const fonte = eb > ea || (eb === ea && (JSON.stringify(b.valores[k]) || '') >= (JSON.stringify(a.valores[k]) || '')) ? b : a;
      if (Object.hasOwn(fonte.valores, k)) valores[k] = fonte.valores[k];
      camposEm[k] = Math.max(ea, eb);
    }
    return Object.assign({}, a, b, novo, { valores, camposEm, atualizadoEm: Math.max(a.atualizadoEm, b.atualizadoEm) });
  }
  /** Relógio adiantado não pode ganhar para sempre: acima de 5 minutos no futuro, a hora vira a de quem recebe. */
  function semFuturo(r, agora) {
    if (!(r.atualizadoEm > agora + 300000)) return r;
    const camposEm = objeto(r.camposEm) ? Object.fromEntries(Object.entries(r.camposEm).map(([k, em]) => [k, Math.min(em, agora)])) : r.camposEm;
    return Object.assign({}, r, { atualizadoEm: agora }, camposEm ? { camposEm } : {});
  }
  const Juncao = { valido, juntar, semFuturo };
  if (typeof module === 'object' && module.exports) module.exports = Juncao;
  else raiz.Juncao = Juncao;
})(typeof window !== 'undefined' ? window : this);
