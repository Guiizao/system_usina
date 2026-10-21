/* Pranchetas Ubirálcool - datas, turnos e formatos
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * Datas, turnos e formatos
   * ========================================================= */
  const pad2 = (n) => String(n).padStart(2, '0');
  const isoData = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const HORAS = Array.from({ length: 24 }, (_, i) => (C.inicioDoDia + i) % 24);
  function dataProducao(agora = new Date()) {
    const d = new Date(agora);
    if (d.getHours() < C.inicioDoDia) d.setDate(d.getDate() - 1);
    return isoData(d);
  }
  function somarDias(iso, n) { const [y, m, d] = iso.split('-').map(Number); return isoData(new Date(y, m - 1, d + n)); }
  const fmtData = (iso) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
  function diaSemana(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'][new Date(y, m - 1, d).getDay()];
  }
  /* Turnos (versão 2.13.4): cada setor usa o padrão (3 turnos, forms.js) ou os 2 de 12 horas que o tablet chefe escolheu.
     A hora conta no dia de produção (7h às 7h): a madrugada vem depois das 23h, então o turno das 19h às 7h fica inteiro. */
  const turnosDoSetor = (id) => ((configSistema().turnosSetor || {})[id] === '12h' && C.turnos12h) || C.turnos;
  const turnosDaPrancheta = (pid) => { const s = pid && setorDaPrancheta(pid); return s ? turnosDoSetor(s.id) : C.turnos; };
  const turnosAqui = () => (setorPorId(cfg.papel) ? turnosDoSetor(cfg.papel) : C.turnos);
  const horaNoDia = (h) => (h < C.inicioDoDia ? h + 24 : h);
  const turnoDaHora = (h, turnos = turnosAqui()) => turnos.find((t) => horaNoDia(h) >= horaNoDia(t.inicio) && horaNoDia(h) < (t.fim <= C.inicioDoDia ? t.fim + 24 : t.fim)) || turnos[0];
  const turnoAtual = () => turnoDaHora(new Date().getHours());
  const horaAgora = () => { const d = new Date(); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
  const rotuloHora = (h) => `${pad2(h)}:00`;
  const rotuloHoraPapel = (h) => (h === 0 ? '24:00' : rotuloHora(h));
  const faixaTurno = (t) => `${pad2(t.inicio)}:00 às ${pad2(t.fim % 24)}:00`;
  const horaDoTexto = (hhmm) => (/^\d\d:\d\d$/.test(hhmm || '') ? Number(hhmm.slice(0, 2)) : null);

  /** 1 anotação, 2 anotações (em vez de "anotação(ões)", que é mais difícil de ler) */
  const contar = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  /** 2, 3 e 4 (em vez de 2 e 3 e 4) */
  const listaE = (l) => (l.length > 1 ? `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}` : l.join(''));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const vazio = (v) => v === '' || v == null;
  const fmtNum = (v) => (vazio(v) ? '' : String(v).replace('.', ','));
  const fmtCampo = (c, v) => (vazio(v) ? '' : c.type === 'num' ? fmtNum(v) : String(v));
  const fmtTamanho = (b) => (b > 1048576 ? `${fmtNum((b / 1048576).toFixed(1))} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

  /** Avisos de um valor: regras do processo (ex.: pH abaixo de 5 pede cal) e valor muito fora. */
  function avisosDe(c, v) {
    if (vazio(v) || (c.type && c.type !== 'num')) return [];
    const n = parseFloat(v);
    const lista = [];
    (c.avisos || []).forEach((a) => {
      const bate = { '<': n < a.valor, '<=': n <= a.valor, '>': n > a.valor, '>=': n >= a.valor }[a.quando];
      if (bate) lista.push({ nivel: a.nivel || 'alerta', texto: a.texto, curto: a.curto || a.texto });
    });
    const fora = (c.min != null && n < c.min) || (c.max != null && n > c.max);
    if (fora && !lista.length) lista.push({ nivel: 'alerta', texto: `Valor muito fora (esperado de ${fmtNum(c.min)} a ${fmtNum(c.max)}). Confira.`, curto: `${c.labelCurto || c.label} ${c.min != null && n < c.min ? 'baixo' : 'alto'}` });
    return lista;
  }
  const nivelDe = (c, v) => { const l = avisosDe(c, v); return l.some((x) => x.nivel === 'alerta') ? 'fora' : l.length ? 'atencao' : ''; };
