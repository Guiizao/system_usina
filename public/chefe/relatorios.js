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
              <div><b>Folhas de ${fmtData(d)}</b><small>${diaSemana(d)}${d === dataProducao() ? ' (hoje)' : ''}${cfg.soNuvem ? '' : ` · ${excel ? 'Excel guardado em RelatoriosUsina' : 'ainda sem Excel guardado'}`}</small></div></div>
            <div class="linha-botoes">
              <button class="btn pequeno primario" data-a="relatorio-abrir" data-data="${d}" data-arq="${(guardados.get(d) || []).length ? 1 : ''}">${ico('seta')} Abrir e corrigir</button>
              <button class="btn pequeno" data-a="relatorio-enviar" data-data="${d}">${ico('enviar')} Enviar ou imprimir</button>
              <button class="btn pequeno" data-a="relatorio-resumo" data-data="${d}">${ico('documento')} Resumo</button>
            </div></section>`;
        }).join('')}</div>
        ${todos.length > dias.length ? `<div class="linha-botoes"><button class="btn" data-a="relatorios-mais">${ico('mais')} Ver dias mais antigos</button></div>` : ''}
      </main>`;
  }
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
