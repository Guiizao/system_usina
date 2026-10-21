/* Pranchetas Ubirálcool - ler folha de papel pela foto
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * Ler folha de papel (tablet chefe): foto -> leitura -> conferir -> salvar
   * Tudo dentro do aparelho, sem internet (leitor.js + lib/opencv.js + lib/leitor.onnx)
   * ========================================================= */
  /** qual molde do papel cada prancheta usa */
  function moldeDaFolha(pid) {
    const p = prancheta(pid);
    if (!p) return null;
    if (p.papel && p.papel.modelo === 'pop011') return pid === 'hid_anexo1' ? 'anexo1' : pid === 'hid_anexo2' ? 'anexo2' : null;
    if (p.tipo === 'insumo') return 'pop03';
    return null;
  }
  const folhasQueLeio = () => setores().flatMap((s) => s.pranchetas.flatMap(folhasDe).map((pid) => ({ pid, setor: s }))).filter((x) => moldeDaFolha(x.pid));

  function specDoCampo(c) {
    if (!c) return { tipo: 'texto' };
    if (c.type === 'time') return { tipo: 'hora' };
    if (c.type === 'choice') return { tipo: 'opcoes', opcoes: opcoesDe(c) };
    if (c.type === 'num' && (c.dec || 0) > 0) return { tipo: 'decimal', min: c.min != null ? c.min : 0, max: c.max != null ? c.max : 20 };
    if (c.type === 'num') return { tipo: 'inteiro', min: Math.max(0, c.min || 0), max: c.max != null ? c.max : 300, padrao: c.padrao };
    return { tipo: 'texto' };
  }
  /** colunas que o leitor lê em cada folha: nome no molde -> { campo, rotulo, spec } */
  function colunasDaLeitura(pid) {
    const p = prancheta(pid); const s = setorDaPrancheta(pid);
    const nomes = operadoresDo(s.id).map((o) => o.nome);
    const pessoa = nomes.length ? { tipo: 'opcoes', opcoes: nomes } : { tipo: 'texto' };
    const molde = moldeDaFolha(pid);
    const cols = {};
    if (molde === 'pop03') {
      cols.qtd = { campo: 'qtd', rotulo: 'Quant.', spec: { tipo: 'quantidade', max: 999 }, numero: true, limiar: 0.9 };
      cols.fornecedor = { campo: 'fornecedor', rotulo: 'Fornecedor', spec: { tipo: 'texto' }, limiar: 0.95 };
      cols.operador = { campo: '_operador', rotulo: 'Operador', spec: pessoa, limiar: 0.95 };
    } else {
      p.campos.forEach((c) => { cols[c.id] = { campo: c.id, rotulo: c.labelCurto || c.label, spec: specDoCampo(c), c }; });
      cols.responsavel = { campo: '_operador', rotulo: 'Responsável', spec: pessoa, limiar: 0.95 };
    }
    return cols;
  }
  const minutosDoDia = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return ((h * 60 + m) - C.inicioDoDia * 60 + 1440) % 1440; };
  const semAcento = (t) => String(t || '').toUpperCase().normalize('NFD').replace(/[^A-Z0-9]/g, '');
  function parecido(a, b) {
    a = semAcento(a); b = semAcento(b);
    if (!a || !b) return 0;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return 1 - d[a.length][b.length] / Math.max(a.length, b.length);
  }

  /** transforma o que a rede leu em valores da prancheta, linha por linha (com as horas em ordem) */
  function interpretarLeitura(pid, data, bruto) {
    const p = prancheta(pid); const cols = colunasDaLeitura(pid);
    const insumo = p.tipo === 'insumo';
    let horaAnterior = null;
    const linhas = bruto.linhas.map((l) => {
      const chave = insumo ? HORAS[l.m] : l.m + 1;
      const celulas = {};
      Object.entries(cols).forEach(([nome, col]) => {
        const cel = l.celulas[nome];
        if (!cel) return;
        let lido = { valor: '', confianca: 1 };
        if (!cel.vazia) {
          let prior = null;
          if (col.spec.tipo === 'hora') {
            const ref = nome === 'fim' ? celulas.inicio && celulas.inicio.valor : horaAnterior;
            prior = (v) => {
              if (!v || !ref) return 1;
              const dt = minutosDoDia(v) - minutosDoDia(ref);
              if (dt < -5) return 0.12;
              if (dt > (nome === 'fim' ? 180 : 300)) return 0.35;
              return 1;
            };
          }
          lido = window.LeitorFolhas.lerCelula(cel.r, col.spec, prior);
          if (col.numero) { // quantidade: pega o número escrito (160, 188,8)
            const m = String(lido.valor).replace(',', '.').match(/\d+(\.\d+)?/);
            lido = { valor: m ? m[0] : '', confianca: m ? lido.confianca : 0 };
          }
          if (col.campo === 'fornecedor' && lido.valor) {
            const lista = listaDaUsina('fornecedores');
            const melhor = lista.map((f) => [f, parecido(f, lido.valor)]).sort((a, b) => b[1] - a[1])[0];
            if (melhor && melhor[1] >= 0.6) lido = { valor: melhor[0], confianca: Math.min(1, lido.confianca + 0.2) };
          }
        }
        celulas[nome] = { valor: lido.valor, confianca: lido.confianca, alternativas: lido.alternativas || [], imagem: cel.imagem, tinta: !cel.vazia };
        if (col.spec.tipo === 'hora' && nome !== 'fim' && lido.valor) horaAnterior = lido.valor;
        if (nome === 'fim' && lido.valor) horaAnterior = lido.valor;
      });
      return { chave, celulas, riscos: Object.fromEntries(Object.keys(cols).map((n) => [n, !!(l.celulas[n] && l.celulas[n].risco)])) };
    });
    // coluna riscada de cima a baixo (sem valor): as pontas do risco não são o número 1
    linhas.forEach((l, m) => Object.keys(cols).forEach((nome) => {
      const c = l.celulas[nome];
      if (!c || !['1', '11'].includes(String(c.valor))) return;
      const vizinho = [linhas[m - 1], linhas[m + 1]].some((x) => x && x.riscos[nome]);
      if (vizinho) Object.assign(c, { valor: '', confianca: 1, alternativas: [] });
    }));
    linhas.forEach((l) => {
      l.temValor = Object.values(l.celulas).some((c) => c.valor !== '' && c.valor != null);
      l.existe = !!pegar(data, pid, l.chave);
      l.incluir = l.temValor && !l.existe;
    });
    return { pid, data, colunas: cols, linhas };
  }

  function escolherFolhaParaLer(data) {
    const lista = folhasQueLeio();
    if (!lista.length) return toast('Nenhuma folha com leitura disponível', 'erro');
    return abrirModal(`<h3>Qual folha vai ler?</h3><p class="dica">Tire a foto com a folha inteira, reta e bem iluminada. Folha do dia ${fmtData(data)}.</p>
      <div class="escolhas lista-folhas">${lista.map((x) => { const p = prancheta(x.pid); return `<button data-k="${x.pid}"><span class="escolha-ico">${ico(x.setor.icone)}</span><b>${esc(p.nome)}</b><small>${esc(x.setor.nome)} · ${esc(p.codigo)}</small></button>`; }).join('')}</div>
      <div class="acoes-modal um"><button class="btn" data-k="x">Cancelar</button></div>`,
    (k, b, fechar) => fechar(k === 'x' ? undefined : k), { classe: 'largo' });
  }
  function pedirFoto(camera) {
    return new Promise((ok) => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*';
      if (camera) inp.setAttribute('capture', 'environment');
      inp.onchange = () => ok(inp.files && inp.files[0] ? inp.files[0] : null);
      inp.click();
    });
  }
  async function comecarLeitura(data) {
    const pid = await escolherFolhaParaLer(data);
    if (!pid) return;
    const como = await abrirModal(`<h3>Foto da folha</h3><p class="dica">${esc(prancheta(pid).nome)} de ${fmtData(data)}</p>
      <div class="escolhas"><button data-k="camera"><span class="escolha-ico">${ico('camera')}</span><b>Tirar foto agora</b><small>Abre a câmera do tablet</small></button>
      <button data-k="galeria"><span class="escolha-ico">${ico('pasta')}</span><b>Escolher uma foto</b><small>Foto que já está no aparelho</small></button></div>
      <div class="acoes-modal um"><button class="btn" data-k="x">Cancelar</button></div>`, (k, b, fechar) => fechar(k === 'x' ? undefined : k), { classe: 'largo' });
    if (!como) return;
    const arquivo = await pedirFoto(como === 'camera');
    if (!arquivo) return;
    return lerFolhaDeArquivo(pid, data, arquivo);
  }
  async function lerFolhaDeArquivo(pid, data, arquivo) {
    const v = { tela: 'leitura', pid, data, fase: 'lendo', texto: 'Preparando o leitor', foto: URL.createObjectURL(arquivo) };
    ir(v);
    try {
      const molde = moldeDaFolha(pid);
      const bruto = await window.LeitorFolhas.lerFoto(arquivo, molde, colunasDaLeitura(pid), (t) => {
        v.texto = t;
        const el = document.getElementById('texto-leitura'); if (el) el.textContent = t;
      });
      v.texto = 'Conferindo as horas e os valores';
      const el = document.getElementById('texto-leitura'); if (el) el.textContent = v.texto;
      await new Promise((ok) => setTimeout(ok, 20));
      v.leitura = interpretarLeitura(pid, data, bruto);
      v.fase = 'revisar';
    } catch (e) {
      v.fase = 'erro'; v.texto = (e && e.message) || 'Não consegui ler a foto';
    }
    if (view() === v) render(true);
  }

  const LIMIAR_CONFERIR = 0.8;
  function textoDoValor(col, valor) {
    if (valor === '' || valor == null) return '';
    if (col.spec.tipo === 'decimal' || col.numero) return fmtNum(valor);
    return String(valor);
  }
  function telaLeitura(v) {
    const p = prancheta(v.pid);
    if (v.fase === 'lendo' || v.fase === 'erro') {
      const erro = v.fase === 'erro';
      return `${cabecalho('Ler folha de papel', `${p.nome} · ${fmtData(v.data)}`, !erro ? false : true)}
        <main><div class="preparo">
          <div class="preparo-cab">
            <span class="preparo-ico ${erro ? 'erro' : 'girando'}">${ico(erro ? 'alerta' : 'camera')}</span>
            <div><h1>${erro ? 'Não deu para ler' : 'Lendo a folha'}</h1><p id="texto-leitura">${esc(v.texto || '')}</p></div>
            ${erro ? `<div class="preparo-botoes"><button class="btn primario" data-a="ler-folha">${ico('camera')} Tirar outra foto</button></div>` : ''}
          </div>
          ${v.foto ? `<img class="foto-leitura" src="${v.foto}" alt="Foto da folha">` : ''}
          <p class="sub">${erro ? 'Dicas: folha inteira na foto, sem dobra, sem sombra forte e com o celular reto em cima da folha.' : 'Tudo acontece neste aparelho, sem internet. Leva alguns segundos.'}</p>
        </div></main>`;
    }
    const L = v.leitura; const cols = Object.entries(L.colunas);
    const emDuvida = (nome, c) => c && c.tinta && c.confianca < ((L.colunas[nome] && L.colunas[nome].limiar) || LIMIAR_CONFERIR);
    const duvidas = L.linhas.reduce((s, l) => s + (l.temValor ? Object.entries(l.celulas).filter(([nome, c]) => emDuvida(nome, c)).length : 0), 0);
    const incluidas = L.linhas.filter((l) => l.incluir).length;
    const visiveis = L.linhas.map((l, i) => [l, i]).filter(([l]) => l.temValor || l.existe);
    return `${cabecalho('Conferir a leitura', `${p.nome} · ${fmtData(v.data)}`, true, `<button class="atalho" data-a="ler-folha">${ico('camera')}<span>Outra foto</span></button>`)}
      <main class="leitura">
        <div class="aviso-leitura ${duvidas ? 'duvida' : 'ok'}">${ico(duvidas ? 'alerta' : 'certo')}
          <span>${duvidas ? `<b>${contar(duvidas, 'valor', 'valores')} em amarelo para conferir.</b> Toque no valor para corrigir.` : '<b>Leitura sem dúvidas.</b> Mesmo assim, confira antes de salvar.'} A foto de cada célula aparece em cima do valor lido.</span></div>
        ${visiveis.length ? `<div class="tabela-leitura"><table>
          <thead><tr><th class="inc">Salvar</th><th>${p.tipo === 'insumo' ? 'Hora' : 'Nº'}</th>${cols.map(([, col]) => `<th>${esc(col.rotulo)}</th>`).join('')}</tr></thead>
          <tbody>${visiveis.map(([l, i]) => `<tr class="${l.incluir ? '' : 'fora'}">
            <td class="inc"><button class="marca-linha ${l.incluir ? 'sel' : ''}" data-a="leitura-linha" data-i="${i}" aria-label="Salvar esta linha">${l.incluir ? ico('certo') : ''}</button></td>
            <td class="chave"><b>${p.tipo === 'insumo' ? rotuloHoraPapel(l.chave) : l.chave}</b>${l.existe ? '<small>já anotada</small>' : ''}</td>
            ${cols.map(([nome, col]) => { const c = l.celulas[nome] || { valor: '', confianca: 1 }; const duv = emDuvida(nome, c);
              return `<td><button class="cel-leitura ${duv ? 'duvida' : ''} ${c.valor === '' ? 'vazia' : ''}" data-a="leitura-cel" data-i="${i}" data-c="${nome}" data-conf="${Math.round((c.confianca || 0) * 100)}">
                ${c.imagem ? `<img src="${c.imagem}" alt="">` : ''}<b>${esc(textoDoValor(col, c.valor)) || '&nbsp;'}</b></button></td>`; }).join('')}
          </tr>`).join('')}</tbody></table></div>` : '<div class="tela-aviso"><h1>Nada escrito nesta folha</h1><p>Não achei valores anotados. Confira se escolheu a folha certa ou tire outra foto.</p></div>'}
      </main>
      <div class="rodape"><button class="btn" data-a="voltar">Cancelar</button><button class="btn primario" data-a="leitura-salvar" ${incluidas ? '' : 'disabled'}>${ico('certo')} Salvar ${contar(incluidas, 'linha', 'linhas')}</button></div>`;
  }

  /** corrigir um valor: mostra a foto da célula grande e deixa digitar ou escolher */
  async function corrigirCelula(v, i, nome) {
    const L = v.leitura; const linha = L.linhas[i]; const col = L.colunas[nome]; const cel = linha.celulas[nome];
    const tipo = col.spec.tipo;
    let texto = textoDoValor(col, cel.valor);
    const alternativas = (cel.alternativas || []).filter((a) => a.valor !== '' && a.valor !== cel.valor).slice(0, 3);
    const teclado = tipo === 'opcoes'
      ? `<div class="escolhas">${col.spec.opcoes.map((o) => `<button data-k="op:${esc(o)}" class="${o === cel.valor ? 'sel' : ''}"><b>${esc(o)}</b></button>`).join('')}</div>`
      : tipo === 'texto' && !col.numero
        ? '<input type="text" id="txt-leitura" maxlength="60">'
        : `<div class="teclas">${[7, 8, 9, 4, 5, 6, 1, 2, 3].map((n) => `<button data-k="${n}">${n}</button>`).join('')}<button data-k="${tipo === 'hora' ? ':' : ','}">${tipo === 'hora' ? ':' : ','}</button><button data-k="0">0</button><button data-k="b">${ico('apagar')}</button></div>`;
    const resultado = await abrirModal(`<h3>${esc(col.rotulo)} · ${linha.chave}</h3>
      ${cel.imagem ? `<img class="celula-grande" src="${cel.imagem}" alt="Foto da célula">` : ''}
      ${tipo !== 'opcoes' ? `<div class="visor">${esc(texto) || '<span class="apagado">vazio</span>'}</div>` : ''}
      ${alternativas.length ? `<p class="dica">Pode ser: ${alternativas.map((a) => `<button class="btn pequeno" data-k="alt:${esc(a.valor)}">${esc(textoDoValor(col, a.valor))}</button>`).join(' ')}</p>` : ''}
      ${teclado}
      <div class="acoes-modal"><button class="btn" data-k="vazio">Deixar vazio</button><button class="btn primario" data-k="ok">Pronto</button></div>`,
    (k, b, fechar, fundo) => {
      const visor = fundo.querySelector('.visor');
      const mostrar = () => { if (visor) visor.innerHTML = esc(texto) || '<span class="apagado">vazio</span>'; };
      if (k.startsWith('op:')) return fechar({ valor: k.slice(3) });
      if (k.startsWith('alt:')) return fechar({ valor: k.slice(4) });
      if (k === 'vazio') return fechar({ valor: '' });
      if (k === 'ok') {
        const inp = fundo.querySelector('#txt-leitura');
        return fechar({ valor: inp ? inp.value.trim().toUpperCase() : texto });
      }
      if (k === 'b') { texto = texto.slice(0, -1); return mostrar(); }
      if (/^[0-9:,]$/.test(k) && texto.length < 8) { texto += k; return mostrar(); }
    }, { classe: 'largo', aoAbrir: (fundo) => { const inp = fundo.querySelector('#txt-leitura'); if (inp) { inp.value = cel.valor || ''; inp.focus(); } } });
    if (!resultado) return;
    let valor = resultado.valor;
    if (valor && tipo === 'hora') {
      const d = valor.replace(/\D/g, '');
      if (d.length < 3) return toast('Hora incompleta', 'erro');
      const h = Number(d.slice(0, -2)), m = Number(d.slice(-2));
      if (h > 23 || m > 59) return toast('Hora inválida', 'erro');
      valor = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    } else if (valor && (tipo === 'decimal' || tipo === 'inteiro' || col.numero)) {
      valor = valor.replace(',', '.');
      if (!/^\d+(\.\d+)?$/.test(valor)) return toast('Número inválido', 'erro');
    }
    linha.celulas[nome] = Object.assign({}, cel, { valor, confianca: 1 });
    linha.temValor = Object.values(linha.celulas).some((c) => c.valor !== '');
    if (linha.temValor && !linha.existe) linha.incluir = true;
    render();
  }

  function salvarLeitura(v) {
    const L = v.leitura; const p = prancheta(L.pid);
    let n = 0;
    L.linhas.forEach((l) => {
      if (!l.incluir) return;
      const valores = {}; let operador = '';
      Object.entries(L.colunas).forEach(([nome, col]) => {
        const c = l.celulas[nome]; if (!c || c.valor === '' || c.valor == null) return;
        if (col.campo === '_operador') operador = c.valor;
        else valores[col.campo] = String(c.valor);
      });
      if (p.tipo === 'insumo' && valores.qtd) valores.unidade = p.unidade;
      if (!Object.keys(valores).length) return;
      gravar(L.data, L.pid, l.chave, valores, { operador: operador || 'Lido da folha', origem: 'foto' });
      n++;
    });
    registrar('anotacao', `${quemEstaAqui()} salvou ${contar(n, 'linha lida', 'linhas lidas')} da folha de papel (${(prancheta(v.pid) || {}).nome || ''})`);
    toast(`${contar(n, 'linha salva', 'linhas salvas')} da folha de papel`);
    ir({ tela: 'prancheta', pid: L.pid, data: L.data, monitor: true }, true);
  }
