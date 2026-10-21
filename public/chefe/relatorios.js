/* Pranchetas Ubirálcool - relatórios guardados no servidor
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * Relatórios guardados no servidor (pasta RelatoriosUsina)
   * ========================================================= */
  /* Relatórios: um por dia, com as folhas de todos os setores. O XML não aparece aqui: é só outro tipo de arquivo
     que dá para escolher na hora de enviar. */

  function telaRelatorios(v) {
    const guardados = new Map((v.dias || []).map((d) => [d.data, d.arquivos || []]));
    const dias = [...new Set([...(v.diasComDados || []), ...guardados.keys()])].sort().reverse();
    return `${cabecalho('Relatórios', 'Um por dia, com todos os setores', true, `<button class="atalho" data-a="gerar-hoje">${ico('planilha')}<span>Gerar agora</span></button>`)}
      <main>
        ${cfg.demo ? '<p class="sub">Demonstração: os dias anotados neste aparelho. Na usina, o Excel de cada dia fica guardado no servidor.</p>' : ''}
        ${!cfg.demo && !v.carregado ? '<p class="sub">Buscando os relatórios...</p>' : ''}
        ${!cfg.demo && v.carregado && !dias.length ? '<div class="tela-aviso"><div class="grande-ico">' + ico('pasta') + '</div><h1>Nenhum relatório ainda</h1><p>Assim que os setores anotarem, o dia aparece aqui. Às 07:00 o Excel do dia anterior é guardado sozinho.</p></div>' : ''}
        <div class="relatorios">${dias.map((d) => {
          const excel = (guardados.get(d) || []).some((a) => /\.xlsx$/i.test(a.nome));
          return `<section class="bloco relatorio-dia">
            <div class="relatorio-cab"><span class="escolha-ico">${ico('planilha')}</span>
              <div><b>Folhas de ${fmtData(d)}</b><small>${diaSemana(d)}${d === dataProducao() ? ' (hoje)' : ''} · ${excel ? 'Excel guardado em RelatoriosUsina' : 'ainda sem Excel guardado'}</small></div></div>
            <div class="linha-botoes">
              <button class="btn pequeno primario" data-a="relatorio-abrir" data-data="${d}">${ico('seta')} Abrir e corrigir</button>
              <button class="btn pequeno" data-a="relatorio-enviar" data-data="${d}">${ico('enviar')} Enviar ou imprimir</button>
              ${(guardados.get(d) || []).length ? `<button class="btn pequeno perigo" data-a="relatorio-apagar" data-data="${d}">${ico('lixeira')} Apagar o arquivo</button>` : ''}
            </div></section>`;
        }).join('')}</div>
      </main>`;
  }
  async function carregarRelatorios() {
    const v = view();
    // demonstração: os dias anotados neste aparelho (sem servidor, não há arquivo guardado)
    if (cfg.demo) {
      v.diasComDados = [...new Set(Object.values(registros).filter((r) => !r.apagado && C.pranchetas[r.prancheta]).map((r) => r.data))];
      v.carregado = true;
      return Promise.resolve().then(() => { if (view() === v) render(); });
    }
    try {
      const r = await buscar('api/relatorios', {}, 8000);
      const dados = r.ok ? await r.json() : { dias: [] };
      v.dias = dados.dias || []; v.diasComDados = dados.diasComDados || []; v.pasta = dados.pasta || '';
    } catch (e) { v.dias = []; toast('Não consegui ler os relatórios do servidor', 'erro'); }
    v.carregado = true;
    if (view() === v) render();
  }
