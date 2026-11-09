/* Pranchetas Ubirálcool - painel novo (3.1): visão geral do computador; início, setores, Mais e barra do celular
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  const painelNovoPc = () => painelNovoAqui() && document.documentElement.dataset.pc === '1';
  const painelNovoCel = () => painelNovoAqui() && document.documentElement.dataset.dispositivo === 'celular';
  const pnVeProducao = () => veNoChefe('escritorio') || veNoChefe('relatorios');
  const pnComUn = (n, un, casas) => { const t = pnNum(n, casas); return t === '-' ? t : `${t} ${un}`; };
  const pnNum = (n, casas = 0) => (n === '' || n == null || !Number.isFinite(Number(n)) ? '-' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: casas }));

  /** O desenho repete a conta do mesmo dia várias vezes: guarda só até acabar este desenho. */
  let pnCache = null;
  function pnDia(dia) {
    if (!pnCache) { pnCache = new Map(); setTimeout(() => { pnCache = null; }); }
    if (!pnCache.has(dia)) {
      const x = valoresDoDia(dia);
      pnCache.set(dia, Object.assign(producaoDoDia(dia), { destilaria: x.calculo.alcoolDestilaria, nova: x.calculo.alcoolNova, mp: x.calculo.mpKg, brixFinal: x.calculo.brixFinal }));
    }
    return pnCache.get(dia);
  }
  function pnVariacao(atual, antes, classe = '') {
    if (atual === '' || antes === '' || !(Number(antes) > 0)) return '';
    const d = (Number(atual) - Number(antes)) / Number(antes) * 100;
    return `<span class="pn-var ${d >= 0 ? 'sobe' : 'desce'} ${classe}">${d >= 0 ? '+' : '-'}${pnNum(Math.abs(d), 1)}%</span>`;
  }
  /** Os dias do gráfico podem não estar no aparelho: busca uma vez cada um, em fila, e redesenha no fim. */
  const pnDiasBuscados = new Set();
  async function pnBuscarDias(dias) {
    const novos = dias.filter((d) => !pnDiasBuscados.has(d));
    if (!novos.length) return;
    novos.forEach((d) => pnDiasBuscados.add(d));
    for (const d of novos) await buscarDia(d).catch(() => {});
    render();
  }
  function pnSerie(fim, n) {
    const dias = Array.from({ length: n }, (_, i) => somarDias(fim, i - n + 1));
    pnBuscarDias(dias);
    return dias.map((dia) => {
      const p = pnDia(dia);
      return { dia, alcool: p.alcool === '' ? null : Number(p.alcool), destilaria: p.destilaria === '' ? null : Number(p.destilaria) };
    });
  }
  const pnPeriodos = (v) => `<div class="pn-periodos" role="group" aria-label="Período">${[7, 14, 30].map((n) => `<button class="${(v.periodo || 7) === n ? 'sel' : ''}" data-a="pn-periodo" data-n="${n}">${n}<span> dias</span></button>`).join('')}</div>`;

  /** Linha do álcool por dia. Passar o mouse ou tocar num dia mostra os números dele; o último fica à vista. */
  function pnGrafico(serie) {
    const validos = serie.filter((p) => p.alcool != null);
    if (!validos.length) return '<p class="sub pn-vazio">Sem produção calculada nestes dias.</p>';
    const W = 900, H = 260, E = 52, D = 14, T = 12, B = 28;
    const max = Math.ceil(Math.max(...validos.map((p) => p.alcool)) / 1000) * 1000 || 1000;
    const x = (i) => E + (W - E - D) * (serie.length > 1 ? i / (serie.length - 1) : 0.5);
    const y = (n) => T + (H - T - B) * (1 - n / max);
    const media = validos.reduce((s, p) => s + p.alcool, 0) / validos.length;
    const caminho = (campo) => serie.map((p, i) => (p[campo] == null ? null : `${x(i).toFixed(1)} ${y(p[campo]).toFixed(1)}`)).filter(Boolean).map((c, i) => `${i ? 'L' : 'M'}${c}`).join(' ');
    const primeiro = serie.findIndex((p) => p.alcool != null), ultimo = serie.length - 1 - [...serie].reverse().findIndex((p) => p.alcool != null);
    const passo = Math.max(1, Math.ceil(serie.length / 8));
    const pontos = serie.map((p, i) => {
      if (p.alcool == null) return '';
      const larg = (W - E - D) / Math.max(1, serie.length - 1), tx = Math.min(W - 190, Math.max(E, x(i) - 180)), ty = Math.max(T, y(p.alcool) - 76);
      return `<g class="pn-p ${i === ultimo ? 'ult' : ''}" tabindex="0"><rect class="alvo" x="${(x(i) - larg / 2).toFixed(1)}" y="0" width="${larg.toFixed(1)}" height="${H - B}"/><line x1="${x(i).toFixed(1)}" x2="${x(i).toFixed(1)}" y1="${T}" y2="${H - B}"/><circle cx="${x(i).toFixed(1)}" cy="${y(p.alcool).toFixed(1)}" r="6"/>
        <g class="dica" transform="translate(${tx.toFixed(1)} ${ty.toFixed(1)})"><rect width="176" height="66" rx="10"/><text x="12" y="23">${fmtData(p.dia).slice(0, 5)}</text><text class="f" x="12" y="50">${pnNum(p.alcool)} L</text></g></g>`;
    }).join('');
    return `<svg class="pn-linha" viewBox="0 0 ${W} ${H}" role="img" aria-label="Álcool produzido por dia">
      ${[0, 1, 2, 3].map((k) => { const n = max * k / 3; return `<line class="grade" x1="${E}" x2="${W - D}" y1="${y(n)}" y2="${y(n)}"/><text class="eixo" x="${E - 8}" y="${y(n) + 5}" text-anchor="end">${n >= 1000 ? pnNum(n / 1000, 1) + ' mil' : pnNum(n)}</text>`; }).join('')}
      <path class="area" d="${caminho('alcool')} L${x(ultimo).toFixed(1)} ${H - B} L${x(primeiro).toFixed(1)} ${H - B} Z"/>
      <path class="dest" d="${caminho('destilaria')}"/><path class="total" d="${caminho('alcool')}"/>
      <line class="media" x1="${E}" x2="${W - D}" y1="${y(media)}" y2="${y(media)}"/>
      ${serie.map((p, i) => (i % passo && i !== serie.length - 1 ? '' : `<text class="eixo ${i === serie.length - 1 ? 'b' : ''}" x="${x(i).toFixed(1)}" y="${H - 7}" text-anchor="${i === serie.length - 1 ? 'end' : i ? 'middle' : 'start'}">${fmtData(p.dia).slice(0, 5)}</text>`)).join('')}
      ${pontos}</svg>`;
  }
  function pnBarras(serie) {
    const max = Math.max(1, ...serie.map((p) => p.alcool || 0)), passo = Math.ceil(serie.length / 7);
    return `<div class="pn-barras">${serie.map((p, i) => `<div class="${i === serie.length - 1 ? 'hoje' : ''}" title="${fmtData(p.dia).slice(0, 5)}: ${pnNum(p.alcool)} L"><i style="height:${Math.max(p.alcool ? 6 : 2, (p.alcool || 0) / max * 100)}%"></i></div>`).join('')}</div>
      <div class="pn-barras-dias">${serie.map((p, i) => `<span>${(serie.length - 1 - i) % passo ? '' : fmtData(p.dia).slice(0, 2)}</span>`).join('')}</div>`;
  }
  /** O tanque enche conforme o dia chega perto do melhor dia dos últimos 7. */
  function pnTanque(dia) {
    const atual = Number(pnDia(dia).alcool) || 0;
    const melhor = Math.max(atual, ...Array.from({ length: 6 }, (_, i) => Number(pnDia(somarDias(dia, -i - 1)).alcool) || 0));
    const f = melhor > 0 ? atual / melhor : 0;
    return `<svg class="pn-tanque" viewBox="0 0 104 122" role="img" aria-label="${pnNum(f * 100)}% do melhor dia dos últimos 7"><defs><clipPath id="pn-tk"><path d="M12 24V100a40 12 0 0 0 80 0V24a40 12 0 0 1-80 0Z"/></clipPath></defs>
      <path class="corpo" d="M12 24V100a40 12 0 0 0 80 0V24"/><g clip-path="url(#pn-tk)"><g class="liquido" style="transform:translateY(${((1 - f) * 76).toFixed(1)}px)"><path class="onda" d="M-62 46q13-5 26 0t26 0 26 0 26 0 26 0 26 0 26 0V130H-62Z"/></g></g>
      <ellipse class="boca" cx="52" cy="24" rx="40" ry="12"/><ellipse class="fundo" cx="52" cy="24" rx="30" ry="8"/><text x="54" y="84" text-anchor="middle">${pnNum(f * 100)}%</text><text class="leg" x="54" y="97" text-anchor="middle">do melhor dia</text></svg>`;
  }
  function pnHeroi(dia, celular) {
    const d = pnDia(dia), ontem = pnDia(somarDias(dia, -1));
    return `<section class="pn-heroi pn-e">
      <div class="txt"><small>Álcool produzido</small><div class="n1">${pnNum(d.alcool)} <em>L</em></div>${pnVariacao(d.alcool, ontem.alcool, 'clara')}
        <div class="partes"><span>Destilaria<b>${pnComUn(d.destilaria, 'L')}</b></span><span>Nova<b>${pnComUn(d.nova, 'L')}</b></span>${celular ? '' : `<span>Lote<b>${esc(d.lote)}</b></span>`}</div>
        ${d.conferido ? '' : '<small class="aviso-h">Calculado das folhas, não conferido</small>'}</div>
      ${pnTanque(dia)}</section>`;
  }
  function pnSetoresAgora(data) {
    const st = sync.status, alertas = listaForaDoLimite(data);
    return setores().map((s) => {
      const folhas = s.pranchetas.flatMap(folhasDe);
      const regs = folhas.flatMap((pid) => listar(data, pid)).sort((a, b) => b.atualizadoEm - a.atualizadoEm);
      const feitas = folhas.filter((pid) => listar(data, pid).length).length;
      const pends = data === dataProducao() ? s.pranchetas.map((pid) => resumoPrancheta(pid, data)).filter((r) => r.estado === 'pendente').length : 0;
      const disp = st && st.aparelhos.find((a) => a.papel === s.id);
      const quem = (disp && disp.online && disp.operador) || (regs[0] && regs[0].operador) || '';
      const hora = regs[0] ? new Date(regs[0].atualizadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
      const nAlertas = alertas.filter((a) => a.setor === s.id).length;
      const situacao = nAlertas ? ['r', contar(nAlertas, 'alerta', 'alertas')] : pends ? ['a', `Faltam ${pends}`] : regs.length ? ['v', 'Em dia'] : ['n', 'Sem anotação'];
      return { s, quem, hora, feitas, total: folhas.length, situacao };
    });
  }
  const pnIniciais = (nome) => esc(String(nome).trim().slice(0, 2));

  function telaVisaoGeral(v, { lista, todos, pend, ligados, subtitulo, hoje, lateral }) {
    const data = v.data, ve = pnVeProducao(), dia = diaDoEscritorio(data);
    const d = pnDia(dia), ontem = pnDia(somarDias(dia, -1));
    const feitas = lista.flatMap((s) => s.pranchetas.flatMap(folhasDe)), comNota = feitas.filter((pid) => listar(data, pid).length).length;
    const pct = feitas.length ? comNota / feitas.length : 0, R = 54, meia = Math.PI * R;
    const mini = (icone, nome, valor, un, a, b) => `<div class="pn-c pn-mini pn-e"><span class="ic">${ico(icone)}</span><div><small>${nome}</small><b>${valor}${valor === '-' ? '' : ` <em>${un}</em>`}</b></div>${pnVariacao(a, b)}</div>`;
    const nav = `<div class="nav-data"><button class="btn" data-a="dia" data-n="-1" aria-label="Dia anterior">${ico('voltar')}</button><div class="data-grande"><b>${diaSemana(data)}, ${fmtData(data).slice(0, 5)}</b><span>07:00 até 06:59 do dia ${fmtData(somarDias(data, 1)).slice(0, 5)}</span></div><button class="btn" data-a="dia" data-n="1" aria-label="Próximo dia" ${data >= hoje ? 'disabled' : ''}>${ico('seta')}</button>${data !== hoje ? '<button class="btn pequeno" data-a="dia-hoje">Hoje</button>' : ''}</div>`;
    const serie = ve ? pnSerie(dia, v.periodo || 7) : [];
    const validos = serie.filter((p) => p.alcool != null), media = validos.length ? validos.reduce((s, p) => s + p.alcool, 0) / validos.length : '';
    const salvo = !!rastreioGuardado(dia);
    const passo = (icone, nome, det, val, un, alerta) => `<li class="${alerta ? 'alerta' : ''}"><span class="ic">${ico(icone)}</span><span class="t"><b>${nome}</b><small>${det}</small></span><strong>${val}${val === '-' ? '' : ` ${un}`}</strong></li>`;
    return `${cabecalho('Visão geral', subtitulo, false, nav)}
      <main class="pn-visao">
        <div class="pn-l1">
          ${ve ? pnHeroi(dia) : ''}
          ${ve ? `<div class="pn-minis">
            ${mini('regua', 'Vinho', pnNum(d.vinho), 'L', d.vinho, ontem.vinho)}${mini('tanque', 'Hidrolisado', pnNum(d.hidrolisado), 'L', d.hidrolisado, ontem.hidrolisado)}
            ${mini('baixar', 'Vinhaça', pnNum(d.vinhaca), 'L', d.vinhaca, ontem.vinhaca)}${mini('balanca', 'Matéria-prima', pnNum(d.mp, 1), 'kg', d.mp, ontem.mp)}</div>` : ''}
          <section class="pn-c pn-folhas pn-e"><div class="cab"><h2>Folhas do dia</h2>${pend ? `<small>${contar(pend, 'pendente', 'pendentes')}</small>` : ''}</div>
            <div class="corpo"><svg viewBox="0 0 136 80" class="pn-gauge" role="img" aria-label="${pnNum(pct * 100)}% das folhas com anotação"><path class="tr" d="M14 72a54 54 0 0 1 108 0"/><path class="val" d="M14 72a54 54 0 0 1 108 0" stroke-dasharray="${(pct * meia).toFixed(1)} ${meia.toFixed(1)}"/><text x="68" y="68" text-anchor="middle">${pnNum(pct * 100)}%</text></svg>
              <dl class="pn-nums"><div><dt>Anotações</dt><dd>${todos.length}</dd></div><div><dt>Folhas</dt><dd>${comNota} de ${feitas.length}</dd></div><div data-num="ligados"><dt>Aparelhos</dt><dd>${cfg.demo && !sync.status ? '-' : ligados}</dd></div></dl></div></section>
        </div>
        ${ve ? `<div class="pn-l2">
          <section class="pn-c pn-e"><div class="cab"><h2>Produção de álcool</h2><span class="pn-leg"><i class="t"></i>Total<i class="d"></i>Destilaria${media !== '' ? `<i class="m"></i>Média ${pnNum(media)} L` : ''}</span>${pnPeriodos(v)}</div>${pnGrafico(serie)}</section>
          <section class="pn-c pn-e"><div class="cab"><h2>Linha de produção</h2><small>do dia ${fmtData(dia).slice(0, 5)}</small></div>
            <ol class="pn-etapas">${passo('balanca', 'Ralo / Pesagem', 'Matéria-prima do dia', pnNum(d.mp, 1), 'kg')}${passo('tanque', 'Hidrólise', d.brix === '' ? 'Sem Brix ainda' : `Brix ${pnNum(d.brix, 1)}`, pnNum(d.hidrolisado), 'L')}${passo('regua', 'Vinho e Fermentação', d.brixFinal === '' ? 'Sem Brix final' : `Brix final ${pnNum(d.brixFinal, 1)}`, pnNum(d.vinho), 'L')}${passo('fabrica', 'Destilaria e Nova', d.alcool === '' ? 'Faltam leituras' : 'Soma das duas', pnNum(d.alcool), 'L', d.alcool === '')}${passo('baixar', 'Vinhaça', 'Destilado menos álcool', pnNum(d.vinhaca), 'L')}</ol></section>
        </div>` : ''}
        <div class="pn-l3">
          ${veNoChefe('corrigir') || veNoChefe('relatorios') ? `<section class="pn-c pn-e"><div class="cab"><h2>Setores agora</h2><small>${esc(turnoAtual().nome)}</small></div>
            <div class="pn-tabela"><div class="tit"><span>Setor</span><span>Quem está</span><span>Última</span><span>Preenchimento</span><span>Situação</span></div>
            ${pnSetoresAgora(data).map((x) => `<button class="lin" data-a="abrir-setor" data-id="${x.s.id}"><span class="s"><i>${ico(x.s.icone)}</i><b>${esc(x.s.nome)}</b></span><span class="q">${x.quem ? `<em>${pnIniciais(x.quem)}</em>${esc(x.quem)}` : '-'}</span><span>${x.hora || '-'}</span><span class="p"><u><i style="width:${x.total ? x.feitas / x.total * 100 : 0}%"></i></u>${x.feitas}/${x.total}</span><span><mark class="${x.situacao[0]}">${x.situacao[1]}</mark></span></button>`).join('')}</div></section>` : ''}
          <div class="pn-col">
            ${veNoChefe('corrigir') || veNoChefe('relatorios') ? blocoForaDoLimite(data) || `<section class="pn-c pn-e"><div class="cab"><h2>Fora do limite</h2></div><p class="sub pn-vazio">Nada fora do limite neste dia.</p></section>` : ''}
            ${veNoChefe('escritorio') ? `<section class="pn-c pn-e pn-fecha"><div class="cab"><h2>Fechamento do dia</h2><small>Lote <b>${esc(d.lote)}</b></small></div>
              <div class="chips"><mark class="${d.alcool === '' ? 'a' : 'v'}">${d.alcool === '' ? 'Faltam leituras' : 'Cálculos'}</mark><mark class="${salvo ? 'v' : 'a'}">${salvo ? 'Rastreamento salvo' : 'Falta rastreamento'}</mark></div>
              <div class="linha-botoes"><button class="btn" data-a="esc-abrir" data-t="esc-calculos" data-dia="${dia}">${ico('grafico')} Cálculos</button><button class="btn" data-a="esc-abrir" data-t="esc-rastreamento" data-dia="${dia}">${ico('documento')} Rastreamento</button>${veNoChefe('relatorios') ? `<button class="btn primario" data-a="compartilhar" data-destino="escritorio">${ico('enviar')} Enviar</button>` : ''}</div></section>` : ''}
          </div>
        </div>
        ${v.temArquivo === data && veNoChefe('relatorios') ? `<div class="linha-botoes"><button class="btn pequeno perigo" data-a="relatorio-apagar" data-data="${data}">${ico('lixeira')} Apagar o arquivo</button></div>` : ''}
        <div class="central-grade pn-demais"><section>${htmlGraficosDoPainel(data)}</section><aside class="lateral-chefe">${lateral}</aside></div>
      </main>`;
  }

  /* ===== Celular ===== */
  const pnSaudacao = () => { const p = pessoaAtual(); return p ? `Olá, ${esc(String(p.nome).split(' ')[0])}` : 'Olá'; };
  function telaInicioCel(v) {
    const data = v.data, dia = diaDoEscritorio(data), ve = pnVeProducao(), abertos = veNoChefe('avisos') ? avisosEmAberto().length : 0;
    const ativos = aparelhosDoPainel().filter((a) => a.online && a.operador);
    const pessoas = [...new Set(ativos.map((a) => a.operador))];
    const d = pnDia(dia);
    const etapa = (icone, nome, feito, falta) => `<div class="${falta ? 'a' : feito ? '' : 'o'}"><i>${ico(icone)}</i>${nome}</div>`;
    return `<header class="pn-oi pn-e"><img src="icons/logo-u.svg" alt=""><div><b>${pnSaudacao()}</b><small>${esc(turnoAtual().nome)}, ${fmtData(data).slice(0, 5)}</small></div>
        <button class="pn-ic" data-a="avisos" aria-label="Avisos${abertos ? `, ${abertos} esperando` : ''}">${ico('sino')}${abertos ? '<span class="pt"></span>' : ''}</button></header>
      <main class="pn-cel">
        ${ve ? pnHeroi(dia, true) : ''}
        ${ve ? `<section class="pn-c pn-e"><div class="cab"><h2>Linha de produção</h2>${d.alcool === '' ? '<mark class="a">Faltam leituras</mark>' : ''}</div>
          <div class="pn-nos">${etapa('balanca', 'Pesagem', d.mp !== '')}${etapa('tanque', 'Hidrólise', d.hidrolisado !== '')}${etapa('regua', 'Vinho', d.vinho !== '')}${etapa('fabrica', 'Destilaria', d.alcool !== '', d.destilaria !== '' && d.nova === '')}${etapa('coluna', 'Álcool', d.alcool !== '')}</div></section>
        <section class="pn-c pn-e"><div class="cab"><h2>Álcool por dia</h2>${pnPeriodos(v)}</div>${pnBarras(pnSerie(dia, v.periodo || 7))}</section>` : ''}
        <section class="pn-c pn-e pn-agora"><div><b>Trabalhando agora</b><small>${pessoas.length ? contar(pessoas.length, 'pessoa', 'pessoas') : 'Ninguém ligado agora'}</small></div><span>${pessoas.slice(0, 4).map((n) => `<em>${pnIniciais(n)}</em>`).join('')}</span></section>
      </main>`;
  }
  function telaSetoresCel(v) {
    const data = v.data || dataProducao(), lista = pnSetoresAgora(data), alertas = listaForaDoLimite(data), pendentes = lista.filter((x) => x.situacao[0] === 'a').length;
    return `<header class="pn-oi pn-e"><div><b>Setores</b><small>${esc(turnoAtual().nome)}, ${fmtData(data).slice(0, 5)}</small></div>${pendentes ? `<mark class="a">${contar(pendentes, 'pendente', 'pendentes')}</mark>` : ''}</header>
      <main class="pn-cel"><div class="pn-setores">${lista.map((x) => `<button class="pn-e ${x.situacao[0] === 'a' || x.situacao[0] === 'r' ? 'w' : ''}" data-a="abrir-setor" data-id="${x.s.id}"><i>${ico(x.s.icone)}</i><b>${esc(x.s.nome)}</b><small>${x.quem ? `${esc(x.quem)}${x.hora ? `, ${x.hora}` : ''}` : x.situacao[1]}</small><u><s style="width:${x.total ? x.feitas / x.total * 100 : 0}%"></s></u></button>`).join('')}</div>
        ${alertas.length ? `<section class="pn-c pn-e pn-alerta"><span>${ico('alerta')}</span><div><b>${alertas.length} fora do limite</b><small>${esc(alertas[0].onde)}</small></div></section>` : ''}</main>`;
  }
  function telaMaisCel() {
    const p = pessoaAtual(), abertos = veNoChefe('avisos') ? avisosEmAberto().length : 0, dia = diaDoEscritorio(dataProducao());
    const tile = (a, icone, nome, extra = '', selo = 0) => `<button class="pn-e" data-a="${a}" ${extra}><i>${ico(icone)}</i>${nome}${selo ? `<em>${selo}</em>` : ''}</button>`;
    const acompanhar = [veNoChefe('ler_folha') && lerFolhaLigada() && tile('ler-folha', 'camera', 'Ler folha'), veNoChefe('avisos') && !soVer() && tile('avisos', 'sino', 'Avisos', '', abertos), veNoChefe('relatorios') && tile('graficos', 'grafico', 'Gráficos'),
      veNoChefe('escritorio') && tile('esc-abrir', 'etiqueta', 'Rastreio e etiqueta', `data-t="esc-rastreamento" data-dia="${dia}"`), veNoChefe('escritorio') && tile('esc-abrir', 'documento', 'Cálculos', `data-t="esc-calculos" data-dia="${dia}"`), veNoChefe('escritorio') && tile('esc-abrir', 'escritorio', 'Escritório', `data-t="escritorio" data-dia="${dia}"`)].filter(Boolean);
    const administrar = [veNoChefe('pessoas') && tile('pessoas', 'pessoas', 'Pessoas e níveis'), (veNoChefe('chefes') || veNoChefe('conexao')) && tile('aparelhos', 'wifi', 'Aparelhos'), p && p.dono && tile('sala', 'servidor', 'Sala de controle'), veNoChefe('registro') && tile('registro', 'nota', 'Registro'), FUNCOES_DA_USINA.some(veNoChefe) && tile('config', 'ajustes', 'Configurações'), tile('tema', cfg.tema === 'escuro' ? 'sol' : 'lua', 'Tema'), tile('admin', 'tamanho', 'Ajustes')].filter(Boolean);
    return `<header class="pn-oi"><div><b>Mais</b></div></header>
      <main class="pn-cel pn-mais">
        <section class="pn-c pn-e pn-quem"><em>${p ? pnIniciais(p.nome) : ''}</em><div><b>${esc(p ? p.nome : 'Ninguém entrou')}</b><small>${esc(p ? p.nivel || '' : '')}</small></div><button class="btn pequeno" data-a="pessoa">${p ? 'Trocar' : 'Entrar'}</button></section>
        <section class="pn-c pn-e pn-quem"><div><b>Painel novo</b><small>Desligado, volta para o painel de antes</small></div><button class="pn-chave ${cfg.painelNovo ? 'on' : ''}" role="switch" aria-checked="${!!cfg.painelNovo}" aria-label="Painel novo" data-a="painel-novo" data-valor="${cfg.painelNovo ? '0' : '1'}"></button></section>
        ${acompanhar.length ? `<h3>Acompanhar</h3><div class="pn-tiles" data-n="${acompanhar.length}">${acompanhar.join('')}</div>` : ''}
        <h3>Administrar</h3><div class="pn-tiles" data-n="${administrar.length}">${administrar.join('')}</div>
      </main>`;
  }
  function blocoVoceEsta() {
    const p = pessoaAtual();
    return `<section class="pn-c pn-quem pn-voce"><div><b>${p ? `Você está como ${esc(p.nome)}` : 'Ninguém entrou neste computador'}</b><small>${esc(p ? p.nivel || '' : '')}</small></div><button class="btn" data-a="pessoa">${p ? 'Entrar com outra pessoa' : 'Entrar'}</button></section>`;
  }
  const TELAS_SEM_BARRA = [...TELAS_SEM_MENU, 'prancheta', 'leitura', 'operador', 'trocar-funcao'];
  function barraCelular(v) {
    if (!painelNovoCel() || TELAS_SEM_BARRA.includes(v.tela)) return '';
    const ativo = { central: 'abrir-painel', 'setores-cel': 'setores-cel', relatorios: 'relatorios', 'mais-cel': 'mais-cel' }[v.tela];
    const t = (a, icone, nome) => `<button class="${ativo === a ? 'at' : ''}" data-a="${a}">${ico(icone)}<span>${nome}</span></button>`;
    return `<nav class="pn-barra" aria-label="Navegação">${t('abrir-painel', 'casa', 'Início')}${t('setores-cel', 'grade', 'Setores')}<button class="ia" data-a="assistente" aria-label="Assistente">${ico('brilho')}</button>${veNoChefe('relatorios') ? t('relatorios', 'pasta', 'Relatórios') : '<span class="vago"></span>'}${t('mais-cel', 'menu', 'Mais')}</nav>`;
  }
  // deslizar da beirada direita abre o Mais
  let pnInicioToque = null;
  document.addEventListener('touchstart', (e) => { const x = e.touches[0].clientX; pnInicioToque = painelNovoCel() && x > window.innerWidth - 28 ? x : null; }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (pnInicioToque == null) return;
    const dx = e.changedTouches[0].clientX - pnInicioToque; pnInicioToque = null;
    if (dx < -60 && view().tela !== 'mais-cel' && !TELAS_SEM_BARRA.includes(view().tela)) ir({ tela: 'mais-cel' });
  }, { passive: true });
