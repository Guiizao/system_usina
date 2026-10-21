/* Pranchetas Ubirálcool - Hidrólise: etapas das dornas, Sacarificação e insumos
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * Dornas: etapas, Sacarificação e insumos que acompanham a Hidrólise
   * ========================================================= */
  /** enchendo (sem início) -> enviando (tem início, a bomba está mandando para cima) -> anotada (tem fim). */
  function etapaDaDorna(p, r) {
    if (!r) return 'nova';
    if (!p.envio) return 'anotada';
    if (!vazio(r.valores[p.envio.fim])) return 'anotada';
    return vazio(r.valores[p.envio.inicio]) ? 'enchendo' : 'enviando';
  }
  const dependentesDe = (pid) => Object.keys(C.pranchetas).filter((x) => C.pranchetas[x].vemDe && C.pranchetas[x].vemDe.prancheta === pid);
  const dornasDoDia = (data, pid) => listar(data, pid).filter((r) => /^\d+$/.test(r.chave)).sort((a, b) => a.chave - b.chave);
  const ordemNoDia = (h) => (h - C.inicioDoDia + 24) % 24;
  const nomesDasHoras = (horas) => [...horas].sort((a, b) => ordemNoDia(a) - ordemNoDia(b)).map((h) => pad2(h) + 'h').join(', ');

  /** A Sacarificação acompanha a dorna de mesmo número da Hidrólise: cria a linha e copia horário, pH e Brix finais.
      Quadro mudado à mão na Sacarificação para de copiar ("manuais"). */
  function acompanharDorna(data, pid, chave) {
    const base = pegar(data, pid, chave);
    if (!base) return;
    dependentesDe(pid).forEach((pid2) => {
      const p2 = prancheta(pid2);
      const r = pegar(data, pid2, chave);
      const manuais = (r && r.manuais) || [];
      const novos = {};
      Object.entries(p2.vemDe.campos).forEach(([meu, dela]) => {
        if (manuais.includes(meu)) return;
        const x = base.valores[dela];
        if (!vazio(x) && (!r || r.valores[meu] !== x)) novos[meu] = x;
      });
      if (!r) {
        const ant = dornasDoDia(data, pid2).filter((x) => Number(x.chave) < Number(chave)).pop();
        const inicial = {};
        (p2.copiarDaAnterior || []).forEach((id) => { if (ant && !vazio(ant.valores[id])) inicial[id] = ant.valores[id]; });
        p2.campos.forEach((c) => { if (c.padrao != null && vazio(inicial[c.id])) inicial[c.id] = c.padrao; });
        gravar(data, pid2, chave, Object.assign(inicial, novos), { operador: base.operador || '', manuais: [] });
      } else if (Object.keys(novos).length) gravar(data, pid2, chave, novos, { operador: r.operador || base.operador || '' });
    });
  }

  /** LPHERA, Cal, Saczyme e Antibiótico de cada hora somados das dornas enviadas naquela hora, quando elas terminam
      (duas dornas das 08h = 140 de LPHERA, 200 de Saczyme). O operador só confere e confirma.
      Hora que alguém anotou ou confirmou não é mais mexida. */
  function somarInsumosDoDia(data) {
    Object.values(C.pranchetas).filter((pj) => pj.tipo === 'juntas').forEach((pj) => pj.partes.forEach((pt) => {
      const sug = pt.sugestao;
      const folha = prancheta(pt.prancheta);
      const porHora = {};
      listar(data, sug.prancheta).filter((r) => dornaTerminada(data, sug.prancheta, r)).forEach((r) => {
        const h = horaDoTexto(r.valores[sug.hora]);
        const n = parseFloat(r.valores[sug.campo]);
        if (h == null || isNaN(n)) return;
        const x = porHora[h] || (porHora[h] = { total: 0, dornas: [], operador: '' });
        x.total += n; x.dornas.push(Number(r.chave)); x.operador = r.operador || x.operador;
      });
      Object.entries(porHora).forEach(([h, x]) => {
        const r = pegar(data, pt.prancheta, h);
        const dornas = x.dornas.sort((a, b) => a - b);
        const valor = String(Math.round(x.total * 100) / 100);
        const igual = (reg) => reg.valores.qtd === valor && JSON.stringify(reg.dornas || []) === JSON.stringify(dornas);
        // anotada à mão: não mexe. Só confirmou a soma e depois entrou ou saiu uma dorna dessa hora: volta para conferir
        if (r && !r.auto && (!r.somaConfirmada || igual(r))) return;
        if (x.total <= 0) { if (r) apagar(data, pt.prancheta, h); return; }
        if (r && r.auto && igual(r)) return;
        gravar(data, pt.prancheta, h, { qtd: valor, unidade: (r && r.valores.unidade) || folha.unidade }, { operador: x.operador, auto: true, conferir: true, somaConfirmada: false, dornas });
      });
      linhasDeHora(listar(data, pt.prancheta)).filter((r) => (r.auto || r.somaConfirmada) && !porHora[r.chave]).forEach((r) => apagar(data, pt.prancheta, r.chave));
    }));
  }
  /** Depois que uma dorna mudou neste aparelho: Sacarificação e insumos acompanham. */
  function depoisDeMudarDorna(data, pid, chave) {
    if (chave != null) acompanharDorna(data, pid, chave);
    somarInsumosDoDia(data);
  }

  /** Apaga a dorna e sobe as seguintes um número (3 vira 2), na Hidrólise e na Sacarificação, como na folha de papel. */
  function apagarDorna(data, pid, k) {
    [pid, ...dependentesDe(pid)].forEach((x) => {
      const seguintes = dornasDoDia(data, x).filter((r) => Number(r.chave) > k);
      apagar(data, x, k);
      seguintes.forEach((r) => {
        const n = Number(r.chave);
        const resto = Object.assign({}, r);
        ['id', 'chave', 'valores', 'atualizadoEm', 'sincronizado', 'seq', 'recebidoEm', 'apagado', 'aparelho'].forEach((c) => delete resto[c]);
        gravar(data, x, n - 1, r.valores, resto);
        apagar(data, x, n);
      });
    });
    somarInsumosDoDia(data);
  }
