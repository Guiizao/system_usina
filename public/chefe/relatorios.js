/* Pranchetas Ubirálcool - relatórios guardados no servidor
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * Relatórios guardados no servidor (pasta RelatoriosUsina)
   * ========================================================= */
  /* Relatórios: um por dia, com as folhas de todos os setores. O XML não aparece aqui: é só outro tipo de arquivo
     que dá para escolher na hora de enviar. */

  const DIAS_NA_LISTA = 90; // a lista abre com 90 dias; os mais antigos vêm no botão (com anos de dados, a tela não fica pesada)
  function telaRelatorios(v) {
    if (painelNovoCel()) return telaRelatoriosCel(v);
    const guardados = new Map((v.dias || []).map((d) => [d.data, d.arquivos || []]));
    const todos = [...new Set([...(v.diasComDados || []), ...guardados.keys()])].sort().reverse();
    const dias = todos.slice(0, v.quantos || DIAS_NA_LISTA);
    return `${cabecalho('Relatórios', 'Um por dia, com todos os setores', true, cfg.soNuvem ? '' : `<button class="atalho" data-a="gerar-hoje">${ico('planilha')}<span>Gerar agora</span></button>`)}
      <main>
        ${cfg.demo || cfg.soNuvem ? `<p class="sub">${cfg.soNuvem ? 'Pela nuvem: todos os dias guardados no banco.' : 'Demonstração: os dias anotados neste aparelho.'} Na usina, o Excel de cada dia fica guardado no servidor.</p>` : ''}
        ${!cfg.demo && !v.carregado ? '<p class="sub">Buscando os relatórios...</p>' : ''}
        ${!cfg.demo && v.carregado && !dias.length ? '<div class="tela-aviso"><div class="grande-ico">' + ico('pasta') + '</div><h1>Nenhum relatório ainda</h1><p>Assim que os setores anotarem, o dia aparece aqui. Às 07:00 o Excel do dia anterior é guardado sozinho.</p></div>' : ''}
        <div class="relatorios">${dias.map((d) => {
          const excel = (guardados.get(d) || []).some((a) => /\.xlsx$/i.test(a.nome));
          return `<section class="bloco relatorio-dia">
            <div class="relatorio-cab"><span class="escolha-ico">${ico('planilha')}</span>
              <div><b>Folhas de ${fmtData(d)}</b><small>${diaSemana(d)}${d === dataProducao() ? ' (hoje)' : ''}${cfg.soNuvem ? '' : ` · ${excel ? 'Excel guardado em RelatoriosUsina' : 'ainda sem Excel guardado'}`}</small></div>${painelNovoPc() && veNoChefe('escritorio') ? `<mark class="pn-marca ${rastreioGuardado(d) ? 'v' : 'a'}">${rastreioGuardado(d) ? 'Rastreamento salvo' : 'Falta rastreamento'}</mark>` : ''}</div>
            <div class="linha-botoes">
              <button class="btn pequeno primario" data-a="relatorio-abrir" data-data="${d}" data-arq="${(guardados.get(d) || []).length ? 1 : ''}">${ico('seta')} Abrir e corrigir</button>
              <button class="btn pequeno" data-a="relatorio-enviar" data-data="${d}">${ico('enviar')} Enviar ou imprimir</button>
              <button class="btn pequeno" data-a="relatorio-resumo" data-data="${d}">${ico('documento')} Resumo</button>
            </div></section>`;
        }).join('')}</div>
        ${todos.length > dias.length ? `<div class="linha-botoes"><button class="btn" data-a="relatorios-mais">${ico('mais')} Ver dias mais antigos</button></div>` : ''}
      </main>`;
  }
  /* 3.1.5: no celular com o painel novo, os dias num calendário. Quanto mais anotações, mais escuro o verde.
     Tocar num dia espreme o calendário até sumir e abre o dia; o Voltar faz o contrário. Cabe na tela como o Início. */
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const SEM_FOLHA = ['avisos', 'avisos-recibo', 'registro', 'rastreamento'];
  function anotacoesPorDia() {
    const n = new Map();
    for (const r of Object.values(registros)) if (!r.apagado && C.pranchetas[r.prancheta] && !SEM_FOLHA.includes(r.prancheta)) n.set(r.data, (n.get(r.data) || 0) + 1);
    return n;
  }
  function telaRelatoriosCel(v) {
    const hoje = dataProducao(), ontem = somarDias(hoje, -1), guardados = new Map((v.dias || []).map((d) => [d.data, d.arquivos || []]));
    const conta = anotacoesPorDia(), comDados = new Set([...(v.diasComDados || []), ...guardados.keys(), ...conta.keys()]);
    const mes = v.mes || hoje.slice(0, 7), [ano, m] = mes.split('-').map(Number), nomeMes = MESES[m - 1].toLowerCase();
    const anim = matchMedia('(prefers-reduced-motion: reduce)').matches ? '' : v.anim || ''; v.anim = ''; // só o desenho logo depois do toque anima; o de 5 em 5 segundos não
    const vazio = new Date(ano, m - 1, 1).getDay(), doMes = Array.from({ length: new Date(ano, m, 0).getDate() }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`);
    const max = Math.max(1, ...doMes.map((d) => conta.get(d) || 0));
    const nivel = (d) => { const n = conta.get(d) || 0, q = n / max; return !n ? (comDados.has(d) ? 1 : 0) : q > 0.75 ? 4 : q > 0.5 ? 3 : q > 0.25 ? 2 : 1; };
    const outro = (k) => { const x = new Date(ano, m - 1 + k, 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`; };
    const anos = [...new Set([ano, Number(hoje.slice(0, 4)), ...[...comDados].map((d) => Number(d.slice(0, 4)))])].sort();
    const hora = (t) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const celula = (d) => {
      const nv = nivel(d), dd = Number(d.slice(8)), cls = `n${nv}${d === hoje ? ' hoje' : ''}`;
      return nv ? `<button class="${cls}" data-a="rel-dia" data-data="${d}" aria-label="${fmtData(d)}: ${conta.get(d) ? contar(conta.get(d), 'anotação', 'anotações') : 'anotações no servidor'}">${dd}</button>`
        : `<span class="${cls}${d > hoje ? ' futuro' : ''}">${dd}</span>`;
    };
    const calendario = (cls) => {
      const diasNoMes = doMes.filter((x) => comDados.has(x)).length, anotacoes = doMes.reduce((t, x) => t + (conta.get(x) || 0), 0);
      const topo = doMes.reduce((b, x) => ((conta.get(x) || 0) > (conta.get(b) || 0) ? x : b), doMes[0]);
      const alcool = pnVeProducao() ? doMes.filter((x) => x <= hoje).map((x) => pnDia(x).alcool).filter((a) => a !== '' && Number.isFinite(Number(a))) : [];
      return `<div class="rel-cal ${cls}">
      <section class="rel-card">
        <div class="rel-mes"><button class="pn-ic" data-a="rel-mes" data-mes="${outro(-1)}" aria-label="Mês anterior">${ico('voltar')}</button>
          <select id="rel-mes" aria-label="Mês">${MESES.map((n, i) => `<option value="${i + 1}" ${i + 1 === m ? 'selected' : ''}>${n}</option>`).join('')}</select>
          <select id="rel-ano" aria-label="Ano">${anos.map((a) => `<option ${a === ano ? 'selected' : ''}>${a}</option>`).join('')}</select>
          <button class="pn-ic" data-a="rel-mes" data-mes="${outro(1)}" aria-label="Próximo mês" ${outro(1) > hoje.slice(0, 7) ? 'disabled' : ''}>${ico('seta')}</button></div>
        <div class="rel-semana" aria-hidden="true">${['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((x) => `<span>${x}</span>`).join('')}</div>
        <div class="rel-grade ${anim === 'mes' ? 'troca-mes' : ''}">${'<span class="vazio"></span>'.repeat(vazio)}${doMes.map(celula).join('')}</div>
        <div class="rel-legenda"><small>Menos</small><i class="n1"></i><i class="n2"></i><i class="n3"></i><i class="n4"></i><small>Mais anotações</small></div>
      </section>
      <section class="rel-card rel-resumo-mes"><h3>Resumo de ${nomeMes}</h3>
        ${!cfg.demo && !v.carregado ? '<p>Buscando os dias...</p>' : diasNoMes ? `<div class="rel-tres"><div><b>${diasNoMes}</b><small>${diasNoMes === 1 ? 'dia anotado' : 'dias anotados'}</small></div><div><b>${pnNum(anotacoes)}</b><small>anotações</small></div>${pnVeProducao() ? `<div><b>${alcool.length ? pnComUn(alcool.reduce((t, a) => t + Number(a), 0), 'L') : '-'}</b><small>de álcool</small></div>` : ''}</div>
        ${conta.get(topo) ? `<p>Dia com mais anotações: <b>${fmtData(topo).slice(0, 5)}</b>, ${pnNum(conta.get(topo))}. Toque num dia para abrir.</p>` : '<p>Toque num dia para abrir.</p>'}` : `<p>Nada anotado em ${nomeMes} de ${ano}.</p>`}</section>
      <section class="rel-card rel-atalhos"><h3>Atalhos</h3><div>
        <button class="btn" data-a="rel-dia" data-data="${hoje}">${ico('planilha')} Hoje</button>
        <button class="btn" data-a="relatorio-enviar" data-data="${ontem}">${ico('enviar')} Enviar ontem</button>
        ${cfg.soNuvem ? '' : `<button class="btn" data-a="gerar-hoje">${ico('planilha')} Gerar o Excel de hoje</button>`}
      </div></section></div>`;
    };
    const painel = (cls, d) => {
      const n = conta.get(d) || 0, arqs = guardados.get(d) || [], excel = arqs.some((a) => /\.xlsx$/i.test(a.nome));
      const doDia = setores().map((s) => [s, s.pranchetas.flatMap(folhasDe).flatMap((pid) => listar(d, pid)).filter((r) => !r.apagado)]);
      const porSetor = doDia.filter(([, l]) => l.length), maior = Math.max(1, ...porSetor.map(([, l]) => l.length));
      const quem = [...new Set(doDia.flatMap(([, l]) => l.map((r) => r.operador)).filter(Boolean))].sort(), fora = listaForaDoLimite(d);
      return `<section class="rel-card rel-painel ${cls}">
        <button class="rel-volta" data-a="rel-voltar">${ico('voltar')} Calendário</button>
        <h2>${diaSemana(d)}, ${fmtData(d)}${d === hoje ? ' (hoje)' : ''}</h2>
        <p class="sub">${n ? contar(n, 'anotação', 'anotações') : 'Nada anotado neste aparelho'}${cfg.soNuvem ? '' : ` · ${excel ? 'Excel guardado' : 'ainda sem Excel guardado'}`}</p>
        ${porSetor.length ? `<div class="rel-setores">${porSetor.map(([s, l]) => `<div><span>${esc(s.nome)}</span><u><s style="width:${(l.length / maior * 100).toFixed(1)}%"></s></u><b>${l.length}</b></div>`).join('')}</div>` : ''}
        ${quem.length ? `<h3>Quem anotou</h3><div class="rel-quem">${quem.map((q) => `<span>${esc(q)}</span>`).join('')}</div>` : ''}
        ${fora.length ? `<h3>Fora do limite <mark>${fora.length}</mark></h3><div class="rel-fora">${fora.slice(0, 3).map((x) => `<div><time>${hora(x.em)}</time><span><b>${esc(x.txt)}</b><small>${esc(x.onde)}</small></span></div>`).join('')}</div>` : ''}
        <div class="rel-acoes">
          <button class="btn primario" data-a="relatorio-abrir" data-data="${d}" data-arq="${arqs.length ? 1 : ''}">${ico('seta')} Abrir e corrigir</button>
          <button class="btn" data-a="relatorio-enviar" data-data="${d}">${ico('enviar')} Enviar</button>
          <button class="btn" data-a="relatorio-resumo" data-data="${d}">${ico('documento')} Resumo</button>
          ${arqs.length && pode('pessoas') ? `<button class="btn perigo" data-a="relatorio-apagar" data-data="${d}">${ico('lixeira')} Apagar o arquivo</button>` : ''}
        </div></section>`;
    };
    // 3.1.5: persiana, como na referência do Guilherme: as faixas fecham de cima para baixo sobre o que sai e abrem mostrando o que entra (na volta, de baixo para cima)
    const persiana = (volta) => `<div class="rel-persiana${volta ? ' volta' : ''}" aria-hidden="true">${Array.from({ length: 9 }, (_, i) => `<i style="--i:${volta ? 8 - i : i}"></i>`).join('')}</div>`;
    const miolo = anim === 'abre' ? calendario('sai') + painel('entra', v.diaSel) + persiana(false)
      : anim === 'fecha' && v.diaAntes ? painel('sai', v.diaAntes) + calendario('entra') + persiana(true)
      : v.diaSel ? painel('', v.diaSel) : calendario('');
    return `${cabecalho('Relatórios', 'Um por dia, com todos os setores', true)}<main class="pn-cel cabe"><div class="pn-miolo"><div class="rel-pilha">${miolo}</div></div></main>`;
  }
  document.addEventListener('change', (e) => {
    if (e.target.id !== 'rel-mes' && e.target.id !== 'rel-ano') return;
    const v = view();
    v.mes = `${document.getElementById('rel-ano').value}-${String(document.getElementById('rel-mes').value).padStart(2, '0')}`; v.anim = 'mes';
    render();
  });
  // o que saiu some com a persiana fechada e não fica ocupando lugar: a tela volta a caber do tamanho certo; a persiana sai quando a última faixa abre
  document.addEventListener('animationend', (e) => {
    if (e.target.matches('.rel-pilha > .sai')) { e.target.remove(); pnCaberNaTela(); }
    else if (e.animationName.startsWith('rel-abre') && e.target.matches('.rel-persiana i[style="--i:8"]')) e.target.parentNode.remove();
  });
  /** 2.16: o resumo do dia (setores, totais por turno) para ver e enviar sem abrir o Excel. */
  async function verResumo(data) {
    await buscarDia(data);
    const texto = resumoDoDia(data);
    const k = await abrirModal(`<h3>Resumo de ${fmtData(data)}</h3><p class="dica">${esc(diaSemana(data))} · o que cada setor anotou e os totais dos insumos, por turno.</p>
      <pre class="resumo-texto">${esc(texto.replace(/\*/g, ''))}</pre>
      <div class="grade-acoes">
        <button data-k="whatsapp">${ico('whatsapp')}<span>WhatsApp</span></button>
        <button data-k="email">${ico('email')}<span>E-mail</span></button>
        <button data-k="outros">${ico('compartilhar')}<span>Outros apps</span></button>
        <button data-k="copiar">${ico('documento')}<span>Copiar</span></button>
      </div>
      <div class="acoes-modal um"><button class="btn" data-k="x">Fechar</button></div>`, (k2, b2, fechar) => fechar(k2), { classe: 'largo' });
    if (k === 'copiar') { try { await navigator.clipboard.writeText(texto); toast('Resumo copiado'); } catch (e) { toast('Não consegui copiar', 'erro'); } }
    else if (['whatsapp', 'email', 'outros'].includes(k)) compartilhar(k, data);
  }
  /** 3.0: que dias o banco tem (de qualquer idade) e os da cópia deste aparelho. Banco fora: ficam os outros. */
  async function diasDoBancoEDaPasta() {
    const dias = [];
    try {
      if (usarBanco()) { const r = await pedirAoBanco('api/dias', {}, 8000); if (r.ok) dias.push(...((await r.json()).dias || [])); }
      const pasta = temPastaDeCopia() ? window.pranchetasPC || pluginCentral : null;
      if (pasta && pasta.listarCopias) dias.push(...(((await pasta.listarCopias()) || {}).nomes || []).map((n) => String(n).slice(0, 10)));
    } catch (e) { /* o que já veio continua valendo */ }
    return dias.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  }
  async function carregarRelatorios() {
    const v = view();
    // demonstração: os dias anotados neste aparelho (sem servidor, não há arquivo guardado)
    if (cfg.demo || cfg.soNuvem) {
      const aqui = Object.values(registros).filter((r) => !r.apagado && C.pranchetas[r.prancheta]).map((r) => r.data);
      v.diasComDados = [...new Set([...aqui, ...(cfg.demo ? [] : await diasDoBancoEDaPasta())])];
      v.carregado = true;
      if (view() === v) render();
      return;
    }
    try {
      const r = await buscar('api/relatorios', {}, 8000);
      const dados = r.ok ? await r.json() : { dias: [] };
      v.dias = dados.dias || []; v.diasComDados = dados.diasComDados || []; v.pasta = dados.pasta || '';
    } catch (e) { v.dias = []; toast('Não consegui ler os relatórios do servidor', 'erro'); }
    v.diasComDados = [...new Set([...(v.diasComDados || []), ...(await diasDoBancoEDaPasta())])];
    v.carregado = true;
    if (view() === v) render();
  }
