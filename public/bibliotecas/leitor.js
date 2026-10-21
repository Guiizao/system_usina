/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * Leitor de folhas de papel, 100% dentro do aparelho (sem internet).
 *
 * 1. Acha a tabela na foto pelos cruzamentos das linhas impressas (aguenta foto torta e em perspectiva).
 * 2. Endireita cada célula usando o molde da folha (proporção das colunas medida nas folhas reais).
 * 3. Uma rede neural pequena (treinada com letras de mão e fontes cursivas) dá a probabilidade de cada letra.
 * 4. A coluna diz o que é possível (hora, pH, número, MASSA/FINI, nome do operador) e o leitor escolhe
 *    o valor possível mais provável, com uma confiança. Valor com pouca confiança fica marcado para conferir.
 *
 * Usa OpenCV.js (lib/opencv.js) para a imagem e para rodar a rede (lib/leitor.onnx).
 */
(function () {
  const ALFABETO = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ:,.-/';
  const IDX = {}; [...ALFABETO].forEach((c, i) => { IDX[c] = i + 1; });
  const H = 32, W = 160;
  const NEG = -1e9;

  // Molde: onde ficam as colunas (0 = borda esquerda da tabela, 1 = direita) e quantas linhas tem
  const MOLDES = {
    anexo1: { linhas: 25, colunas: [0, 0.049, 0.148, 0.251, 0.315, 0.381, 0.445, 0.517, 0.597, 0.675, 0.754, 0.876, 1],
      nomes: ['n', 'inicio', 'fim', 'phf', 'cal', 'brix', 'phf2', 'anti', 'enzi', 'bhx', 'produto', 'responsavel'] },
    anexo2: { linhas: 25, colunas: [0, 0.075, 0.205, 0.34, 0.459, 0.58, 0.70, 0.824, 1],
      nomes: ['n', 'horario', 'sac', 'phf', 'bhx', 'enz', 'anti', 'responsavel'] },
    pop03: { linhas: 24, colunas: [0, 0.227, 0.315, 0.403, 0.591, 0.744, 0.858, 1],
      nomes: ['fornecedor', 'nf', 'lote', 'validade', 'qtd', 'hora', 'operador'] },
  };

  /* ---------------- carregar OpenCV e a rede ---------------- */
  let cv = null, rede = null;
  async function carregar(aoProgresso) {
    if (cv && rede) return;
    if (!cv) {
      aoProgresso && aoProgresso('Preparando o leitor');
      await new Promise((ok, erro) => {
        if (window.cv && window.cv.Mat) return ok();
        const s = document.createElement('script');
        s.src = 'lib/opencv.js'; s.onload = ok; s.onerror = () => erro(new Error('Não achei o leitor (lib/opencv.js)'));
        document.head.appendChild(s);
      });
      let c = window.cv;
      if (c instanceof Promise) c = await c;
      else if (!c.Mat) await new Promise((ok) => { c.onRuntimeInitialized = ok; });
      cv = c;
    }
    if (!rede) {
      aoProgresso && aoProgresso('Carregando a inteligência de letra de mão');
      const bytes = new Uint8Array(await (await fetch('lib/leitor.onnx')).arrayBuffer());
      // o OpenCV.js lê o modelo de um arquivo do seu disco virtual
      try { cv.FS_unlink('/leitor.onnx'); } catch (e) { /* ainda não existia */ }
      cv.FS_createDataFile('/', 'leitor.onnx', bytes, true, false, false);
      rede = cv.readNet('leitor.onnx');
    }
  }

  /* ---------------- utilidades ---------------- */
  const liberar = (...m) => m.forEach((x) => { try { x && x.delete(); } catch (e) { /* já liberado */ } });
  function retaMinQuad(xs, ys) {
    const n = xs.length; let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; sxx += xs[i] * xs[i]; sxy += xs[i] * ys[i]; }
    const den = n * sxx - sx * sx;
    if (Math.abs(den) < 1e-9) return [0, sy / n];
    const a = (n * sxy - sx * sy) / den; return [a, (sy - a * sx) / n];
  }
  const mediana = (v) => { const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const percentil = (v, p) => { const s = Float32Array.from(v).sort(); return s[Math.min(s.length - 1, Math.floor((s.length - 1) * p / 100))]; };

  async function imagemParaCinza(arquivo, lado = 2200) {
    const bmp = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
    const esc = Math.min(1, lado / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * esc); c.height = Math.round(bmp.height * esc);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    if (bmp.close) bmp.close();
    const rgba = cv.imread(c); const g = new cv.Mat();
    cv.cvtColor(rgba, g, cv.COLOR_RGBA2GRAY); liberar(rgba);
    return g;
  }

  /* ---------------- 1. linhas e cruzamentos ---------------- */
  function mascaras(cinza) {
    const fundo = new cv.Mat(), norm = new cv.Mat(), tinta = new cv.Mat(), hor = new cv.Mat(), ver = new cv.Mat();
    cv.medianBlur(cinza, fundo, 51);
    cv.divide(cinza, fundo, norm, 255);
    cv.adaptiveThreshold(norm, tinta, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 25, 10);
    const k = Math.max(cinza.rows, cinza.cols);
    const kv = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(1, Math.floor(k / 70)));
    const kh = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(Math.floor(k / 70), 1));
    cv.morphologyEx(tinta, ver, cv.MORPH_OPEN, kv);
    cv.morphologyEx(tinta, hor, cv.MORPH_OPEN, kh);
    liberar(fundo, tinta, kv, kh);
    return { norm, hor, ver, k };
  }
  function angulo(hor, k) {
    const l = new cv.Mat();
    cv.HoughLinesP(hor, l, 1, Math.PI / 1440, 80, Math.floor(k / 20), Math.floor(k / 80));
    const ang = [];
    for (let i = 0; i < l.rows; i++) {
      const [x1, y1, x2, y2] = [l.data32S[i * 4], l.data32S[i * 4 + 1], l.data32S[i * 4 + 2], l.data32S[i * 4 + 3]];
      if (Math.abs(y2 - y1) > Math.abs(x2 - x1) * 0.2) continue;
      ang.push([Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI, Math.hypot(x2 - x1, y2 - y1)]);
    }
    liberar(l);
    if (!ang.length) return 0;
    ang.sort((a, b) => a[0] - b[0]);
    const total = ang.reduce((s, a) => s + a[1], 0); let acc = 0;
    for (const [a, p] of ang) { acc += p; if (acc >= total / 2) return a; }
    return 0;
  }
  function girar(img, graus, borda) {
    const M = cv.getRotationMatrix2D(new cv.Point(img.cols / 2, img.rows / 2), graus, 1);
    const d = new cv.Mat();
    cv.warpAffine(img, d, M, new cv.Size(img.cols, img.rows), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(borda));
    liberar(M); return d;
  }
  function cruzamentos(hor, ver) {
    const d = cv.Mat.ones(7, 7, cv.CV_8U), a = new cv.Mat(), b = new cv.Mat(), inter = new cv.Mat();
    cv.dilate(hor, a, d); cv.dilate(ver, b, d); cv.bitwise_and(a, b, inter);
    const lab = new cv.Mat(), st = new cv.Mat(), cen = new cv.Mat();
    const n = cv.connectedComponentsWithStats(inter, lab, st, cen);
    const pts = [];
    for (let i = 1; i < n; i++) if (st.data32S[i * 5 + 4] >= 6) pts.push([cen.data64F[i * 2], cen.data64F[i * 2 + 1]]);
    liberar(d, a, b, inter, lab, st, cen);
    return pts;
  }

  /* ---------------- 2. fileiras e colunas da tabela ---------------- */
  function fileiras(pts, tol) {
    const o = [...pts].sort((p, q) => p[1] - q[1]);
    const grupos = [];
    for (const p of o) {
      const g = grupos[grupos.length - 1];
      if (g && Math.abs(p[1] - g.reduce((s, q) => s + q[1], 0) / g.length) < tol) g.push(p); else grupos.push([p]);
    }
    return grupos.map((g) => g.sort((p, q) => p[0] - q[0]));
  }
  function tabela(pts, nLinhas) {
    if (pts.length < 10) return null;
    const fil = fileiras(pts, 8).filter((f) => f.length >= 3);
    if (fil.length < 3) return null;
    const ys = fil.map((f) => f.reduce((s, p) => s + p[1], 0) / f.length);
    const cont = fil.map((f) => f.length);
    const cap = Math.max(3, percentil(cont, 75));
    let melhor = null;
    for (let i = 0; i < fil.length; i++) {
      for (let j = i + 1; j < Math.min(i + 3, fil.length); j++) {
        let s = ys[j] - ys[i];
        if (s < 12) continue;
        const usados = [i, j], posic = [ys[i], ys[j]];
        let total = Math.min(cont[i], cap) + Math.min(cont[j], cap), faltas = 0, parou = false;
        for (let m = 2; m <= nLinhas; m++) {
          const alvo = posic[posic.length - 1] + s;
          let c = 0, dmin = Infinity;
          ys.forEach((y, k) => { const d = Math.abs(y - alvo); if (d < dmin) { dmin = d; c = k; } });
          if (dmin < s * 0.3 && !usados.includes(c)) {
            s = 0.7 * s + 0.3 * (ys[c] - posic[posic.length - 1]); usados.push(c); posic.push(ys[c]); total += Math.min(cont[c], cap);
          } else {
            usados.push(null); posic.push(alvo); faltas++;
            if (faltas > nLinhas * 0.25) { parou = true; break; }
          }
        }
        if (parou || usados.length < nLinhas + 1) continue;
        const passos = posic.slice(1).map((y, k) => y - posic[k]); const med = mediana(passos);
        const irregular = passos.reduce((sum, p) => sum + Math.abs(p - med), 0) / med;
        const nota = total - faltas * cap * 1.5 - irregular * cap;
        if (!melhor || nota > melhor.nota) melhor = { nota, usados, posic };
      }
    }
    if (!melhor) return null;
    return { fils: melhor.usados.map((u) => (u === null ? null : fil[u])), y0: melhor.posic[0], s: (melhor.posic[nLinhas] - melhor.posic[0]) / nLinhas };
  }
  function colunas(fils, s) {
    const cadeias = [];
    for (const fl of fils) {
      if (!fl) continue;
      for (const p of fl) {
        let melhor = null;
        for (const c of cadeias) {
          const ult = c[c.length - 1];
          if (Math.abs(p[1] - ult[1]) < s * 0.5) continue;
          const d = Math.abs(p[0] - ult[0]);
          if (d < s * 0.6 && (!melhor || d < melhor[0])) melhor = [d, c];
        }
        if (melhor) melhor[1].push(p); else cadeias.push([p]);
      }
    }
    const vivas = fils.filter(Boolean).length;
    return cadeias.filter((c) => c.length >= Math.max(3, vivas * 0.3)).map((c) => {
      const [a, b] = c.length > 2 ? retaMinQuad(c.map((p) => p[1]), c.map((p) => p[0])) : [0, c.reduce((s2, p) => s2 + p[0], 0) / c.length];
      return { a, b, n: c.length };
    });
  }
  function casarColunas(xs, molde, tol = 0.022) {
    let melhor = null;
    for (let i = 0; i < xs.length; i++) {
      for (let j = xs.length - 1; j > i; j--) {
        const L = xs[i], R = xs[j];
        if (R - L < 50) continue;
        let achou = 0; const pos = [];
        for (const r of molde) {
          const alvo = L + r * (R - L);
          let k = 0, dmin = Infinity;
          xs.forEach((x, q) => { const d = Math.abs(x - alvo); if (d < dmin) { dmin = d; k = q; } });
          if (dmin < tol * (R - L)) { achou++; pos.push(xs[k]); } else pos.push(alvo);
        }
        if (!melhor || achou > melhor.achou) melhor = { achou, pos };
      }
    }
    return melhor;
  }

  /** Acha a grade de pontos [linha][coluna] da tabela na foto. */
  function acharGrade(cinza, molde) {
    const { norm, hor, ver, k } = mascaras(cinza);
    const a = angulo(hor, k);
    const hor2 = girar(hor, a, 0), ver2 = girar(ver, a, 0), norm2 = girar(norm, a, 255);
    liberar(norm, hor, ver);
    const pts = cruzamentos(hor2, ver2);
    liberar(hor2, ver2);
    const t = tabela(pts, molde.linhas);
    if (!t) { liberar(norm2); return null; }
    const cols = colunas(t.fils, t.s);
    // retas das fileiras (y = a x + b); as que faltam são interpoladas
    const rf = t.fils.map((fl) => (fl && fl.length >= 3 ? retaMinQuad(fl.map((p) => p[0]), fl.map((p) => p[1])) : null));
    const vivos = rf.map((r, i) => (r ? i : -1)).filter((i) => i >= 0);
    if (vivos.length < 2) { liberar(norm2); return null; }
    for (let i = 0; i < rf.length; i++) {
      if (rf[i]) continue;
      const ant = vivos.filter((j) => j < i).pop(); const prox = vivos.find((j) => j > i);
      if (ant !== undefined && prox !== undefined) { const u = (i - ant) / (prox - ant); rf[i] = [rf[ant][0] * (1 - u) + rf[prox][0] * u, rf[ant][1] * (1 - u) + rf[prox][1] * u]; }
      else { const base = ant !== undefined ? ant : prox; rf[i] = [rf[base][0], rf[base][1] + (i - base) * t.s]; }
    }
    const ymeio = t.y0 + t.s * molde.linhas / 2;
    const ordem = cols.sort((p, q) => (p.a * ymeio + p.b) - (q.a * ymeio + q.b));
    const xs = ordem.map((c) => c.a * ymeio + c.b);
    const casado = casarColunas(xs, molde.colunas);
    if (!casado || casado.achou < molde.colunas.length * 0.6) { liberar(norm2); return null; }
    let rc = casado.pos.map((alvo) => { let kk = -1, dmin = Infinity; xs.forEach((x, q) => { const d = Math.abs(x - alvo); if (d < dmin) { dmin = d; kk = q; } }); return dmin < 2 ? [ordem[kk].a, ordem[kk].b] : null; });
    const vivasC = rc.map((r, i) => (r ? i : -1)).filter((i) => i >= 0);
    rc = rc.map((r, i) => {
      if (r) return r;
      let ant = vivasC.filter((j) => j < i).pop(); let prox = vivasC.find((j) => j > i);
      if (ant === undefined) { ant = prox; prox = vivasC.find((j) => j > ant); }
      if (prox === undefined) { prox = ant; ant = vivasC.filter((j) => j < prox).pop(); }
      const u = (molde.colunas[i] - molde.colunas[ant]) / (molde.colunas[prox] - molde.colunas[ant]);
      return [rc[ant][0] * (1 - u) + rc[prox][0] * u, rc[ant][1] * (1 - u) + rc[prox][1] * u];
    });
    const cruza = (f, c) => { const y = (f[0] * c[1] + f[1]) / (1 - f[0] * c[0]); return [c[0] * y + c[1], y]; };
    const P = rf.map((f) => rc.map((c) => cruza(f, c)));
    return { img: norm2, P, angulo: a, achou: casado.achou };
  }

  /* ---------------- 3. células ---------------- */
  function recortarCelula(img, P, m, c, alt = 64) {
    const q = [P[m][c], P[m][c + 1], P[m + 1][c + 1], P[m + 1][c]];
    const w = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]);
    const h = Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1]);
    const Wc = Math.max(8, Math.round(alt * w / Math.max(h, 1)));
    const src = cv.matFromArray(4, 1, cv.CV_32FC2, q.flat());
    const dst = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, Wc, 0, Wc, alt, 0, alt]);
    const M = cv.getPerspectiveTransform(src, dst);
    const out = new cv.Mat();
    cv.warpPerspective(img, out, M, new cv.Size(Wc, alt), cv.INTER_AREA, cv.BORDER_CONSTANT, new cv.Scalar(255));
    liberar(src, dst, M);
    return out;
  }
  /** apaga as bordas impressas que sobram na célula */
  function limparCelula(cel) {
    const h = cel.rows, w = cel.cols;
    const gf = new cv.Mat(); cel.convertTo(gf, cv.CV_32F);
    const fundo = new cv.Mat(); cv.GaussianBlur(gf, fundo, new cv.Size(0, 0), 10);
    const tinta = new cv.Mat(h, w, cv.CV_8U);
    for (let i = 0; i < h * w; i++) tinta.data[i] = (1 - Math.min(1, gf.data32F[i] / (fundo.data32F[i] + 1))) > 0.25 ? 255 : 0;
    const kh = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(Math.max(10, Math.floor(w * 0.45)), 1));
    const kv = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(1, Math.floor(h * 0.7)));
    const hor = new cv.Mat(), ver = new cv.Mat(), lin = new cv.Mat();
    cv.morphologyEx(tinta, hor, cv.MORPH_OPEN, kh); cv.morphologyEx(tinta, ver, cv.MORPH_OPEN, kv);
    cv.bitwise_or(hor, ver, lin);
    const k3 = cv.Mat.ones(3, 3, cv.CV_8U); cv.dilate(lin, lin, k3);
    const m = Math.max(4, Math.floor(h * 0.18)), mv = Math.max(4, Math.floor(h * 0.15));
    const saida = cel.clone();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (lin.data[i] && (y < m || y >= h - m || x < mv || x >= w - mv)) saida.data[i] = 255;
    }
    // risco que atravessa a célula de borda a borda (ex.: linha vertical riscando a coluna inteira = sem valor).
    // Um "1" escrito não encosta nas duas bordas, então não é apagado.
    const lab = new cv.Mat(), st = new cv.Mat(), cen = new cv.Mat();
    const nComp = cv.connectedComponentsWithStats(ver, lab, st, cen);
    let risco = false;
    for (let k = 1; k < nComp; k++) {
      const topo = st.data32S[k * 5 + 1], alt = st.data32S[k * 5 + 3];
      if (alt < h * 0.9 || topo > h * 0.06) continue;
      risco = true;
      for (let i = 0; i < h * w; i++) if (lab.data32S[i] === k) {
        const y = Math.floor(i / w), x = i % w;
        for (let dx = -2; dx <= 2; dx++) if (x + dx >= 0 && x + dx < w) saida.data[y * w + x + dx] = 255;
      }
    }
    liberar(lab, st, cen);
    const corte = saida.roi(new cv.Rect(2, 2, Math.max(1, w - 4), Math.max(1, h - 4))).clone();
    liberar(gf, fundo, tinta, kh, kv, hor, ver, lin, k3, saida);
    corte.risco = risco;
    return corte;
  }
  /** mesma preparação do treino: tinta clara em fundo escuro, 32 x 160 */
  function preparar(cinza) {
    const h = cinza.rows, w = cinza.cols;
    const gf = new cv.Mat(); cinza.convertTo(gf, cv.CV_32F);
    const fundo = new cv.Mat(); cv.GaussianBlur(gf, fundo, new cv.Size(0, 0), 8);
    const t = new cv.Mat(h, w, cv.CV_32F);
    let escuros = 0; // tinta de caneta de verdade (sujeira e ruído são mais claros)
    for (let i = 0; i < h * w; i++) {
      const n = Math.min(1.2, Math.max(0, gf.data32F[i] / (fundo.data32F[i] + 1)));
      t.data32F[i] = Math.min(1, Math.max(0, 1 - n));
      if (1 - Math.min(1, n) > 0.3) escuros++;
    }
    const mx = Math.max(percentil(t.data32F, 99.5), 0.08);
    let soma = 0;
    for (let i = 0; i < h * w; i++) { let v = Math.min(1, t.data32F[i] / mx); if (v < 0.18) v = 0; t.data32F[i] = v; soma += v; }
    const nw = Math.max(4, Math.min(W, Math.round(w * H / h)));
    const r = new cv.Mat(); cv.resize(t, r, new cv.Size(nw, H), 0, 0, cv.INTER_AREA);
    const out = new Float32Array(H * W);
    for (let y = 0; y < H; y++) for (let x = 0; x < nw; x++) out[y * W + x] = r.data32F[y * nw + x];
    liberar(gf, fundo, t, r);
    return { entrada: out, tinta: escuros / (h * w) };
  }
  function paraImagemUrl(cel) {
    const c = document.createElement('canvas'); cv.imshow(c, cel); return c.toDataURL('image/jpeg', 0.8);
  }

  /* ---------------- 4. rede e leitura restrita ---------------- */
  function rodarRede(entrada) {
    const m = cv.matFromArray(H, W, cv.CV_32F, entrada);
    const blob = cv.blobFromImage(m, 1, new cv.Size(W, H), new cv.Scalar(0), false, false);
    rede.setInput(blob);
    const out = rede.forward();
    const C = ALFABETO.length + 1; const T = out.data32F.length / C;
    const lp = new Float32Array(T * C);
    for (let t = 0; t < T; t++) {
      let mx = -Infinity;
      for (let c = 0; c < C; c++) mx = Math.max(mx, out.data32F[c * T + t]);
      let s = 0;
      for (let c = 0; c < C; c++) s += Math.exp(out.data32F[c * T + t] - mx);
      const lse = mx + Math.log(s);
      for (let c = 0; c < C; c++) lp[t * C + c] = out.data32F[c * T + t] - lse;
    }
    liberar(m, blob, out);
    return { lp, T, C };
  }
  const logsoma = (a, b) => (a === NEG ? b : b === NEG ? a : Math.max(a, b) + Math.log1p(Math.exp(-Math.abs(a - b))));
  /** log p(texto) pelo forward do CTC */
  function ctc(r, texto) {
    const { lp, T, C } = r; const L = texto.length; const S = 2 * L + 1;
    const ext = new Int32Array(S); for (let i = 0; i < L; i++) ext[2 * i + 1] = IDX[texto[i]] || 0;
    let a = new Float64Array(S).fill(NEG), b = new Float64Array(S);
    a[0] = lp[0]; if (L) a[1] = lp[ext[1]];
    for (let t = 1; t < T; t++) {
      for (let s = 0; s < S; s++) {
        let v = a[s];
        if (s > 0) v = logsoma(v, a[s - 1]);
        if (s > 1 && ext[s] !== 0 && ext[s] !== ext[s - 2]) v = logsoma(v, a[s - 2]);
        b[s] = v === NEG ? NEG : v + lp[t * C + ext[s]];
      }
      [a, b] = [b, a];
    }
    return S === 1 ? a[0] : logsoma(a[S - 1], a[S - 2]);
  }
  const cacheCand = {};
  /** formas de escrever cada valor possível da coluna */
  function candidatos(spec) {
    const chave = JSON.stringify(spec);
    if (cacheCand[chave]) return cacheCand[chave];
    const c = [];
    if (spec.tipo === 'hora') {
      for (let h = 0; h < 24; h++) for (let m = 0; m < 60; m++) {
        const v = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, mm = String(m).padStart(2, '0'), hh = String(h).padStart(2, '0');
        new Set([`${h}:${mm}`, `${hh}:${mm}`, `${h}${mm}`, `${hh}${mm}`, `${h}.${mm}`]).forEach((s) => c.push([s, v]));
      }
      c.push(['', '']);
    } else if (spec.tipo === 'decimal') {
      for (let i = Math.round(spec.min * 10); i <= Math.round(spec.max * 10); i++) {
        const a = Math.floor(i / 10), b = i % 10; const v = `${a}.${b}`;
        new Set([`${a},${b}`, `${a}.${b}`, `${a}${b}`]).forEach((s) => c.push([s, v]));
      }
      c.push(['-', '']); c.push(['', '']);
    } else if (spec.tipo === 'quantidade') {
      // quantidade anotada: 160 é cento e sessenta; 188,8 tem a vírgula escrita
      for (let n = 0; n <= (spec.max || 999); n++) c.push([String(n), String(n)]);
      for (let n = 0; n <= (spec.max || 999); n++) for (let d = 0; d <= 9; d++) { c.push([`${n},${d}`, `${n}.${d}`]); c.push([`${n}.${d}`, `${n}.${d}`]); }
      c.push(['-', '']); c.push(['', '']);
    } else if (spec.tipo === 'inteiro') {
      for (let n = spec.min; n <= spec.max; n++) { c.push([String(n), String(n)]); if (n < 10) c.push([`0${n}`, String(n)]); }
      c.push(['-', '']); c.push(['', '']);
    } else if (spec.tipo === 'opcoes') {
      spec.opcoes.forEach((o) => c.push([String(o).toUpperCase().normalize('NFD').replace(/[^A-Z0-9 ]/g, '').replace(/ /g, ''), o]));
      c.push(['-', '']); c.push(['', '']);
    }
    cacheCand[chave] = c;
    return c;
  }
  /** leitura "livre" (sem lista de valores): texto como fornecedor, ou só números numa quantidade.
      A confiança é a do caractere mais duvidoso: um só número incerto já pede para conferir. */
  function livre(r, soNumeros) {
    const { lp, T, C } = r;
    const permitido = (k) => k === 0 || !soNumeros || /[0-9,.]/.test(ALFABETO[k - 1]);
    let s = '', ant = 0, pior = 1, atual = 0;
    for (let t = 0; t < T; t++) {
      let k = 0, mx = -Infinity, soma = 0;
      for (let c = 0; c < C; c++) { if (!permitido(c)) continue; const v = Math.exp(lp[t * C + c]); soma += v; if (v > mx) { mx = v; k = c; } }
      const p = mx / soma; // probabilidade entre os caracteres permitidos
      if (k !== ant) {
        if (ant !== 0) pior = Math.min(pior, atual);
        if (k !== 0) { s += ALFABETO[k - 1]; atual = p; }
      } else if (k !== 0) atual = Math.max(atual, p);
      ant = k;
    }
    if (ant !== 0) pior = Math.min(pior, atual);
    // quanto dos quadros "sumiu" para caracteres proibidos: se muito, a leitura é duvidosa
    return { valor: s, confianca: s ? pior : 0 };
  }
  /**
   * Lê uma célula. spec: { tipo: 'hora'|'decimal'|'inteiro'|'opcoes'|'texto', min, max, opcoes, padrao }
   * prior(valor) opcional: número >= 0 que aumenta ou diminui a chance de um valor (ex.: hora em ordem)
   */
  function lerCelula(r, spec, prior) {
    if (spec.tipo === 'texto') return livre(r, false);
    if (spec.tipo === 'quantidade') {
      // número com a unidade escrita do lado (1 LA, 20 CN, 5 KG): pega o número
      const lv = livre(r, false);
      const m = lv.valor.match(/^(\d{1,3})(?:[,.](\d))?[,.]?([A-Z]{1,3})$/);
      if (m) return { valor: m[2] ? `${Number(m[1])}.${m[2]}` : String(Number(m[1])), confianca: lv.confianca, unidadeEscrita: m[3], alternativas: [] };
    }
    const cands = candidatos(spec);
    const por = new Map();
    for (const [s, v] of cands) por.set(v, logsoma(por.has(v) ? por.get(v) : NEG, ctc(r, s)));
    let total = NEG; const lista = [];
    // "outra coisa": o melhor caminho livre da rede, se ele não for um valor da lista.
    // Assim, quando está escrito algo fora do esperado, a confiança do melhor valor da lista cai.
    const { lp, T, C } = r; let caminho = 0, txt = '', ant = 0;
    for (let t = 0; t < T; t++) { let k = 0, mx = -Infinity; for (let c = 0; c < C; c++) if (lp[t * C + c] > mx) { mx = lp[t * C + c]; k = c; } caminho += mx; if (k !== ant && k !== 0) txt += ALFABETO[k - 1]; ant = k; }
    // peso: em número, "outra coisa" conta bastante; em nome/palavra da lista conta pouco (assinatura nunca é legível letra a letra)
    const penalidade = spec.tipo === 'opcoes' ? Math.log(400) : Math.log(2);
    if (!cands.some(([s2]) => s2 === txt)) total = logsoma(total, caminho - penalidade);
    for (const [v, x] of por) {
      let y = x;
      if (spec.padrao !== undefined && String(v) === String(spec.padrao)) y += Math.log(6);
      if (prior) { const f = prior(v); y += f > 0 ? Math.log(f) : NEG; }
      lista.push([v, y]); total = logsoma(total, y);
    }
    lista.sort((p, q) => q[1] - p[1]);
    return { valor: lista[0][0], confianca: Math.exp(lista[0][1] - total), alternativas: lista.slice(1, 4).map(([v, y]) => ({ valor: v, confianca: Math.exp(y - total) })) };
  }

  /**
   * Lê a foto inteira.
   * colunas: { nomeDaColunaNoMolde: spec } — só as colunas pedidas são lidas
   * devolve { linhas: [ { m, celulas: { nome: { vazia, imagem, r } } } ] }
   */
  async function lerFoto(arquivo, nomeMolde, colunasPedidas, aoProgresso) {
    await carregar(aoProgresso);
    const molde = MOLDES[nomeMolde];
    aoProgresso && aoProgresso('Achando a tabela na foto');
    await new Promise((ok) => setTimeout(ok, 30));
    const cinza = await imagemParaCinza(arquivo);
    // foto tirada de lado ou de cabeça para baixo: testa os giros e fica com o que encaixa melhor no molde
    const deitada = cinza.cols > cinza.rows;
    const giros = deitada ? [cv.ROTATE_90_CLOCKWISE, cv.ROTATE_90_COUNTERCLOCKWISE, null, cv.ROTATE_180] : [null, cv.ROTATE_180, cv.ROTATE_90_CLOCKWISE, cv.ROTATE_90_COUNTERCLOCKWISE];
    let g = null;
    for (const giro of giros) {
      let img = cinza;
      if (giro !== null) { img = new cv.Mat(); cv.rotate(cinza, img, giro); }
      const t = acharGrade(img, molde);
      if (giro !== null) liberar(img);
      if (t && (!g || t.achou > g.achou)) { if (g) liberar(g.img); g = t; } else if (t) liberar(t.img);
      if (g && g.achou === molde.colunas.length) break;
      await new Promise((ok) => setTimeout(ok, 0));
    }
    liberar(cinza);
    if (!g) throw new Error('Não achei a tabela na foto. Tire de novo, com a folha inteira, reta e bem iluminada.');
    const nomes = Object.keys(colunasPedidas);
    const linhas = [];
    const total = molde.linhas * nomes.length; let feitas = 0;
    for (let m = 0; m < molde.linhas; m++) {
      const celulas = {};
      for (const nome of nomes) {
        const c = molde.nomes.indexOf(nome);
        const bruta = recortarCelula(g.img, g.P, m, c);
        const limpa = limparCelula(bruta);
        const prep = preparar(limpa);
        const vazia = prep.tinta < 0.012; // quase sem tinta: nem passa na rede (e a rede ainda pode dizer "vazio")
        celulas[nome] = { vazia, risco: !!limpa.risco, imagem: paraImagemUrl(bruta), r: vazia ? null : rodarRede(prep.entrada) };
        liberar(bruta, limpa);
        feitas++;
      }
      linhas.push({ m, celulas });
      if (aoProgresso) aoProgresso(`Lendo as células: ${Math.round((feitas / total) * 100)}%`);
      await new Promise((ok) => setTimeout(ok, 0));
    }
    liberar(g.img);
    return { linhas, molde: nomeMolde };
  }

  window.LeitorFolhas = { carregar, lerFoto, lerCelula, MOLDES, candidatos,
    // etapas soltas, para testar e comparar com o treino
    _interno: { imagemParaCinza, acharGrade, recortarCelula, limparCelula, preparar, rodarRede, livre, get cv() { return cv; } } };
})();
