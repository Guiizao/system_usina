/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * API só de leitura para o sistema do escritório (JSON).
 * Monta, a partir das anotações guardadas, o dia de produção com os nomes dos campos iguais às pranchetas
 * (public/forms.js): cada campo vem com rótulo, valor e unidade.
 *
 *   GET /api/v1/esquema               setores, pranchetas e campos (para o outro sistema saber o que é cada coisa)
 *   GET /api/v1/dias?de=&ate=         dias que têm anotação
 *   GET /api/v1/dias/AAAA-MM-DD       o dia inteiro, por setor e prancheta, com os totais
 *   GET /api/v1/totais?dia=          insumos por unidade/turno/produto e dornas terminadas (ou de=&ate=, até 62 dias)
 *   GET /api/v1/registros?desde=N     o que mudou depois do número N (para o outro sistema ir buscando só o novo)
 *
 * Tudo com o cabeçalho  Authorization: Bearer <senha de leitura>.  A configuração da usina (senhas dos operadores,
 * contatos) e os avisos internos nunca saem por aqui.
 *
 * O mesmo arquivo roda na central (server.js) e na nuvem (nuvem/src/index.js, Cloudflare): por isso não usa fs nem vm.
 */

const ehDia = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
const vazio = (v) => v === '' || v == null;
const pad2 = (n) => String(n).padStart(2, '0');
/** Hora com o fuso da usina (-03:00), como texto ISO. fusoMin: minutos do fuso (-180); sem ele, o do relógio deste computador. */
function isoLocal(ms, fusoMin) {
  if (!ms) return null;
  const off = fusoMin == null ? -new Date(ms).getTimezoneOffset() : fusoMin;
  const d = new Date(ms + off * 60000); // as horas "do relógio da usina", lidas como UTC
  const s = off >= 0 ? '+' : '-';
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}${s}${pad2(Math.floor(Math.abs(off) / 60))}:${pad2(Math.abs(off) % 60)}`;
}
/** Hora h do dia AAAA-MM-DD no relógio da usina, em milissegundos. */
function momento(data, h, fusoMin) {
  const [y, m, d] = data.split('-').map(Number);
  return fusoMin == null ? new Date(y, m - 1, d, h).getTime() : Date.UTC(y, m - 1, d, h) - fusoMin * 60000;
}
function somarDias(iso, n) { const [y, m, d] = iso.split('-').map(Number); const x = new Date(y, m - 1, d + n); return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`; }

