/* Pranchetas Ubirálcool - exportar Excel, XML e compartilhar
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * Exportar: Excel (.xlsx), XML e compartilhar
   * ========================================================= */
  /* Folhas iguais ao papel: o mesmo molde (modelos.js) gera o Excel, o XML e a impressão */
  let LOGO_PNG = null;
  fetch('icons/logo.png').then((r) => r.arrayBuffer()).then((b) => { LOGO_PNG = new Uint8Array(b); }).catch(() => {});
  let modelosPapel = null;
  // dia sem salvar: a folha de rastreamento sai com o que foi calculado (o papel normal lê só o que está salvo)
  let rascunhoRastreio = null;
  const pegarParaPapel = (data, pid, chave) => (rascunhoRastreio && pid === PID_RASTREIO && rascunhoRastreio.dia === data ? { valores: rascunhoRastreio.valores } : pegar(data, pid, chave));
  function folhaDoRastreamento(dia, valores) {
    const naoConferido = !valores && !rastreioGuardado(dia);
    const x = valores || (naoConferido ? valoresDoDia(dia) : null);
    rascunhoRastreio = x ? { dia, valores: Object.assign({}, x, { operadores: String(x.operadores || '').split(/s*-s*|s*,s*/).filter(Boolean) }) } : null;
    try {
      const f = papel().folha(PID_RASTREIO, dia), g = f.grade;
      if (naoConferido) g.bloco(g.linhas, 0, g.linhas, g.larguras.length - 1, 'Calculado das anotações, não conferido', { b: true, al: 'c', sz: 9 });
      return f;
    } finally { rascunhoRastreio = null; }
  }
  const papel = () => modelosPapel || (modelosPapel = window.ModelosPapel.montar({
    C, prancheta, setorDaPrancheta, turnos: turnosDaPrancheta, listar: listarPapel, pegar: pegarParaPapel, fmtData, fmtNum, rotuloHoraPapel, HORAS, linhasDeHora, totalInsumo, extrasOperador, somarDias,
    medicaoDoDia: (data) => medicaoDoDia(data), fermentacaoDoDia,
  }));
  function planilhaDaPrancheta(pid, data) {
    return window.ModelosPapel.paraPlanilha(papel().folha(pid, data));
  }
  const listaDeDias = (dias) => (Array.isArray(dias) ? dias : [dias]);
  const nomeDosDias = (dias) => { const l = listaDeDias(dias); return l.length > 1 ? `${l[0]}_a_${l[l.length - 1]}` : l[0]; };
  function gerarXml(dias, pids) {
    const X = window.xmlEscape;
    const l = listaDeDias(dias);
    const partes = ['<?xml version="1.0" encoding="UTF-8"?>', `<pranchetas empresa="${X(C.empresa)}" data="${l[0]}"${l.length > 1 ? ` ate="${l[l.length - 1]}"` : ''} gerado="${new Date().toISOString()}">`];
    l.forEach((data) => pids.forEach((pid) => partes.push(window.ModelosPapel.paraXml(papel().folha(pid, data), data, X))));
    partes.push('</pranchetas>');
    return new Blob([partes.join('\n')], { type: 'application/xml' });
  }
  /** Imprime as folhas do dia iguais ao papel (no Android abre a impressão do sistema, que também salva em PDF). */
  async function imprimirFolhas(dias, setorIds, somar, extras) {
    const l = listaDeDias(dias);
    return imprimirHtml(folhasDoEnvio(l, setorIds, somar, extras).map((f) => window.ModelosPapel.paraHtml(f, 'icons/logo.png', fmtNum)).join(''), `Pranchetas ${fmtData(l[0])}`);
  }
  /** Imprime um pedaço de HTML (folhas, etiquetas). No Android abre a impressão do sistema, que também salva em PDF. */
  async function imprimirHtml(html, nome) {
    let area = document.getElementById('impressao');
    if (!area) { area = document.createElement('div'); area.id = 'impressao'; document.body.appendChild(area); }
    area.innerHTML = html;
    // a primeira página já nasce no tamanho da primeira folha (sem página em branco antes de uma folha deitada)
    const primeira = area.querySelector('.folha-imp');
    area.style.page = document.body.style.page = primeira && primeira.classList.contains('paisagem') ? 'paisagem' : 'retrato';
    document.body.classList.add('imprimindo');
    await Promise.all([...area.querySelectorAll('img')].map((im) => (im.complete ? 0 : new Promise((ok) => { im.onload = ok; im.onerror = ok; }))));
    if (NO_APK && pluginCentral && pluginCentral.imprimir) {
      // a folha fica escondida na tela; o Android desenha a impressão quando a pessoa escolhe a impressora
      try { await pluginCentral.imprimir({ nome }); } catch (e) { toast('Não consegui abrir a impressão', 'erro'); }
      return;
    }
    window.addEventListener('afterprint', () => { document.body.classList.remove('imprimindo'); area.innerHTML = ''; }, { once: true });
    window.print();
  }
  const folhasDosSetores = (setorIds) => setores().filter((s) => setorIds.includes(s.id)).flatMap((s) => s.pranchetas.flatMap(folhasDe));
  /** A conta do período de uma folha, respeitando os turnos marcados no envio. */
  const consolidadoDaFolha = (pid, dias) => window.Consolidar.daFolha(prancheta(pid), Object.fromEntries(dias.map((d) => [d, listarPapel(d, pid)])), dias);
  const comUnidade = (x) => (x.unidade ? `${x.rotulo} (${x.unidade})` : x.rotulo);
  const diasCurtos = (dias) => dias.map((d) => fmtData(d).slice(0, 5)).join(', ');
  const folhasMedidas = (setor) => setor.pranchetas.flatMap(folhasDe).filter((pid) => prancheta(pid).tipo !== 'insumo');
  /** Período somado: uma folha por área, com total das quantidades e média, mínima e máxima das medições. */
  function folhaSomadaDoSetor(setor, dias) {
    const secoes = [], rodape = [];
    folhasMedidas(setor).forEach((pid) => {
      const p = prancheta(pid), r = consolidadoDaFolha(pid, dias);
      const linhas = [...r.quantidades.map((x) => [comUnidade(x), x.total, '', '', '', '']), ...r.medicoes.map((x) => [comUnidade(x), '', x.media, x.minima, x.maxima, x.leituras])];
      if (linhas.length) secoes.push({ titulo: p.nome, colunas: ['Campo', 'Total', 'Média', 'Mínima', 'Máxima', 'Leituras'], linhas });
      if (r.operadores.length) rodape.push(`${p.nome}. Operadores: ${r.operadores.join(', ')}`);
      if (r.diasSemAnotacao.length) rodape.push(`${p.nome}. Sem anotação em: ${diasCurtos(r.diasSemAnotacao)}`);
    });
    const insumos = totaisDoEnvio(dias, [setor.id]);
    if (insumos.length) secoes.push({ titulo: 'Insumos', colunas: ['Insumo', 'Quantidade', 'Unidade'], linhas: insumos.map((x) => [x.insumo, x.quantidade, x.unidade]) });
    return window.ModelosPapel.folhaDeTabela({ nome: setor.nome, titulo: `${setor.nome}, de ${fmtData(dias[0])} a ${fmtData(dias[dias.length - 1])}`, secoes, rodape });
  }
  const NUM_PRODUCAO = [['alcool', 'Álcool', 'L'], ['vinhaca', 'Vinhaça', 'L'], ['hidrolisado', 'Hidrolisado', 'L'], ['vinho', 'Vinho', 'L']];
  /** Cálculo de produção de um dia, ou de vários já somados. */
  function folhaDeProducao(dias) {
    const lista = dias.map(producaoDoDia), r = lista.length === 1 ? lista[0] : window.Consolidar.producao(lista);
    const naoConferidos = lista.filter((x) => !x.conferido);
    const linhas = [...NUM_PRODUCAO.map(([k, nome, u]) => [nome, r[k], u]), ['INPM médio', r.inpm, '°'], ['Brix médio', r.brix, '°Bx']];
    return window.ModelosPapel.folhaDeTabela({
      nome: 'Cálculo de produção', titulo: dias.length === 1 ? `Cálculo de produção de ${fmtData(dias[0])}` : `Cálculo de produção, de ${fmtData(dias[0])} a ${fmtData(dias[dias.length - 1])}`,
      secoes: [{ titulo: 'Produção', colunas: ['Item', 'Valor', 'Unidade'], linhas }],
      rodape: [`Lote: ${[...new Set(lista.map((x) => x.lote).filter(Boolean))].join(', ')}`, ...(naoConferidos.length ? [`Calculado das anotações, não conferido: ${diasCurtos(naoConferidos.map((x) => x.dia))}`] : [])],
    });
  }
  /** O que sai no Excel, no PDF e na impressão: as folhas de cada dia ou uma por área, e o cálculo e o rastreamento marcados. */
  function folhasDoEnvio(l, setorIds, somar, extras = []) {
    const somado = somar && l.length > 1;
    const doDia = (f, dia) => Object.assign(f, { dia });
    const folhas = somado
      ? setores().filter((s) => setorIds.includes(s.id)).map((s) => folhaSomadaDoSetor(s, l))
      : l.flatMap((data) => folhasDosSetores(setorIds).map((pid) => doDia(papel().folha(pid, data), data)));
    if (extras.includes('calculo')) folhas.push(...(somado ? [folhaDeProducao(l)] : l.map((d) => doDia(folhaDeProducao([d]), d))));
    if (extras.includes('rastreamento')) folhas.push(...l.map((d) => doDia(folhaDoRastreamento(d), d))); // cada dia tem o seu lote, mesmo somando
    return folhas;
  }
  const MIME = { xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xml: 'application/xml', pdf: 'application/pdf' };
  function gerarArquivo(formato, dias, setorIds, somar, extras) {
    const pids = folhasDosSetores(setorIds);
    const l = listaDeDias(dias);
    // o relatório do dia (todos os setores) tem sempre o mesmo nome: um por dia; só alguns setores ganham o nome deles
    const parcial = setorIds.length < setores().length;
    const nome = `Pranchetas_${nomeDosDias(l)}${parcial ? '_' + setorIds.join('-') : ''}`;
    if (formato === 'xml') return new File([gerarXml(l, pids)], nome + '.xml', { type: MIME.xml });
    // vários dias sem somar: uma aba por folha de cada dia (o nome da aba leva o dia)
    const abas = folhasDoEnvio(l, setorIds, somar, extras).map((f) => {
      const a = window.ModelosPapel.paraPlanilha(f);
      if (f.dia && l.length > 1) a.name = `${String(a.name).slice(0, 24)} ${f.dia.slice(8, 10)}-${f.dia.slice(5, 7)}`;
      return a;
    });
    return new File([window.criarXlsx(abas, LOGO_PNG)], nome + '.xlsx', { type: MIME.xlsx });
  }
  /** PDF das folhas (pdf.js): uma página para cada folha de papel. A letra e o logo são buscados uma vez só. */
  let pecasDoPdf = null;
  async function pecasPdf() {
    if (pecasDoPdf) return pecasDoPdf;
    const fonte = (n) => fetch(`fonts/atkinson-pdf-${n}.ttf`).then((r) => { if (!r.ok) throw new Error('fonte'); return r.arrayBuffer(); });
    const [normal, negrito] = await Promise.all([fonte(400), fonte(700)]);
    let logo = null;
    try {
      const im = new Image();
      im.src = 'icons/logo.png';
      await im.decode();
      const cv = document.createElement('canvas');
      cv.width = im.naturalWidth; cv.height = im.naturalHeight;
      const cx = cv.getContext('2d');
      cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(im, 0, 0);
      const b64 = cv.toDataURL('image/jpeg', 0.92).split(',')[1];
      logo = { jpeg: Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)), largura: cv.width, altura: cv.height };
    } catch (e) { /* sem o logo, o PDF sai do mesmo jeito */ }
    pecasDoPdf = { fontes: [normal, negrito], logo };
    return pecasDoPdf;
  }
  async function gerarPdf(dias, setorIds, somar, extras) {
    const l = listaDeDias(dias);
    const parcial = setorIds.length < setores().length;
    const nome = `Pranchetas_${nomeDosDias(l)}${parcial ? '_' + setorIds.join('-') : ''}`;
    const pecas = await pecasPdf();
    const bytes = window.criarPdf(folhasDoEnvio(l, setorIds, somar, extras), Object.assign({ fmtNum, titulo: `Pranchetas Ubirálcool ${fmtData(l[0])}` }, pecas));
    return new File([bytes], nome + '.pdf', { type: MIME.pdf });
  }
  const paraBase64 = (arquivo) => new Promise((ok, erro) => {
    const fr = new FileReader();
    fr.onload = () => ok(String(fr.result).split(',')[1]);
    fr.onerror = erro;
    fr.readAsDataURL(arquivo);
  });

  /** Guarda o arquivo na pasta RelatoriosUsina do servidor. */
  async function guardarNaCentral(data, arquivos) {
    if (cfg.demo || !cfg.chave) return false;
    try {
      for (const f of arquivos) {
        const r = await postJson('api/relatorio', { data, nome: f.name, base64: await paraBase64(f) }, 30000);
        if (!r.ok) return false;
      }
      return true;
    } catch (e) { return false; }
  }

  /** Resumo em texto do dia, para mandar numa mensagem */
  function resumoDoDia(data, setorIds) {
    const lista = setores().filter((s) => !setorIds || setorIds.includes(s.id));
    const linhas = ['*PRANCHETAS UBIRÁLCOOL*', `Folha de ${fmtData(data)} (${diaSemana(data)}), das ${pad2(C.inicioDoDia)}:00 às ${pad2((C.inicioDoDia + 23) % 24)}:59`];
    lista.forEach((s) => {
      linhas.push('', `*${s.nome.toUpperCase()}*`);
      s.pranchetas.forEach((pid) => linhas.push(`• ${prancheta(pid).nome}: ${resumoPrancheta(pid, data).texto}`));
    });
    // total do dia de cada insumo: o que o escritório lança no sistema dele
    const insumos = lista.flatMap((s) => s.pranchetas.flatMap(folhasDe)).filter((pid) => prancheta(pid).tipo === 'insumo');
    if (insumos.length) {
      linhas.push('', '*TOTAIS DO DIA (insumos)*');
      // 2.16: numa unidade só (g vira kg, L vira mL) e com o que foi em cada turno
      const totais = totaisPorTurno(data, listarPapel);
      const num = (n) => fmtNum(String(Math.round(n * 100) / 100));
      insumos.forEach((pid) => {
        const ls = totais.filter((x) => x.folha === pid);
        linhas.push(`• ${prancheta(pid).nome}: ${ls.length ? ls.map((x) => `${num(x.total)} ${x.unidade}` + (x.turnos.filter((y) => y.q).length > 1 ? ` (${x.turnos.filter((y) => y.q).map((y) => `${y.t.nome.replace(' Turno', '')} ${num(y.q)}`).join(' · ')})` : '')).join(' + ') : 'nada adicionado'}`);
      });
    }
    return linhas.join('\n');
  }
