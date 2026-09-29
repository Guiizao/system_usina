/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * API só de leitura para o sistema do escritório (JSON).
 * Monta, a partir das anotações guardadas, o dia de produção com os nomes dos campos iguais às pranchetas
 * (public/forms.js): cada campo vem com rótulo, valor e unidade.
 *
 *   GET /api/v1/esquema               setores, pranchetas e campos (para o outro sistema saber o que é cada coisa)
 *   GET /api/v1/dias?de=&ate=         dias que têm anotação
 *   GET /api/v1/dias/AAAA-MM-DD       o dia inteiro, por setor e prancheta, com os totais
 *   GET /api/v1/registros?desde=N     o que mudou depois do número N (para o outro sistema ir buscando só o novo)
 *
 * Tudo com o cabeçalho  Authorization: Bearer <senha de leitura>.  A configuração da usina (senhas dos operadores,
 * contatos) e os avisos internos nunca saem por aqui.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/** As definições das pranchetas (o mesmo forms.js do aplicativo). */
function carregarPranchetas(pastaPublica) {
  const contexto = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(pastaPublica, 'forms.js'), 'utf8'), contexto);
  return contexto.window.USINA;
}

const ehDia = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
const vazio = (v) => v === '' || v == null;
const pad2 = (n) => String(n).padStart(2, '0');
/** Hora do relógio com o fuso da usina (-03:00), como texto ISO. */
function isoLocal(ms) {
  if (!ms) return null;
  const d = new Date(ms);
  const off = -d.getTimezoneOffset();
  const s = off >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}${s}${pad2(Math.floor(Math.abs(off) / 60))}:${pad2(Math.abs(off) % 60)}`;
}
function somarDias(iso, n) { const [y, m, d] = iso.split('-').map(Number); const x = new Date(y, m - 1, d + n); return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`; }