/** Intervalo inclusivo e limitado, sem normalizar datas impossíveis nem aceitar filtros ambíguos. */
function intervaloTotais(params) {
  const dia = params.get('dia'), de = dia || params.get('de'), ate = dia || params.get('ate');
  if ([...params.keys()].some((k) => !['dia', 'de', 'ate'].includes(k) || params.getAll(k).length !== 1) ||
      (params.has('dia') && (params.has('de') || params.has('ate')))) return null;
  const valido = (d) => ehDia(d) && Number.isFinite(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d;
  if (!valido(de) || !valido(ate)) return null;
  const quantidade = (Date.parse(ate) - Date.parse(de)) / 86400000 + 1;
  if (quantidade < 1 || quantidade > 62) return null;
  return { de, ate, dias: Array.from({ length: quantidade }, (_, i) => new Date(Date.parse(de) + i * 86400000).toISOString().slice(0, 10)) };
}

/** medidasAtuais: as medidas das dornas trocadas pelo escritório (Configurações da usina), se houver.
    opcoes.fusoMin: o fuso da usina em minutos (a nuvem roda em UTC e passa -180). */
function criar(C, medidasAtuais, opcoes = {}) {
  const fuso = opcoes.fusoMin;
  const iso = (ms) => isoLocal(ms, fuso);
  const pranchetas = C.pranchetas;
  const setorDa = (pid) => C.setores.find((s) => s.pranchetas.some((x) => x === pid || (pranchetas[x] && pranchetas[x].tipo === 'juntas' && pranchetas[x].partes.some((pt) => pt.prancheta === pid))));
  // folhas que guardam anotação (a tela "juntas" é só duas folhas de insumo lado a lado)
  const folhasDoSetor = (s) => s.pranchetas.flatMap((pid) => (pranchetas[pid].tipo === 'juntas' ? pranchetas[pid].partes.map((pt) => pt.prancheta) : [pid]));
  // como no app: as medidas do escritório só valem se forem da mesma versão dos grupos
  const medidas = () => { const m = medidasAtuais && medidasAtuais(); return m && m.versao === C.medicaoPadrao.versao ? m : C.medicaoPadrao; };

  /** Valor no tipo certo: número vira número, o resto fica texto. */
  function valorDe(c, v) {
    if (vazio(v)) return null;
    if (c && c.type === 'num') { const n = Number(v); return Number.isFinite(n) ? n : String(v); }
    if (c && c.type === 'check') return true;
    return String(v);
  }
  function unidadeNoDia(c, data) {
    const h = Array.isArray(c.historico) ? c.historico.filter((x) => data && data <= x.ate).sort((a, b) => a.ate.localeCompare(b.ate)) : [];
    return h.length ? h[0].unidade : c.unidade;
  }
  const campo = (c, v, data) => {
    const unidade = unidadeNoDia(c, data);
    return Object.assign({ rotulo: c.label, valor: valorDe(c, v) }, unidade ? { unidade } : {});
  };
  const camposDe = (lista, valores, data) => { const o = {}; lista.forEach((c) => { o[c.id] = campo(c, valores[c.id], data); }); return o; };
  const base = (r) => ({ id: r.id, operador: r.operador || null, atualizadoEm: iso(r.atualizadoEm), ...(r.alteradoPeloEscritorio ? { alteradoPeloEscritorio: { em: iso(r.alteradoPeloEscritorio.em), autorizadoPor: r.alteradoPeloEscritorio.autorizadoPor } } : {}) });
  const horaDaChave = (k) => `${pad2(Number(k))}:00`;
  const ordemNoDia = (h) => (Number(h) - C.inicioDoDia + 24) % 24;
  // turnos de cada setor (2.13.4): o padrão ou os 2 de 12 horas (C.turnosSetor vem da configuração da usina);
  // a hora conta no dia de produção, então o turno das 19h às 7h fica inteiro
  const turnosDo = (s) => (s && (C.turnosSetor || {})[s.id] === '12h' && C.turnos12h) || C.turnos;
  const horaNoDia = (h) => (h < C.inicioDoDia ? h + 24 : h);
  const turnoDaHora = (h, turnos = C.turnos) => turnos.find((t) => horaNoDia(h) >= horaNoDia(t.inicio) && horaNoDia(h) < (t.fim <= C.inicioDoDia ? t.fim + 24 : t.fim)) || turnos[0];

  /* ---------- cada tipo de prancheta ---------- */
  function folhaDornas(p, regs, data) {
    const etapa = (v) => (!p.envio ? null : !vazio(v[p.envio.fim]) ? 'anotada' : !vazio(v[p.envio.inicio]) ? 'enviando' : 'enchendo');
    return {
      linhas: regs.filter((r) => /^\d+$/.test(r.chave)).sort((a, b) => a.chave - b.chave).map((r) => Object.assign({ dorna: Number(r.chave) }, p.envio ? { etapa: etapa(r.valores) } : {}, base(r), { campos: camposDe(p.campos, r.valores, data) })),
    };
  }
  function folhaInsumo(p, regs, data) {
    const extras = [...(p.camposOperador || []), ...(p.camposEscritorio || []).filter((c) => !(p.camposOperador || []).some((o) => o.id === c.id))];
    const linhas = regs.filter((r) => /^\d+$/.test(r.chave) && !vazio(r.valores.qtd)).sort((a, b) => ordemNoDia(a.chave) - ordemNoDia(b.chave)).map((r) => Object.assign(
      { hora: horaDaChave(r.chave), quantidade: valorDe({ type: 'num' }, r.valores.qtd), unidade: r.valores.unidade || p.unidade || null },
      r.conferir ? { conferir: true } : {}, base(r), { campos: camposDe(extras, r.valores, data) }));
    const soma = {};
    linhas.forEach((l) => { if (typeof l.quantidade === 'number') soma[l.unidade || ''] = (soma[l.unidade || ''] || 0) + l.quantidade; });
    const meta = (regs.find((r) => r.chave === 'meta') || { valores: {} }).valores;
    return { insumo: p.nome, total: Object.entries(soma).map(([u, q]) => ({ quantidade: Math.round(q * 100) / 100, unidade: u || null })), lote: meta.lote || null, verificadoPor: meta.verificado || null, linhas };
  }
  function folhaGrade(p, regs, data, s) {
    const turnos = turnosDo(s);
    return {
      linhas: regs.filter((r) => /^\d+$/.test(r.chave)).sort((a, b) => ordemNoDia(a.chave) - ordemNoDia(b.chave)).map((r) => Object.assign({ hora: horaDaChave(r.chave), turno: turnoDaHora(Number(r.chave), turnos).nome }, base(r), { campos: camposDe(p.itens, r.valores, data) })),
      observacoes: turnos.map((t) => ({ turno: t.nome, texto: ((regs.find((r) => r.chave === 'obs' + t.id) || { valores: {} }).valores.texto) || null })).filter((o) => o.texto),
    };
  }
  function folhaMedicao(p, regs, data) {
    const vol = (d, v) => (vazio(v[d.id + '_vol']) ? (vazio(v[d.id + '_folga']) || !(d.altura > 0 && d.area > 0) ? null : Math.round((d.altura - Number(v[d.id + '_folga'])) * d.area * (d.unidade === 'm³' ? 1 : 1000) * 100) / 100) : Number(v[d.id + '_vol']));
    const grupos = medidas().grupos.map((g) => {
      const r = regs.find((x) => x.chave === g.id);
      const v = r ? r.valores : {};
      const unidade = g.unidade || 'L';
      const dornas = g.dornas.map((d) => Object.assign({ id: d.id, nome: d.nome, folga: valorDe({ type: 'num' }, v[d.id + '_folga']), volume: vol(Object.assign({ unidade }, d), v) },
        g.brix ? { brix: valorDe({ type: 'num' }, v[d.id + '_brix']) } : {}, g.fermentando ? { fermentando: vazio(v[d.id + '_ferm']) ? null : v[d.id + '_ferm'] === 'Sim' } : {}));
      const medidas = dornas.filter((d) => d.volume != null);
      return { id: g.id, nome: g.nome, unidade, entraNaProducao: !!g.soma, hora: v.hora || null, operador: r ? r.operador || null : null, subtotal: Math.round(medidas.reduce((t, d) => t + d.volume, 0) * 100) / 100, dornas };
    });
    const par = (regs.find((r) => r.chave === 'param') || { valores: {} }).valores;
    const producao = grupos.filter((g) => g.entraNaProducao && g.unidade === 'L').reduce((s, g) => s + g.subtotal, 0);
    return {
      grupos, totalDeVinhoDaProducaoLitros: Math.round(producao * 100) / 100,
      parametros: camposDe(p.parametros, par, data),
    };
  }
  function folhaFermentacao(p, regs, data) {
    return {
      enchimentos: regs.filter((r) => r.valores && r.valores.dorna != null).sort((a, b) => (a.valores.inicioEm || 0) - (b.valores.inicioEm || 0)).map((r) => {
        const v = r.valores;
        return Object.assign({ dorna: Number(v.dorna) }, base(r), {
          campos: camposDe(p.campos, v, data),
          volante: (v.volante || []).map((s) => ({ data: s.data, inicio: s.inicio || null, fim: s.fim || null, operador: s.operador || null })),
          esvaziada: v.esvaziada ? { data: v.esvaziada.data, hora: v.esvaziada.hora, operador: v.esvaziada.operador || null } : null,
        });
      }),
    };
  }
  const MONTAR = { dornas: folhaDornas, insumo: folhaInsumo, grade: folhaGrade, medicao: folhaMedicao, fermentacao: folhaFermentacao };

  /** O dia inteiro, por setor e prancheta. registrosDoDia: as anotações daquele dia (sem as apagadas). */
  function dia(data, registrosDoDia) {
    const porFolha = {};
    registrosDoDia.forEach((r) => { if (!r.apagado) (porFolha[r.prancheta] = porFolha[r.prancheta] || []).push(r); });
    const setores = C.setores.map((s) => ({
      id: s.id, nome: s.nome,
      pranchetas: folhasDoSetor(s).map((pid) => {
        const p = pranchetas[pid];
        return Object.assign({ id: pid, nome: p.nome, codigo: p.codigo || null, titulo: (p.papel && p.papel.titulo) || p.titulo || p.nome, tipo: p.tipo }, MONTAR[p.tipo] ? MONTAR[p.tipo](p, porFolha[pid] || [], data, s) : {});
      }),
    }));
    const insumos = setores.flatMap((s) => s.pranchetas.filter((p) => p.tipo === 'insumo').flatMap((p) => (p.total.length ? p.total : [{ quantidade: 0, unidade: pranchetas[p.id].unidade || null }]).map((t) => ({ setor: s.nome, prancheta: p.id, insumo: p.nome, quantidade: t.quantidade, unidade: t.unidade }))));
    const med = setores.flatMap((s) => s.pranchetas).find((p) => p.tipo === 'medicao');
    return {
      empresa: C.empresa, data,
      periodo: { inicio: iso(momento(data, C.inicioDoDia, fuso)), fim: iso(momento(somarDias(data, 1), C.inicioDoDia, fuso) - 1000) },
      totais: { insumos, ...(med ? { vinhoDaProducaoLitros: med.totalDeVinhoDaProducaoLitros } : {}) },
      setores,
    };
  }

  /** Uma anotação sozinha, com os nomes dos campos (para a busca do que mudou). */
  function registro(r) {
    const p = pranchetas[r.prancheta];
    const s = setorDa(r.prancheta);
    const lista = !p ? [] : p.tipo === 'insumo' ? [{ id: 'qtd', label: 'Quantidade', type: 'num' }, { id: 'unidade', label: 'Unidade', type: 'text' }, ...(p.camposOperador || []), ...(p.camposEscritorio || [])]
      : p.tipo === 'grade' ? p.itens : p.tipo === 'medicao' ? [] : p.campos || [];
    const vistos = new Set();
    const campos = {};
    lista.forEach((c) => { if (!vistos.has(c.id)) { vistos.add(c.id); campos[c.id] = campo(c, r.valores[c.id], r.data); } });
    return Object.assign({ id: r.id, seq: r.seq, data: r.data, setor: s ? s.id : r.setor || null, prancheta: r.prancheta, chave: r.chave, apagado: !!r.apagado }, base(r),
      { campos: p && (p.tipo === 'medicao' || p.tipo === 'fermentacao') ? r.valores : campos });
  }

  /** O esquema: o que é cada setor, prancheta e campo. */
  function esquema() {
    const desc = (c) => Object.assign({ id: c.id, rotulo: c.label, tipo: { num: 'numero', time: 'hora', choice: 'opcao', check: 'marca', text: 'texto' }[c.type] || c.type }, c.unidade ? { unidade: c.unidade } : {}, c.dec ? { casasDecimais: c.dec } : {}, c.novo === true ? { novo: true } : {}, c.arquivado === true ? { arquivado: true } : {});
    return {
      empresa: C.empresa, diaDeProducao: `das ${pad2(C.inicioDoDia)}:00 às ${pad2((C.inicioDoDia + 23) % 24)}:59 do dia seguinte`,
      turnos: C.turnos.map((t) => ({ nome: t.nome, inicio: `${pad2(t.inicio)}:00`, fim: `${pad2(t.fim % 24)}:00` })),
      setores: C.setores.map((s) => ({
        id: s.id, nome: s.nome,
        turnos: turnosDo(s).map((t) => ({ nome: t.nome, inicio: `${pad2(t.inicio)}:00`, fim: `${pad2(t.fim % 24)}:00` })),
        pranchetas: folhasDoSetor(s).map((pid) => {
          const p = pranchetas[pid];
          const campos = p.tipo === 'insumo' ? [{ id: 'qtd', label: 'Quantidade', type: 'num' }, ...(p.camposOperador || []), ...(p.camposEscritorio || []).filter((c) => !(p.camposOperador || []).some((o) => o.id === c.id))]
            : p.tipo === 'grade' ? p.itens : p.tipo === 'medicao' ? p.parametros : p.campos || [];
          return Object.assign({ id: pid, nome: p.nome, codigo: p.codigo || null, tipo: p.tipo, linhaPor: { dornas: 'dorna', insumo: 'hora', grade: 'hora', medicao: 'grupo de dornas', fermentacao: 'enchimento' }[p.tipo] || null, campos: campos.map(desc) },
            p.tipo === 'insumo' ? { unidades: p.unidades || [p.unidade] } : {},
            p.tipo === 'medicao' ? { grupos: medidas().grupos.map((g) => ({ id: g.id, nome: g.nome, unidade: g.unidade || 'L', dornas: g.dornas.map((d) => ({ id: d.id, nome: d.nome, alturaM: d.altura, areaDaBaseM2: d.area })) })) } : {});
        }),
      })),
    };
  }
  /** Só quantidades de insumos: temperaturas, horas, metadados e registros apagados não são somados. */
  function somatorio(registros) {
    const ativos = registros.filter((r) => !r.apagado && publica(r) && /^\d+$/.test(r.chave));
    const arredondar = (n) => Math.round(n * 100) / 100;
    const insumos = C.setores.flatMap((s) => folhasDoSetor(s).filter((pid) => pranchetas[pid].tipo === 'insumo').flatMap((pid) => {
      const p = pranchetas[pid], turnos = turnosDo(s), unidades = new Map();
      const novo = () => ({ quantidade: 0, turnos: turnos.map((t) => ({ ...t, quantidade: 0 })), produtos: new Map() });
      for (const r of ativos.filter((r) => r.prancheta === pid)) {
        const v = r.valores || {}, valor = parseFloat(v.qtd);
        const conversao = (C.somarEm || {})[v.unidade || p.unidade || ''];
        const n = valor * (conversao ? conversao.fator : 1);
        if (!Number.isFinite(n)) continue;
        const unidade = conversao ? conversao.unidade : v.unidade || p.unidade || '';
        if (!unidades.has(unidade)) unidades.set(unidade, novo());
        const soma = unidades.get(unidade);
        soma.quantidade += n;
        soma.turnos.find((t) => t.id === turnoDaHora(Number(r.chave), turnos).id).quantidade += n;
        if (pid === 'ins_materia_prima') {
          const produto = v.produto || '';
          soma.produtos.set(produto, (soma.produtos.get(produto) || 0) + n);
        }
      }
      if (!unidades.size) unidades.set(((C.somarEm || {})[p.unidade] || {}).unidade || p.unidade || '', novo());
      return [...unidades].map(([unidade, soma]) => ({
        setor: s.id, prancheta: pid, insumo: p.nome, unidade, quantidade: arredondar(soma.quantidade),
        turnos: soma.turnos.map((t) => ({ ...t, quantidade: arredondar(t.quantidade) })),
        ...(pid === 'ins_materia_prima' ? { produtos: [...soma.produtos].map(([produto, n]) => ({ produto, quantidade: arredondar(n) })) } : {}),
      }));
    }));
    return { insumos, dornasFinalizadas: ativos.filter((r) => r.prancheta === 'hid_anexo1' && !vazio((r.valores || {}).fim)).length };
  }
  function totais(intervalo, registros) {
    const porDia = new Map(intervalo.dias.map((data) => [data, []]));
    registros.forEach((r) => { if (porDia.has(r.data)) porDia.get(r.data).push(r); });
    return { empresa: C.empresa, de: intervalo.de, ate: intervalo.ate,
      dias: [...porDia].map(([data, regs]) => ({ data, ...somatorio(regs) })),
      total: somatorio([...porDia.values()].flat()),
    };
  }
  return { dia, registro, esquema, totais };
}

/** Anotação que pode sair pela API (a configuração da usina e os avisos internos, não). */
const publica = (r) => r && ehDia(r.data) && r.prancheta !== 'avisos' && r.prancheta !== 'avisos-recibo' && r.prancheta !== 'registro';

module.exports = { criar, publica, ehDia, isoLocal, intervaloTotais };
