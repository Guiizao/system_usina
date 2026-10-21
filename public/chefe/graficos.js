/* Pranchetas Ubirálcool - gráficos do dia
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * Gráficos do dia (versão 2.10): Brix, pH e temperaturas, hora a hora.
   * Quais gráficos e quais quadros entram em cada um ficam no forms.js (graficos).
   * Folha hora a hora: o ponto fica na hora da linha. Dornas: na hora em que a dorna
   * começou a ser enviada (ou no horário dela; sem horário, quando foi anotada).
   * ========================================================= */
  const numeroDe = (v) => { if (vazio(v)) return null; const n = Number(String(v).replace(',', '.')); return isNaN(n) ? null : n; };
  function graficosDoDia(data, setorId) {
    const ligadas = new Set(setores().flatMap((s) => s.pranchetas.flatMap(folhasDe)));
    return (C.graficos || []).filter((gr) => ligadas.has(gr.prancheta)).map((gr) => {
      const p = prancheta(gr.prancheta);
      const setor = setorDaPrancheta(gr.prancheta);
      if (!p || !setor || (setorId && setor.id !== setorId)) return null;
      const campos = (p.tipo === 'grade' ? p.itens : p.campos) || [];
      const hora = campos.find((c) => c.type === 'time');
      const xDe = (r) => {
        if (p.tipo === 'grade') return /^\d+$/.test(r.chave) ? ordemNoDia(Number(r.chave)) * 60 + 30 : null;
        const h = r.valores[(p.envio || {}).inicio] || (hora && r.valores[hora.id]);
        if (h && /^\d{1,2}:\d{2}$/.test(h)) return minutosDoDia(h);
        const d = new Date(r.criadoEm);
        return minutosDoDia(`${d.getHours()}:${d.getMinutes()}`);
      };
      const regs = listar(data, gr.prancheta).filter((r) => !r.apagado);
      const series = gr.campos.map((id) => campos.find((c) => c.id === id)).filter(Boolean).map((c, i) => ({
        nome: c.label, cor: (i % 4) + 1, dec: c.dec || 0,
        pontos: regs.map((r) => {
          const y = numeroDe(r.valores[c.id]);
          const x = xDe(r);
          return y == null || x == null ? null : { x, y, onde: p.tipo === 'dornas' ? `Nº ${r.chave}` : rotuloHora(Number(r.chave)) };
        }).filter(Boolean).sort((a, b) => a.x - b.x),
      }));
      // as linhas dos avisos (pH 5, Brix 25...) aparecem tracejadas
      const faixas = [];
      gr.campos.forEach((id) => { const c = campos.find((x) => x.id === id); (c && c.avisos || []).forEach((a) => { if (!faixas.some((f) => f.valor === a.valor)) faixas.push({ valor: a.valor, nivel: a.nivel || 'alerta', texto: a.curto || a.texto }); }); });
      const unidade = (campos.find((c) => c.id === gr.campos[0]) || {}).unidade || '';
      return { id: gr.titulo, titulo: gr.titulo, setor, unidade, series, faixas, temDados: series.some((s) => s.pontos.length) };
    }).filter(Boolean);
  }
  /** Um gráfico de linhas: as linhas em SVG (esticam com a caixa) e os números em texto normal (letra de verdade em qualquer tela). */
  function htmlDoGrafico(gr, compacto) {
    const ys = gr.series.flatMap((s) => s.pontos.map((p) => p.y));
    const cab = `<div class="graf-cab"><b>${esc(gr.titulo)}</b>${gr.unidade ? `<small>${esc(gr.unidade)}</small>` : ''}</div>`;
    if (!ys.length) return `<div class="grafico vazio ${compacto ? 'compacto' : ''}">${cab}<div class="graf-corpo graf-vazio"><p class="sub">Nada anotado ainda neste dia.</p></div></div>`;
    const perto = gr.faixas.filter((f) => f.valor >= Math.min(...ys) - (Math.max(...ys) - Math.min(...ys) + 2) && f.valor <= Math.max(...ys) + (Math.max(...ys) - Math.min(...ys) + 2));
    let min = Math.min(...ys, ...perto.map((f) => f.valor)), max = Math.max(...ys, ...perto.map((f) => f.valor));
    if (max - min < 1) { min -= 1; max += 1; }
    const passo = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000].find((s) => (max - min) / s <= 4) || 10000;
    min = Math.floor(min / passo) * passo; max = Math.ceil(max / passo) * passo;
    if (max === min) max = min + passo;
    const X = (x) => (x / 1440) * 100;
    const Y = (y) => (1 - (y - min) / (max - min)) * 100;
    const dec = passo < 1 ? 1 : 0;
    const marcas = [];
    for (let v = min; v <= max + passo / 2; v += passo) marcas.push(Math.round(v * 10) / 10);
    const linhas = marcas.map((v) => `<line x1="0" x2="100" y1="${Y(v).toFixed(2)}" y2="${Y(v).toFixed(2)}" class="graf-grade"/>`).join('')
      + perto.map((f) => `<line x1="0" x2="100" y1="${Y(f.valor).toFixed(2)}" y2="${Y(f.valor).toFixed(2)}" class="graf-faixa ${f.nivel}"/>`).join('')
      + gr.series.filter((s) => s.pontos.length > 1).map((s) => `<polyline class="graf-linha s${s.cor}" points="${s.pontos.map((p) => `${X(p.x).toFixed(2)},${Y(p.y).toFixed(2)}`).join(' ')}"/>`).join('');
    const pontos = gr.series.flatMap((s) => s.pontos.map((p) => `<i class="graf-ponto s${s.cor}" style="left:${X(p.x).toFixed(2)}%;top:${Y(p.y).toFixed(2)}%" title="${esc(`${s.nome} ${p.onde}: ${fmtNum(p.y.toFixed(s.dec))}`)}"></i>`)).join('');
    const horas = (compacto ? [0, 6, 12, 18] : [0, 3, 6, 9, 12, 15, 18, 21]).map((i) => `<span style="left:${X(i * 60).toFixed(2)}%">${pad2((C.inicioDoDia + i) % 24)}h</span>`).join('');
    const legenda = gr.series.map((s) => { const u = s.pontos[s.pontos.length - 1]; return `<span class="graf-leg"><i class="s${s.cor}"></i>${esc(s.nome)}${u ? ` <b>${esc(fmtNum(u.y.toFixed(s.dec)))}</b>${compacto ? '' : ` <small>(${esc(u.onde)})</small>`}` : ''}</span>`; }).join('');
    return `<div class="grafico ${compacto ? 'compacto' : ''}">${cab}
      <div class="graf-corpo"><div class="graf-y">${marcas.map((v) => `<span style="top:${Y(v).toFixed(2)}%">${esc(fmtNum(v.toFixed(dec)))}</span>`).join('')}</div>
        <div class="graf-area"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${linhas}</svg>${pontos}</div></div>
      <div class="graf-x">${horas}</div>
      <div class="graf-legenda">${legenda}${perto.length && !compacto ? perto.map((f) => `<span class="graf-leg limite ${f.nivel}"><i></i>${esc(f.texto)} (${esc(fmtNum(String(f.valor)))})</span>`).join('') : ''}</div></div>`;
  }
  /** No painel: os primeiros gráficos que têm anotação no dia. */
  function htmlGraficosDoPainel(data) {
    const com = graficosDoDia(data).filter((g) => g.temDados);
    return `<section class="graficos-painel">
      <div class="titulo-secao"><h2>Gráficos do dia</h2><button class="btn pequeno" data-a="graficos">${ico('grafico')} Ver todos</button></div>
      ${com.length ? `<div class="graficos-grade">${com.slice(0, 6).map((g) => `<button class="grafico-botao" data-a="graficos" data-setor="${g.setor.id}">${htmlDoGrafico(g, true)}</button>`).join('')}</div>`
        : '<p class="sub">Os gráficos aparecem quando os setores anotarem Brix, pH e temperaturas.</p>'}
    </section>`;
  }
  function telaGraficos(v) {
    if (!v.data) v.data = dataProducao();
    const hoje = dataProducao();
    const todos = graficosDoDia(v.data);
    const setoresCom = [...new Map(todos.map((g) => [g.setor.id, g.setor])).values()];
    const lista = todos.filter((g) => !v.setor || g.setor.id === v.setor);
    return `${topo('Gráficos do dia', `${fmtData(v.data)} · Brix, pH e temperaturas, hora a hora`, true)}
      <main class="graficos">
        <div class="barra-dia">
          <div class="nav-data">
            <button class="btn" data-a="graficos-dia" data-n="-1" aria-label="Dia anterior">${ico('voltar')}</button>
            <div class="data-grande"><b>${fmtData(v.data)}</b><span>${diaSemana(v.data)}, das 07:00 até 06:59 do dia seguinte</span></div>
            <button class="btn" data-a="graficos-dia" data-n="1" aria-label="Próximo dia" ${v.data >= hoje ? 'disabled' : ''}>${ico('seta')}</button>
          </div>
        </div>
        <div class="segmentos filtros-registro"><button class="${v.setor ? '' : 'sel'}" data-a="graficos-setor" data-setor="">Todos</button>${setoresCom.map((s) => `<button class="${v.setor === s.id ? 'sel' : ''}" data-a="graficos-setor" data-setor="${s.id}">${esc(s.nome)}</button>`).join('')}</div>
        ${diasBuscando.has(v.data) ? '<p class="sub">Buscando as anotações na central...</p>' : ''}
        <div class="graficos-lista">${lista.map((g) => htmlDoGrafico(g, false)).join('') || '<p class="sub">Nenhum gráfico para estes setores.</p>'}</div>
      </main>`;
  }