/** medidasAtuais: as medidas das dornas trocadas pelo escritório (Configurações da usina), se houver. */
function criar(C, medidasAtuais) {
  const pranchetas = C.pranchetas;
  const setorDa = (pid) => C.setores.find((s) => s.pranchetas.some((x) => x === pid || (pranchetas[x] && pranchetas[x].tipo === 'juntas' && pranchetas[x].partes.some((pt) => pt.prancheta === pid))));
  // folhas que guardam anotação (a tela "juntas" é só duas folhas de insumo lado a lado)
  const folhasDoSetor = (s) => s.pranchetas.flatMap((pid) => (pranchetas[pid].tipo === 'juntas' ? pranchetas[pid].partes.map((pt) => pt.prancheta) : [pid]));
  const medidas = () => (medidasAtuais && medidasAtuais()) || C.medicaoPadrao;

  /** Valor no tipo certo: número vira número, o resto fica texto. */
  function valorDe(c, v) {
    if (vazio(v)) return null;
    if (c && c.type === 'num') { const n = Number(v); return Number.isFinite(n) ? n : String(v); }
    if (c && c.type === 'check') return true;
    return String(v);
  }
  const campo = (c, v) => Object.assign({ rotulo: c.label, valor: valorDe(c, v) }, c.unidade ? { unidade: c.unidade } : {});
  const camposDe = (lista, valores) => { const o = {}; lista.forEach((c) => { o[c.id] = campo(c, valores[c.id]); }); return o; };
  const base = (r) => ({ id: r.id, operador: r.operador || null, atualizadoEm: isoLocal(r.atualizadoEm), ...(r.alteradoPeloEscritorio ? { alteradoPeloEscritorio: { em: isoLocal(r.alteradoPeloEscritorio.em), autorizadoPor: r.alteradoPeloEscritorio.autorizadoPor } } : {}) });
  const horaDaChave = (k) => `${pad2(Number(k))}:00`;
  const ordemNoDia = (h) => (Number(h) - C.inicioDoDia + 24) % 24;
  const turnoDaHora = (h) => C.turnos.find((t) => h >= t.inicio && h < t.fim) || C.turnos[0];

  /* ---------- cada tipo de prancheta ---------- */
  function folhaDornas(p, regs) {
    const etapa = (v) => (!p.envio ? null : !vazio(v[p.envio.fim]) ? 'anotada' : !vazio(v[p.envio.inicio]) ? 'enviando' : 'enchendo');
    return {
      linhas: regs.filter((r) => /^\d+$/.test(r.chave)).sort((a, b) => a.chave - b.chave).map((r) => Object.assign({ dorna: Number(r.chave) }, p.envio ? { etapa: etapa(r.valores) } : {}, base(r), { campos: camposDe(p.campos, r.valores) })),
    };
  }
  function folhaInsumo(p, regs) {
    const extras = [...(p.camposOperador || []), ...(p.camposEscritorio || []).filter((c) => !(p.camposOperador || []).some((o) => o.id === c.id))];
    const linhas = regs.filter((r) => /^\d+$/.test(r.chave) && !vazio(r.valores.qtd)).sort((a, b) => ordemNoDia(a.chave) - ordemNoDia(b.chave)).map((r) => Object.assign(
      { hora: horaDaChave(r.chave), quantidade: valorDe({ type: 'num' }, r.valores.qtd), unidade: r.valores.unidade || p.unidade || null },
      r.conferir ? { conferir: true } : {}, base(r), { campos: camposDe(extras, r.valores) }));
    const soma = {};
    linhas.forEach((l) => { if (typeof l.quantidade === 'number') soma[l.unidade || ''] = (soma[l.unidade || ''] || 0) + l.quantidade; });
    const meta = (regs.find((r) => r.chave === 'meta') || { valores: {} }).valores;
    return { insumo: p.nome, total: Object.entries(soma).map(([u, q]) => ({ quantidade: Math.round(q * 100) / 100, unidade: u || null })), lote: meta.lote || null, verificadoPor: meta.verificado || null, linhas };
  }
  function folhaGrade(p, regs) {
    return {
      linhas: regs.filter((r) => /^\d+$/.test(r.chave)).sort((a, b) => ordemNoDia(a.chave) - ordemNoDia(b.chave)).map((r) => Object.assign({ hora: horaDaChave(r.chave), turno: turnoDaHora(Number(r.chave)).nome }, base(r), { campos: camposDe(p.itens, r.valores) })),
      observacoes: C.turnos.map((t) => ({ turno: t.nome, texto: ((regs.find((r) => r.chave === 'obs' + t.id) || { valores: {} }).valores.texto) || null })).filter((o) => o.texto),
    };
  }
  function folhaMedicao(p, regs) {
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
      parametros: camposDe(p.parametros, par),
    };
  }
  function folhaFermentacao(p, regs) {
    return {
      enchimentos: regs.filter((r) => r.valores && r.valores.dorna != null).sort((a, b) => (a.valores.inicioEm || 0) - (b.valores.inicioEm || 0)).map((r) => {
        const v = r.valores;
        return Object.assign({ dorna: Number(v.dorna) }, base(r), {
          campos: camposDe(p.campos, v),
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
        return Object.assign({ id: pid, nome: p.nome, codigo: p.codigo || null, titulo: (p.papel && p.papel.titulo) || p.titulo || p.nome, tipo: p.tipo }, MONTAR[p.tipo] ? MONTAR[p.tipo](p, porFolha[pid] || []) : {});
      }),
    }));
    const insumos = setores.flatMap((s) => s.pranchetas.filter((p) => p.tipo === 'insumo').flatMap((p) => (p.total.length ? p.total : [{ quantidade: 0, unidade: pranchetas[p.id].unidade || null }]).map((t) => ({ setor: s.nome, prancheta: p.id, insumo: p.nome, quantidade: t.quantidade, unidade: t.unidade }))));
    const med = setores.flatMap((s) => s.pranchetas).find((p) => p.tipo === 'medicao');
    return {
      empresa: C.empresa, data,
      periodo: { inicio: isoLocal(new Date(...data.split('-').map((x, i) => Number(x) - (i === 1 ? 1 : 0)), C.inicioDoDia).getTime()), fim: isoLocal(new Date(...somarDias(data, 1).split('-').map((x, i) => Number(x) - (i === 1 ? 1 : 0)), C.inicioDoDia).getTime() - 1000) },
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
    lista.forEach((c) => { if (!vistos.has(c.id)) { vistos.add(c.id); campos[c.id] = campo(c, r.valores[c.id]); } });
    return Object.assign({ id: r.id, seq: r.seq, data: r.data, setor: s ? s.id : r.setor || null, prancheta: r.prancheta, chave: r.chave, apagado: !!r.apagado }, base(r),
      { campos: p && (p.tipo === 'medicao' || p.tipo === 'fermentacao') ? r.valores : campos });
  }

  /** O esquema: o que é cada setor, prancheta e campo. */
  function esquema() {
    const desc = (c) => Object.assign({ id: c.id, rotulo: c.label, tipo: { num: 'numero', time: 'hora', choice: 'opcao', check: 'marca', text: 'texto' }[c.type] || c.type }, c.unidade ? { unidade: c.unidade } : {}, c.dec ? { casasDecimais: c.dec } : {});
    return {
      empresa: C.empresa, diaDeProducao: `das ${pad2(C.inicioDoDia)}:00 às ${pad2((C.inicioDoDia + 23) % 24)}:59 do dia seguinte`,
      turnos: C.turnos.map((t) => ({ nome: t.nome, inicio: `${pad2(t.inicio)}:00`, fim: `${pad2(t.fim % 24)}:00` })),
      setores: C.setores.map((s) => ({
        id: s.id, nome: s.nome,
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
  return { dia, registro, esquema };
}

/** Anotação que pode sair pela API (a configuração da usina e os avisos internos, não). */
const publica = (r) => r && ehDia(r.data) && r.prancheta !== 'avisos' && r.prancheta !== 'avisos-recibo';

module.exports = { carregarPranchetas, criar, publica, ehDia, isoLocal };
