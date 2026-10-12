/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * Modelos das folhas de papel da Ubirálcool.
 * Cada folha vira uma "grade" (células, mesclas, larguras, logo) que é desenhada igual ao papel:
 *   - no Excel (xlsx.js)
 *   - na impressão (HTML)
 * e os mesmos dados viram o XML, na ordem das colunas do papel.
 *
 * Modelos:
 *   pop011   -> Anexo I e Anexo II do POP 011 (hidrólise e sacarificação), 25 linhas
 *   pop03    -> POP-03-FOR-004, registro de insumos (07:00 até 06:00), TOTAL e "Verificado por"
 *   caldeira -> Controle Diário da Caldeira (7 até 7, operador/horário/obs por turno)
 *   destilaria -> Controle Diário da Destilaria (7 a 18 e 19 a 6)
 *   nova     -> Controle Diário da Destilaria nova (7 a 6, turnos e Obs)
 */
(function () {
  const BORDA = { borda: true };

  /* ---------- Grade: onde a folha é montada ---------- */
  function Grade(larguras) {
    this.larguras = larguras;
    this.cel = {};
    this.mesclas = [];
    this.alturas = {};
    this.linhas = 0;
  }
  Grade.prototype.set = function (r, c, v, st) {
    this.cel[r + ',' + c] = { v: v === undefined || v === null ? '' : v, st };
    this.linhas = Math.max(this.linhas, r + 1);
  };
  /** Bloco mesclado com o mesmo estilo em todas as células (a borda fica completa). */
  Grade.prototype.bloco = function (r1, c1, r2, c2, v, st) {
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) this.set(r, c, r === r1 && c === c1 ? v : '', st);
    if (r2 > r1 || c2 > c1) this.mesclas.push([r1, c1, r2, c2]);
  };
  Grade.prototype.altura = function (r, pts) { this.alturas[r] = pts; this.linhas = Math.max(this.linhas, r + 1); };

  function colNome(i) { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }

  /** Dividir n colunas em k blocos quase iguais: devolve [inicio, fim] de cada bloco */
  function dividir(inicio, n, k) {
    const base = Math.floor(n / k); let resto = n % k; const blocos = []; let c = inicio;
    for (let i = 0; i < k; i++) { const t = base + (resto-- > 0 ? 1 : 0); blocos.push([c, c + t - 1]); c += t; }
    return blocos;
  }

  /* ---------- Ajudas de texto ---------- */
  function montar(ctx) {
    const { C, fmtData, fmtNum } = ctx;
    const pranchetaCompleta = ctx.prancheta;
    const listas = ['itens', 'campos', 'camposOperador', 'parametros'];
    // O papel conserva seus quadros; os novos saem separados no XML.
    ctx = Object.assign({}, ctx, { prancheta(pid) {
      const p = pranchetaCompleta(pid);
      const novos = new Set(listas.flatMap((k) => (p[k] || []).filter((c) => c.novo === true).map((c) => c.id)));
      const copia = Object.assign({}, p);
      listas.forEach((k) => { if (p[k]) copia[k] = p[k].filter((c) => c.novo !== true); });
      if (p.grupos) copia.grupos = p.grupos.map((g) => Object.assign({}, g, { campos: g.campos.filter((id) => !novos.has(id)) }));
      return copia;
    } });
    const vazio = (v) => v === '' || v == null;
    const numero = (v) => (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v);
    const valorCampo = (c, v) => {
      if (vazio(v)) return '';
      if (c.type === 'check') return 'OK';
      if (c.type === 'num') return numero(v);
      return String(v);
    };
    const textoNum = (v) => (typeof v === 'number' ? fmtNum(String(v)) : v);
    const operadoresDoTurno = (regs, t) => [...new Set(regs.filter((r) => /^\d+$/.test(r.chave)).filter((r) => { const h = Number(r.chave); return h >= t.inicio && h < t.fim; }).map((r) => r.operador).filter(Boolean))].join(', ');
    const casas = (c, v) => {
      if (!c || c.type !== 'num') return {};
      const [mantissa, expoente] = String(v).toLowerCase().split('e');
      const dec = Math.max(c.dec || 0, (mantissa.split('.')[1] || '').length - Number(expoente || 0));
      return dec > 0 ? { dec } : {};
    };
    const horarioDoTurno = (t) => `${String(t.inicio).padStart(2, '0')}:00 às ${String(t.fim).padStart(2, '0')}:00`;
    const D = C.documentos || {};

    /* ===== POP 011 (Anexo I e II) ===== */
    function pop011(pid, data) {
      const p = ctx.prancheta(pid);
      const doc = D.pop011 || {};
      const titulo = (p.papel && p.papel.titulo) || `${p.codigo}-${p.titulo}`;
      const colunas = ['Nº', ...p.campos.map((c) => c.papel || c.label), 'Responsável'];
      const regs = ctx.listar(data, pid);
      const linhas = [];
      for (let n = 1; n <= (p.maxLinhas || 25); n++) {
        const r = regs.find((x) => Number(x.chave) === n);
        linhas.push({ rotulo: n, valores: [n, ...p.campos.map((c) => (r ? valorCampo(c, r.valores[c.id]) : '')), r ? r.operador || '' : ''], preenchida: !!r });
      }
      const dados = {
        cabecalho: [['Empresa', doc.empresa || C.empresa], ['Documento', titulo], ['Código', doc.codigo || 'POP 011-RC'], ['Data', fmtData(data)]],
        colunas, linhas,
        rodape: (doc.aprovacao || []).map(([k, v]) => [k, v]),
      };
      const n = colunas.length;
      const larguras = [5, ...p.campos.map((c) => c.largura || (c.type === 'time' ? 9 : c.type === 'choice' ? 11 : 7.5)), 15];
      const g = new Grade(larguras);
      const lateral = doc.lateral || [];
      const cLat = n - 2; // duas últimas colunas
      // linha 0: data escrita no alto, como no papel
      g.bloco(0, cLat, 0, n - 1, fmtData(data), { b: true, sz: 11, al: 'r' });
      // cabeçalho (linhas 1 a 4)
      g.bloco(1, 0, 4, 1, '', BORDA);
      g.bloco(1, 2, 2, cLat - 1, doc.empresa || C.empresa, { b: true, sz: 12, al: 'c', borda: true });
      g.bloco(3, 2, 3, cLat - 1, titulo, { b: true, sz: 9, al: 'c', borda: true, quebra: true });
      g.bloco(4, 2, 4, cLat - 1, 'CÓD. DO DOCTO.', { sz: 8, al: 'c', borda: true });
      for (let i = 0; i < 4; i++) g.bloco(1 + i, cLat, 1 + i, n - 1, lateral[i] || '', { sz: 7, al: 'l', borda: true, quebra: true });
      [1, 2, 3, 4].forEach((r) => g.altura(r, 17));
      g.altura(3, 26);
      // tabela
      const t0 = 5;
      colunas.forEach((c, i) => g.set(t0, i, c, { b: true, sz: 8, al: 'c', borda: true, quebra: true }));
      g.altura(t0, 26);
      linhas.forEach((l, j) => {
        l.valores.forEach((v, i) => g.set(t0 + 1 + j, i, v, Object.assign({ sz: 9, al: i === n - 1 || i === n - 2 ? 'l' : 'c', borda: true, b: i === 0 }, casas(p.campos[i - 1], v))));
        g.altura(t0 + 1 + j, 22);
      });
      // aprovação
      const a0 = t0 + 1 + linhas.length + 1;
      const blocos = dividir(1, n - 2, 4);
      (doc.aprovacao || []).forEach(([rot, nome], i) => {
        if (!blocos[i]) return;
        g.bloco(a0, blocos[i][0], a0, blocos[i][1], rot + ':', { sz: 8, al: 'c', borda: true });
        g.bloco(a0 + 1, blocos[i][0], a0 + 1, blocos[i][1], nome, { sz: 8, al: 'c', borda: true });
      });
      return { nome: p.nome, paisagem: false, grade: g, imagem: { linha: 1, coluna: 0, alturaPx: 60, dx: 20, dy: 4 }, dados };
    }

    /* ===== POP-03-FOR-004 (insumos) ===== */
    function pop03(pid, data) {
      const p = ctx.prancheta(pid);
      const doc = D.pop03 || {};
      const meta = (ctx.pegar(data, pid, 'meta') || { valores: {} }).valores;
      const extras = ctx.extrasOperador(p).filter((c) => c.id !== 'fornecedor');
      const colunas = [...p.camposEscritorio.map((c) => c.papel || c.label), 'Quant. adicionada', ...extras.map((c) => c.label), 'Horas', 'Nome Operador'];
      const regs = ctx.linhasDeHora(ctx.listar(data, pid));
      const linhas = ctx.HORAS.map((h) => {
        const r = regs.find((x) => Number(x.chave) === h);
        const val = r ? r.valores : {};
        const qtd = vazio(val.qtd) ? '' : `${fmtNum(val.qtd)} ${val.unidade || p.unidade || ''}`.trim();
        return { rotulo: ctx.rotuloHoraPapel(h), preenchida: !!r, valores: [...p.camposEscritorio.map((c) => (vazio(val[c.id]) ? '' : String(val[c.id]))), qtd, ...extras.map((c) => val[c.id] || ''), ctx.rotuloHoraPapel(h), r ? r.operador || '' : ''] };
      });
      const total = ctx.totalInsumo(regs);
      const dados = {
        cabecalho: [['Sistema', doc.sistema], ['Documento', doc.titulo], ['Código', p.codigo], ['Assunto', doc.assunto], ['Página', doc.pagina], ['Revisão', doc.revisao], ['Data do documento', doc.data],
          ['Insumo/Produto', p.rotuloPapel], ['Data', fmtData(data)], ['Lote', meta.lote || '']],
        colunas, linhas,
        rodape: [['TOTAL', total], ['Verificado por', meta.verificado || ''], ['Data da verificação', meta.dataVerificado || '']],
      };
      const n = colunas.length;
      const iQtd = p.camposEscritorio.length;
      const larguras = [20, 8, 9, 14, 12, ...extras.map(() => 11), 9, 15];
      const g = new Grade(larguras);
      // cabeçalho (linhas 0 a 3)
      g.bloco(0, 0, 2, 0, '', BORDA);
      g.set(3, 0, p.codigo, { sz: 9, al: 'c', borda: true });
      g.bloco(0, 1, 0, n - 1, doc.sistema || 'Sistema de Gestão da Qualidade', { b: true, sz: 11, al: 'c', borda: true });
      g.bloco(1, 1, 1, n - 1, doc.titulo || '', { b: true, sz: 8, al: 'c', borda: true });
      const cols = [[1, iQtd - 1], [iQtd, n - 3], [n - 2, n - 2], [n - 1, n - 1]]; // Assunto | Página | Revisão | Data
      [['Assunto', doc.assunto], ['Página', doc.pagina], ['Revisão', doc.revisao], ['Data', doc.data]].forEach(([rot, v], i) => {
        const [a, b] = cols[i];
        g.bloco(2, a, 2, b, rot, { b: true, sz: 9, al: 'c', borda: true });
        g.bloco(3, a, 3, b, v || '', { sz: 9, al: 'c', borda: true });
      });
      g.altura(0, 20); g.altura(1, 16); g.altura(2, 16); g.altura(3, 16);
      // nome do insumo e data
      g.bloco(4, 0, 4, iQtd - 1, p.rotuloPapel, { b: true, sz: 10, al: 'l', quebra: true });
      g.bloco(4, iQtd, 4, n - 1, `DATA: ${fmtData(data)}`, { sz: 10, al: 'l' });
      g.altura(4, 26);
      g.bloco(5, 0, 5, iQtd - 1, `LOTE: ${meta.lote || ''}`, { sz: 9, al: 'l', va: 'b' });
      // tabela
      const t0 = 6;
      colunas.forEach((c, i) => g.set(t0, i, c, { b: true, sz: 9, al: 'c', borda: true, quebra: true }));
      g.altura(t0, 28);
      linhas.forEach((l, j) => {
        l.valores.forEach((v, i) => g.set(t0 + 1 + j, i, v, { sz: 9, al: i === n - 2 ? 'c' : i === iQtd ? 'c' : 'l', borda: true }));
        g.altura(t0 + 1 + j, 21);
      });
      const tt = t0 + 1 + linhas.length;
      g.set(tt, iQtd - 1, 'TOTAL', { b: true, sz: 9, al: 'c', borda: true });
      g.set(tt, iQtd, total, { b: true, sz: 9, al: 'c', borda: true });
      for (let i = iQtd + 1; i < n; i++) g.set(tt, i, '', BORDA);
      g.altura(tt, 17);
      g.bloco(tt + 2, 0, tt + 2, iQtd - 1, `Verificado por: ${meta.verificado || '____________________'}`, { sz: 9 });
      g.bloco(tt + 2, iQtd, tt + 2, n - 1, `Data: ${meta.dataVerificado || '____________'}`, { sz: 9 });
      return { nome: p.nome, paisagem: false, grade: g, imagem: { linha: 0, coluna: 0, alturaPx: 58, dx: 38, dy: 3 }, dados };
    }

    /* ===== Controle Diário da Caldeira ===== */
    function caldeira(pid, data) {
      const p = ctx.prancheta(pid);
      const doc = D.caldeira || {};
      const regs = ctx.listar(data, pid);
      const porHora = {}; ctx.linhasDeHora(regs).forEach((r) => { porHora[r.chave] = r; });
      const amanha = ctx.linhasDeHora(ctx.listar(ctx.somarDias(data, 1), pid)).find((r) => Number(r.chave) === C.inicioDoDia);
      const horas = [...ctx.HORAS, C.inicioDoDia]; // o papel vai de 7 até 7
      const valorHora = (c, h, i) => { const r = i === horas.length - 1 ? amanha : porHora[h]; return r ? valorCampo(c, r.valores[c.id]) : ''; };
      const colunas = ['HORAS', ...horas.map(String)];
      const linhas = p.itens.map((c) => ({ rotulo: c.papel || c.label, valores: [c.papel || c.label, ...horas.map((h, i) => valorHora(c, h, i))] }));
      const turnos = C.turnos.map((t) => ({ nome: t.nome, operador: operadoresDoTurno(regs, t), horario: horarioDoTurno(t), obs: (ctx.pegar(data, pid, 'obs' + t.id) || { valores: {} }).valores.texto || '' }));
      const dados = {
        cabecalho: [['Documento', 'CONTROLE DIÁRIO DA CALDEIRA'], ['Responsável', (doc.responsavel || []).filter(Boolean).join(' ')], ['Data', fmtData(data)]],
        colunas, linhas,
        rodape: turnos.flatMap((t) => [[`${t.nome} - Operador`, t.operador], [`${t.nome} - Horário/Turno`, t.horario], [`${t.nome} - Obs`, t.obs]]),
      };
      const n = colunas.length; // 26
      const larguras = [15, ...horas.map(() => 5)];
      const g = new Grade(larguras);
      g.bloco(0, 0, 3, 3, '', BORDA);
      g.bloco(0, 4, 3, n - 6, 'CONTROLE DIÁRIO DA CALDEIRA', { b: true, sz: 16, al: 'c', borda: true });
      g.bloco(0, n - 5, 3, n - 1, (doc.responsavel || []).join('\n'), { b: true, sz: 8, al: 'c', borda: true, quebra: true });
      [0, 1, 2, 3].forEach((r) => g.altura(r, 18));
      g.bloco(4, 0, 4, n - 1, `DATA: ${fmtData(data)}`, { b: true, sz: 10, al: 'l', borda: true });
      colunas.forEach((c, i) => g.set(5, i, i === 0 ? c : Number(c), { b: true, sz: 9, al: i === 0 ? 'l' : 'c', borda: true }));
      linhas.forEach((l, j) => {
        l.valores.forEach((v, i) => g.set(6 + j, i, v, i === 0 ? { b: true, sz: 7, al: 'l', borda: true, quebra: true } : Object.assign({ sz: 9, al: 'c', borda: true }, casas(p.itens[j], v))));
        g.altura(6 + j, 34);
      });
      // blocos de turno embaixo (1º: 7 a 16 | 2º: 17 a 23 | 3º: 0 a 7)
      const b0 = 6 + linhas.length;
      const blocos = [[0, 10], [11, 17], [18, n - 1]];
      turnos.forEach((t, i) => {
        const [a, b] = blocos[i] || blocos[blocos.length - 1];
        g.bloco(b0, a, b0, b, `OPERADOR: ${t.operador}`, { b: true, sz: 9, al: 'l', borda: true });
        g.bloco(b0 + 1, a, b0 + 1, b, `HORÁRIO/TURNO: ${t.horario}`, { b: true, sz: 9, al: 'l', borda: true });
        g.bloco(b0 + 2, a, b0 + 2, b, `OBS: ${t.obs}`, { sz: 9, al: 'l', va: 't', borda: true, quebra: true });
      });
      g.altura(b0, 22); g.altura(b0 + 1, 22); g.altura(b0 + 2, 48);
      return { nome: 'Caldeira', paisagem: true, grade: g, imagem: { linha: 0, coluna: 0, alturaPx: 66, dx: 50, dy: 4 }, dados };
    }

    /* ===== Controle Diário da Destilaria ===== */
    function destilaria(pid, data) {
      const p = ctx.prancheta(pid);
      const regs = ctx.listar(data, pid);
      const porHora = {}; ctx.linhasDeHora(regs).forEach((r) => { porHora[r.chave] = r; });
      const parte1 = ctx.HORAS.slice(0, 12); const parte2 = ctx.HORAS.slice(12);
      const linhaItem = (c, horas) => [c.papel || c.label, ...horas.map((h) => (porHora[h] ? valorCampo(c, porHora[h].valores[c.id]) : ''))];
      const turnos = C.turnos.map((t) => ({ nome: t.nome, operador: operadoresDoTurno(regs, t), obs: (ctx.pegar(data, pid, 'obs' + t.id) || { valores: {} }).valores.texto || '' }));
      const dados = {
        cabecalho: [['Documento', 'CONTROLE DIÁRIO DA DESTILARIA'], ['Data', fmtData(data)]],
        colunas: ['Itens /Horas', ...ctx.HORAS.map(String)],
        linhas: p.itens.map((c) => ({ rotulo: c.papel || c.label, valores: linhaItem(c, ctx.HORAS) })),
        rodape: turnos.flatMap((t) => [[t.nome, t.operador], ...(t.obs ? [[`${t.nome} - Obs`, t.obs]] : [])]),
      };
      const n = 13;
      const g = new Grade([22, ...parte1.map(() => 8)]);
      g.bloco(0, 0, 2, 1, '', BORDA);
      g.bloco(0, 2, 2, n - 1, 'CONTROLE DIÁRIO DA DESTILARIA', { b: true, sz: 16, al: 'c', borda: true });
      [0, 1, 2].forEach((r) => g.altura(r, 20));
      g.bloco(3, 0, 3, n - 1, `DATA: ${fmtData(data)}`, { b: true, sz: 10, al: 'l', borda: true });
      let r = 4;
      [parte1, parte2].forEach((horas) => {
        g.set(r, 0, '', BORDA);
        g.bloco(r, 1, r, n - 1, 'HORÁRIO', { b: true, sz: 10, al: 'c', borda: true });
        r++;
        g.set(r, 0, parte1 === horas ? 'Itens /Horas' : '', { b: true, sz: 10, al: 'l', borda: true });
        horas.forEach((h, i) => g.set(r, i + 1, h, { b: true, sz: 10, al: 'c', borda: true }));
        r++;
        p.itens.forEach((c) => {
          linhaItem(c, horas).forEach((v, i) => g.set(r, i, v, i === 0 ? { b: true, sz: 8, al: 'l', borda: true } : Object.assign({ sz: 10, al: 'c', borda: true }, casas(c, v))));
          g.altura(r, 26);
          r++;
        });
        for (let i = 0; i < n; i++) g.set(r, i, '', BORDA);
        r++;
      });
      g.set(r, 0, 'TURNOS', { b: true, sz: 10, al: 'c', borda: true });
      const blocos = dividir(1, n - 1, 3);
      turnos.forEach((t, i) => g.bloco(r, blocos[i][0], r, blocos[i][1], `${i + 1}º TURNO: ${t.operador}`, { sz: 9, al: 'l', borda: true }));
      g.altura(r, 22);
      const obs = turnos.filter((t) => t.obs).map((t) => `${t.nome}: ${t.obs}`).join('   |   ');
      if (obs) { g.bloco(r + 1, 0, r + 1, n - 1, `OBS: ${obs}`, { sz: 9, al: 'l', va: 't', borda: true, quebra: true }); g.altura(r + 1, 34); }
      return { nome: 'Destilaria', paisagem: true, grade: g, imagem: { linha: 0, coluna: 0, alturaPx: 58, dx: 60, dy: 5 }, dados };
    }

    /* ===== Controle Diário da Destilaria (nova) ===== */
    function nova(pid, data) {
      const p = ctx.prancheta(pid);
      const regs = ctx.listar(data, pid);
      const porHora = {}; ctx.linhasDeHora(regs).forEach((r) => { porHora[r.chave] = r; });
      const turnos = C.turnos.map((t) => ({ nome: t.nome, operador: operadoresDoTurno(regs, t), obs: (ctx.pegar(data, pid, 'obs' + t.id) || { valores: {} }).valores.texto || '' }));
      const colunas = ['Itens/Horas', ...ctx.HORAS.map(String)];
      const linhas = p.itens.map((c) => ({ rotulo: c.papel || c.label, valores: [c.papel || c.label, ...ctx.HORAS.map((h) => (porHora[h] ? valorCampo(c, porHora[h].valores[c.id]) : ''))] }));
      const dados = {
        cabecalho: [['Documento', 'USINA UBIRÁLCOOL - CONTROLE DIÁRIO DA DESTILARIA'], ['Data', fmtData(data)]],
        colunas, linhas,
        rodape: turnos.flatMap((t) => [[t.nome, t.operador], ...(t.obs ? [[`${t.nome} - Obs`, t.obs]] : [])]),
      };
      const n = colunas.length; // 25
      const g = new Grade([20, ...ctx.HORAS.map(() => 5)]);
      g.bloco(0, 0, 0, n - 6, 'USINA UBIRÁLCOOL', { sz: 11, al: 'c' });
      g.bloco(1, 0, 1, n - 6, 'CONTROLE DIÁRIO DA DESTILARIA', { sz: 11, al: 'c' });
      g.bloco(0, n - 5, 2, n - 1, '', {});
      g.altura(0, 22); g.altura(1, 22); g.altura(2, 12);
      g.bloco(3, 0, 3, n - 1, `DATA: ${fmtData(data)}`, { sz: 10, al: 'l', borda: true });
      colunas.forEach((c, i) => g.set(4, i, i === 0 ? c : Number(c), { sz: 10, al: i === 0 ? 'l' : 'c', borda: true }));
      linhas.forEach((l, j) => { l.valores.forEach((v, i) => g.set(5 + j, i, v, Object.assign({ sz: i === 0 ? 10 : 9, al: i === 0 ? 'l' : 'c', borda: true }, i ? casas(p.itens[j], v) : {}))); g.altura(5 + j, 24); });
      const t = 5 + linhas.length;
      g.set(t, 0, '', BORDA);
      const blocos = [[1, 10], [11, 17], [18, n - 1]];
      turnos.forEach((tu, i) => g.bloco(t, blocos[i][0], t, blocos[i][1], `${i + 1}° TURNO${tu.operador ? ': ' + tu.operador : ''}`, { sz: 9, al: 'c', borda: true }));
      const obs = turnos.filter((x) => x.obs).map((x) => `${x.nome}: ${x.obs}`).join('   |   ');
      g.bloco(t + 1, 0, t + 3, n - 1, `Obs: ${obs}`, { sz: 9, al: 'l', va: 't', borda: true, quebra: true });
      g.altura(t, 20); [1, 2, 3].forEach((k) => g.altura(t + k, 22));
      return { nome: 'Nova Destilaria', paisagem: true, grade: g, imagem: { linha: 0, coluna: n - 5, alturaPx: 62, dx: 30, dy: 2 }, dados };
    }

    /* ===== Volume de vinho (planilha CONTROLE LTS do escritório) ===== */
    function medicao(pid, data) {
      const m = ctx.medicaoDoDia(data);
      const n = 5;
      const g = new Grade([30, 12, 16, 10, 14]);
      const cab = { b: true, sz: 9, al: 'c', borda: true, fundo: 'D9E2D3' };
      g.bloco(0, 0, 1, n - 1, 'CONTROLE DE VOLUME DAS DORNAS (LTS)', { b: true, sz: 14, al: 'c', borda: true });
      g.bloco(2, 0, 2, n - 1, `DATA: ${fmtData(data)}`, { b: true, sz: 10, al: 'l', borda: true });
      let r = 4;
      const linhas = [];
      m.grupos.forEach((x) => {
        g.bloco(r, 0, r, n - 1, `${x.g.nome.toUpperCase()}${x.hora && x.medidas ? `   (medido às ${x.hora}${x.operador ? ' por ' + x.operador : ''})` : ''}`, { b: true, sz: 10, al: 'l', borda: true, fundo: 'C6D9B4' });
        r++;
        const m3 = x.g.unidade === 'm³';
        ['DORNAS', 'FOLGA', m3 ? 'VOLUME M³' : 'VOLUME LTS', 'BRIX', 'FERMENTANDO'].forEach((c, i) => g.set(r, i, c, cab));
        r++;
        x.linhas.forEach((l) => {
          const vals = [l.d.nome, vazio(l.folga) ? '' : numero(l.folga), l.volume == null ? '' : l.volume, x.g.brix && !vazio(l.brix) ? numero(l.brix) : '', x.g.fermentando ? l.ferm || '' : ''];
          vals.forEach((v, i) => g.set(r, i, v, Object.assign({ sz: 9, al: i ? 'c' : 'l', borda: true }, i === 1 ? { dec: 2 } : i === 2 ? { dec: m3 ? 3 : 2, milhar: true } : {})));
          linhas.push({ rotulo: `${x.g.nome} - ${l.d.nome}`, preenchida: !vazio(l.folga) || !vazio(l.brix) || !vazio(l.ferm), valores: [x.g.nome, ...vals] });
          r++;
        });
        g.set(r, 0, 'SUB TOTAL', { b: true, sz: 9, al: 'l', borda: true, fundo: 'FCE4B4' });
        g.set(r, 1, '', BORDA);
        g.set(r, 2, x.subtotal, { b: true, sz: 9, al: 'c', borda: true, dec: m3 ? 3 : 2, milhar: true, fundo: 'FCE4B4' });
        g.set(r, 3, '', BORDA); g.set(r, 4, '', BORDA);
        r += 2;
      });
      [['TOTAL GERAL LITROS PRODUÇÃO', m.producao, 2], ['TOTAL TANQUES DE ÁLCOOL (M³)', m.tanques, 3]].forEach(([rot, val, dec]) => {
        g.bloco(r, 0, r, 1, rot, { b: true, sz: 10, al: 'l', borda: true, fundo: 'FCE4B4' });
        g.set(r, 2, val, { b: true, sz: 10, al: 'c', borda: true, dec, milhar: true, fundo: 'FCE4B4' });
        g.set(r, 3, '', BORDA); g.set(r, 4, '', BORDA);
        r++;
      });
      r++;
      g.bloco(r, 0, r, n - 1, 'PARÂMETROS DA PRODUÇÃO (FAVOR VERIFICAR E ANOTAR DIARIAMENTE)', { b: true, sz: 10, al: 'l', borda: true, fundo: 'C6D9B4' });
      r++;
      ['', 'BRIX', 'HORÁRIO'].forEach((c, i) => g.set(r, i, c, cab));
      r++;
      const params = [['BRIX NO RALO', 'brix_ralo', 'hora_ralo'], ['BRIX NA HIDRÓLISE', 'brix_hid', 'hora_hid'], ['BRIX FERMENTAÇÃO', 'brix_ferm', 'hora_ferm']];
      params.forEach(([rot, b, h]) => {
        g.set(r, 0, rot, { b: true, sz: 9, al: 'l', borda: true });
        g.set(r, 1, vazio(m.param[b]) ? '' : numero(m.param[b]), { sz: 9, al: 'c', borda: true });
        g.set(r, 2, m.param[h] || '', { sz: 9, al: 'c', borda: true });
        r++;
      });
      const dados = {
        cabecalho: [['Documento', 'CONTROLE DE VOLUME DAS DORNAS (LTS)'], ['Data', fmtData(data)]],
        colunas: ['Grupo', 'Dorna', 'Folga (m)', 'Volume (L)', 'Brix', 'Fermentando'],
        linhas,
        rodape: [['Total geral litros produção', String(m.producao)], ['Total tanques de álcool (m³)', String(m.tanques)],
          ...params.map(([rot, b, h]) => [rot, [m.param[b], m.param[h]].filter((x) => !vazio(x)).join(' às ')])],
      };
      return { nome: 'Volume de vinho', paisagem: false, grade: g, dados };
    }

    /* ===== Caderno das dornas de fermentação ===== */
    function fermentacao(pid, data) {
      const lista = ctx.fermentacaoDoDia(data);
      const colunas = ['DORNA', 'ENCHIDA EM', 'COMEÇOU A ENCHER', 'TERMINOU', 'BRIX INICIAL', 'OPERADOR', 'MEDIÇÃO', 'BRIX', 'VOLUME LTS', 'FERMENTANDO', 'VOLANTE NO DIA', 'ESVAZIOU'];
      const g = new Grade([8, 10, 10, 10, 9, 14, 12, 7, 12, 11, 30, 12]);
      const n = colunas.length;
      g.bloco(0, 0, 1, n - 1, 'CONTROLE DAS DORNAS DE FERMENTAÇÃO', { b: true, sz: 14, al: 'c', borda: true });
      g.bloco(2, 0, 2, n - 1, `DATA: ${fmtData(data)}`, { b: true, sz: 10, al: 'l', borda: true });
      colunas.forEach((c, i) => g.set(4, i, c, { b: true, sz: 8, al: 'c', borda: true, quebra: true, fundo: 'D9E2D3' }));
      g.altura(4, 26);
      const curta = (iso) => (iso ? fmtData(iso).slice(0, 5) : '');
      const linhas = lista.map((l) => {
        const m = l.medicao;
        const valores = [l.n, l.ciclo ? curta(l.enchidaEm) : 'vazia', l.inicio, l.fim, vazio(l.brixInicial) ? '' : numero(l.brixInicial), l.operador,
          m ? `${curta(m.data)} ${m.hora}`.trim() : '', m && !vazio(m.brix) ? numero(m.brix) : '', m && m.volume != null ? m.volume : '', m ? m.ferm || '' : '',
          l.volante.map((s) => `${s.inicio}-${s.fim || '...'}${s.operador ? ' ' + s.operador : ''}`).join('; '), l.esvaziou ? `${curta(l.esvaziou.data)} ${l.esvaziou.hora}` : ''];
        return { rotulo: `Dorna ${l.n}`, preenchida: !!l.ciclo || !!l.volante.length, valores };
      });
      linhas.forEach((l, j) => {
        l.valores.forEach((v, i) => g.set(5 + j, i, v, Object.assign({ sz: 9, al: i === 5 || i === 10 ? 'l' : 'c', borda: true, b: i === 0, quebra: i === 10 }, i === 8 ? { dec: 2, milhar: true } : {})));
        g.altura(5 + j, 20);
      });
      const dados = { cabecalho: [['Documento', 'CONTROLE DAS DORNAS DE FERMENTAÇÃO'], ['Data', fmtData(data)]], colunas, linhas, rodape: [] };
      return { nome: 'Fermentação', paisagem: true, grade: g, dados };
    }

    /* ===== POP 03 - FOR 011: usando o fechamento guardado ===== */
    function rastreamento(pid, data) {
      const p = ctx.prancheta(pid), cfg = C.rastreamento;
      const salvo = ctx.pegar(data, pid, 'dia');
      const v = salvo && !salvo.apagado ? salvo.valores || {} : {};
      const g = new Grade(Array(56).fill(1.8)), linhas = [];
      const ler = (caminho) => caminho.split('.').reduce((o, k) => o == null ? undefined : o[k], v) ?? '';
      const dataPapel = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? fmtData(d) : d || '';
      const cel = (r, a, b, x, fim = r, st = {}) => g.bloco(r, a, fim, b, x, Object.assign({ borda: true, sz: 8, al: 'l', quebra: true }, st));
      const cab = (r, a, b, x) => cel(r, a, b, x, r, { b: true, al: 'c' });
      const valor = (r, a, b, caminho, fim = r, dec = 1) => {
        const x = ler(caminho);
        cel(r, a, b, x, fim, { dec, milhar: true, al: 'c' });
        linhas.push({ rotulo: caminho, valores: [caminho, x], preenchida: x !== '' });
      };
      const fechamento = v.fechamento || '';
      cel(0, 0, 3, '', 4);
      cab(0, 4, 7, 'INÍCIO'); cab(0, 8, 11, 'FINAL');
      cel(1, 4, 7, '07:00'); cel(1, 8, 11, '07:00');
      cel(2, 4, 7, 'DIA ANTERIOR', 2, { sz: 7 }); cel(2, 8, 11, 'DIA ATUAL', 2, { sz: 7 });
      cel(3, 4, 7, dataPapel(data)); cel(3, 8, 11, dataPapel(fechamento));
      cel(4, 4, 11, 'DATA: ' + dataPapel(fechamento));
      cab(0, 12, 55, `${p.codigo}: ${p.titulo} - ${p.revisao || '01/2026'}`);
      [[12, 15, 'PRODUTO'], [16, 20, 'PRODUÇÃO (L)'], [21, 26, 'Nº DO LOTE'], [27, 31, 'VALIDADE']].forEach(([a, b, t]) => cab(1, a, b, t));
      [['alcool', 'ÁLCOOL-PA', cfg.validadeAlcoolMeses + ' MESES'], ['vinhaca', 'VINHAÇA', cfg.validadeVinhacaDias + ' DIAS']].forEach(([id, nome, prazo], i) => {
        const r = 2 + i;
        cel(r, 12, 15, nome); valor(r, 16, 20, id + '.producao'); valor(r, 21, 26, id + '.lote');
        cel(r, 27, 31, prazo + (ler(id + '.validade') ? '\n' + dataPapel(ler(id + '.validade')) : ''), r, { sz: 7, al: 'c' });
      });
      cel(4, 12, 20, 'VOLUME DESTILADO (L):'); valor(4, 21, 31, 'volumeDestilado');
      cab(1, 32, 55, 'PRODUTOS INTERMEDIÁRIOS (PI)');
      cel(2, 32, 47, '(PI) PRODUÇÃO DE HIDRÓLISE (L):'); valor(2, 48, 55, 'pi.hidrolise');
      cel(3, 32, 47, '(PI) PRODUÇÃO DE VINHO (L):'); valor(3, 48, 55, 'pi.vinho');
      cel(4, 32, 55, 'MP ÷ fator = hidrolisado; × Brix inicial ÷ Brix final = vinho', 4, { sz: 7 });
      [['hidrolise', 'HIDRÓLISE', cfg.parametros.hidrolise], ['alcoolParam', 'PRODUÇÃO DE ÁLCOOL', cfg.parametros.alcool]].forEach(([id, nome, params], i) => {
        const a = i * 16;
        cab(5, a, a + 15, nome);
        [[a, a + 5, 'DADOS'], [a + 6, a + 10, 'PARÂMETROS'], [a + 11, a + 15, 'RESULTADO']].forEach(([x, y, t]) => cab(6, x, y, t));
        params.forEach(([campo, rotulo, limite], j) => {
          cel(7 + j, a, a + 5, rotulo); cel(7 + j, a + 6, a + 10, limite);
          valor(7 + j, a + 11, a + 15, id + '.' + campo, 7 + j, 2);
        });
      });
      const tanques = cfg.tanques.flatMap((x) => x.lista);
      const linhaTanques = (r, ids, ultima = r + 3) => {
        cel(r, 0, 3, 'RESULTADO');
        ids.forEach((id, i) => cel(r, (i + 1) * 4, (i + 2) * 4 - 1, ((tanques.find((t) => t[0] === id) || [])[1] || '').replace(' (volante)', ''), r, { sz: 7, al: 'c' }));
        ['brix', 'ph', 'folga'].forEach((campo, j) => {
          const fim = j === 2 ? ultima : r + j + 1;
          cel(r + j + 1, 0, 3, campo.toUpperCase(), fim);
          ids.forEach((id, i) => valor(r + j + 1, (i + 1) * 4, (i + 2) * 4 - 1, 'tanques.' + id + '.' + campo, fim, 2));
        });
      };
      cab(10, 0, 11, 'HIDRÓLISE · TQs da Hidrólise'); cab(10, 12, 31, 'SACARIFICAÇÃO · TQs da Sacarificação');
      linhaTanques(11, ['h1', 'h2', 's1', 's2', 's3', 's4', 's5']);
      cab(15, 0, 23, 'FERMENTAÇÃO'); cab(15, 24, 31, 'VOLANTE');
      linhaTanques(16, ['f1', 'f2', 'f3', 'f4', 'f5', 'v1', '']);
      cab(20, 0, 31, 'DORNAS DE DESCANSO');
      linhaTanques(21, ['d1', 'd2', 'd4', 'd5', 'd6', 'd7', 'd8']);
      const cols = [[32, 39], [40, 42], [43, 45], [46, 49], [50, 51], [52, 55]];
      ['INSUMOS', 'KGS/LTS', 'LOTE', 'VALIDADE', 'Nº NF', 'FORNECEDOR'].forEach((t, i) => cab(5, ...cols[i], t));
      [...cfg.insumos, ...cfg.tratamentoAgua].forEach(([id, nome], i) => {
        const r = 6 + i;
        cel(r, 32, 39, (i >= cfg.insumos.length ? 'ÁGUA · ' : '') + nome + (ler('insumos.' + id + '.unidade') === 'copos' ? ' (copos)' : ''), r, { sz: 7 });
        ['qtd', 'lote', 'validade', 'nf', 'fornecedor'].forEach((campo, j) => {
          if (campo === 'validade') cel(r, ...cols[j + 1], String(ler('insumos.' + id + '.' + campo)).split(' / ').map(dataPapel).join(' / '), r, { sz: 7 });
          else valor(r, ...cols[j + 1], 'insumos.' + id + '.' + campo, r, 3);
        });
      });
      cab(19, 32, 55, 'HIGIENIZAÇÃO DE EQUIPAMENTOS');
      [[32, 42, 'INSUMO'], [43, 45, 'KGS'], [46, 49, 'VALIDADE'], [50, 51, 'Nº NF'], [52, 55, 'FORNECEDOR']].forEach(([a, b, t]) => cab(20, a, b, t));
      cel(21, 32, 42, 'SODA CÁUSTICA EM ESCAMAS'); valor(21, 43, 45, 'insumos.soda.qtd', 21, 3);
      cel(21, 46, 49, dataPapel(ler('insumos.soda.validade'))); valor(21, 50, 51, 'insumos.soda.nf'); valor(21, 52, 55, 'insumos.soda.fornecedor');
      cab(22, 32, 55, 'MOAGEM DE MATÉRIA-PRIMA (MP)');
      [[32, 38, 'PRODUTO'], [39, 43, 'KG'], [44, 47, 'Nº NF'], [48, 55, 'FORNECEDOR']].forEach(([a, b, t]) => cab(23, a, b, t));
      const nMP = Math.max(3, (v.mp || []).length);
      for (let i = 0; i < nMP; i++) [[32, 38, 'produto'], [39, 43, 'kg'], [44, 47, 'nf'], [48, 55, 'fornecedor']].forEach(([a, b, campo]) => valor(24 + i, a, b, `mp.${i}.${campo}`, 24 + i, 3));
      const lenha = 24 + nMP, nLenha = Math.max(2, (v.lenha || []).length), assinatura = lenha + 2 + nLenha;
      cab(lenha, 32, 55, 'TIPO DE LENHA E VOLUME CONSUMIDO M³');
      [[32, 41, 'TIPO LENHA'], [42, 47, 'M³'], [48, 55, 'FORNECEDOR']].forEach(([a, b, t]) => cab(lenha + 1, a, b, t));
      for (let i = 0; i < nLenha; i++) [[32, 41, 'tipo'], [42, 47, 'm3'], [48, 55, 'fornecedor']].forEach(([a, b, campo]) => valor(lenha + 2 + i, a, b, `lenha.${i}.${campo}`, lenha + 2 + i, 3));
      cel(assinatura, 32, 43, 'ENCARREGADO: ' + (v.encarregado || ''));
      cel(assinatura, 44, 55, 'ASSINATURA:');
      cab(25, 0, 15, 'DORNAS DE DESCANSO'); cab(25, 16, 31, 'AVISO');
      linhaTanques(26, ['d9', 'd10', 'd11'], assinatura);
      cel(26, 16, 31, cfg.aviso, assinatura, { va: 't', b: true, sz: 9 });
      cel(assinatura + 1, 0, 55, 'OPERADORES: ' + (v.operadores || []).join(' - '));
      for (let r = 0; r < g.linhas; r++) g.altura(r, r === 0 ? 22 : r === 2 || r === 3 ? 23 : 15);
      return {
        nome: p.nome, paisagem: true, grade: g, imagem: { linha: 0, coluna: 0, alturaPx: 46, dx: 1, dy: 22 },
        dados: { cabecalho: [['Documento', p.titulo], ['Código', p.codigo], ['Produção', data], ['Fechamento', fechamento],
          ['Lote', v.lote || ''], ['Validade álcool', ler('alcool.validade')], ['Validade vinhaça', ler('vinhaca.validade')]],
          colunas: ['Campo', 'Valor'], linhas, rodape: [['Operadores', (v.operadores || []).join(' - ')], ['Encarregado', v.encarregado || '']] },
      };
    }

    const MODELOS = { pop011, pop03, caldeira, destilaria, nova, medicao, fermentacao, rastreamento };
    return {
      /** Monta a folha de papel de uma prancheta num dia. */
      folha(pid, data) {
        const p = pranchetaCompleta(pid);
        const nomeModelo = p.papel && p.papel.modelo ? p.papel.modelo : p.tipo === 'rastreamento' ? 'rastreamento' : p.tipo === 'insumo' ? 'pop03' : p.tipo === 'dornas' ? 'pop011' : 'caldeira';
        const f = MODELOS[nomeModelo](pid, data);
        const regs = ctx.listar(data, pid).filter((r) => /^\d+$/.test(r.chave));
        const novos = listas.flatMap((k) => (p[k] || []).filter((c) => c.novo === true));
        f.dados.camposNovos = novos.map((c) => ({
          id: c.id, rotulo: c.label,
          unidade: window.Folhas && window.Folhas.unidadeNoDia ? window.Folhas.unidadeNoDia(c, data) : c.unidade,
          valores: regs.filter((r) => !vazio(r.valores[c.id])).map((r) => ({ linha: p.tipo === 'insumo' ? ctx.rotuloHoraPapel(r.chave) : r.chave, valor: valorCampo(c, r.valores[c.id]) })),
        })).filter((c) => c.valores.length);
        const s = ctx.setorDaPrancheta(pid);
        f.pid = pid; f.setor = s ? s.nome : ''; f.codigo = p.codigo; f.titulo = (p.papel && p.papel.titulo) || p.titulo;
        // nome da aba do Excel (até 31 letras)
        const longo = `${f.setor.split(' ')[0]} - ${p.nome}`;
        f.nomePlanilha = p.tipo === 'grade' ? f.nome : longo.length <= 31 ? longo : p.nome;
        return f;
      },
      textoNum,
    };
  }

  /* ---------- Grade -> planilha do xlsx.js ---------- */
  function paraPlanilha(f) {
    const g = f.grade;
    const rows = [];
    for (let r = 0; r < g.linhas; r++) {
      const linha = [];
      for (let c = 0; c < g.larguras.length; c++) {
        const cel = g.cel[r + ',' + c];
        linha.push(cel ? { v: cel.v, st: cel.st && Object.keys(cel.st).length ? cel.st : undefined } : '');
      }
      rows.push(linha);
    }
    const merges = g.mesclas.map(([r1, c1, r2, c2]) => `${colNome(c1)}${r1 + 1}:${colNome(c2)}${r2 + 1}`);
    return { name: f.nomePlanilha, rows, widths: g.larguras, heights: g.alturas, merges, paisagem: f.paisagem, imagem: f.imagem };
  }

  /* ---------- Grade -> HTML para imprimir ---------- */
  function paraHtml(f, logoUrl, fmtNum) {
    const g = f.grade;
    const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    const coberta = new Set(); const span = {};
    g.mesclas.forEach(([r1, c1, r2, c2]) => {
      span[r1 + ',' + c1] = [r2 - r1 + 1, c2 - c1 + 1];
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) if (r !== r1 || c !== c1) coberta.add(r + ',' + c);
    });
    const total = g.larguras.reduce((a, b) => a + b, 0);
    const cols = g.larguras.map((w) => `<col style="width:${((w / total) * 100).toFixed(2)}%">`).join('');
    let html = '';
    for (let r = 0; r < g.linhas; r++) {
      const ht = g.alturas[r] ? ` style="height:${Math.round(g.alturas[r] * 1.1)}px"` : '';
      html += `<tr${ht}>`;
      for (let c = 0; c < g.larguras.length; c++) {
        const k = r + ',' + c;
        if (coberta.has(k)) continue;
        const cel = g.cel[k] || { v: '' };
        const st = cel.st || {};
        const [rs, cs] = span[k] || [1, 1];
        const cls = [st.borda ? 'b' : '', st.b ? 'n' : '', `a${st.al || 'l'}`, `v${st.va || 'c'}`, st.quebra ? 'q' : ''].filter(Boolean).join(' ');
        const estilo = `font-size:${((st.sz || 10) * 0.95).toFixed(1)}pt`;
        const logo = f.imagem && f.imagem.linha === r && f.imagem.coluna === c && logoUrl ? `<img class="logo-imp" src="${logoUrl}" alt="Ubirálcool">` : '';
        const v = typeof cel.v === 'number' ? (st.milhar ? cel.v.toLocaleString('pt-BR', { minimumFractionDigits: st.dec || 0, maximumFractionDigits: st.dec || 0 }) : fmtNum(st.dec ? cel.v.toFixed(st.dec) : String(cel.v))) : cel.v;
        html += `<td${rs > 1 ? ` rowspan="${rs}"` : ''}${cs > 1 ? ` colspan="${cs}"` : ''} class="${cls}" style="${estilo}">${logo}${esc(v).replace(/\n/g, '<br>')}</td>`;
      }
      html += '</tr>';
    }
    return `<section class="folha-imp ${f.paisagem ? 'paisagem' : 'retrato'}"><table class="grade-imp"><colgroup>${cols}</colgroup>${html}</table></section>`;
  }

  /* ---------- Dados -> XML na ordem do papel ---------- */
  function paraXml(f, data, esc) {
    const d = f.dados;
    const at = (k, v) => `${k}="${esc(v === undefined || v === null ? '' : v)}"`;
    const linhas = [`  <folha ${at('prancheta', f.pid)} ${at('setor', f.setor)} ${at('codigo', f.codigo)} ${at('titulo', f.titulo)} ${at('data', data)}>`];
    linhas.push('    <cabecalho>');
    d.cabecalho.forEach(([k, v]) => linhas.push(`      <item ${at('nome', k)}>${esc(v || '')}</item>`));
    linhas.push('    </cabecalho>');
    linhas.push(`    <tabela colunas="${d.colunas.length}">`);
    d.linhas.forEach((l) => {
      if (l.preenchida === false) return; // linhas em branco do papel não vão para o sistema
      if (l.preenchida === undefined && l.valores.slice(1).every((v) => v === '' || v == null)) return;
      linhas.push(`      <linha ${at('rotulo', l.rotulo)}>`);
      l.valores.forEach((v, i) => linhas.push(`        <coluna ${at('nome', d.colunas[i])}>${esc(v === '' || v == null ? '' : typeof v === 'number' ? String(v) : v)}</coluna>`));
      linhas.push('      </linha>');
    });
    linhas.push('    </tabela>');
    if (d.camposNovos && d.camposNovos.length) {
      linhas.push('    <camposNovos>');
      d.camposNovos.forEach((c) => {
        linhas.push(`      <campo ${at('nome', c.rotulo)} ${at('unidade', c.unidade)}>`);
        c.valores.forEach((v) => linhas.push(`        <valor ${at('linha', v.linha)}>${esc(String(v.valor))}</valor>`));
        linhas.push('      </campo>');
      });
      linhas.push('    </camposNovos>');
    }
    linhas.push('    <rodape>');
    d.rodape.forEach(([k, v]) => linhas.push(`      <item ${at('nome', k)}>${esc(v || '')}</item>`));
    linhas.push('    </rodape>');
    linhas.push('  </folha>');
    return linhas.join('\n');
  }

  window.ModelosPapel = { montar, paraPlanilha, paraHtml, paraXml };
})();
