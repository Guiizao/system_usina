/* Pranchetas Ubirálcool - tela de preparar o servidor
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * Tela: preparando o tablet chefe (servidor da usina)
   * ========================================================= */
  function telaPreparando(v) {
    const passos = v.passos || [];
    const terminou = v.fim;
    const erro = passos.some((p) => p.estado === 'erro');
    return `${cabecalho('Preparando o servidor', 'Servidor da usina neste aparelho', false)}
      <main><div class="preparo">
        <div class="preparo-cab">
          <span class="preparo-ico ${terminou ? (erro ? 'erro' : 'ok') : 'girando'}">${ico(terminou ? (erro ? 'alerta' : 'certo') : 'servidor')}</span>
          <div><h1>${terminou ? (erro ? 'Faltou um passo' : 'Tudo pronto') : 'Preparando o servidor da usina'}</h1>
          <p>${terminou ? (erro ? 'Resolva o item marcado e tente de novo.' : 'Os tablets já podem se conectar neste aparelho. Tudo que já estava guardado continua aqui.') : 'Não feche o aplicativo. Leva poucos segundos.'}</p></div>
          ${terminou ? `<div class="preparo-botoes">${erro
            ? `<button class="btn primario" data-a="virar-central">${ico('servidor')} Tentar de novo</button><button class="btn" data-a="voltar-conectar">Voltar</button>`
            : `<button class="btn primario" data-a="abrir-painel">${ico('seta')} Continuar</button>`}</div>` : ''}
        </div>
        <ol class="passos-preparo">${passos.map((p) => `<li class="${p.estado}">
          <span class="marca">${p.estado === 'ok' ? ico('certo') : p.estado === 'erro' ? ico('alerta') : p.estado === 'fazendo' ? '<i class="giro"></i>' : ''}</span>
          <div><b>${esc(p.texto)}</b>${p.detalhe ? `<small>${esc(p.detalhe)}</small>` : ''}</div></li>`).join('')}</ol>

      </div></main>`;
  }
  /** Executa de verdade cada passo e mostra o resultado na tela. */
  async function prepararTabletChefe() {
    const passos = [];
    pilha = [{ tela: 'preparando', passos }];
    const passo = async (texto, acao) => {
      const item = { texto, estado: 'fazendo', detalhe: '' };
      passos.push(item); render(true);
      const inicio = Date.now();
      try {
        item.detalhe = (await acao()) || '';
        item.estado = 'ok';
      } catch (e) {
        item.estado = 'erro'; item.detalhe = e && e.message ? e.message : String(e);
      }
      await new Promise((r) => setTimeout(r, Math.max(0, 450 - (Date.now() - inicio)))); // dá tempo de ler
      render(true);
      return item.estado === 'ok';
    };
    // liga o servidor neste aparelho; a função dele (tablet chefe ou setor) continua a mesma e nenhum dado é apagado
    cfg.servidor = true; salvarCfg();
    let ok = true;
    let estado = null;
    if (pluginCentral) {
      ok = ok && await passo('Permissão para os tablets acharem este aparelho no Wi-Fi', async () => {
        if (!(await garantirRedeLocal(true))) throw new Error('Libere "Dispositivos por perto" (ou "Rede local") nos ajustes do Android e toque em Tentar de novo.');
        return 'Rede local liberada';
      });
      ok = ok && await passo('Criando as pastas ServidorUsina, RelatoriosUsina e BackupUsina', async () => {
        const r = await pluginCentral.criarPastas();
        return r.documentos ? `No aparelho e em ${r.documentos}` : `Em ${r.pasta}`;
      });
      ok = ok && await passo(`Ligando o servidor na rede, porta ${C.portaCentral}`, async () => {
        const r = await pluginCentral.iniciar({ porta: C.portaCentral });
        cfg.central = `http://127.0.0.1:${C.portaCentral}`; usarChaveDaRede(r.chave); cfg.demo = false; cfg.ultimoContato = Date.now(); salvarCfg();
        return 'Servidor ligado';
      });
      ok = ok && await passo('Mantendo o servidor ligado com a tela apagada', async () => {
        const r = await pluginCentral.manterLigado({ perguntar: true });
        return r && r.bateriaLivre === false ? 'Toque em Permitir na pergunta sobre a bateria' : 'Aparece um aviso fixo na barra de notificações';
      });
      ok = ok && await passo('Procurando o endereço deste tablet no Wi-Fi', async () => {
        estado = await pluginCentral.estado();
        if (!estado.enderecos || !estado.enderecos.length) throw new Error('Este tablet não está em nenhum Wi-Fi. Conecte no Wi-Fi da usina.');
        return estado.enderecos.join(', ');
      });
    } else {
      ok = ok && await passo('Procurando o servidor da usina', async () => {
        const r = await buscar('api/ping', {}, 5000);
        if (!r.ok) throw new Error('A central não respondeu');
        return 'Servidor encontrado';
      });
    }
    ok = ok && await passo('Testando o servidor', async () => {
      const r = await buscar('api/status', {}, 5000);
      if (!r.ok) throw new Error('O servidor não respondeu. Tente de novo.');
      estado = await r.json();
      sync.status = estado; sync.statusJson = JSON.stringify(estado);
      return estado.pastas ? `Relatórios em ${estado.pastas.relatorios}` : 'Respondendo';
    });
    ok = ok && await passo('Gerando o código de conexão dos tablets', async () => `Código ${String(estado.codigo).replace(/(\d{3})(\d{3})/, '$1 $2')}`);
    view().fim = true;
    render(true);
    if (ok) { sync.modo = 'online'; sincronizar(); }
  }
