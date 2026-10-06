/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * A folha em vigor: o forms.js (o original) com o que o tablet chefe mudou em "Folhas e avisos" (configSistema().folhas).
 * O mesmo código roda no aplicativo e na central do computador (para a API mostrar igual ao que o operador vê).
 *
 * Por quadro:   label, labelCurto, unidade, min, max, dica, avisos (desde a 2.10)
 *               historico [{ate:'AAAA-MM-DD', unidade}]: a unidade de antes, até aquele dia (2.12; nada é convertido)
 *               dec (vírgula: 0, 1 ou 2 casas) e oculto (o operador não vê) - só o dono, num tablet chefe nível 3 (2.12)
 * Por folha:    _unidades (insumos, desde a 2.10)
 *               _operador [ids]: campos do escritório que o operador também preenche (insumos) - só o dono (2.12)
 *               _novos [{id, label, labelCurto, type, unidade, dec, opcoes, dica, arquivado}]: campos novos - só o dono (2.12)
 * Campo novo entra no fim: grade (linha nova), dornas (grupo "Outros") e insumo (depois dos campos do operador).
 * Ele leva novo: true, para os relatórios iguais ao papel deixarem de fora (o desenho do papel não muda).
 * Campo novo arquivado continua na lista com arquivado: true (os dias antigos aparecem no Monitorar, no XML e na API);
 * a tela de anotar e a de mudar as folhas não mostram.
 */
