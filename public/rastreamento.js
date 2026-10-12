/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Contas do Escritório (2.13). Datas são civis; registros.data já identifica o dia de produção das 07:00 às 07:00. */
(function (raiz) {
  const numero = (v) => {
    if (v == null || v === '' || (typeof v !== 'number' && typeof v !== 'string') || String(v).trim() === '') return '';
    const n = Number(String(v).trim().replace(',', '.'));
    return Number.isFinite(n) ? n : '';
  };
  const distintos = (lista) => [...new Set(lista.map((v) => String(v == null ? '' : v).trim()).filter(Boolean))];
  const juntar = (regs, campo) => distintos(regs.map((r) => r.valores[campo])).join(' / ');
  const soma = (ns) => ns.length ? ns.reduce((s, n) => s + n, 0) : '';
  const media = (ns) => ns.length ? soma(ns) / ns.length : '';
  const numeros = (regs, campo) => regs.map((r) => numero(r.valores[campo])).filter((n) => n !== '');
  function dataCivil(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('Data inválida: use AAAA-MM-DD');
    const d = new Date(s + 'T12:00:00Z');
    if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== s) throw new Error('Data inválida');
    return d;
  }
  function dias(s, n) { const d = dataCivil(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function meses(s, n) {
    const d = dataCivil(s), dia = d.getUTCDate();
    d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n);
    const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(dia, ultimo));
    return d.toISOString().slice(0, 10);
  }
  // C é opcional na chamada direta; lote sempre usa a configuração recebida.
  function letraDoMes(mes, C) {
    const letras = ((C || raiz.USINA || {}).rastreamento || {}).letrasDosMeses || 'LABCDEFGHIJK';
    return Number.isInteger(Number(mes)) && mes >= 1 && mes <= 12 ? letras[Number(mes) - 1] || '' : '';
  }
  function lote(C, fechamento) {
    dataCivil(fechamento);
    const c = C.rastreamento;
    return c.prefixoLote + fechamento.slice(2, 4) + letraDoMes(Number(fechamento.slice(5, 7)), C) + fechamento.slice(8, 10) + c.horaDoLote;
  }

  /** Aplica {campo:'pi.hidrolise', valor:123}, mapa de caminhos ou objeto parcial; altera e devolve valores. */
  function recalcular(v, mudanca) {
    v.origem = v.origem || {};
    const alterados = new Set();
    const aplicar = (campo, valor) => {
      const partes = campo.split('.');
      if (partes.some((p) => ['__proto__', 'prototype', 'constructor', 'origem'].includes(p))) return;
      let alvo = v;
      for (const p of partes.slice(0, -1)) { if (!alvo[p] || typeof alvo[p] !== 'object') return; alvo = alvo[p]; }
      const k = partes[partes.length - 1];
      if (!(k in alvo)) return;
      const numerico = /^(volumeDestilado|calculo\.[^.]+|pi\.[^.]+|(?:alcool|vinhaca)\.producao|hidrolise\.[^.]+|alcoolParam\.[^.]+|tanques\.[^.]+\.[^.]+|insumos\.[^.]+\.qtd|mp\.\d+\.kg|lenha\.\d+\.m3)$/.test(campo);
      alvo[k] = numerico ? numero(valor) : valor;
      v.origem[campo] = alvo[k] === '' ? '' : 'digitado no Escritório';
      alterados.add(campo);
    };
    const percorrer = (o, prefixo = '') => Object.entries(o).forEach(([k, valor]) => {
      const campo = prefixo ? prefixo + '.' + k : k;
      if (valor && typeof valor === 'object' && !Array.isArray(valor)) percorrer(valor, campo); else aplicar(campo, valor);
    });
    if (mudanca && typeof mudanca.campo === 'string') aplicar(mudanca.campo, mudanca.valor);
    else if (mudanca) percorrer(mudanca);
    const depende = (...campos) => !mudanca || campos.some((c) => alterados.has(c));
    const calcularCampo = (obj, chave, caminho, resultado, origem) => {
      obj[chave] = Number.isFinite(resultado) ? resultado : '';
      v.origem[caminho] = obj[chave] === '' ? '' : origem;
      alterados.add(caminho);
    };
    const c = v.calculo;
    if (depende('calculo.mpKg', 'calculo.fator')) calcularCampo(v.pi, 'hidrolise', 'pi.hidrolise',
      c.mpKg !== '' && c.fator > 0 ? c.mpKg / c.fator : NaN, 'matéria-prima (kg) ÷ fator');
    if (depende('pi.hidrolise', 'calculo.brixInicial', 'calculo.brixFinal')) calcularCampo(v.pi, 'vinho', 'pi.vinho',
      v.pi.hidrolise !== '' && c.brixInicial !== '' && c.brixFinal > 0 ? v.pi.hidrolise * c.brixInicial / c.brixFinal : NaN, 'hidrolisado × Brix inicial ÷ Brix final');
    if (depende('calculo.alcoolDestilaria', 'calculo.alcoolNova')) calcularCampo(v.alcool, 'producao', 'alcool.producao',
      c.alcoolDestilaria !== '' || c.alcoolNova !== '' ? (c.alcoolDestilaria || 0) + (c.alcoolNova || 0) : NaN, 'soma da Destilaria e da Nova Destilaria');
    if (depende('volumeDestilado', 'alcool.producao')) calcularCampo(v.vinhaca, 'producao', 'vinhaca.producao',
      v.volumeDestilado !== '' && v.alcool.producao !== '' ? v.volumeDestilado - v.alcool.producao : NaN, 'volume destilado − produção de álcool');
    return v;
  }

  function calcular(C, dia, registros) {
    const cfg = C.rastreamento, fechamento = dias(dia, 1), codigo = lote(C, fechamento);
    const regs = (registros || []).filter((r) => !r.apagado && (!r.data || r.data === dia) && r.prancheta !== 'rastreamento').map((r) => Object.assign({}, r, { valores: r.valores || {} }));
    const de = (pid) => regs.filter((r) => r.prancheta === pid);
    const v = {
      fechamento, lote: codigo,
      alcool: { producao: '', lote: codigo, validade: meses(fechamento, cfg.validadeAlcoolMeses) },
      vinhaca: { producao: '', lote: '', validade: dias(fechamento, cfg.validadeVinhacaDias) }, volumeDestilado: '',
      pi: { hidrolise: '', vinho: '' },
      calculo: { mpKg: '', fator: numero(cfg.fatorMateriaPrima), brixInicial: '', brixFinal: '', alcoolDestilaria: '', alcoolNova: '' },
      hidrolise: { ph: '', brix: '', temp: '' }, alcoolParam: { inpm: '', gl: '', acidez: '' },
      tanques: {}, insumos: {}, mp: [], lenha: [], operadores: distintos(regs.map((r) => r.operador)), encarregado: cfg.encarregado || '', origem: {},
    };
    const guardar = (caminho, n, origem) => {
      const ps = caminho.split('.'); let o = v;
      ps.slice(0, -1).forEach((p) => { o = o[p]; }); o[ps[ps.length - 1]] = n;
      v.origem[caminho] = n === '' ? '' : origem;
    };
    const quantidade = (r, pid) => {
      const n = numero(r.valores.qtd);
      const unidade = String(r.valores.unidade || (C.pranchetas[pid] || {}).unidade || '').trim();
      return { qtd: n === '' ? '' : /^(mL|g)$/i.test(unidade) ? n / 1000 : n, unidade: /^ml$/i.test(unidade) ? 'L' : /^g$/i.test(unidade) ? 'kg' : unidade };
    };
    const mp = de('ins_materia_prima');
    const kg = (r) => { const q = quantidade(r, 'ins_materia_prima'); return q.unidade === 'kg' ? q.qtd : ''; };
    guardar('calculo.mpKg', soma(mp.map(kg).filter((n) => n !== '')), 'soma da matéria-prima do dia (kg)');
    guardar('calculo.fator', v.calculo.fator, 'fator configurado da matéria-prima');
    distintos(mp.map((r) => r.valores.produto || r.valores.tipo)).forEach((produto) => {
      const lista = mp.filter((r) => String(r.valores.produto || r.valores.tipo || '').trim() === produto);
      v.mp.push({ produto, kg: soma(lista.map(kg).filter((n) => n !== '')), fornecedor: juntar(lista, 'fornecedor'), nf: juntar(lista, 'nf') });
    });
    // Anotações sem produto continuam visíveis na linha em branco de matéria-prima.
    const semProduto = mp.filter((r) => !String(r.valores.produto || r.valores.tipo || '').trim());
    if (semProduto.length) v.mp.push({ produto: '', kg: soma(semProduto.map(kg).filter((n) => n !== '')), fornecedor: juntar(semProduto, 'fornecedor'), nf: juntar(semProduto, 'nf') });
    v.mp.forEach((m, i) => { v.origem[`mp.${i}.kg`] = m.kg === '' ? '' : 'soma da matéria-prima por produto'; });
    const med = de('med_dornas'), hid = de('hid_anexo1');
    [['brixInicial', 'brix_hid', hid, 'brix'], ['brixFinal', 'brix_ferm', de('fermentacao'), 'brix_inicial']].forEach(([campo, parametro, fallback, fonte]) => {
      const anotados = numeros(med.filter((r) => r.chave === 'param'), parametro), ns = numeros(fallback, fonte);
      guardar('calculo.' + campo, anotados.length ? anotados[anotados.length - 1] : media(ns), anotados.length ? 'medição do Brix do dia' : `média de ${ns.length} dornas`);
    });
    [['ph', 'phf'], ['brix', 'brix']].forEach(([campo, fonte]) => {
      const ns = numeros(hid, fonte); guardar('hidrolise.' + campo, media(ns), `média de ${ns.length} dornas da Hidrólise`);
    });
    [['alcoolDestilaria', 'destilaria', 'producao', 'Destilaria'], ['alcoolNova', 'nova_destilaria', 'producao_lth', 'Nova Destilaria']].forEach(([campo, pid, fonte, nome]) => {
      const ns = numeros(de(pid).filter((r) => /^\d+$/.test(r.chave)), fonte);
      guardar('calculo.' + campo, soma(ns), `soma de ${ns.length} horas da ${nome}`);
    });
    const inpm = numeros([...de('destilaria'), ...de('nova_destilaria')].filter((r) => /^\d+$/.test(r.chave)), 'inpm');
    guardar('alcoolParam.inpm', media(inpm), `média de ${inpm.length} medições das destilarias`);
    cfg.tanques.forEach((g) => g.lista.forEach(([id, , dorna]) => {
      const ns = dorna ? numeros(med, dorna + '_folga') : [];
      v.tanques[id] = { brix: '', ph: '', folga: '' };
      guardar(`tanques.${id}.folga`, ns.length ? ns[ns.length - 1] : '', 'folga medida no dia: ' + dorna);
    }));
    [...cfg.insumos, ...cfg.tratamentoAgua, ...cfg.higienizacao].forEach(([id, , pid]) => {
      const lista = pid ? de(pid) : [], qs = lista.map((r) => quantidade(r, pid));
      const unidades = distintos(qs.filter((q) => q.qtd !== '').map((q) => q.unidade));
      // Não somar litros com quilos/copos: o Escritório deve resolver unidades incompatíveis.
      const qtd = unidades.length <= 1 ? soma(qs.map((q) => q.qtd).filter((n) => n !== '')) : '';
      v.insumos[id] = { qtd, unidade: unidades.join(' / '), lote: juntar(lista, 'lote'), validade: juntar(lista, 'validade'), nf: juntar(lista, 'nf'), fornecedor: juntar(lista, 'fornecedor') };
      v.origem[`insumos.${id}.qtd`] = qtd === '' ? '' : 'soma das anotações do insumo no dia';
    });
    recalcular(v);
    // Toda célula numérica vazia também tem origem vazia.
    ['volumeDestilado', 'hidrolise.temp', 'alcoolParam.gl', 'alcoolParam.acidez'].forEach((c) => { v.origem[c] = ''; });
    Object.keys(v.tanques).forEach((id) => ['ph', 'brix'].forEach((c) => { v.origem[`tanques.${id}.${c}`] = ''; }));
    return v;
  }

  function etiqueta(C, volume) {
    const c = C.rastreamento.etiqueta, n = numero(volume), densidade = numero(c.densidade), tara = numero(c.tara[volume]);
    const arred = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
    const pesoLiquido = n !== '' && n >= 0 && densidade !== '' ? arred(n * densidade) : '';
    return { volume: n, pesoLiquido, pesoBruto: pesoLiquido !== '' && tara !== '' ? arred(pesoLiquido + tara) : '' };
  }
  const Rastreamento = { letraDoMes, lote, calcular, recalcular, etiqueta };
  if (typeof module === 'object' && module.exports) module.exports = Rastreamento;
  else raiz.Rastreamento = Rastreamento;
})(typeof window !== 'undefined' ? window : this);
