/* Pranchetas Ubirálcool - escritório: cálculos, rastreamento e etiqueta
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * Escritório (versão 2.13): cálculos da produção, rastreamento de lotes (POP 03 - FOR 011) e etiqueta das bombonas.
   * É um aparelho à parte (papel 'escritorio'). Entra quem tem a função Escritório, com a senha conferida na central;
   * depois de 10 minutos sem mexer pede a senha de novo (a central também só aceita a folha dentro desses 10 minutos).
   * Os números vêm das anotações dos setores (rastreamento.js); o que for digitado aqui vale por cima.
   * ========================================================= */
  const PID_RASTREIO = 'rastreamento';
  const MINUTOS_ESCRITORIO = 10;
  const escritorioAberto = () => cfg.demo || (ehCentral() ? pode('escritorio') : !!(cfg.escritorio && Date.now() < cfg.escritorio.ate));
  // quem salvou ou imprimiu: no tablet chefe, quem entrou nele
  const quemNoEscritorio = () => (ehCentral() ? (pessoaAtual() || {}).nome || '' : cfg.escritorio ? cfg.escritorio.nome : '');
  const diaFechado = () => somarDias(dataProducao(), -1);
  const numBr = (n) => (n === '' || n == null || !Number.isFinite(Number(n)) ? '' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: Math.abs(Number(n)) >= 1000 ? 1 : 2 }));
  const pegarCaminho = (o, c) => c.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);
  const dataBr = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? fmtData(d) : d || '');
  function renovarEscritorio() { if (cfg.escritorio) { cfg.escritorio.ate = Date.now() + MINUTOS_ESCRITORIO * 60000; salvarCfg(); } }
  async function entrarNoEscritorio() {
    const pin = await pedirSenhaModal('Senha do Escritório', 'Quem tem a função Escritório (cálculos, rastreamento de lotes e etiqueta).');
    if (pin === undefined) return false;
    let nome = 'Demonstração';
    if (!cfg.demo) {
      const r = await postJson('api/pessoas', { acao: 'verificar', pin }, 6000).catch(() => null);
      if (!r) { toast('Sem a central: o Escritório precisa dela para conferir a senha', 'erro'); return false; }
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(d.erro || 'Senha errada', 'erro'); return false; }
      const funcoes = Array.isArray(d.funcoes) ? new Set(d.funcoes) : funcoesDe(d.pessoa);
      if (!funcoes.has('escritorio')) { toast(`${d.pessoa.nome} não tem a função Escritório`, 'erro'); return false; }
      nome = d.pessoa.nome;
    }
    cfg.escritorio = { nome, ate: Date.now() + MINUTOS_ESCRITORIO * 60000, conferidoEm: Date.now() }; salvarCfg();
    registrar('entrada', `${nome} entrou no Escritório`);
    // o que a central não aceitou por falta da senha vai de novo
    let guardadas = 0;
    Object.values(registros).forEach((r) => { if (r.esperaEntrar) { delete r.esperaEntrar; guardadas += 1; } });
    if (guardadas) { salvarRegistros(); sincronizarLogo(); }
    return true;
  }
  /** Antes de salvar: a central só aceita a folha até 10 minutos depois da senha (renovados a cada folha salva). */
  async function garantirEscritorio() {
    if (cfg.demo) return true;
    if (ehCentral()) return exigir('escritorio');
    if (cfg.escritorio && Date.now() - (cfg.escritorio.conferidoEm || 0) < 8 * 60000) return true;
    return entrarNoEscritorio();
  }
  /** As anotações de um dia de produção (de todos os setores) que este aparelho tem. */
  const anotacoesDoDia = (dia) => Object.values(registros).filter((r) => r.data === dia && !r.apagado);
  const rastreioGuardado = (dia) => pegar(dia, PID_RASTREIO, 'dia');
  /** O que aparece na tela: o que foi salvo, ou a conta feita agora com as anotações. Listas com linhas para digitar. */
  function valoresDoDia(dia) {
    const salvo = rastreioGuardado(dia);
    return prepararValores(salvo ? copia(salvo.valores) : window.Rastreamento.calcular(C, dia, anotacoesDoDia(dia)));
  }
  function prepararValores(v) {
    v.origem = v.origem || {};
    while (v.mp.length < 3) v.mp.push({ produto: '', kg: '', fornecedor: '', nf: '' });
    while (v.lenha.length < 2) v.lenha.push({ tipo: '', m3: '', fornecedor: '' });
    if (Array.isArray(v.operadores)) v.operadores = v.operadores.join(' - ');
    return v;
  }
  const valoresDaTela = (v) => v.valores || (v.valores = valoresDoDia(v.data));
  function navDiaEscritorio(dia) {
    return `<div class="nav-data"><button class="btn" data-a="esc-dia" data-n="-1" aria-label="Dia anterior">${ico('voltar')}</button>
      <div class="data-grande"><b>${fmtData(somarDias(dia, 1))}</b><span>fechou às 07:00 · produção desde ${fmtData(dia).slice(0, 5)} 07:00</span></div>
      <button class="btn" data-a="esc-dia" data-n="1" aria-label="Próximo dia" ${dia >= dataProducao() ? 'disabled' : ''}>${ico('seta')}</button></div>`;
  }
  function telaEscritorio(v) {
    if (!escritorioAberto()) {
      return `${cabecalho('Escritório', 'Cálculos, rastreamento de lotes e etiqueta', false)}
        <main><div class="tela-aviso"><div class="grande-ico">${ico('cadeado')}</div><h1>Escritório</h1>
          <p>Entre com a sua senha. Só quem tem a função Escritório usa esta parte.</p>
          <div class="linha-botoes"><button class="btn primario" data-a="esc-entrar">${ico('cadeado')} Entrar com a senha</button></div></div></main>`;
    }
    const dia = v.data;
    const salvo = rastreioGuardado(dia);
    const lote = window.Rastreamento.lote(C, somarDias(dia, 1));
    const quando = salvo && salvo.valores.salvoEm ? new Date(salvo.valores.salvoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    return `${cabecalho('Escritório', cfg.escritorio ? `${cfg.escritorio.nome} · cálculos, rastreamento e etiqueta` : 'Cálculos, rastreamento e etiqueta', false, `<button class="atalho" data-a="esc-sair">${ico('cadeado')}<span>Sair</span></button>`)}
      <main class="escritorio">
        <div class="barra-dia">${navDiaEscritorio(dia)}<div class="lote-dia"><small>Lote do dia</small><b>${esc(lote)}</b></div></div>
        <div class="papeis">
          <button class="papel-cartao" data-a="esc-abrir" data-t="esc-calculos"><span class="escolha-ico">${ico('grafico')}</span><b>Cálculos da produção</b><small>Matéria-prima, hidrolisado, vinho, álcool e vinhaça</small></button>
          <button class="papel-cartao" data-a="esc-abrir" data-t="esc-rastreamento"><span class="escolha-ico">${ico('documento')}</span><b>Rastreamento de lotes e etiqueta</b><small>Folha POP 03 - FOR 011 e o adesivo das bombonas</small></button>
        </div>
        <p class="sub">${salvo ? `Salvo por ${esc(salvo.valores.salvoPor || '')}${quando ? ` em ${quando}` : ''}. Os números ficam como foram salvos.` : 'Ainda não foi salvo: os números vêm das anotações dos setores e mudam se alguém corrigir uma folha.'}</p>
      </main>`;
  }
  /** Uma linha de número: nome, de onde veio e o botão de mudar. */
  function linhaEsc(x, c, rotulo, unidade, resultado) {
    const val = pegarCaminho(x, c);
    const origem = x.origem[c] || (val === '' || val == null ? 'falta' : '');
    return `<div class="linha-config linha-esc ${resultado ? 'resultado' : ''}"><div><b>${esc(rotulo)}</b><small class="${origem === 'falta' ? 'falta' : ''}">${esc(origem).replace(/-/g, '‑')}</small></div>
      <span class="num-esc">${val === '' || val == null ? '—' : esc(numBr(val))}${unidade && val !== '' ? ` <small>${esc(unidade)}</small>` : ''}</span>
      <button class="btn pequeno" data-a="esc-campo" data-c="${c}" data-r="${esc(rotulo)}">Mudar</button></div>`;
  }
  const atalhosEsc = (v, extra = '') => `<button class="atalho ${v.sujo ? 'destaque' : ''}" data-a="esc-salvar">${ico('certo')}<span>Salvar</span></button>${extra}`;
  function telaEscCalculos(v) {
    const x = valoresDaTela(v);
    return `${cabecalho('Cálculos da produção', `Lote ${x.lote} · ${fmtData(x.fechamento)} 07:00`, true, atalhosEsc(v))}
      <main class="escritorio">
        <section class="bloco"><h2>${ico('tanque')} Hidrolisado e vinho</h2>
          <p class="sub">Conta do Lucas: hidrolisado = matéria‑prima ÷ fator; vinho = hidrolisado × Brix inicial ÷ Brix final.</p>
          ${linhaEsc(x, 'calculo.mpKg', 'Matéria‑prima do dia', 'kg')}${linhaEsc(x, 'calculo.fator', 'Fator da matéria‑prima', '')}
          ${linhaEsc(x, 'calculo.brixInicial', 'Brix inicial (Hidrólise)', '°Bx')}${linhaEsc(x, 'calculo.brixFinal', 'Brix final (diluído)', '°Bx')}
          ${linhaEsc(x, 'pi.hidrolise', 'Produção de hidrólise', 'L', true)}${linhaEsc(x, 'pi.vinho', 'Produção de vinho', 'L', true)}</section>
        <section class="bloco"><h2>${ico('coluna')} Álcool e vinhaça</h2>
          <p class="sub">Vinhaça = volume destilado − produção de álcool.</p>
          ${linhaEsc(x, 'calculo.alcoolDestilaria', 'Álcool da Destilaria', 'L')}${linhaEsc(x, 'calculo.alcoolNova', 'Álcool da Nova Destilaria', 'L')}
          ${linhaEsc(x, 'alcool.producao', 'Produção de álcool', 'L', true)}${linhaEsc(x, 'volumeDestilado', 'Volume destilado', 'L')}
          ${linhaEsc(x, 'vinhaca.producao', 'Produção de vinhaça', 'L', true)}</section>
        <div class="linha-botoes"><button class="btn" data-a="esc-recalcular">${ico('relogio')} Refazer com as anotações de agora</button>
          <button class="btn primario" data-a="esc-salvar">${ico('certo')} Salvar</button></div>
      </main>`;
  }
  /** Célula da folha: mostra o valor e abre para mudar. */
  function celEsc(x, c, rotulo, num) {
    const val = pegarCaminho(x, c);
    const txt = val === '' || val == null ? '' : num ? numBr(val) : /validade$/.test(c) ? dataBr(val) : String(val);
    return `<button class="cel-esc ${txt ? '' : 'vazia'} ${(x.origem[c] || '').startsWith('digitado') ? 'digitada' : ''}" data-a="esc-campo" data-c="${c}" data-r="${esc(rotulo)}">${esc(txt) || '—'}</button>`;
  }
  function telaEscRastreamento(v) {
    const x = valoresDaTela(v);
    const R = C.rastreamento;
    const par = (lista, grupo, titulo) => `<table class="tabela-esc"><thead><tr><th>${esc(titulo)}</th><th>Faixa</th><th>Resultado</th></tr></thead><tbody>
      ${lista.map(([id, nome, faixa]) => `<tr><td>${esc(nome)}</td><td>${esc(faixa)}</td><td>${celEsc(x, `${grupo}.${id}`, nome, true)}</td></tr>`).join('')}</tbody></table>`;
    const tanques = R.tanques.map((g) => `<h3>${esc(g.titulo)}</h3><div class="tabela-wrap"><table class="tabela-esc"><thead><tr><th>Resultado</th>${g.lista.map(([, nome]) => `<th>${esc(nome)}</th>`).join('')}</tr></thead><tbody>
      ${[['brix', 'BRIX'], ['ph', 'PH'], ['folga', 'FOLGA']].map(([k, t]) => `<tr><td>${t}</td>${g.lista.map(([id, nome]) => `<td>${celEsc(x, `tanques.${id}.${k}`, `${t} ${nome}`, true)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`).join('');
    const insumos = (lista, titulo) => `<h3>${esc(titulo)}</h3><div class="tabela-wrap"><table class="tabela-esc"><thead><tr><th>Insumo</th><th>KGS/LTS</th><th>Lote</th><th>Validade</th><th>Nº NF</th><th>Fornecedor</th></tr></thead><tbody>
      ${lista.map(([id, nome]) => { const i = x.insumos[id] || {}; return `<tr><td>${esc(nome)}${i.unidade ? ` <small>${esc(i.unidade)}</small>` : ''}</td><td>${celEsc(x, `insumos.${id}.qtd`, nome, true)}</td>
        ${['lote', 'validade', 'nf', 'fornecedor'].map((k) => `<td>${celEsc(x, `insumos.${id}.${k}`, `${nome}: ${k}`)}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div>`;
    return `${cabecalho('Rastreamento', `POP 03 - FOR 011 · lote ${x.lote}`, true, atalhosEsc(v))}
      <main class="escritorio">
        <section class="bloco"><h2>Produtos do dia</h2>
          <p class="sub">Início 07:00 de ${fmtData(v.data)} · final 07:00 de ${fmtData(x.fechamento)}. Toque num número para mudar.</p>
          <div class="tabela-wrap"><table class="tabela-esc"><thead><tr><th>Produto</th><th>Produção (L)</th><th>Nº do lote</th><th>Validade</th></tr></thead><tbody>
            <tr><td>ÁLCOOL-PA</td><td>${celEsc(x, 'alcool.producao', 'Produção de álcool', true)}</td><td>${celEsc(x, 'alcool.lote', 'Lote do álcool')}</td><td>${celEsc(x, 'alcool.validade', 'Validade do álcool')}</td></tr>
            <tr><td>VINHAÇA</td><td>${celEsc(x, 'vinhaca.producao', 'Produção de vinhaça', true)}</td><td>${celEsc(x, 'vinhaca.lote', 'Lote da vinhaça')}</td><td>${celEsc(x, 'vinhaca.validade', 'Validade da vinhaça')}</td></tr>
            <tr><td>VOLUME DESTILADO</td><td>${celEsc(x, 'volumeDestilado', 'Volume destilado', true)}</td><td></td><td></td></tr>
            <tr><td>(PI) HIDRÓLISE</td><td>${celEsc(x, 'pi.hidrolise', 'Produção de hidrólise', true)}</td><td colspan="2"><small>matéria-prima ÷ ${esc(numBr(x.calculo.fator))}</small></td></tr>
            <tr><td>(PI) VINHO</td><td>${celEsc(x, 'pi.vinho', 'Produção de vinho', true)}</td><td colspan="2"><small>× Brix inicial ÷ Brix final</small></td></tr>
          </tbody></table></div></section>
        <section class="bloco"><h2>Parâmetros</h2><div class="duas-tabelas">${par(R.parametros.hidrolise, 'hidrolise', 'Hidrólise')}${par(R.parametros.alcool, 'alcoolParam', 'Produção de álcool')}</div></section>
        <section class="bloco"><h2>Tanques</h2>${tanques}</section>
        <section class="bloco"><h2>Insumos utilizados</h2>${insumos(R.insumos, 'Insumos')}${insumos(R.tratamentoAgua, 'Tratamento de água')}${insumos(R.higienizacao, 'Higienização de equipamentos')}</section>
        <section class="bloco"><h2>Matéria-prima e lenha</h2>
          <div class="tabela-wrap"><table class="tabela-esc"><thead><tr><th>Moagem de matéria-prima</th><th>kg</th><th>Fornecedor</th><th>Nº NF</th></tr></thead><tbody>
            ${x.mp.map((m, i) => `<tr><td>${celEsc(x, `mp.${i}.produto`, 'Produto')}</td><td>${celEsc(x, `mp.${i}.kg`, 'Matéria-prima (kg)', true)}</td><td>${celEsc(x, `mp.${i}.fornecedor`, 'Fornecedor')}</td><td>${celEsc(x, `mp.${i}.nf`, 'Nº NF')}</td></tr>`).join('')}</tbody></table></div>
          <div class="tabela-wrap"><table class="tabela-esc"><thead><tr><th>Tipo de lenha</th><th>m³</th><th>Fornecedor</th></tr></thead><tbody>
            ${x.lenha.map((l, i) => `<tr><td>${celEsc(x, `lenha.${i}.tipo`, 'Tipo de lenha')}</td><td>${celEsc(x, `lenha.${i}.m3`, 'Lenha (m³)', true)}</td><td>${celEsc(x, `lenha.${i}.fornecedor`, 'Fornecedor da lenha')}</td></tr>`).join('')}</tbody></table></div></section>
        <section class="bloco"><h2>Operadores e encarregado</h2>
          <div class="linha-config"><div><b>Operadores</b><small>${esc(x.operadores || '—')}</small></div><button class="btn pequeno" data-a="esc-campo" data-c="operadores" data-r="Operadores">Mudar</button></div>
          <div class="linha-config"><div><b>Encarregado</b><small>${esc(x.encarregado || '—')}</small></div><button class="btn pequeno" data-a="esc-campo" data-c="encarregado" data-r="Encarregado">Mudar</button></div>
          <p class="sub">${esc(R.aviso)}</p></section>
        <div class="linha-botoes"><button class="btn" data-a="esc-recalcular">${ico('relogio')} Refazer com as anotações de agora</button>
          <button class="btn" data-a="esc-arquivo">${ico('enviar')} Enviar (PDF, Excel ou XML)</button>
          <button class="btn" data-a="esc-folha">${ico('imprimir')} Imprimir a folha</button>
          <button class="btn" data-a="esc-etiqueta">${ico('documento')} Etiqueta das bombonas</button>
          <button class="btn primario" data-a="esc-salvar">${ico('certo')} Salvar</button></div>
      </main>`;
  }
  /** Muda um campo: número com vírgula, data no calendário, ou texto. */
  async function mudarCampoEsc(v, c, rotulo) {
    const x = valoresDaTela(v);
    const atual = pegarCaminho(x, c);
    const numero = /^(volumeDestilado|calculo\.[^.]+|pi\.[^.]+|(?:alcool|vinhaca)\.producao|hidrolise\.[^.]+|alcoolParam\.[^.]+|tanques\.[^.]+\.[^.]+|insumos\.[^.]+\.qtd|mp\.\d+\.kg|lenha\.\d+\.m3)$/.test(c);
    const data = /^(alcool|vinhaca)\.validade$/.test(c);
    const txt = await textoLivre({ titulo: rotulo, dica: numero ? 'Use vírgula para as casas (ex.: 95,5). Vazio apaga.' : data ? 'Escolha a data.' : '', valor: atual === '' || atual == null ? '' : numero ? String(atual).replace('.', ',') : String(atual), tipo: data ? 'date' : 'text', decimal: numero, max: 120 });
    if (txt === undefined) return;
    if (numero && txt !== '' && !Number.isFinite(Number(txt.replace(/\./g, '').replace(',', '.')))) return toast('Número inválido', 'erro');
    const valor = numero && txt !== '' ? txt.replace(/\./g, '').replace(',', '.') : txt;
    if (c === 'operadores' || c === 'encarregado') { x[c] = valor; x.origem[c] = 'digitado no Escritório'; }
    else window.Rastreamento.recalcular(x, { campo: c, valor });
    v.sujo = true; renovarEscritorio(); render();
  }
  async function salvarEsc(v) {
    if (!(await garantirEscritorio())) return false;
    const x = copia(valoresDaTela(v));
    if (typeof x.operadores === 'string') x.operadores = x.operadores.split(/\s*-\s*|\s*,\s*/).filter(Boolean);
    x.salvoPor = quemNoEscritorio(); x.salvoEm = Date.now();
    gravar(v.data, PID_RASTREIO, 'dia', x, { operador: x.salvoPor });
    registrar('anotacao', `${x.salvoPor} salvou o rastreamento de lotes de ${fmtData(x.fechamento)} (lote ${x.lote})`);
    if (cfg.escritorio) cfg.escritorio.conferidoEm = Date.now(); // a central renova os 10 minutos a cada folha aceita
    v.sujo = false; v.valores = null; renovarEscritorio();
    toast(`Rastreamento salvo: lote ${x.lote}`, 'ok');
    render();
    return true;
  }
  /** Folha igual ao papel: imprime ou monta o arquivo com o que está salvo (salva antes, se mudou). */
  async function arquivoEsc(v, formato) {
    if ((v.sujo || !rastreioGuardado(v.data)) && !(await salvarEsc(v))) return null;
    const nome = `Rastreamento_${somarDias(v.data, 1)}`;
    if (formato === 'xml') return new File([gerarXml(v.data, [PID_RASTREIO])], nome + '.xml', { type: MIME.xml });
    if (formato === 'pdf') { const pecas = await pecasPdf(); return new File([window.criarPdf([papel().folha(PID_RASTREIO, v.data)], Object.assign({ fmtNum, titulo: nome }, pecas))], nome + '.pdf', { type: MIME.pdf }); }
    return new File([window.criarXlsx([planilhaDaPrancheta(PID_RASTREIO, v.data)], LOGO_PNG)], nome + '.xlsx', { type: MIME.xlsx });
  }
  async function enviarRastreamento(v) {
    const formato = await abrirModal(`<h3>Rastreamento de ${fmtData(somarDias(v.data, 1))}</h3><p class="dica">Qual arquivo?</p>
      <div class="escolhas"><button data-k="pdf"><span class="escolha-ico">${ico('documento')}</span><b>PDF</b><small>Igual ao papel</small></button>
        <button data-k="xlsx"><span class="escolha-ico">${ico('planilha')}</span><b>Excel</b><small>Igual ao papel</small></button>
        <button data-k="xml"><span class="escolha-ico">${ico('codigo')}</span><b>XML</b><small>Para outro sistema</small></button></div>
      <div class="acoes-modal um"><button class="btn" data-k="x">Cancelar</button></div>`, (k, b, fechar) => fechar(k === 'x' ? undefined : k));
    if (!formato) return;
    const arquivo = await arquivoEsc(v, formato).catch(() => null);
    if (!arquivo) return;
    const destino = await abrirModal(`<h3>${esc(arquivo.name)}</h3><p class="dica">Para onde?</p>
      <div class="escolhas"><button data-k="escritorio"><span class="escolha-ico">${ico('enviar')}</span><b>Escritório</b><small>WhatsApp ou e-mail cadastrado</small></button>
        <button data-k="whatsapp"><span class="escolha-ico">${ico('whatsapp')}</span><b>WhatsApp</b><small>Escolher a conversa</small></button>
        <button data-k="email"><span class="escolha-ico">${ico('email')}</span><b>E-mail</b><small>Com o arquivo anexado</small></button>
        <button data-k="outros"><span class="escolha-ico">${ico('compartilhar')}</span><b>Outros apps</b><small>Drive, Bluetooth e outros</small></button>
        <button data-k="baixar"><span class="escolha-ico">${ico('pasta')}</span><b>Guardar</b><small>Neste aparelho</small></button></div>
      <div class="acoes-modal um"><button class="btn" data-k="x">Cancelar</button></div>`, (k, b, fechar) => fechar(k === 'x' ? undefined : k));
    if (destino) compartilhar(destino, somarDias(v.data, 1), arquivo);
  }
  async function imprimirFolhaEsc(v) {
    if ((v.sujo || !rastreioGuardado(v.data)) && !(await salvarEsc(v))) return;
    imprimirHtml(window.ModelosPapel.paraHtml(papel().folha(PID_RASTREIO, v.data), 'icons/logo.png', fmtNum), `Rastreamento ${fmtData(somarDias(v.data, 1))}`);
  }

  /* ---------- Etiqueta das bombonas (igual ao adesivo de 01/10/2026) ---------- */
  const PICTO_CHAMA = '<path d="M12 3c1.4 3 4.6 4.6 4.6 8.6a4.6 4.6 0 0 1-9.2 0c0-1.9 1-3.2 2-4.3.2 1.6 1.1 2.6 2.2 3C11.5 8.2 11 5.6 12 3z" fill="#000"/><rect x="6" y="17.6" width="12" height="1.6" fill="#000"/>';
  const pictograma = (miolo) => `<svg class="picto" viewBox="0 0 24 24"><path d="M12 .8L23.2 12 12 23.2.8 12z" fill="#fff" stroke="#d00" stroke-width="1.6"/><g transform="translate(5.4 5.2) scale(.55)">${miolo}</g></svg>`;
  const PICTO_EXCLAMA = '<rect x="10.4" y="3" width="3.2" height="11" rx="1" fill="#000"/><circle cx="12" cy="18.2" r="1.9" fill="#000"/>';
  function etiquetaHtml(x, volume) {
    const e = C.rastreamento.etiqueta;
    const p = window.Rastreamento.etiqueta(C, volume);
    const kg = (n) => (n === '' ? '—' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    return `<div class="etiqueta">
      <div class="et-esq">
        <div class="et-marca"><img src="icons/logo.png" alt=""><div><b>UBIRÁLCOOL</b><small>ÁLCOOL DE CEREAIS</small></div></div>
        <div class="et-pictos">${pictograma(PICTO_CHAMA)}${pictograma(PICTO_EXCLAMA)}</div>
        <p class="et-prec"><b>Frases de precaução:</b> ${esc(e.precaucao)}</p>
        <p class="et-ficha">${esc(e.ficha)}</p>
        <div class="et-peso"><b>VOLUME: ${esc(numBr(p.volume))} lts</b><b>PESO LÍQUIDO: ${kg(p.pesoLiquido)} kgs</b><b>PESO BRUTO: ${kg(p.pesoBruto)} kgs</b><b>VALIDADE: ${esc(String(C.rastreamento.validadeAlcoolMeses))} meses</b></div>
      </div>
      <div class="et-meio">
        <p class="et-empresa"><b>${esc(e.empresa)}</b><br>${esc(e.endereco)}<br>Telefone: ${esc(e.telefone)} - <b>Emergências: ${esc(e.emergencia)}</b></p>
        <p class="et-produto">${esc(e.produto)}</p>
        <div class="et-onu">ONU ${esc(e.onu)}</div>
        <p class="et-dados"><b>Nome apropriado para embarque:</b> ${esc(e.nomeEmbarque)}<br><b>Classe ou subclasse de risco:</b> ${esc(e.classeRisco)}<br><b>Grupo de embalagem:</b> ${esc(e.grupoEmbalagem)}<br><b>Número de risco:</b> ${esc(e.numeroRisco)}</p>
        <div class="et-lote"><b>LOTE: ${esc(x.lote)}</b><small>DATA FABRICAÇÃO: ${esc(dataBr(x.fechamento))}</small><small>VALIDADE: ${esc(dataBr(x.alcool.validade))}</small></div>
      </div>
      <div class="et-dir">
        <p><b>Composição Química:</b> ${esc(e.composicao)}<br><b>Responsável técnico:</b> ${esc(e.responsavel)}<br>${esc(e.registro)}</p>
        <p class="et-perigo">PERIGO</p><p>${esc(e.perigo)}</p>
        <svg class="et-placa" viewBox="0 0 100 100"><path d="M50 2L98 50 50 98 2 50z" fill="#d22" stroke="#fff" stroke-width="2"/><path d="M50 8L92 50 50 92 8 50z" fill="none" stroke="#fff" stroke-width="1.5"/>
          <g transform="translate(36 14) scale(1.15)"><path d="M12 3c1.4 3 4.6 4.6 4.6 8.6a4.6 4.6 0 0 1-9.2 0c0-1.9 1-3.2 2-4.3.2 1.6 1.1 2.6 2.2 3C11.5 8.2 11 5.6 12 3z" fill="#fff"/></g>
          <text x="50" y="57" text-anchor="middle" font-size="7.5" font-weight="700" fill="#fff" font-family="Arial">LÍQUIDO</text><text x="50" y="66" text-anchor="middle" font-size="7.5" font-weight="700" fill="#fff" font-family="Arial">INFLAMÁVEL</text>
          <text x="50" y="86" text-anchor="middle" font-size="13" font-weight="700" fill="#fff" font-family="Arial">3</text></svg>
      </div></div>`;
  }
  async function etiquetaEsc(v) {
    if ((v.sujo || !rastreioGuardado(v.data)) && !(await salvarEsc(v))) return;
    const x = valoresDoDia(v.data);
    const volumes = C.rastreamento.etiqueta.volumes;
    let volume = volumes[0], qtd = 1;
    const desenhar = (f) => {
      f.querySelector('#et-previa').innerHTML = etiquetaHtml(x, volume);
      f.querySelector('#et-qtd').textContent = qtd;
      f.querySelectorAll('[data-k^="vol:"]').forEach((b) => b.classList.toggle('sel', Number(b.dataset.k.slice(4)) === volume));
    };
    const ok = await abrirModal(`<h3>Etiqueta das bombonas</h3><p class="dica">Lote ${esc(x.lote)}, fabricação ${esc(dataBr(x.fechamento))}. Duas etiquetas por folha A4.</p>
      <div class="segmentos">${volumes.map((n) => `<button data-k="vol:${n}">${n} L</button>`).join('')}</div>
      <div class="qtd-etiquetas"><span>Quantas etiquetas?</span><button class="btn" data-k="menos" aria-label="Menos uma">−</button><b id="et-qtd"></b><button class="btn" data-k="mais">${ico('mais')}</button></div>
      <div class="et-previa" id="et-previa"></div>
      <div class="acoes-modal"><button class="btn" data-k="x">Cancelar</button><button class="btn primario" data-k="ok">${ico('imprimir')} Imprimir</button></div>`,
    (k, b, fechar, f) => {
      if (k === 'x') return fechar(false);
      if (k === 'ok') return fechar(true);
      if (k.startsWith('vol:')) volume = Number(k.slice(4));
      if (k === 'menos') qtd = Math.max(1, qtd - 1);
      if (k === 'mais') qtd = Math.min(60, qtd + 1);
      desenhar(f);
    }, { classe: 'largo', aoAbrir: desenhar });
    if (!ok) return;
    imprimirHtml(`<div class="folha-etiquetas">${Array.from({ length: qtd }, () => etiquetaHtml(x, volume)).join('')}</div>`, `Etiqueta ${x.lote}`);
    registrar('anotacao', `${quemNoEscritorio()} imprimiu ${qtd} etiqueta${qtd > 1 ? 's' : ''} do lote ${x.lote}`);
  }