(function (raiz) {
  const EDITAVEIS = ['label', 'labelCurto', 'unidade', 'min', 'max', 'dica', 'avisos', 'historico', 'dec', 'oculto'];
  const TIPOS_NOVOS = ['num', 'text', 'choice', 'time', 'check'];
  const copia = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  /** Onde ficam os quadros de cada tipo de folha (os que o dono pode mudar). */
  const listaDe = (p) => (p.tipo === 'grade' ? 'itens' : p.tipo === 'dornas' || p.tipo === 'fermentacao' ? 'campos' : p.tipo === 'medicao' ? 'parametros' : p.tipo === 'insumo' ? 'camposOperador' : null);
  /** Folhas que aceitam campo novo. */
  const aceitaNovo = (p) => p.tipo === 'grade' || p.tipo === 'dornas' || p.tipo === 'insumo';

  /** Um campo novo limpo (o que vier diferente disso não entra). */
  function campoNovo(d) {
    if (!d || typeof d.id !== 'string' || !/^x_[a-z0-9]{3,20}$/.test(d.id) || !TIPOS_NOVOS.includes(d.type)) return null;
    const c = { id: d.id, label: String(d.label || 'Campo novo').slice(0, 40), type: d.type, novo: true };
    if (d.labelCurto) c.labelCurto = String(d.labelCurto).slice(0, 20);
    if (d.dica) c.dica = String(d.dica).slice(0, 160);
    if (d.type === 'num') {
      c.dec = [0, 1, 2].includes(Number(d.dec)) ? Number(d.dec) : 0;
      if (d.unidade) c.unidade = String(d.unidade).slice(0, 12);
    }
    if (d.type === 'choice') c.opcoes = (Array.isArray(d.opcoes) ? d.opcoes : []).map((o) => String(o).slice(0, 30)).filter(Boolean).slice(0, 20);
    if (d.arquivado) c.arquivado = true;
    return c;
  }

  /**
   * Põe as mudanças das folhas por cima do forms (mexe no próprio objeto, como o aplicativo sempre fez).
   * originais: um Map que guarda como cada folha era no forms.js (o mesmo Map em todas as chamadas).
   */
  function aplicar(forms, folhas, originais) {
    const f = folhas || {};
    Object.entries(forms.pranchetas || {}).forEach(([pid, p]) => {
      const nome = listaDe(p);
      // como a folha era no forms.js: as listas de quadros, os grupos e as unidades
      if (!originais.has(pid)) {
        originais.set(pid, {
          lista: nome ? (p[nome] || []).map((c) => { const o = {}; EDITAVEIS.forEach((k) => { o[k] = copia(c[k]); }); return { c, o }; }) : [],
          ordem: nome ? (p[nome] || []).slice() : [],
          grupos: p.grupos ? copia(p.grupos) : null,
          unidades: p.tipo === 'insumo' ? (p.unidades || []).slice() : null,
        });
      }
      const orig = originais.get(pid);
      const m = f[pid] || {};
      // os quadros do forms.js, com as mudanças (o que não mudou volta ao original)
      orig.lista.forEach(({ c, o }) => {
        const mc = m[c.id] || {};
        EDITAVEIS.forEach((k) => {
          const v = mc[k] !== undefined ? mc[k] : o[k];
          if (v === undefined || v === null || v === '') delete c[k]; else c[k] = copia(v);
        });
        if (!c.label) c.label = o.label; // o nome nunca fica vazio
      });
      if (nome) {
        const lista = orig.ordem.slice();
        // as mudanças do tablet chefe num campo que não está no forms.js (campo do escritório para o operador, campo novo)
        // (vazio ou null apaga: a unidade ou a dica que o tablet chefe tirou)
        const comMudancas = (c) => { const mc = m[c.id] || {}; EDITAVEIS.forEach((k) => { if (!(k in mc)) return; if (mc[k] === null || mc[k] === '') { if (k !== 'label') delete c[k]; } else c[k] = copia(mc[k]); }); return c; };
        // insumo: campos do escritório que o operador também preenche (uma cópia, com as mudanças; o do escritório,
        // que vai no papel, fica como no forms.js)
        if (p.tipo === 'insumo') {
          (m._operador || []).forEach((id) => {
            const c = (p.camposEscritorio || []).find((x) => x.id === id);
            if (c && !lista.some((x) => x.id === id)) lista.push(comMudancas(Object.assign({ type: 'text' }, copia(c), { doEscritorio: true })));
          });
        }
        // campos novos: o arquivado fica na lista (com arquivado: true) para os dias antigos, fora do grupo de anotar
        const novos = aceitaNovo(p) ? (m._novos || []).map(campoNovo).filter(Boolean) : [];
        novos.forEach((d) => lista.push(comMudancas(Object.assign({}, d))));
        p[nome] = lista;
        if (orig.grupos) {
          p.grupos = copia(orig.grupos);
          const ativos = novos.filter((c) => !c.arquivado);
          if (ativos.length) p.grupos.push({ titulo: 'Outros', campos: ativos.map((c) => c.id) });
        }
      }
      if (p.tipo === 'insumo') {
        const u = (m._unidades || []).filter(Boolean);
        p.unidades = u.length ? u.slice() : orig.unidades.slice();
        p.unidade = p.unidades[0];
      }
    });
    return forms;
  }

  /** A unidade de um quadro num dia: a de antes, se a troca foi depois desse dia (nada é convertido). */
  function unidadeNoDia(c, data) {
    if (!c) return '';
    const h = Array.isArray(c.historico) ? c.historico.slice().sort((a, b) => (a.ate < b.ate ? -1 : 1)) : [];
    if (data) { const v = h.find((x) => data <= x.ate); if (v) return v.unidade || ''; }
    return c.unidade || '';
  }

  /** As unidades sugeridas na tela, por tipo (o dono também pode digitar outra). */
  const UNIDADES = [
    ['Temperatura', ['°C', '°F']],
    ['Peso', ['g', 'kg', 't']],
    ['Volume', ['mL', 'L', 'm³']],
    ['Pressão', ['kgf', 'kgf/cm²', 'bar', 'psi']],
    ['Contagem', ['copos', 'sacos', 'un']],
    ['Outros', ['%', '°', 'pH', 'ppm']],
  ];

  const Folhas = { aplicar, unidadeNoDia, campoNovo, listaDe, aceitaNovo, UNIDADES, EDITAVEIS };
  if (typeof module === 'object' && module.exports) module.exports = Folhas;
  else raiz.Folhas = Folhas;
})(typeof window !== 'undefined' ? window : this);
