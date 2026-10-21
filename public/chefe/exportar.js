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
  const papel = () => modelosPapel || (modelosPapel = window.ModelosPapel.montar({
    C, prancheta, setorDaPrancheta, turnos: turnosDaPrancheta, listar: listarPapel, pegar, fmtData, fmtNum, rotuloHoraPapel, HORAS, linhasDeHora, totalInsumo, extrasOperador, somarDias,
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
  async function imprimirFolhas(dias, setorIds) {
    const pids = folhasDosSetores(setorIds);
    const l = listaDeDias(dias);
    return imprimirHtml(l.flatMap((data) => pids.map((pid) => window.ModelosPapel.paraHtml(papel().folha(pid, data), 'icons/logo.png', fmtNum))).join(''), `Pranchetas ${fmtData(l[0])}`);
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
  const MIME = { xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xml: 'application/xml', pdf: 'application/pdf' };
  function gerarArquivo(formato, dias, setorIds, somar) {
    const pids = folhasDosSetores(setorIds);
    const l = listaDeDias(dias);
    // o relatório do dia (todos os setores) tem sempre o mesmo nome: um por dia; só alguns setores ganham o nome deles
    const parcial = setorIds.length < setores().length;
    const nome = `Pranchetas_${nomeDosDias(l)}${parcial ? '_' + setorIds.join('-') : ''}`;
    if (formato === 'xml') return new File([gerarXml(l, pids)], nome + '.xml', { type: MIME.xml });
    // vários dias: uma aba por folha de cada dia (o nome da aba leva o dia); "somar" põe a aba com os totais no começo
    const abas = l.flatMap((data) => pids.map((pid) => { const a = planilhaDaPrancheta(pid, data); if (l.length > 1) a.name = `${String(a.name || pid).slice(0, 24)} ${data.slice(8, 10)}-${data.slice(5, 7)}`; return a; }));
    if (somar) {
      const cel = (v, b) => ({ v, st: { borda: true, b: !!b } });
      const linhas = [[cel(`Totais de ${fmtData(l[0])} a ${fmtData(l[l.length - 1])}`, true), '', '', ''], [cel('Setor', true), cel('Insumo', true), cel('Quantidade', true), cel('Unidade', true)],
        ...totaisDoEnvio(l, setorIds).map((x) => [cel(x.setor), cel(x.insumo), cel(x.quantidade), cel(x.unidade)])];
      abas.unshift({ name: 'Totais do período', rows: linhas, widths: [24, 30, 14, 10], heights: {}, merges: ['A1:D1'], paisagem: false });
    }
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
  async function gerarPdf(dias, setorIds) {
    const pids = folhasDosSetores(setorIds);
    const l = listaDeDias(dias);
    const parcial = setorIds.length < setores().length;
    const nome = `Pranchetas_${nomeDosDias(l)}${parcial ? '_' + setorIds.join('-') : ''}`;
    const pecas = await pecasPdf();
    const bytes = window.criarPdf(l.flatMap((data) => pids.map((pid) => papel().folha(pid, data))), Object.assign({ fmtNum, titulo: `Pranchetas Ubirálcool ${fmtData(l[0])}` }, pecas));
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
      insumos.forEach((pid) => linhas.push(`• ${prancheta(pid).nome}: ${totalInsumo(linhasDeHora(listarPapel(data, pid))) || 'nada adicionado'}`));
    }
    return linhas.join('\n');
  }
