/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * PDF das folhas do dia, feito aqui mesmo (sem biblioteca e sem internet).
 * Cada folha vira uma página A4 (em pé ou deitada, como no papel), desenhada a partir da mesma
 * "grade" do Excel e da impressão (modelos.js): células, mesclas, bordas, negrito e o logo.
 * A letra é a do aplicativo (Atkinson Hyperlegible), que vai dentro do arquivo: abre igual em qualquer aparelho.
 *
 *   window.criarPdf(folhas, { fontes: [normal, negrito], logo, fmtNum }) -> Uint8Array
 *     folhas: as folhas de papel (o que papel().folha(pid, data) devolve)
 *     fontes: ArrayBuffer das fontes TTF (fonts/atkinson-pdf-400.ttf e -700.ttf)
 *     logo:   { jpeg: Uint8Array, largura, altura } ou nada
 */
(function () {
  /* ---------- Fonte TrueType: larguras e o mapa letra -> desenho ---------- */
  function lerFonte(buf) {
    const dv = new DataView(buf);
    const tabelas = {};
    for (let i = 0, n = dv.getUint16(4); i < n; i++) {
      const o = 12 + i * 16;
      const tag = String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
      tabelas[tag] = dv.getUint32(o + 8);
    }
    const head = tabelas.head, hhea = tabelas.hhea;
    const upm = dv.getUint16(head + 18);
    const em = (v) => Math.round((v * 1000) / upm);
    const nGlifos = dv.getUint16(tabelas.maxp + 4);
    const nLarguras = dv.getUint16(hhea + 34);
    const larguras = [];
    for (let g = 0; g < nGlifos; g++) larguras.push(em(dv.getUint16(tabelas.hmtx + 4 * Math.min(g, nLarguras - 1))));
    // cmap formato 4 (Windows Unicode)
    const cm = tabelas.cmap;
    let sub = -1;
    for (let i = 0, n = dv.getUint16(cm + 2); i < n; i++) {
      const plat = dv.getUint16(cm + 4 + i * 8), enc = dv.getUint16(cm + 6 + i * 8), off = cm + dv.getUint32(cm + 8 + i * 8);
      if (dv.getUint16(off) !== 4) continue;
      if (plat === 3 && enc === 1) { sub = off; break; }
      if (sub < 0) sub = off;
    }
    const mapa = new Map();
    const seg2 = dv.getUint16(sub + 6);
    const fins = sub + 14, inicios = fins + seg2 + 2, deltas = inicios + seg2, saltos = deltas + seg2;
    for (let s = 0; s < seg2 / 2; s++) {
      const fim = dv.getUint16(fins + 2 * s), ini = dv.getUint16(inicios + 2 * s), delta = dv.getInt16(deltas + 2 * s), salto = dv.getUint16(saltos + 2 * s);
      for (let c = ini; c <= fim && c !== 0xffff; c++) {
        let g = salto ? dv.getUint16(saltos + 2 * s + salto + 2 * (c - ini)) : c;
        if (salto && !g) continue;
        g = (g + delta) & 0xffff;
        if (g) mapa.set(c, g);
      }
    }
    const caixa = [dv.getInt16(head + 36), dv.getInt16(head + 38), dv.getInt16(head + 40), dv.getInt16(head + 42)].map(em);
    return { bytes: new Uint8Array(buf), larguras, mapa, caixa, sobe: em(dv.getInt16(hhea + 4)), desce: em(dv.getInt16(hhea + 6)), interrogacao: mapa.get(63) || 0 };
  }
  // letras que a fonte não tem viram a mais parecida
  const TROCAS = { '→': '->', '←': '<-', '≤': '<=', '≥': '>=', '≈': '~', ' ': ' ' };
  function glifos(f, texto) {
    const lista = [];
    for (const ch of String(texto)) {
      const t = TROCAS[ch];
      if (t) { for (const x of t) lista.push(f.mapa.get(x.codePointAt(0)) || f.interrogacao); continue; }
      lista.push(f.mapa.get(ch.codePointAt(0)) || f.interrogacao);
    }
    return lista;
  }
  const largura = (f, texto, tam) => glifos(f, texto).reduce((s, g) => s + (f.larguras[g] || 0), 0) * tam / 1000;
  const hex = (gs) => '<' + gs.map((g) => g.toString(16).padStart(4, '0')).join('') + '>';
  const n2 = (x) => (Math.round(x * 100) / 100).toString();

  /* ---------- Uma folha -> o desenho da página ---------- */
  const MM = 72 / 25.4;
  const A4 = [595.28, 841.89];
  const MARGEM = 10 * MM;
  const PX = 0.75; // 1 px do Excel em pontos
  const largCol = (w) => (w * 7 + 5) * PX;

  function textoDaCelula(cel, fmtNum) {
    const st = cel.st || {};
    const v = cel.v;
    if (typeof v !== 'number') return String(v);
    if (st.milhar) return v.toLocaleString('pt-BR', { minimumFractionDigits: st.dec || 0, maximumFractionDigits: st.dec || 0 });
    return fmtNum(st.dec ? v.toFixed(st.dec) : String(v));
  }
  /** Quebra o texto em linhas que cabem na largura (palavra inteira; palavra maior que a linha fica sozinha). */
  function quebrar(f, texto, tam, max) {
    const linhas = [];
    String(texto).split('\n').forEach((par) => {
      let atual = '';
      par.split(/ +/).forEach((p) => {
        const tenta = atual ? atual + ' ' + p : p;
        if (!atual || largura(f, tenta, tam) <= max) atual = tenta;
        else { linhas.push(atual); atual = p; }
      });
      linhas.push(atual);
    });
    return linhas;
  }

  function pagina(folha, fontes, logo, fmtNum) {
    const g = folha.grade;
    const [pw, ph] = folha.paisagem ? [A4[1], A4[0]] : A4;
    const cols = g.larguras.map(largCol);
    const altura = (r) => {
      if (g.alturas[r]) return g.alturas[r];
      let maior = 10;
      for (let c = 0; c < cols.length; c++) { const cel = g.cel[r + ',' + c]; if (cel && cel.v !== '') maior = Math.max(maior, (cel.st && cel.st.sz) || 10); }
      return Math.max(15, maior * 1.35);
    };
    const linhas = [];
    for (let r = 0; r < g.linhas; r++) linhas.push(altura(r));
    const largTotal = cols.reduce((a, b) => a + b, 0);
    const altTotal = linhas.reduce((a, b) => a + b, 0);
    // a folha inteira cabe na página: ocupa a largura toda, ou a altura toda se for comprida
    const k = Math.min((pw - 2 * MARGEM) / largTotal, (ph - 2 * MARGEM) / altTotal);
    const x0 = (pw - largTotal * k) / 2, y0 = ph - MARGEM;
    const xs = [x0]; cols.forEach((w, i) => xs.push(xs[i] + w * k));
    const ys = [y0]; linhas.forEach((h, i) => ys.push(ys[i] - h * k));

    const coberta = new Set(), mescla = {};
    g.mesclas.forEach(([r1, c1, r2, c2]) => {
      mescla[r1 + ',' + c1] = [r2, c2];
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) if (r !== r1 || c !== c1) coberta.add(r + ',' + c);
    });
    const traco = [`${n2(0.6 * Math.min(1, k * 1.2))} w 0 0 0 RG 0 0 0 rg`];
    const texto = [];
    for (let r = 0; r < g.linhas; r++) {
      for (let c = 0; c < cols.length; c++) {
        const chave = r + ',' + c;
        if (coberta.has(chave)) continue;
        const cel = g.cel[chave];
        if (!cel) continue;
        const st = cel.st || {};
        const [r2, c2] = mescla[chave] || [r, c];
        const x = xs[c], y = ys[r2 + 1], w = xs[c2 + 1] - xs[c], h = ys[r] - ys[r2 + 1];
        if (st.borda) traco.push(`${n2(x)} ${n2(y)} ${n2(w)} ${n2(h)} re S`);
        const t = textoDaCelula(cel, fmtNum);
        if (!t.trim()) continue;
        const f = st.b ? 1 : 0;
        const fonte = fontes[f];
        const folga = 2 * k + 1;
        let tam = ((st.sz || 10) * 0.95) * k;
        let partes;
        if (st.quebra) {
          partes = quebrar(fonte, t, tam, w - 2 * folga);
          // não coube na altura: diminui a letra até caber (no máximo pela metade)
          while (partes.length * tam * 1.15 > h - 1 && tam > (st.sz || 10) * 0.5 * k) { tam *= 0.92; partes = quebrar(fonte, t, tam, w - 2 * folga); }
        } else {
          partes = t.split('\n');
          const maior = Math.max(...partes.map((p) => largura(fonte, p, tam)));
          if (maior > w - 2 * folga) tam = Math.max(tam * 0.55, tam * (w - 2 * folga) / maior);
        }
        const entre = tam * 1.15;
        const blocoAlt = partes.length * entre;
        const va = st.va || 'c';
        let topo = va === 't' ? ys[r] - folga : va === 'b' ? y + folga + blocoAlt : y + h / 2 + blocoAlt / 2;
        texto.push(`q ${n2(x)} ${n2(y)} ${n2(w)} ${n2(h)} re W n`);
        partes.forEach((p, i) => {
          const lw = largura(fonte, p, tam);
          const al = st.al || 'l';
          const tx = al === 'c' ? x + (w - lw) / 2 : al === 'r' ? x + w - folga - lw : x + folga;
          const base = topo - i * entre - tam * 0.82;
          texto.push(`BT /F${f + 1} ${n2(tam)} Tf ${n2(tx)} ${n2(base)} Td ${hex(glifos(fonte, p))} Tj ET`);
        });
        texto.push('Q');
      }
    }
    // logo no canto, como no Excel
    let comLogo = false;
    if (logo && folha.imagem) {
      const im = folha.imagem;
      const alt = (im.alturaPx || 60) * PX * k;
      const larg = alt * logo.largura / logo.altura;
      const lx = xs[im.coluna] + (im.dx || 0) * PX * k, ly = ys[im.linha] - (im.dy || 0) * PX * k - alt;
      texto.push(`q ${n2(larg)} 0 0 ${n2(alt)} ${n2(lx)} ${n2(ly)} cm /Im1 Do Q`);
      comLogo = true;
    }
    return { largura: pw, altura: ph, conteudo: traco.concat(texto).join('\n'), comLogo };
  }

  /* ---------- Montar o arquivo PDF ---------- */
  function criarPdf(folhas, opcoes) {
    const fmtNum = opcoes.fmtNum || String;
    const fontes = opcoes.fontes.map(lerFonte);
    const logo = opcoes.logo && opcoes.logo.jpeg ? opcoes.logo : null;
    const pedacos = [];
    let tamanho = 0;
    const enc = new TextEncoder();
    const por = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; pedacos.push(b); tamanho += b.length; };
    const posicoes = [];
    let proximo = 1;
    const reservar = () => proximo++;
    const objeto = (n, corpo, fluxo) => {
      posicoes[n] = tamanho;
      if (fluxo) { por(`${n} 0 obj\n${corpo}\nstream\n`); por(fluxo); por('\nendstream\nendobj\n'); }
      else por(`${n} 0 obj\n${corpo}\nendobj\n`);
    };
    por('%PDF-1.4\n'); por(new Uint8Array([37, 226, 227, 207, 211, 10])); // cabeçalho (a segunda linha avisa que o arquivo tem partes binárias)
    const catalogo = reservar(), paginas = reservar();
    // fontes
    const refFontes = fontes.map((f, i) => {
      const nome = i ? 'AtkinsonHyperlegible-Bold' : 'AtkinsonHyperlegible-Regular';
      const arquivo = reservar(), descritor = reservar(), cid = reservar(), unicode = reservar(), tipo0 = reservar();
      objeto(arquivo, `<< /Length ${f.bytes.length} /Length1 ${f.bytes.length} >>`, f.bytes);
      objeto(descritor, `<< /Type /FontDescriptor /FontName /${nome} /Flags 32 /FontBBox [${f.caixa.join(' ')}] /ItalicAngle 0 /Ascent ${f.sobe} /Descent ${f.desce} /CapHeight ${f.sobe} /StemV ${i ? 120 : 80} /FontFile2 ${arquivo} 0 R >>`);
      objeto(cid, `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${nome} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descritor} 0 R /DW 500 /W [0 [${f.larguras.join(' ')}]] /CIDToGIDMap /Identity >>`);
      // para copiar e procurar texto no PDF
      const pares = [...f.mapa.entries()].filter(([u]) => u < 0x10000);
      const blocos = [];
      for (let i2 = 0; i2 < pares.length; i2 += 100) {
        const parte = pares.slice(i2, i2 + 100);
        blocos.push(`${parte.length} beginbfchar\n${parte.map(([u, g]) => `<${g.toString(16).padStart(4, '0')}> <${u.toString(16).padStart(4, '0')}>`).join('\n')}\nendbfchar`);
      }
      const cmap = `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n${blocos.join('\n')}\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend`;
      objeto(unicode, `<< /Length ${enc.encode(cmap).length} >>`, enc.encode(cmap));
      objeto(tipo0, `<< /Type /Font /Subtype /Type0 /BaseFont /${nome} /Encoding /Identity-H /DescendantFonts [${cid} 0 R] /ToUnicode ${unicode} 0 R >>`);
      return tipo0;
    });
    let refLogo = 0;
    if (logo) {
      refLogo = reservar();
      objeto(refLogo, `<< /Type /XObject /Subtype /Image /Width ${logo.largura} /Height ${logo.altura} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.jpeg.length} >>`, logo.jpeg);
    }
    const refsPaginas = [];
    folhas.forEach((folha) => {
      const p = pagina(folha, fontes, logo, fmtNum);
      const ref = reservar(), cont = reservar();
      const corpo = enc.encode(p.conteudo);
      objeto(cont, `<< /Length ${corpo.length} >>`, corpo);
      objeto(ref, `<< /Type /Page /Parent ${paginas} 0 R /MediaBox [0 0 ${n2(p.largura)} ${n2(p.altura)}] /Resources << /Font << /F1 ${refFontes[0]} 0 R /F2 ${refFontes[1]} 0 R >>${p.comLogo ? ` /XObject << /Im1 ${refLogo} 0 R >>` : ''} >> /Contents ${cont} 0 R >>`);
      refsPaginas.push(ref);
    });
    objeto(paginas, `<< /Type /Pages /Kids [${refsPaginas.map((r) => r + ' 0 R').join(' ')}] /Count ${refsPaginas.length} >>`);
    const info = reservar();
    const titulo = (opcoes.titulo || 'Pranchetas').replace(/[()\\]/g, '');
    objeto(info, `<< /Title ${hexTexto(titulo)} /Producer (Pranchetas Digitais) /CreationDate (D:${dataPdf(new Date())}) >>`);
    objeto(catalogo, `<< /Type /Catalog /Pages ${paginas} 0 R >>`);
    const xref = tamanho;
    let tabela = `xref\n0 ${proximo}\n0000000000 65535 f \n`;
    for (let i = 1; i < proximo; i++) tabela += `${String(posicoes[i]).padStart(10, '0')} 00000 n \n`;
    por(tabela + `trailer\n<< /Size ${proximo} /Root ${catalogo} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    const saida = new Uint8Array(tamanho);
    let o = 0;
    pedacos.forEach((b) => { saida.set(b, o); o += b.length; });
    return saida;
  }
  // texto do PDF em UTF-16 (título com acento)
  function hexTexto(s) {
    let h = 'FEFF';
    for (let i = 0; i < s.length; i++) h += s.charCodeAt(i).toString(16).padStart(4, '0');
    return '<' + h + '>';
  }
  const dataPdf = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}00`;

  window.criarPdf = criarPdf;
  window.larguraNoPdf = (buf, texto, tam) => largura(lerFonte(buf), texto, tam); // para os testes
}());
