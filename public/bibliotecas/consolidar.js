/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Conta do período (3.1): o que é quantidade soma; o que é medição dá média, mínima e máxima. */
(function (raiz) {
  const numero = (typeof module === 'object' && module.exports ? require('./rastreamento.js') : raiz.Rastreamento).numero;
  const arred = (x) => Math.round(x * 100) / 100;
  const soma = (ns) => ns.reduce((s, n) => s + n, 0);
  const numeros = (lista) => lista.map(numero).filter((n) => n !== '');

  const agregaDoCampo = (campo) => campo.agrega || (campo.type === 'num' ? 'media' : 'nenhum');

  /** Só o que vale: registro apagado fica de fora e, na grade, a linha de observação (chave não numérica). */
  function validos(prancheta, regs) {
    return (regs || []).filter((r) => !r.apagado && (prancheta.tipo !== 'grade' || /^\d+$/.test(String(r.chave))));
  }

  function daFolha(prancheta, registrosPorDia, dias) {
    const porDia = dias.map((d) => validos(prancheta, registrosPorDia[d]));
    const regs = porDia.flat();
    const campos = [...(prancheta.campos || []), ...(prancheta.itens || []), ...(prancheta.parametros || [])].filter((c) => c.type === 'num');
    const quantidades = [], medicoes = [];
    for (const c of campos) {
      const tipo = agregaDoCampo(c), ns = numeros(regs.map((r) => (r.valores || {})[c.id]));
      if (!ns.length || tipo === 'nenhum') continue;
      const base = { id: c.id, rotulo: c.label, unidade: c.unidade || '' };
      if (tipo === 'soma') quantidades.push(Object.assign(base, { total: arred(soma(ns)) }));
      else medicoes.push(Object.assign(base, { media: arred(soma(ns) / ns.length), minima: arred(Math.min(...ns)), maxima: arred(Math.max(...ns)), leituras: ns.length }));
    }
    return {
      quantidades, medicoes,
      operadores: [...new Set(regs.map((r) => String(r.operador || '').trim()).filter(Boolean))],
      diasSemAnotacao: dias.filter((d, i) => !porDia[i].length),
    };
  }

  function producao(lista) {
    const total = (k) => { const ns = numeros(lista.map((x) => x[k])); return ns.length ? arred(soma(ns)) : ''; };
    const media = (k) => { const ns = numeros(lista.map((x) => x[k])); return ns.length ? arred(soma(ns) / ns.length) : ''; };
    return {
      alcool: total('alcool'), vinhaca: total('vinhaca'), hidrolisado: total('hidrolisado'), vinho: total('vinho'),
      inpm: media('inpm'), brix: media('brix'), dias: lista.length, naoConferidos: lista.filter((x) => !x.conferido).length,
    };
  }

  const Consolidar = { agregaDoCampo, daFolha, producao };
  if (typeof module === 'object' && module.exports) module.exports = Consolidar;
  else raiz.Consolidar = Consolidar;
})(typeof window !== 'undefined' ? window : this);
