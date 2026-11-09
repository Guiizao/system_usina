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
    if (p.papel && p.papel.modelo === 'caldeira' && !p.novaTabela) return 'caldeira';
    if (p.papel && ['destilaria', 'nova'].includes(p.papel.modelo)) return p.papel.modelo;
    return null;
  }
  const folhasQueLeio = () => setores().flatMap((s) => s.pranchetas.flatMap(folhasDe).map((pid) => ({ pid, setor: s }))).filter((x) => moldeDaFolha(x.pid));

  /** na Caldeira o papel é outro: 6K é 6 kgf, 42 é 42 °C, e a marca é OK ou um traço */
  function specDaCaldeira(c) {
    if (c.type === 'check') return { tipo: 'opcoes', exato: true, opcoes: ['OK'], formas: { OK: ['0K', 'K', 'X', 'V'] } };
    if (c.type === 'choice') return { tipo: 'opcoes', exato: true, opcoes: opcoesDe(c) };
    if (c.type === 'num') return { tipo: 'decimal', inteiro: true, min: c.min != null ? c.min : 0, max: c.max != null ? c.max : 200, sufixos: c.unidade === 'kgf' ? ['K', 'KG', 'KF', 'KGF'] : [] };
    return specDoCampo(c);
  }
  /** Destilarias: a coluna é escrita com ou sem vírgula (1055 é 105,5), mas produção é número cheio (160) e o vapor da Destilaria vem com K. */
  function specDaDestilaria(c, molde) {
    if (c.id === 'producao' || c.id === 'producao_lth') return { tipo: 'quantidade', max: 1500 };
    if (c.id === 'vapor') return molde === 'destilaria' ? { tipo: 'decimal', inteiro: true, min: 0, max: 20, sufixos: ['K', 'KG', 'KF', 'KGF'] } : { tipo: 'decimal', min: 0, max: 20 };
    if (c.id === 'carregamento') return { tipo: 'decimal', min: 0, max: 150 };
    return { tipo: 'decimal', min: c.min != null ? c.min : 20, max: c.max != null ? c.max : 130 };
  }
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
    } else if (molde === 'caldeira') {
      p.itens.forEach((c) => { cols[c.id] = { campo: c.id, rotulo: c.labelCurto || c.label, spec: specDaCaldeira(c), c }; });
    } else if (molde === 'destilaria' || molde === 'nova') {
      p.itens.forEach((c) => { cols[c.id] = { campo: c.id, rotulo: c.labelCurto || c.label, spec: specDaDestilaria(c, molde), c, numero: c.id === 'producao' || c.id === 'producao_lth' }; });
    } else {
      p.campos.forEach((c) => { cols[c.id] = { campo: c.id, rotulo: c.labelCurto || c.label, spec: specDoCampo(c), c }; });
      cols.responsavel = { campo: '_operador', rotulo: 'Responsável', spec: pessoa, limiar: 0.95 };
    }
    // campo criado depois não existe no papel
    Object.keys(cols).forEach((nome) => { if (!window.LeitorFolhas.MOLDES[molde].nomes.includes(nome)) delete cols[nome]; });
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

  /* 3.1: memória das correções. Cada correção guarda um resumo da célula (sem a imagem) e o valor certo, e viaja como configuração.
     Com 3 células parecidas para o mesmo valor, sugere; com 5 ou mais e sem outro valor parecido, já preenche, e a pessoa ainda confere. */
  const PID_MEMORIA = 'memoria_leitor', PARECIDA = 0.25, MAX_POR_VALOR = 25;
  const memoriaDaColuna = (pid, nome) => Object.values(registros).filter((r) => r.prancheta === PID_MEMORIA && !r.apagado && r.valores.pid === pid && r.valores.nome === nome);
  function palpiteDaMemoria(pid, nome, vet) {
    if (!vet) return null;
    const n = {};
    memoriaDaColuna(pid, nome).forEach((r) => { if (window.LeitorFolhas.semelhanca(vet, r.valores.vet) >= PARECIDA) n[r.valores.valor] = (n[r.valores.valor] || 0) + 1; });
    const [a, b] = Object.entries(n).sort((x, y) => y[1] - x[1]);
    return a && a[1] >= 3 ? { valor: a[0], preenche: a[1] >= 5 && !b } : null;
  }
  function lembrarCorrecao(pid, nome, vet, valor) {
    // shortcut: para de guardar depois de 25 exemplos do mesmo valor; quando a memória precisar se renovar, trocar os mais antigos
    if (!vet || memoriaDaColuna(pid, nome).filter((r) => r.valores.valor === valor).length >= MAX_POR_VALOR) return;
    gravar('config', PID_MEMORIA, `${pid}:${nome}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, { pid, nome, valor, vet });
  }

  /** transforma o que a rede leu em valores da prancheta, linha por linha (com as horas em ordem) */
  function interpretarLeitura(pid, data, bruto) {
    const p = prancheta(pid); const cols = colunasDaLeitura(pid);
    const porHora = p.tipo === 'insumo' || p.tipo === 'grade';
    let horaAnterior = null;
    const linhas = bruto.linhas.map((l) => {
      const chave = porHora ? HORAS[l.m] : l.m + 1;
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
        const palpite = cel.vazia ? null : palpiteDaMemoria(pid, nome, cel.vet);
        let aprendido = false;
        if (palpite && palpite.valor !== lido.valor) {
          if (palpite.preenche) { lido = { valor: palpite.valor, confianca: Math.min(lido.confianca, 0.79), alternativas: lido.alternativas }; aprendido = true; }
          else lido.alternativas = [{ valor: palpite.valor }, ...(lido.alternativas || [])];
        }
        celulas[nome] = { valor: lido.valor, confianca: lido.confianca, alternativas: lido.alternativas || [], imagem: cel.imagem, tinta: !cel.vazia, vet: cel.vet, aprendido };
        if (col.spec.tipo === 'hora' && nome !== 'fim' && lido.valor) horaAnterior = lido.valor;
        if (nome === 'fim' && lido.valor) horaAnterior = lido.valor;
      });
      return { chave, celulas, riscos: Object.fromEntries(Object.keys(cols).map((n) => [n, !!(l.celulas[n] && l.celulas[n].risco)])) };
    });
    // coluna riscada de cima a baixo (sem valor): as pontas do risco não são o número 1
    if (p.tipo !== 'grade') linhas.forEach((l, m) => Object.keys(cols).forEach((nome) => {
      const c = l.celulas[nome];
      if (!c || !['1', '11'].includes(String(c.valor))) return;
      const vizinho = [linhas[m - 1], linhas[m + 1]].some((x) => x && x.riscos[nome]);
      if (vizinho) Object.assign(c, { valor: '', confianca: 1, alternativas: [] });
    }));
    // pressão muda devagar: na dúvida, sugere o valor das horas vizinhas, mas continua em amarelo para conferir
    if (p.tipo === 'grade') Object.entries(cols).forEach(([nome, col]) => {
      if (!col.spec.sufixos) return;
      const contagem = {};
      linhas.forEach((l) => { const c = l.celulas[nome]; if (c && c.valor !== '' && c.confianca >= 0.9) contagem[c.valor] = (contagem[c.valor] || 0) + 1; });
      const comum = Object.keys(contagem).sort((a, b) => contagem[b] - contagem[a])[0];
      if (comum === undefined) return;
      bruto.linhas.forEach((b, i) => {
        const c = linhas[i].celulas[nome], cel = b.celulas[nome];
        if (!c || !cel || cel.vazia || c.confianca >= LIMIAR_CONFERIR) return;
        const novo = window.LeitorFolhas.lerCelula(cel.r, col.spec, (v) => (v === comum ? 8 : 1));
        if (novo.valor === comum) Object.assign(c, { valor: comum, confianca: Math.min(novo.confianca, LIMIAR_CONFERIR - 0.01), alternativas: novo.alternativas });
      });
    });
    linhas.forEach((l) => {
      l.temValor = Object.values(l.celulas).some((c) => c.valor !== '' && c.valor != null);
      l.naFolha = l.chave;
      l.existe = porHora && !!pegar(data, pid, l.chave);
      l.incluir = l.temValor && !l.existe;
    });
    const leitura = { pid, data, colunas: cols, linhas };
    posicionarLinhas(leitura, true);
    return leitura;
  }

  /** O Nº escrito no papel recomeça a cada turno e não diz em que linha do dia a anotação fica. Quem diz é o horário:
      igual ao de uma linha salva, é a mesma (só completa o que está vazio); diferente, continua a sequência do dia. */
  function posicionarLinhas(L, inicio) {
    const p = prancheta(L.pid);
    if (p.tipo === 'insumo' || p.tipo === 'grade') return; // estas têm a hora impressa na linha do papel
    const salvas = dornasDoDia(L.data, L.pid), usadas = new Set();
    const nomeHora = Object.keys(L.colunas).find((n) => L.colunas[n].spec.tipo === 'hora');
    const campoHora = nomeHora && L.colunas[nomeHora].campo;
    let proxima = salvas.reduce((m, r) => Math.max(m, Number(r.chave)), 0) + 1;
    L.linhas.forEach((l) => {
      const lidos = Object.entries(l.celulas).filter(([n, c]) => L.colunas[n].campo !== '_operador' && c.valor !== '' && c.valor != null).map(([n, c]) => [L.colunas[n].campo, String(c.valor)]);
      const hora = (lidos.find(([c]) => c === campoHora) || [])[1];
      const salva = lidos.length ? salvas.find((r) => !usadas.has(r) && (hora ? r.valores[campoHora] === hora : lidos.every(([c, x]) => r.valores[c] === x))) || null : null;
      const mudou = inicio || (l.salva || null) !== salva;
      l.salva = salva; l.existe = !!salva; l.semLugar = false;
      if (salva) {
        usadas.add(salva); l.chave = Number(salva.chave);
        if (mudou) l.incluir = lidos.some(([c]) => vazio(salva.valores[c]));
        return;
      }
      if (mudou) l.incluir = l.temValor;
      if (l.temValor && proxima > p.maxLinhas) { l.semLugar = true; l.incluir = false; } else if (l.incluir) l.chave = proxima++;
    });
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
  /* A leitura em andamento fica guardada no aparelho: saiu ou fechou, ao voltar ela retoma. Os recortes são imagens e não cabem no localStorage. */
  const bancoDaLeitura = () => new Promise((ok, erro) => { const r = indexedDB.open('usina-leitura', 1); r.onupgradeneeded = () => r.result.createObjectStore('l'); r.onsuccess = () => ok(r.result); r.onerror = () => erro(r.error); });
  const naLeitura = async (modo, fazer) => { const db = await bancoDaLeitura(); return new Promise((ok, erro) => { const t = db.transaction('l', modo), r = fazer(t.objectStore('l')); t.oncomplete = () => { db.close(); ok(r.result); }; t.onerror = () => erro(t.error); }); };
  const leituraGuardar = (v) => naLeitura('readwrite', (s) => s.put({ pid: v.pid, data: v.data, leitura: v.leitura, arquivo: v.arquivo || null }, 'atual')).catch(() => {});
  const leituraLer = () => naLeitura('readonly', (s) => s.get('atual')).catch(() => null);
  const leituraApagar = () => naLeitura('readwrite', (s) => s.delete('atual')).catch(() => {});
  async function comecarLeitura(data) {
    const g = await leituraLer();
    if (g && prancheta(g.pid)) {
      const k = await abrirModal(`<h3>Continuar a leitura?</h3><p class="dica">${esc(prancheta(g.pid).nome)} de ${fmtData(g.data)}: lida antes e ainda não salva.</p><div class="acoes-modal"><button class="btn" data-k="nova">Começar outra</button><button class="btn primario" data-k="sim">Continuar</button></div>`, (x, b, fechar) => fechar(x));
      if (!k) return;
      if (k === 'sim') { posicionarLinhas(g.leitura); return ir({ tela: 'leitura', pid: g.pid, data: g.data, fase: 'revisar', leitura: g.leitura, arquivo: g.arquivo, foto: g.arquivo ? URL.createObjectURL(g.arquivo) : '' }); }
      await leituraApagar();
    }
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
    const v = { tela: 'leitura', pid, data, fase: 'lendo', texto: 'Preparando o leitor', foto: URL.createObjectURL(arquivo), arquivo };
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
      leituraGuardar(v);
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
    const porHora = p.tipo === 'insumo' || p.tipo === 'grade';
    const emDuvida = (nome, c) => c && c.tinta && c.confianca < ((L.colunas[nome] && L.colunas[nome].limiar) || LIMIAR_CONFERIR);
    const duvidas = L.linhas.reduce((s, l) => s + (l.temValor ? Object.entries(l.celulas).filter(([nome, c]) => emDuvida(nome, c)).length : 0), 0);
    const incluidas = L.linhas.filter((l) => l.incluir).length;
    const visiveis = L.linhas.map((l, i) => [l, i]).filter(([l]) => l.temValor || l.existe);
    return `${cabecalho('Conferir a leitura', `${p.nome} · ${fmtData(v.data)}`, true, `<button class="atalho" data-a="ler-folha">${ico('camera')}<span>Outra foto</span></button>`)}
      <main class="leitura">
        <div class="aviso-leitura ${duvidas ? 'duvida' : 'ok'}">${ico(duvidas ? 'alerta' : 'certo')}
          <span>${duvidas ? `<b>${contar(duvidas, 'valor', 'valores')} em amarelo para conferir.</b> Toque no valor para corrigir.` : '<b>Leitura sem dúvidas.</b> Mesmo assim, confira antes de salvar.'} A foto de cada célula aparece em cima do valor lido.</span></div>
        ${visiveis.length ? `<div class="tabela-leitura"><table>
          <thead><tr><th class="inc">Salvar</th><th>${porHora ? 'Hora' : 'Nº'}</th>${cols.map(([, col]) => `<th>${esc(col.rotulo)}</th>`).join('')}</tr></thead>
          <tbody>${visiveis.map(([l, i]) => `<tr class="${l.incluir ? '' : 'fora'}">
            <td class="inc"><button class="marca-linha ${l.incluir ? 'sel' : ''}" data-a="leitura-linha" data-i="${i}" aria-label="Salvar esta linha">${l.incluir ? ico('certo') : ''}</button></td>
            <td class="chave"><b>${porHora ? rotuloHoraPapel(l.chave) : l.incluir || l.existe ? l.chave : '—'}</b>${l.existe ? `<small>${l.salva && l.incluir ? 'completa o vazio' : 'já anotada'}</small>` : ''}${l.semLugar ? `<small>sem linha livre (máximo ${p.maxLinhas})</small>` : ''}${!porHora && (l.incluir || l.existe) && l.naFolha !== l.chave ? `<small>na folha: ${l.naFolha}</small>` : ''}</td>
            ${cols.map(([nome, col]) => { const c = l.celulas[nome] || { valor: '', confianca: 1 }; const duv = emDuvida(nome, c);
              return `<td><button class="cel-leitura ${duv ? 'duvida' : ''} ${c.valor === '' ? 'vazia' : ''}" data-a="leitura-cel" data-i="${i}" data-c="${nome}" data-conf="${Math.round((c.confianca || 0) * 100)}">
                ${c.imagem ? `<img src="${c.imagem}" alt="">` : ''}<b>${esc(textoDoValor(col, c.valor)) || '&nbsp;'}</b>${c.aprendido ? '<small class="aprendido">aprendido</small>' : ''}</button></td>`; }).join('')}
          </tr>`).join('')}</tbody></table></div>` : '<div class="tela-aviso"><h1>Nada escrito nesta folha</h1><p>Não achei valores anotados. Confira se escolheu a folha certa ou tire outra foto.</p></div>'}
      </main>
      <div class="rodape"><button class="btn" data-a="leitura-cancelar">Cancelar</button><button class="btn primario" data-a="leitura-salvar" ${incluidas ? '' : 'disabled'}>${ico('certo')} Salvar ${contar(incluidas, 'linha', 'linhas')}</button></div>`;
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
      ${col.campo === '_operador' && pode('usina') ? `<p class="dica"><button class="btn pequeno" data-k="cadastrar">${ico('mais')} Cadastrar quem falta</button></p>` : ''}
      <div class="acoes-modal"><button class="btn" data-k="vazio">Deixar vazio</button><button class="btn primario" data-k="ok">Pronto</button></div>`,
    (k, b, fechar, fundo) => {
      const visor = fundo.querySelector('.visor');
      const mostrar = () => { if (visor) visor.innerHTML = esc(texto) || '<span class="apagado">vazio</span>'; };
      if (k.startsWith('op:')) return fechar({ valor: k.slice(3) });
      if (k.startsWith('alt:')) return fechar({ valor: k.slice(4) });
      if (k === 'vazio') return fechar({ valor: '' });
      if (k === 'cadastrar') return fechar({ cadastrar: true });
      if (k === 'ok') {
        const inp = fundo.querySelector('#txt-leitura');
        return fechar({ valor: inp ? inp.value.trim().toUpperCase() : texto });
      }
      if (k === 'b') { texto = texto.slice(0, -1); return mostrar(); }
      if (/^[0-9:,]$/.test(k) && texto.length < 8) { texto += k; return mostrar(); }
    }, { classe: 'largo', aoAbrir: (fundo) => { const inp = fundo.querySelector('#txt-leitura'); if (inp) { inp.value = cel.valor || ''; inp.focus(); } } });
    if (!resultado) return;
    if (resultado.cadastrar) {
      const setor = setorDaPrancheta(L.pid);
      const novo = await textoLivre({ titulo: `Novo operador da ${setor.nome}`, dica: 'Escreva como deve aparecer na prancheta.' });
      if (novo) {
        salvarOperadores(setor.id, [...operadoresDo(setor.id), { nome: novo, senha: '' }]);
        col.spec = Object.assign({}, col.spec, { tipo: 'opcoes', opcoes: operadoresDo(setor.id).map((o) => o.nome) });
        toast(`${novo} cadastrado sem senha`);
      }
      return corrigirCelula(v, i, nome);
    }
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
    if (valor && valor !== cel.valor) lembrarCorrecao(L.pid, nome, cel.vet, valor);
    linha.celulas[nome] = Object.assign({}, cel, { valor, confianca: 1, aprendido: false });
    linha.temValor = Object.values(linha.celulas).some((c) => c.valor !== '');
    if (linha.temValor && !linha.existe) linha.incluir = true;
    posicionarLinhas(L); // corrigir a hora pode mudar a linha de lugar
    leituraGuardar(v);
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
      if (l.salva) Object.keys(valores).forEach((c) => { if (!vazio(l.salva.valores[c])) delete valores[c]; }); // o que já foi anotado não muda
      if (!Object.keys(valores).length) return;
      gravar(L.data, L.pid, l.chave, valores, { operador: (l.salva && l.salva.operador) || operador || 'Lido da folha', origem: 'foto' });
      n++;
      // 3.0: a folha da Hidrólise preenche o resto como no tablet: a Sacarificação da mesma dorna (os insumos vêm logo abaixo)
      if (p.tipo === 'dornas') acompanharDorna(L.data, L.pid, Number(l.chave));
    });
    leituraApagar();
    const preencheuOutras = n && (p.tipo === 'dornas' || p.vemDe);
    if (preencheuOutras) somarInsumosDoDia(L.data); // LPHERA, Cal, Saczyme e Antibiótico de cada hora, para o operador conferir
    registrar('anotacao', `${quemEstaAqui()} salvou ${contar(n, 'linha lida', 'linhas lidas')} da folha de papel (${(prancheta(v.pid) || {}).nome || ''})`);
    toast(`${contar(n, 'linha salva', 'linhas salvas')} da folha de papel${p.tipo === 'dornas' && n ? '. Sacarificação e insumos preenchidos: confira' : preencheuOutras ? '. Insumos preenchidos: confira' : ''}`);
    ir({ tela: 'prancheta', pid: L.pid, data: L.data, monitor: true }, true);
  }
