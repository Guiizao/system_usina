/* Pranchetas Ubirálcool - a prancheta (tela de anotação)
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * Prancheta: uma tela só
   *   seletor da linha -> quadros; teclado ao lado; folha do dia no monitoramento
   * ========================================================= */
  const dataDaView = (v) => v.data || dataProducao();
  /** Última linha aberta em cada folha, para voltar nela ao trocar de aba. */
  const lembrar = {};
  function chavePadrao(p, pid, data) {
    const lembrada = lembrar[`${data}|${pid}`];
    if (lembrada != null) return lembrada;
    // volume de vinho: o primeiro grupo que ainda não foi medido hoje
    if (p.tipo === 'medicao') return (gruposDaMedicao().find((g) => !pegar(data, pid, g.id)) || gruposDaMedicao()[0]).id;
    // fermentação: a dorna que está indo para a volante, senão a que está enchendo
    if (p.tipo === 'fermentacao') {
      const l = dornasDeFermentacao();
      const et = (n) => etapaFerm(cicloAtual(n));
      return (l.find((x) => et(x.n) === 'volante') || l.find((x) => et(x.n) === 'enchendo') || l[0] || {}).n;
    }
    if (p.tipo === 'dornas') {
      const l = dornasDoDia(data, pid);
      const proxima = l.length ? Math.max(...l.map((r) => Number(r.chave))) + 1 : 1;
      // abre a dorna que está em andamento (enchendo, depois a que está indo para cima)
      const ref = p.envio ? p : p.vemDe ? prancheta(p.vemDe.prancheta) : null;
      const pidRef = p.envio ? pid : p.vemDe ? p.vemDe.prancheta : null;
      if (ref && ref.envio) {
        const lr = dornasDoDia(data, pidRef);
        const andando = lr.find((r) => etapaDaDorna(ref, r) === 'enchendo') || lr.find((r) => etapaDaDorna(ref, r) === 'enviando');
        if (andando) return Number(andando.chave);
      }
      return p.vemDe && l.length ? Number(l[l.length - 1].chave) : proxima;
    }
    return data === dataProducao() ? new Date().getHours() : C.inicioDoDia;
  }
  /** Ao trocar de aba: Hidrólise e Sacarificação abrem na mesma dorna; os insumos, na hora em que ela foi enviada. */
  function chaveParaAba(v, alvo) {
    const de = prancheta(v.pid), para = prancheta(alvo);
    const data = dataDaView(v);
    const atual = rascunho ? rascunho.chave : v.chave;
    if (atual != null && de.tipo === 'dornas' && para.tipo === 'dornas' && (pegar(data, alvo, atual) || pegar(data, v.pid, atual))) return atual;
    if (atual != null && de.tipo === 'dornas' && (para.tipo === 'juntas' || para.tipo === 'insumo')) {
      const r = pegar(data, v.pid, atual);
      const campoHora = de.envio ? de.envio.inicio : (de.campos.find((c) => c.type === 'time') || {}).id;
      const h = r && campoHora ? horaDoTexto(r.valores[campoHora]) : null;
      if (h != null) return h;
    }
    return undefined;
  }
  /** Colunas de insumo que o operador preenche, sem repetir as do escritório. */
  const extrasOperador = (p) => (p.camposOperador || []).filter((c) => !p.camposEscritorio.some((e) => e.id === c.id));
  const operadorPreenche = (p, id) => (p.camposOperador || []).some((c) => c.id === id);

  /** Quando foi mexida a anotação que está na linha (0 se ainda não tem). */
  function fonteDaFolha(p, pid, data, chave) {
    if (p.tipo === 'fermentacao') { const c = cicloAtual(chave); return c ? c.atualizadoEm || 0 : 0; }
    if (p.tipo === 'juntas') return p.partes.map((pt) => (pegar(data, pt.prancheta, chave) || {}).atualizadoEm || 0).join(',');
    return (pegar(data, pid, chave) || {}).atualizadoEm || 0;
  }

  function prepararRascunho(v) {
    const p = prancheta(v.pid);
    const data = dataDaView(v);
    const chave = v.chave != null ? v.chave : chavePadrao(p, v.pid, data);
    // fermentação: o rascunho é do enchimento que está na dorna (outro aparelho começou um novo: recomeça)
    const cicloDaTela = p.tipo === 'fermentacao' ? cicloAtual(chave) : null;
    const chaveView = `${data}|${v.pid}|${chave}${cicloDaTela ? '|' + cicloDaTela.id : ''}`;
    // se outro aparelho mandar a anotação desta linha enquanto a pessoa só olha, a tela mostra a nova
    const fonte = fonteDaFolha(p, v.pid, data, chave);
    if (rascunho && rascunho.chaveView === chaveView && (rascunho.fonte === fonte || rascunhoSujo())) return { p, data, chave };
    const extras = { operador: '' };
    let valores = {};
    let novo = true;
    let origem = '';
    let horaAuto = [];
    let ciclo = null;

    if (p.tipo === 'medicao') {
      const r = pegar(data, v.pid, chave);
      novo = !r;
      valores = r ? Object.assign({}, r.valores) : {};
      extras.operador = r ? r.operador || '' : '';
      // hora da medição: acompanha o relógio até a pessoa mudar
      if (!r && chave !== 'param') { valores.hora = horaAgora(); horaAuto.push('hora'); }
    } else if (p.tipo === 'fermentacao') {
      const aberto = cicloDaTela && etapaFerm(cicloDaTela) !== 'vazia';
      valores = { enche_inicio: '', enche_fim: '', brix_inicial: '' };
      if (aberto) { p.campos.forEach((c) => { valores[c.id] = cicloDaTela.valores[c.id] || ''; }); ciclo = { data: cicloDaTela.data, chave: cicloDaTela.chave }; }
      novo = !aberto;
      extras.operador = aberto ? cicloDaTela.operador || '' : '';
    } else if (p.tipo === 'juntas') {
      p.partes.forEach((pt) => {
        const r = pegar(data, pt.prancheta, chave);
        const folha = prancheta(pt.prancheta);
        if (r) { novo = false; extras.operador = extras.operador || r.operador || ''; valores[pt.prancheta] = { qtd: r.valores.qtd || '', unidade: r.valores.unidade || folha.unidade }; }
        else {
          const sug = sugestaoDaHora(data, pt.sugestao, chave);
          valores[pt.prancheta] = { qtd: sug ? sug.valor : '', unidade: folha.unidade };
          if (sug) origem = `Valores vindos da${sug.dornas.length > 1 ? 's' : ''} dorna${sug.dornas.length > 1 ? 's' : ''} Nº ${listaE(sug.dornas)}, que começ${sug.dornas.length > 1 ? 'aram' : 'ou'} às ${pad2(chave)}h`;
        }
      });
    } else {
      const r = pegar(data, v.pid, chave);
      novo = !r;
      valores = r ? Object.assign({}, r.valores) : {};
      extras.operador = r ? r.operador || '' : '';
      if (!r && p.tipo === 'dornas') {
        const ant = dornasDoDia(data, v.pid).filter((x) => Number(x.chave) < Number(chave)).pop();
        if (ant) { (p.copiarDaAnterior || []).forEach((id) => { if (!vazio(ant.valores[id])) valores[id] = ant.valores[id]; }); origem = `Valores repetidos da Nº ${ant.chave}`; }
        p.campos.forEach((c) => { if (c.padrao != null && vazio(valores[c.id])) valores[c.id] = c.padrao; });
        // hora que acompanha o relógio do aparelho até a pessoa mudar
        p.campos.filter((c) => c.agoraAoCriar).forEach((c) => { valores[c.id] = horaAgora(); horaAuto.push(c.id); });
        if (p.vemDe) {
          const base = pegar(data, p.vemDe.prancheta, chave);
          if (base) {
            Object.entries(p.vemDe.campos).forEach(([meu, dela]) => { if (!vazio(base.valores[dela])) { valores[meu] = base.valores[dela]; horaAuto = horaAuto.filter((x) => x !== meu); } });
            origem = `Valores vindos da ${prancheta(p.vemDe.prancheta).nome}, dorna Nº ${chave}`;
          }
        }
      }
      if (!r && p.tipo === 'insumo') valores.unidade = p.unidade;
      if (p.tipo === 'grade') { const t = turnoDaHora(chave, turnosDaPrancheta(v.pid)); const o = pegar(data, v.pid, 'obs' + t.id); extras.obs = o ? o.valores.texto || '' : ''; }
      if (p.tipo === 'insumo') { const m = pegar(data, v.pid, 'meta'); extras.meta = m ? Object.assign({}, m.valores) : {}; }
    }
    // um rascunho novo com valores sugeridos não conta como "mudado" até a pessoa mexer
    // guarda o dia e quem abriu: se o turno trocar ou a folha virar às 07:00 no meio da anotação, salva no dia e no nome certos
    rascunho = { chaveView, fonte, chave, data, operador: operadorAtual(), novo, origem, valores, extras, horaAuto, ciclo, tocados: {}, original: JSON.parse(JSON.stringify(valores)), originalExtras: JSON.stringify(extras) };
    return { p, data, chave };
  }

  function montarAlvos(p, chave) {
    const val = rascunho.valores;
    const dia = rascunho.data || dataProducao();
    // versão 2.12: a unidade é a do dia da folha (a troca vale a partir do dia em que foi feita)
    const campo = (c) => Object.assign({}, c, { unidade: window.Folhas.unidadeNoDia(c, dia) || undefined, opcoes: c.type === 'choice' ? opcoesDe(c) : c.opcoes, get: () => val[c.id], set: (x) => { val[c.id] = x; } });
    // o quadro que o dono escondeu do operador não aparece no tablet do setor (o tablet chefe vê)
    const visivel = (c) => !c.arquivado && (ehCentral() || !c.oculto);
    if (p.tipo === 'fermentacao') return p.campos.filter(visivel).map(campo);
    if (p.tipo === 'medicao') {
      if (chave === 'param') return p.parametros.filter(visivel).map(campo);
      const g = grupoDaMedicao(chave);
      if (!g) return [];
      const lista = [{ id: 'hora', label: 'Hora da medição', labelCurto: 'Hora', type: 'time', get: () => val.hora, set: (x) => { val.hora = x; } }];
      const num = (x) => fmtNum(String(x));
      g.dornas.forEach((d) => {
        const idF = d.id + '_folga';
        // o número da dorna vai em cada quadro ("Folga Nº 7"), para saber de qual dorna é olhando um quadro só
        const n = /^Dorna (\d+)$/.exec(d.nome);
        const marca = n ? ` Nº ${n[1]}` : '';
        lista.push({
          id: idF, dornaId: d.id, label: `${d.nome}: folga`, labelCurto: 'Folga' + marca, type: 'num', dec: 2, unidade: 'm', min: 0,
          avisos: temMedida(d) ? [{ quando: '>', valor: Number(d.altura), nivel: 'alerta', texto: `Folga maior que a altura da dorna (${num(d.altura)} m)`, curto: 'Maior que a dorna' }] : [],
          dica: temMedida(d) ? `${d.nome}: altura ${num(d.altura)} m, base ${num(d.area)} m². Volume = (altura − folga) × base${emM3(g) ? ', em m³' : ' × 1000'}.` : `${d.nome} está sem medida: o escritório cadastra em Configurações da usina.`,
          // o volume aparece do lado da folga, na hora
          calculo: () => { const vol = volumeDe(d, val[idF], g); return vol != null ? volumeTexto(vol, g, true) : !vazio(val[idF]) && !temMedida(d) ? 'sem medida' : ''; },
          get: () => val[idF], set: (x) => { val[idF] = x; },
        });
        if (g.brix) lista.push({ id: d.id + '_brix', dornaId: d.id, label: `${d.nome}: Brix`, labelCurto: 'Brix' + marca, type: 'num', dec: 1, min: 0, max: 40, get: () => val[d.id + '_brix'], set: (x) => { val[d.id + '_brix'] = x; } });
        if (g.fermentando) lista.push({ id: d.id + '_ferm', dornaId: d.id, label: `${d.nome}: fermentando?`, labelCurto: 'Fermentando' + marca, type: 'choice', opcoes: ['Sim', 'Não'], get: () => val[d.id + '_ferm'], set: (x) => { val[d.id + '_ferm'] = x; } });
      });
      return lista;
    }
    if (p.tipo === 'dornas') {
      const ordem = p.grupos ? p.grupos.flatMap((g) => g.campos) : p.campos.map((c) => c.id);
      return ordem.map((id) => p.campos.find((c) => c.id === id)).filter(Boolean).filter(visivel).map(campo);
    }
    if (p.tipo === 'grade') {
      const t = turnoDaHora(chave, turnosDaPrancheta(view().pid));
      return [...p.itens.filter(visivel).map(campo), { id: 'obs', label: `Observação do ${t.nome}`, type: 'text', largo: true, get: () => rascunho.extras.obs, set: (x) => { rascunho.extras.obs = x; } }];
    }
    if (p.tipo === 'juntas') {
      return p.partes.map((pt) => {
        const folha = prancheta(pt.prancheta);
        const item = val[pt.prancheta];
        return {
          id: pt.prancheta, label: folha.nome, type: 'num', dec: 2, unidades: folha.unidades,
          dica: `Quanto de ${folha.nome} foi colocado às ${rotuloHoraPapel(chave)}.`,
          get: () => item.qtd, set: (x) => { item.qtd = x; }, getUnidade: () => item.unidade || folha.unidade, setUnidade: (u) => { item.unidade = u; },
        };
      });
    }
    const lista = [{ id: 'qtd', label: p.rotuloQtd || 'Quantidade adicionada', type: 'num', dec: 2, unidades: p.unidades, get: () => val.qtd, set: (x) => { val.qtd = x; }, getUnidade: () => val.unidade || p.unidade, setUnidade: (u) => { val.unidade = u; } }];
    if (p.somaPesagens) Object.assign(lista[0], pesagensNaHora(val)); // ralo: vários bags na mesma hora (setores/ralo/regras.js)
    (p.camposOperador || []).filter(visivel).forEach((c) => {
      if (c.opcional && !opcoesDe(c).length) return;
      lista.push(campo(c));
    });
    if (ehCentral()) {
      p.camposEscritorio.filter((c) => !operadorPreenche(p, c.id)).forEach((c) => lista.push({ id: c.id, label: c.label, type: 'text', get: () => val[c.id], set: (x) => { val[c.id] = x; } }));
      lista.push({ id: 'operador', label: 'Nome operador', type: 'text', get: () => rascunho.extras.operador, set: (x) => { rascunho.extras.operador = x; } });
      lista.push({ id: 'meta_lote', label: 'Lote da folha', type: 'text', get: () => rascunho.extras.meta.lote, set: (x) => { rascunho.extras.meta.lote = x; } });
      lista.push({ id: 'meta_verificado', label: 'Verificado por', type: 'text', get: () => rascunho.extras.meta.verificado, set: (x) => { rascunho.extras.meta.verificado = x; } });
    }
    return lista;
  }

  /** Pranchetas que aparecem nas abas. No tablet chefe as telas "juntas" abrem separadas, para o escritório completar cada folha. */
  function pranchetasDasAbas(setorId) {
    const lista = pranchetasDo(setorId);
    return ehCentral() ? lista.flatMap(folhasDe) : lista;
  }
  /** Abas com as pranchetas do setor. A casinha leva de volta para o painel. */
  function abasDoSetor(v) {
    const s = setorDaPrancheta(v.pid);
    const inicio = ehCentral()
      ? `<button class="casa" data-a="painel">${ico('casa')}<span>Painel</span></button>`
      : `<button class="casa" data-a="inicio-setor">${ico('casa')}<span>Início</span></button>`;
    return `<div class="abas">${inicio}${pranchetasDasAbas(s.id).map((pid) => `<button class="${pid === v.pid ? 'sel' : ''}" data-a="aba" data-id="${pid}">${esc(prancheta(pid).nome)}</button>`).join('')}</div>`;
  }
  /** Setas para andar a folha para o lado (aparecem só quando a tabela não cabe na tela). */
  const setasDaFolha = () => `<span class="rolar-folha"><button class="btn pequeno" data-a="rolar-folha" data-dir="-1" aria-label="Rolar a folha para a esquerda">${ico('voltar')}</button><button class="btn pequeno" data-a="rolar-folha" data-dir="1" aria-label="Rolar a folha para a direita">${ico('seta')}</button></span>`;
  /** Botão da folha: inteira na tela (letra menor) ou no tamanho normal (rola com o dedo). */
  const botaoCaber = () => `<button class="btn pequeno" data-a="caber-folha">${ico(cfg.folhaNormal ? 'telaCheia' : 'mais')} ${cfg.folhaNormal ? 'Folha inteira' : 'Letra maior'}</button>`;
  const cabecalhoFolha = (p, data) => `<div class="folha-cab"><div><b>${esc(p.titulo || p.nome)}</b><span>${esc(p.codigo)}. ${esc(C.empresa)}. Data ${fmtData(data)}</span></div><span class="botoes-folha">${botaoCaber()}${setasDaFolha()}</span></div>`;
  /** Folha inteira: a tabela diminui até caber na largura da tela (sem ficar pequena demais para ler). */
  function caberFolhas() {
    app.querySelectorAll('.folha .tabela-wrap').forEach((w) => {
      const t = w.querySelector('table');
      if (!t) return;
      t.style.zoom = '';
      if (cfg.folhaNormal) return;
      const largura = t.scrollWidth;
      if (largura > w.clientWidth + 2) t.style.zoom = Math.max(0.5, (w.clientWidth - 2) / largura).toFixed(3);
    });
    marcarFolhasLargas();
  }
  function marcarFolhasLargas() {
    app.querySelectorAll('.folha').forEach((f) => {
      const w = f.querySelector('.tabela-wrap');
      f.classList.toggle('larga', !!w && w.scrollWidth > w.clientWidth + 2);
    });
  }
  const classeCelula = (c, x) => nivelDe(c, x);

  function seletorDeHoras(chave, hoje, feitaNaHora, legendaDaHora, conferirNaHora) {
    const hAgora = new Date().getHours();
    return `<div class="seletor">${HORAS.map((h) => {
      const feita = feitaNaHora(h);
      const cls = h === chave ? 'sel' : conferirNaHora && conferirNaHora(h) ? 'atual' : hoje && h === hAgora && !feita ? 'atual' : feita ? 'feita' : '';
      const legenda = feita ? legendaDaHora(h) : hoje && h === hAgora ? 'agora' : '';
      return `<button data-a="linha" data-chave="${h}" class="${cls}" ${h === chave ? 'data-rolar-para' : ''}>${pad2(h)}h<small>${esc(legenda)}</small></button>`;
    }).join('')}</div>`;
  }

  /* ---------- Volume de vinho: a folha do dia e os totais ---------- */
  function totaisMedicaoHtml(data, chave) {
    const med = medicaoDoDia(data, chave !== 'param' && rascunho ? { grupo: chave, valores: rascunho.valores } : null);
    const x = med.grupos.find((y) => y.g.id === chave);
    const parte = x && !x.g.soma ? `${esc(x.g.nome)}: <b>${volumeTexto(x.subtotal, x.g)}</b>` : x ? `Subtotal: <b>${litros(x.subtotal)}</b>` : '';
    return `${parte ? `<span class="par-total">${parte}</span>` : ''}<span class="par-total">Vinho da produção: <b>${litros(med.producao)}</b></span>`;
  }
  function folhaMedicaoHtml(p, data, chave) {
    const med = medicaoDoDia(data);
    const num = (x) => (vazio(x) ? '' : esc(fmtNum(x)));
    return `<div class="folha">${cabecalhoFolha(p, data)}<div class="tabela-wrap"><table class="papel medicao">
      <thead><tr><th>Dornas</th><th>Folga (m)</th><th>Volume</th><th>Brix</th><th>Fermentando</th></tr></thead>
      <tbody>${med.grupos.map((x) => `<tr class="grupo-linha clicavel ${x.g.id === chave ? 'sel' : ''}" data-a="linha" data-chave="${x.g.id}"><td colspan="5"><b>${esc(x.g.nome)}</b>${x.hora && x.medidas ? ` <span>medido às ${esc(x.hora)}${x.operador ? ` por ${esc(x.operador)}` : ''}</span>` : ''}</td></tr>
        ${x.linhas.map((l) => `<tr class="clicavel" data-a="linha" data-chave="${x.g.id}"><td>${esc(l.d.nome)}</td><td>${num(l.folga)}</td><td><b>${l.volume == null ? (vazio(l.folga) || temMedida(l.d) ? '' : 'sem medida') : esc(volumeTexto(l.volume, x.g))}</b></td><td>${x.g.brix ? num(l.brix) : ''}</td><td>${x.g.fermentando ? esc(l.ferm || '') : ''}</td></tr>`).join('')}
        <tr class="subtotal"><td>Subtotal</td><td></td><td><b>${esc(volumeTexto(x.subtotal, x.g))}</b></td><td colspan="2"></td></tr>`).join('')}
        <tr class="total"><td>Total geral de vinho da produção</td><td></td><td><b>${esc(litros(med.producao))}</b></td><td colspan="2"></td></tr>
        <tr class="total"><td>Total nos tanques de álcool</td><td></td><td><b>${esc(volumeTexto(med.tanques, gruposDaMedicao().find((y) => !y.soma)))}</b></td><td colspan="2"></td></tr></tbody>
    </table></div></div>
    <div class="folha" style="margin-top:12px"><div class="folha-cab"><div><b>Parâmetros da produção</b><span>Favor verificar e anotar diariamente</span></div></div><div class="tabela-wrap"><table class="papel">
      <thead><tr><th></th><th>Brix</th><th>Horário</th></tr></thead>
      <tbody>${[['Brix no ralo', 'brix_ralo', 'hora_ralo'], ['Brix na hidrólise', 'brix_hid', 'hora_hid'], ['Brix na fermentação', 'brix_ferm', 'hora_ferm']].map(([rot, b, h]) => `<tr class="clicavel" data-a="linha" data-chave="param"><td>${rot}</td><td>${num(med.param[b])}</td><td>${esc(med.param[h] || '')}</td></tr>`).join('')}</tbody>
    </table></div></div>`;
  }

  /* ---------- Dornas de fermentação: o cartão da dorna e a folha do dia ---------- */
  const diaCurto = (iso) => fmtData(iso).slice(0, 5);
  function cartaoDaDorna(n, r) {
    const et = etapaFerm(r);
    const partes = [];
    if (et !== 'vazia') {
      const v = r.valores;
      partes.push(`<p>${ico('tanque')} Enchida em <b>${diaCurto(r.data)}</b>${r.operador ? ` por <b>${esc(r.operador)}</b>` : ''}${v.enche_inicio ? `, das ${esc(v.enche_inicio)}${v.enche_fim ? ` às ${esc(v.enche_fim)}` : ' (ainda enchendo)'}` : ''}. Brix inicial <b>${vazio(v.brix_inicial) ? 'não anotado' : esc(fmtNum(v.brix_inicial))}</b>.</p>`);
      const m = medicaoDaDorna(n, r);
      partes.push(m ? `<p>${ico('regua')} ${m.data === dataProducao() ? 'Hoje' : `Em ${diaCurto(m.data)}`}${m.hora ? `, ${esc(m.hora)}` : ''}: Brix <b>${vazio(m.brix) ? 'não anotado' : esc(fmtNum(m.brix))}</b> · <b>${m.volume == null ? 'volume não medido' : litros(m.volume, true)}</b>${m.ferm ? ` · Fermentando: <b>${esc(m.ferm)}</b>` : ''}</p>`
        : `<p class="apagado">${ico('regua')} Ainda não foi medida depois de encher. A medição da manhã é na folha Volume de vinho.</p>`);
      const vol = v.volante || [];
      if (vol.length) partes.push(`<p>${ico('enviar')} Volante: ${vol.map((s) => `${diaCurto(s.data)} das ${esc(s.inicio)}${s.fim ? ` às ${esc(s.fim)}` : ' até agora'}${s.operador ? ` (${esc(s.operador)})` : ''}`).join('; ')}</p>`);
    } else {
      const ult = r && r.valores.esvaziada;
      partes.push(`<p>${ico('tanque')} Dorna vazia.${ult ? ` Esvaziou em ${diaCurto(ult.data)} às ${esc(ult.hora)}.` : ''}${ehCentral() ? '' : ' Quando começar a encher, toque em Começar a encher.'}</p>`);
    }
    return `<section class="cartao-dorna etapa-${et.replace(' ', '-')}"><h3>Dorna Nº ${n} <em>${esc(NOME_ETAPA[et])}</em></h3>${partes.join('')}</section>`;
  }
  function folhaFermentacaoHtml(p, data, chave) {
    const linhas = fermentacaoDoDia(data);
    return `<div class="folha">${cabecalhoFolha(p, data)}<div class="tabela-wrap"><table class="papel">
      <thead><tr><th>Dorna</th><th>Enchida</th><th>Início</th><th>Fim</th><th>Brix inicial</th><th>Operador</th><th>Medição</th><th>Brix</th><th>Volume (L)</th><th>Fermentando</th><th>Volante no dia</th><th>Esvaziou</th></tr></thead>
      <tbody>${linhas.map((l) => {
        const m = l.medicao;
        return `<tr class="clicavel ${l.n === chave ? 'sel' : ''}" data-a="linha" data-chave="${l.n}"><td><b>${l.n}</b></td>
          ${l.ciclo ? `<td>${diaCurto(l.enchidaEm)}</td><td>${esc(l.inicio)}</td><td>${esc(l.fim) || '<span class="aberta">enchendo</span>'}</td><td>${esc(fmtNum(l.brixInicial))}</td><td>${esc(l.operador)}</td>
          <td>${m ? `${diaCurto(m.data)} ${esc(m.hora)}` : ''}</td><td>${m ? esc(fmtNum(m.brix)) : ''}</td><td>${m && m.volume != null ? esc(litros(m.volume).replace(' L', '')) : ''}</td><td>${m ? esc(m.ferm || '') : ''}</td>` : '<td colspan="9" class="dorna-vazia">vazia</td>'}
          <td>${esc(l.volante.map((s) => `${s.inicio}-${s.fim || '...'}${s.operador ? ' ' + s.operador : ''}`).join('; '))}</td>
          <td>${l.esvaziou ? `${diaCurto(l.esvaziou.data)} ${esc(l.esvaziou.hora)}` : ''}</td></tr>`;
      }).join('')}</tbody>
    </table></div></div>`;
  }

  function telaPrancheta(v) {
    aoAtualizarEdicao = null;
    const { p, data, chave } = prepararRascunho(v);
    const hoje = data === dataProducao();
    const hAgora = new Date().getHours();
    alvos = montarAlvos(p, chave);
    // a folha do dia (tabela do monitoramento) só é montada quando alguém abre o monitoramento
    let seletor = '', cabecalhoForm = '', folha = () => '', rotuloSalvar = '', grupos = p.grupos, etapa = '', antesDosQuadros = '';
    const origem = rascunho.novo && rascunho.origem ? `<span class="aviso">${esc(rascunho.origem)}</span>` : '';

    if (p.tipo === 'medicao') {
      const med = medicaoDoDia(data);
      const g = grupoDaMedicao(chave);
      contextoEdicao = chave === 'param' ? 'Brix da produção' : g ? g.nome : '';
      const chips = [...med.grupos.map((x) => ({ id: x.g.id, nome: x.g.nome, leg: x.medidas ? `${x.medidas} de ${x.g.dornas.length}` : '' })),
        { id: 'param', nome: 'Brix da produção', leg: pegar(data, v.pid, 'param') ? 'anotado' : '' }];
      seletor = `<div class="seletor">${chips.map((x) => `<button data-a="linha" data-chave="${x.id}" class="${x.id === chave ? 'sel' : x.leg ? 'feita' : ''}" ${x.id === chave ? 'data-rolar-para' : ''}>${esc(x.nome)}<small>${esc(x.leg)}</small></button>`).join('')}</div>`;
      const reg = pegar(data, v.pid, chave);
      cabecalhoForm = `${reg ? `<span class="aviso ok">${ico('certo')} Anotado por ${esc(reg.operador || 'sem nome')}</span>` : `<span class="aviso">${chave === 'param' ? 'Anote o Brix e o horário' : 'Digite a folga medida com a trena: o volume aparece na hora'}</span>`}
        <span class="aviso info" id="totais-medicao">${totaisMedicaoHtml(data, chave)}</span>`;
      aoAtualizarEdicao = () => { const el = document.getElementById('totais-medicao'); if (el) el.innerHTML = totaisMedicaoHtml(data, chave); };
      grupos = chave === 'param'
        ? [{ titulo: 'Ralo', campos: ['brix_ralo', 'hora_ralo'] }, { titulo: 'Hidrólise', campos: ['brix_hid', 'hora_hid'] }, { titulo: 'Fermentação', campos: ['brix_ferm', 'hora_ferm'] }]
        : [{ titulo: 'Hora da medição', campos: ['hora'] }, ...(g ? g.dornas : []).map((d) => ({ titulo: d.nome, campos: alvos.filter((a) => a.dornaId === d.id).map((a) => a.id) }))];
      rotuloSalvar = `Salvar ${contextoEdicao}`;
      folha = () => folhaMedicaoHtml(p, data, chave);
    } else if (p.tipo === 'fermentacao') {
      const r = cicloAtual(chave);
      etapa = etapaFerm(r);
      contextoEdicao = `dorna Nº ${chave}`;
      seletor = `<div class="seletor">${dornasDeFermentacao().map(({ n }) => {
        const et = etapaFerm(cicloAtual(n));
        return `<button data-a="linha" data-chave="${n}" class="${n === chave ? 'sel' : et === 'enchendo' || et === 'volante' ? 'atual' : et === 'vazia' ? '' : 'feita'}" ${n === chave ? 'data-rolar-para' : ''}>Nº ${n}<small>${esc(NOME_ETAPA[et])}</small></button>`;
      }).join('')}</div>`;
      const vol = naVolante();
      const status = {
        vazia: `<span class="aviso">Nº ${chave} vazia</span>`,
        enchendo: `<span class="aviso atencao">${ico('tanque')} Enchendo desde ${esc((r && r.valores.enche_inicio) || '')}${r && r.operador ? ` · ${esc(r.operador)}` : ''}</span>`,
        fermentando: `<span class="aviso ok">${ico('certo')} Fermentando</span>`,
        volante: `<span class="aviso info">${ico('enviar')} Mandando para a volante</span>`,
        'com vinho': `<span class="aviso ok">${ico('certo')} Com vinho (já mandou uma parte)</span>`,
      }[etapa];
      cabecalhoForm = `${status}<span class="aviso ${vol.length ? 'info' : ''}" id="volante-agora">Volante: ${vol.length ? esc(vol.map((s) => `Nº ${s.n} desde ${s.inicio}${s.operador ? ` (${s.operador})` : ''}`).join(', ')) : 'parada'}</span>
        ${etapa === 'com vinho' && anotaComoSetor(v.pid) ? `<button class="btn pequeno" data-a="ferm-esvaziou">${ico('certo')} Dorna vazia</button>` : ''}
        ${r && etapa !== 'vazia' ? `<button class="btn pequeno perigo" data-a="ferm-apagar">${ico('lixeira')} Apagar este enchimento</button>` : ''}`;
      grupos = [{ titulo: 'Enchimento', campos: ['enche_inicio', 'enche_fim'] }, { titulo: 'Brix', campos: ['brix_inicial'] }];
      rotuloSalvar = `Salvar dorna Nº ${chave}`;
      antesDosQuadros = cartaoDaDorna(chave, r);
      folha = () => folhaFermentacaoHtml(p, data, chave);
    } else if (p.tipo === 'dornas') {
      const linhas = dornasDoDia(data, v.pid);
      const proximo = linhas.length ? Math.max(...linhas.map((r) => Number(r.chave))) + 1 : 1;
      const regAtual = pegar(data, v.pid, chave);
      etapa = etapaDaDorna(p, regAtual);
      // outra dorna ainda indo para cima: dá para marcar que terminou sem sair desta
      const indo = p.envio && !ehCentral() ? linhas.filter((r) => Number(r.chave) !== chave && etapaDaDorna(p, r) === 'enviando') : [];
      contextoEdicao = `${p.rotulo.toLowerCase()} Nº ${chave}`;
      // a "Nova Nº" fica numa caixa própria, à direita: sempre à vista, mesmo com muitas dornas no dia
      seletor = `<div class="seletor-dornas"><div class="seletor">${linhas.map((r) => {
          const n = Number(r.chave); const et = etapaDaDorna(p, r);
          const cls = n === chave ? 'sel' : et === 'enchendo' ? 'atual' : et === 'enviando' ? 'enviando' : 'feita';
          return `<button data-a="linha" data-chave="${n}" class="${cls}" ${n === chave ? 'data-rolar-para' : ''}>Nº ${n}<small>${et}</small></button>`;
        }).join('')}</div>
        ${proximo <= p.maxLinhas ? `<div class="seletor seletor-nova"><button data-a="linha" data-chave="${proximo}" class="${chave === proximo ? 'sel' : 'nova'}">${ico('mais')} Nova Nº ${proximo}</button></div>` : ''}</div>`;
      const quem = esc(rascunho.extras.operador || 'sem nome');
      let status;
      if (!regAtual) status = origem || `<span class="aviso">${p.envio ? 'Dorna nova: anote enquanto ela enche' : 'Toque nos quadros para anotar'}</span>`;
      else if (etapa === 'enchendo') status = `<span class="aviso atencao">${ico('tanque')} Enchendo · ${quem}</span>`;
      else if (etapa === 'enviando') status = `<span class="aviso info">${ico('enviar')} Enviando para cima desde ${esc(regAtual.valores[p.envio.inicio])}</span>`;
      else status = `<span class="aviso ok">${ico('certo')} Anotada por ${quem}</span>`;
      let ligacao = '';
      if (p.vemDe) {
        const base = pegar(data, p.vemDe.prancheta, chave);
        const manuais = (regAtual && regAtual.manuais) || [];
        const nomeBase = prancheta(p.vemDe.prancheta).nome;
        if (base && manuais.length) {
          const nomes = manuais.map((id) => (p.campos.find((c) => c.id === id) || { label: id }).label).join(', ');
          ligacao = `<span class="aviso atencao">${esc(nomes)} mudado aqui</span><button class="btn pequeno" data-a="copiar-vemde">${ico('seta')} Copiar da ${esc(nomeBase)}</button>`;
        } else if (base && regAtual) ligacao = `<span class="aviso">${ico('certo')} Acompanha a ${esc(nomeBase)}, dorna Nº ${chave}</span>`;
      }
      cabecalhoForm = `${status}${ligacao}
        ${indo.map((r) => `<button class="btn pequeno atencao" data-a="terminar-dorna" data-chave="${r.chave}">${ico('fim')} Terminou a Nº ${r.chave}</button>`).join('')}
        ${regAtual ? `<button class="btn pequeno perigo" data-a="apagar-linha">${ico('lixeira')} Apagar a Nº ${chave}</button>` : ''}`;
      rotuloSalvar = `Salvar ${p.rotulo.toLowerCase()} Nº ${chave}`;
      folha = () => `<div class="folha">${cabecalhoFolha(p, data)}<div class="tabela-wrap"><table class="papel">
        <thead><tr><th>Nº</th>${p.campos.map((c) => `<th>${esc(c.label)}</th>`).join('')}<th>Responsável</th></tr></thead>
        <tbody>${linhas.map((r) => `<tr class="clicavel ${Number(r.chave) === chave ? 'sel' : ''}" data-a="linha" data-chave="${r.chave}"><td><b>${r.chave}</b></td>
          ${p.campos.map((c) => { const x = r.valores[c.id]; if (vazio(x) && p.envio && c.id === p.envio.fim) return `<td class="aberta">${etapaDaDorna(p, r)}</td>`; return `<td class="${classeCelula(c, x)}">${esc(fmtCampo(c, x))}</td>`; }).join('')}
          <td>${esc(r.operador || '')}</td></tr>`).join('')}
          ${!linhas.length ? `<tr><td colspan="${p.campos.length + 2}" class="vazia">A folha de hoje ainda está em branco.</td></tr>` : ''}</tbody></table></div></div>`;
    } else if (p.tipo === 'juntas') {
      const regsPorParte = p.partes.map((pt) => { const m = {}; linhasDeHora(listar(data, pt.prancheta)).forEach((r) => { if (!vazio(r.valores.qtd)) m[r.chave] = r; }); return m; });
      const conferirNa = (h) => regsPorParte.some((m) => m[h] && m[h].conferir);
      contextoEdicao = `${p.nome}, ${rotuloHoraPapel(chave)}`;
      seletor = seletorDeHoras(chave, hoje, (h) => regsPorParte.some((m) => m[h]), (h) => (conferirNa(h) ? 'conferir' : 'feita'), conferirNa);
      const auto = regsPorParte.map((m) => m[chave]).filter((r) => r && r.conferir);
      const dornasAuto = [...new Set(auto.flatMap((r) => r.dornas || []))].sort((a, b) => a - b);
      if (auto.length) cabecalhoForm = `<span class="aviso atencao">${ico('alerta')} Somado da${dornasAuto.length > 1 ? 's' : ''} dorna${dornasAuto.length > 1 ? 's' : ''} Nº ${listaE(dornasAuto)}. Confira e confirme.</span>`;
      else cabecalhoForm = rascunho.novo ? (origem || '<span class="aviso">Anote quanto foi colocado</span>') : `<span class="aviso ok">${ico('certo')} Anotado por ${esc(rascunho.extras.operador || 'sem nome')}</span>`;
      rotuloSalvar = `${auto.length ? 'Confirmar' : 'Salvar'} ${p.nome} das ${rotuloHoraPapel(chave)}`;
      grupos = [{ titulo: `Quantidades das ${rotuloHoraPapel(chave)}`, campos: p.partes.map((pt) => pt.prancheta) }];
      folha = () => `<div class="folha"><div class="folha-cab"><div><b>${esc(p.nome)}</b><span>${esc(p.codigo)}. Cada coluna é uma folha separada no Excel. Data ${fmtData(data)}</span></div><span class="botoes-folha">${botaoCaber()}${setasDaFolha()}</span></div>
        <div class="tabela-wrap"><table class="papel">
          <thead><tr><th>Horas</th>${p.partes.map((pt) => `<th>${esc(prancheta(pt.prancheta).nome)}</th>`).join('')}<th>Nome operador</th></tr></thead>
          <tbody>${HORAS.map((h) => {
            const regs = regsPorParte.map((m) => m[h]);
            const op = (regs.find(Boolean) || {}).operador || '';
            return `<tr class="clicavel ${h === chave ? 'sel' : ''}" data-a="linha" data-chave="${h}"><td class="${hoje && h === hAgora ? 'agora' : ''}"><b>${rotuloHoraPapel(h)}</b></td>
              ${regs.map((r) => `<td><b>${r ? `${esc(fmtNum(r.valores.qtd))} ${esc(r.valores.unidade || '')}` : ''}</b></td>`).join('')}<td>${esc(op)}</td></tr>`;
          }).join('')}
          <tr><td><b>Total</b></td>${p.partes.map((pt) => `<td><b>${esc(totalInsumo(linhasDeHora(listar(data, pt.prancheta))) || '0')}</b></td>`).join('')}<td></td></tr></tbody>
        </table></div></div>`;
    } else if (p.tipo === 'grade') {
      const porHora = {};
      linhasDeHora(listar(data, v.pid)).forEach((r) => { porHora[r.chave] = r; });
      contextoEdicao = `leitura das ${rotuloHora(chave)}`;
      seletor = seletorDeHoras(chave, hoje, (h) => !!porHora[h], () => 'feita');
      const reg = porHora[chave];
      cabecalhoForm = `<span class="aviso">${esc(turnoDaHora(chave, turnosDaPrancheta(v.pid)).nome)}</span>${reg ? `<span class="aviso ok">${ico('certo')} Anotada por ${esc(reg.operador || 'sem nome')}</span>` : ''}`;
      rotuloSalvar = `Salvar leitura das ${rotuloHora(chave)}`;
      const regs = listar(data, v.pid);
      folha = () => `<div class="turnos">${turnosDaPrancheta(v.pid).map((t) => {
          const nomes = [...new Set(linhasDeHora(regs).filter((r) => turnoDaHora(Number(r.chave), turnosDaPrancheta(v.pid)).id === t.id).map((r) => r.operador).filter(Boolean))];
          const obs = pegar(data, v.pid, 'obs' + t.id);
          return `<div class="turno"><h3>${esc(t.nome)}, ${faixaTurno(t)}</h3><p><span>Operador:</span> ${esc(nomes.join(', ') || 'ninguém anotou')}</p><p><span>Observação:</span> ${esc(obs && obs.valores.texto ? obs.valores.texto : 'nenhuma')}</p></div>`;
        }).join('')}</div>
        <div class="folha" style="margin-top:12px">${cabecalhoFolha(p, data)}<div class="tabela-wrap"><table class="papel">
          <thead><tr><th class="lateral">Itens / Horas</th>${HORAS.map((h) => `<th class="${h === chave ? 'sel' : ''} ${hoje && h === hAgora ? 'agora' : ''}">${h}</th>`).join('')}</tr></thead>
          <tbody>${p.itens.map((c) => `<tr><td class="lateral">${esc(c.label)}</td>${HORAS.map((h) => { const x = porHora[h] ? porHora[h].valores[c.id] : ''; return `<td class="clicavel ${classeCelula(c, x)} ${h === chave ? 'sel' : ''}" data-a="linha" data-chave="${h}">${esc(fmtCampo(c, x))}</td>`; }).join('')}</tr>`).join('')}</tbody>
        </table></div></div>`;
    } else {
      const porHora = {};
      linhasDeHora(listar(data, v.pid)).forEach((r) => { porHora[r.chave] = r; });
      contextoEdicao = `${p.nome}, ${rotuloHoraPapel(chave)}`;
      seletor = seletorDeHoras(chave, hoje, (h) => porHora[h] && !vazio(porHora[h].valores.qtd), (h) => `${fmtNum(porHora[h].valores.qtd)} ${porHora[h].valores.unidade || ''}`);
      const reg = porHora[chave];
      cabecalhoForm = reg && !vazio(reg.valores.qtd) ? `<span class="aviso ok">${ico('certo')} Anotado por ${esc(reg.operador || 'sem nome')}</span>` : `<span class="aviso">${p.rotuloQtd ? `Anote o ${esc(p.rotuloQtd.toLowerCase())}` : 'Anote quanto foi colocado'}</span>`;
      rotuloSalvar = `Salvar ${p.nome} das ${rotuloHoraPapel(chave)}`;
      const meta = (pegar(data, v.pid, 'meta') || { valores: {} }).valores;
      const extras = extrasOperador(p);
      folha = () => `<div class="folha">${cabecalhoFolha(p, data)}
        <div class="folha-cab"><span>Lote: <b>${esc(meta.lote || 'o escritório preenche')}</b></span><span>Verificado por: <b>${esc(meta.verificado || 'o escritório preenche')}</b></span></div>
        <div class="tabela-wrap"><table class="papel">
          <thead><tr><th>Horas</th><th>${esc(p.rotuloQtd || 'Quant. adicionada')}</th>${extras.map((c) => `<th>${esc(c.label)}</th>`).join('')}<th>Nome operador</th>${p.camposEscritorio.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr></thead>
          <tbody>${HORAS.map((h) => { const r = porHora[h]; const x = r ? r.valores : {};
            return `<tr class="clicavel ${h === chave ? 'sel' : ''}" data-a="linha" data-chave="${h}"><td class="${hoje && h === hAgora ? 'agora' : ''}"><b>${rotuloHoraPapel(h)}</b></td>
              <td><b>${vazio(x.qtd) ? '' : `${esc(fmtNum(x.qtd))} ${esc(x.unidade || '')}`}</b></td>
              ${extras.map((c) => `<td>${esc(x[c.id] || '')}</td>`).join('')}
              <td>${esc(r ? r.operador || '' : '')}</td>
              ${p.camposEscritorio.map((c) => `<td class="${operadorPreenche(p, c.id) ? '' : 'escritorio'}">${esc(x[c.id] || '')}</td>`).join('')}</tr>`; }).join('')}
            <tr><td><b>Total</b></td><td><b>${esc(totalInsumo(linhasDeHora(listar(data, v.pid))) || '0')}</b></td><td colspan="${p.camposEscritorio.length + extras.length + 1}"></td></tr></tbody>
        </table></div></div>`;
    }

    const subtituloTopo = subtituloDaFolha(data);

    // Monitoramento: a folha do dia inteira, fora da tela de anotar
    if (v.monitor) {
      // versão 2.13: dia anterior e próximo; no tablet do setor, dia anterior é só para consultar
      const diaHoje = dataProducao();
      const navDia = `<div class="nav-data nav-monitor"><button class="btn" data-a="monitor-dia" data-n="-1" aria-label="Dia anterior">${ico('voltar')}</button>
        <div class="data-grande"><b>${fmtData(data).slice(0, 5)}</b><span>${data === diaHoje ? 'hoje' : diaSemana(data)}</span></div>
        <button class="btn" data-a="monitor-dia" data-n="1" aria-label="Próximo dia" ${data >= diaHoje ? 'disabled' : ''}>${ico('seta')}</button></div>`;
      return `${cabecalho(p.nome, subtituloTopo, false, atalhosOperador())}
        <div class="edicao"><div class="coluna"><div class="barra-trabalho"><div class="linha-monitor">${abasDoSetor(v)}${navDia}</div></div><main>
          <p class="sub" style="margin:2px 0 10px">${soConsulta() ? `Folha de ${fmtData(data)}: só para consultar (corrigir pede a função Corrigir).` : hoje || ehCentral() ? 'Toque em uma linha para abrir e corrigir.' : `Folha de ${fmtData(data)}: só para consultar.`}</p>
          ${folha()}</main>
        ${soConsulta() ? '' : `<div class="rodape"><button class="btn primario" data-a="monitor">${ico('voltar')} Voltar para anotar</button></div>`}</div></div>`;
    }

    const fixoTopo = `${abasDoSetor(v)}${seletor}${cabecalhoForm ? `<div class="cabecalho-form">${cabecalhoForm}</div>` : ''}`;
    let quadros = blocosDeQuadros(grupos, alvos);
    // medição: cada dorna tem folga, Brix e fermentando lado a lado, então o bloco precisa de mais largura
    if (p.tipo === 'medicao') quadros = quadros.replace('<div class="grupos">', '<div class="grupos grupos-largos">');
    const conteudo = antesDosQuadros + quadros;
    lembrar[`${data}|${v.pid}`] = chave;
    let rodape = `<button class="btn primario" data-a="salvar">${ico('certo')} ${esc(rotuloSalvar)}</button>`;
    if (p.tipo === 'fermentacao' && anotaComoSetor(v.pid)) {
      const [acao, icone, texto] = {
        vazia: ['ferm-encher', 'tanque', `Começar a encher Nº ${chave}`], enchendo: ['ferm-terminou', 'fim', 'Terminou de encher'],
        fermentando: ['ferm-volante', 'enviar', 'Mandar para a volante'], 'com vinho': ['ferm-volante', 'enviar', 'Mandar para a volante'], volante: ['ferm-parar', 'fim', 'Parou de mandar'],
      }[etapa];
      rodape = `<button class="btn" data-a="salvar">${ico('certo')} Salvar</button><button class="btn primario" data-a="${acao}">${ico(icone)} ${esc(texto)}</button>`;
    }
    if (p.envio && !ehCentral() && (etapa === 'nova' || etapa === 'enchendo')) {
      rodape = `<button class="btn" data-a="salvar">${ico('certo')} Salvar</button><button class="btn primario" data-a="enviar-dorna">${ico('enviar')} Enviar Nº ${chave}</button>`;
    } else if (p.envio && !ehCentral() && etapa === 'enviando') {
      rodape = `<button class="btn" data-a="salvar">${ico('certo')} Salvar</button><button class="btn primario" data-a="terminar-dorna" data-chave="${chave}">${ico('fim')} Terminou de enviar</button>`;
    }
    return `${cabecalho(p.nome, subtituloTopo, false, atalhosOperador())}${telaEdicao(conteudo, rodape, fixoTopo)}`;
  }

  /* No tablet chefe, mudar o que um operador anotou precisa da senha dele: os dois ficam sabendo da alteração.
     Operador sem senha (ou nome que não está na lista do setor): o encarregado autoriza com a senha dele.
     Linha nova e campos do escritório (NF, lote, validade, fornecedor, verificado por) não pedem senha. */
  function quemPrecisaAutorizar() {
    const v = view();
    // folhas só do tablet chefe (Vinho e Fermentação): quem anota é o escritório; a mudança fica no registro
    if (!ehCentral() || !rascunho || v.tela !== 'prancheta' || soDoChefe(v.pid)) return [];
    const p = prancheta(v.pid);
    const { data, chave } = rascunho;
    const mudou = (a, b) => JSON.stringify(a == null ? '' : a) !== JSON.stringify(b == null ? '' : b);
    const nomes = new Set();
    if (p.tipo === 'fermentacao') {
      const existente = rascunho.ciclo ? pegar(rascunho.ciclo.data, PID_FERMENTACAO, rascunho.ciclo.chave) : null;
      if (existente && existente.operador && p.campos.some((c) => mudou(rascunho.valores[c.id], rascunho.original[c.id]))) nomes.add(existente.operador);
    } else if (p.tipo === 'juntas') {
      p.partes.forEach((pt) => {
        const existente = pegar(data, pt.prancheta, chave);
        if (existente && existente.operador && mudou(rascunho.valores[pt.prancheta].qtd, rascunho.original[pt.prancheta].qtd)) nomes.add(existente.operador);
      });
    } else {
      const existente = pegar(data, v.pid, chave);
      if (existente && existente.operador) {
        const doEscritorio = new Set((p.camposEscritorio || []).filter((c) => !operadorPreenche(p, c.id)).map((c) => c.id));
        const antes = JSON.parse(rascunho.originalExtras || '{}');
        const campos = Object.keys(Object.assign({}, rascunho.valores, rascunho.original)).filter((k) => !doEscritorio.has(k) && mudou(rascunho.valores[k], rascunho.original[k]));
        if (campos.length || (p.tipo === 'grade' && mudou(rascunho.extras.obs, antes.obs)) || (p.tipo === 'insumo' && mudou(rascunho.extras.operador, antes.operador))) nomes.add(existente.operador);
      }
    }
    return [...nomes].filter((n) => n && !ehDoChefe(n));
  }
  /** Pede a senha de cada operador (ou do encarregado). Resolve true se todas estão certas. */
  async function autorizar(nomes) {
    const setor = setorDaPrancheta(view().pid);
    for (const nome of nomes) {
      const op = setor ? operadorPorNome(setor.id, nome) : null;
      const comSenha = !!(op && op.senha);
      if (!comSenha && pode('corrigir')) continue; // operador sem senha: quem entrou no tablet chefe autoriza (fica no registro)
      const s = await pedirSenhaModal(comSenha ? `Senha de ${nome}` : 'Senha do encarregado',
        comSenha ? `Para mudar o que ${nome} anotou, ${nome} digita a senha. Assim os dois ficam sabendo da alteração.` : `${nome} não tem senha cadastrada: o encarregado autoriza a alteração.`);
      if (s === undefined) return false;
      if (comSenha ? embaralharSenha(nome, s) !== op.senha : s !== C.pinAdmin) { toast('Senha errada. A alteração não foi salva.', 'erro'); return false; }
    }
    return true;
  }

  function salvarRascunho(automatico, opcoes = {}) {
    const v = view();
    if (!rascunho || v.tela !== 'prancheta') return false;
    // salvando sozinho (troca de turno, virada do dia, saiu da tela): vale o nome de quem abriu a linha
    // folha que só o tablet chefe anota (Vinho e Fermentação): vai o nome do tablet chefe
    const quem = ehCentral() ? (soDoChefe(v.pid) ? (pessoaAtual() || {}).nome || nomeDoChefe() : '') : operadorAtual() || (automatico ? rascunho.operador : null);
    if (!ehCentral() && !quem) { if (!automatico) exigeOperador(); return false; }
    // tablet chefe mudando o que um operador anotou: só com a senha dele (salvar sozinho, ao sair da tela, não vale)
    const precisaAutorizar = ehCentral() ? quemPrecisaAutorizar() : [];
    if (precisaAutorizar.length && !opcoes.autorizado) {
      toast(`A alteração não foi salva: para mudar o que ${listaE(precisaAutorizar)} anotou, toque em Salvar e digite a senha.`, 'erro');
      return false;
    }
    const marcaAlteracao = precisaAutorizar.length ? { alteradoPeloEscritorio: { em: Date.now(), autorizadoPor: precisaAutorizar, por: (pessoaAtual() || {}).nome || '' } } : {};
    const novoAntes = !!rascunho.novo;
    const p = prancheta(v.pid);
    const data = rascunho.data;
    const chave = rascunho.chave;

    if (p.tipo === 'medicao') {
      const existente = pegar(data, v.pid, chave);
      const g = grupoDaMedicao(chave);
      // o volume vai junto (se a medida da dorna mudar depois, o que já foi medido continua igual)
      if (g) g.dornas.forEach((d) => { const vol = volumeDe(d, rascunho.valores[d.id + '_folga'], g); rascunho.valores[d.id + '_vol'] = vol == null ? '' : vol.toFixed(emM3(g) ? 3 : 2); });
      const temAlgo = Object.entries(rascunho.valores).some(([k, x]) => k !== 'hora' && !/_vol$/.test(k) && !vazio(x));
      // no tablet chefe vale o nome de quem anotou antes; folha só do chefe (Vinho e Fermentação) leva o nome do tablet chefe
      const operador = ehCentral() ? (existente && existente.operador) || quem || '' : (existente && existente.operador) || quem;
      if (temAlgo) gravar(data, v.pid, chave, rascunho.valores, Object.assign({ operador }, marcaAlteracao));
      else if (existente) apagar(data, v.pid, chave);
      else if (!automatico) { toast(chave === 'param' ? 'Anote pelo menos um Brix antes de salvar' : 'Anote pelo menos uma folga antes de salvar', 'erro'); return false; }
      if (!opcoes.silencioso && (temAlgo || existente)) toast(`${chave === 'param' ? 'Brix da produção' : g.nome} salvo`);
    } else if (p.tipo === 'fermentacao') {
      const val = {}; p.campos.forEach((c) => { val[c.id] = rascunho.valores[c.id] || ''; });
      const temAlgo = Object.values(val).some((x) => !vazio(x));
      const existente = rascunho.ciclo ? pegar(rascunho.ciclo.data, PID_FERMENTACAO, rascunho.ciclo.chave) : null;
      if (existente) mudarCiclo(existente, val, Object.assign({ operador: existente.operador || quem || '' }, marcaAlteracao));
      else if (temAlgo) { const novo = novoCiclo(chave, val, quem || ''); rascunho.ciclo = { data: novo.data, chave: novo.chave }; }
      else if (!automatico) { toast('Anote pelo menos um quadro antes de salvar', 'erro'); return false; }
      if (!opcoes.silencioso && (existente || temAlgo)) toast(`Dorna Nº ${chave} salva`);
    } else if (p.tipo === 'juntas') {
      let algum = false;
      p.partes.forEach((pt) => {
        const item = rascunho.valores[pt.prancheta];
        const existente = pegar(data, pt.prancheta, chave);
        // hora somada sozinha: quem confirma vira o responsável
        const operador = ehCentral() ? (existente && existente.operador) || '' : (existente && !existente.auto && existente.operador) || quem;
        // confirmou a soma das dornas (não mudou o valor): se depois entrar outra dorna nessa hora, a soma volta para conferir
        const somaConfirmada = !!(existente && (existente.auto || existente.somaConfirmada) && existente.dornas && existente.valores.qtd === item.qtd);
        if (!vazio(item.qtd)) { gravar(data, pt.prancheta, chave, { qtd: item.qtd, unidade: item.unidade }, Object.assign({ operador, auto: false, conferir: false, somaConfirmada, dornas: somaConfirmada ? existente.dornas : [] }, marcaAlteracao)); algum = true; }
        else if (existente) apagar(data, pt.prancheta, chave);
      });
      if (!algum && !automatico && rascunho.novo) { toast('Anote pelo menos uma quantidade antes de salvar', 'erro'); return false; }
      if (!opcoes.silencioso) toast(`${p.nome} das ${rotuloHoraPapel(chave)} ${automatico ? 'salvo' : 'confirmado'}`);
    } else {
      const existente = pegar(data, v.pid, chave);
      const temAlgo = Object.entries(rascunho.valores).some(([k, x]) => k !== 'unidade' && !vazio(x));
      const operador = ehCentral() ? (rascunho.extras.operador || (existente && existente.operador) || '') : (existente && existente.operador) || quem;
      const extrasMudaram = JSON.stringify(rascunho.extras) !== rascunho.originalExtras;

      const extra = Object.assign({ operador }, marcaAlteracao);
      if (p.vemDe) {
        // quadro que veio de outra folha e foi mudado aqui para de acompanhar; voltou ao mesmo valor, acompanha de novo
        const base = pegar(data, p.vemDe.prancheta, chave);
        const manuais = new Set((existente && existente.manuais) || []);
        Object.entries(p.vemDe.campos).forEach(([meu, dela]) => {
          if (rascunho.valores[meu] === rascunho.original[meu]) return;
          if (base && rascunho.valores[meu] === base.valores[dela]) manuais.delete(meu); else manuais.add(meu);
        });
        extra.manuais = [...manuais];
      }
      if (temAlgo) gravar(data, v.pid, chave, rascunho.valores, extra);
      else if (existente) apagar(data, v.pid, chave); // quadros todos limpos: só a linha sai (renumerar é só no botão Apagar)
      else if (!automatico && !extrasMudaram) { toast('Anote pelo menos um quadro antes de salvar', 'erro'); return false; }
      if (p.tipo === 'dornas' && (temAlgo || existente)) depoisDeMudarDorna(data, v.pid, temAlgo ? Number(chave) : null);

      if (p.tipo === 'grade' && extrasMudaram) gravar(data, v.pid, 'obs' + turnoDaHora(chave, turnosDaPrancheta(v.pid)).id, { texto: rascunho.extras.obs }, { operador: quem || '' });
      if (p.tipo === 'insumo' && ehCentral() && extrasMudaram) gravar(data, v.pid, 'meta', rascunho.extras.meta);
      const nome = p.tipo === 'dornas' ? `${p.rotulo} Nº ${chave}` : p.tipo === 'grade' ? `Leitura das ${rotuloHora(chave)}` : `${p.nome} das ${rotuloHoraPapel(chave)}`;
      const et = p.envio && temAlgo ? etapaDaDorna(p, pegar(data, v.pid, chave)) : '';
      if (!opcoes.silencioso) toast(`${nome} salva${et && et !== 'anotada' ? ` (${et})` : ''}`);
    }
    const mudou = mudancasDoRascunho();
    if (mudou.length) {
      const linha = p.tipo === 'medicao' ? ((grupoDaMedicao(chave) || {}).nome || 'Brix da produção') : p.tipo === 'fermentacao' || p.tipo === 'dornas' ? `Nº ${chave}` : `das ${rotuloHoraPapel(chave)}`;
      const todosVazios = mudou.every((m) => m.antes === '(vazio)');
      registrar('anotacao', `${quemEstaAqui()} ${novoAntes || todosVazios ? 'anotou' : 'mudou'} ${p.nome} ${linha}${precisaAutorizar.length ? ` (o que ${listaE(precisaAutorizar)} tinha anotado)` : ''}`, mudou);
    }
    rascunho.original = JSON.parse(JSON.stringify(rascunho.valores));
    rascunho.originalExtras = JSON.stringify(rascunho.extras);
    rascunho.fonte = fonteDaFolha(p, v.pid, data, chave); // o que acabou de salvar não conta como anotação de fora
    return true;
  }

  function totalInsumo(linhas) {
    const soma = {};
    linhas.forEach((r) => { const n = parseFloat(r.valores.qtd); if (isNaN(n)) return; const u = r.valores.unidade || ''; soma[u] = (soma[u] || 0) + n; });
    return Object.entries(soma).map(([u, n]) => `${fmtNum(Math.round(n * 100) / 100)} ${u}`.trim()).join(' + ');
  }
