/* Pranchetas Ubirálcool - tela de conectar na central
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * Tela: conectar na central da usina
   * ========================================================= */
  const conexaoForm = { endereco: NO_APK ? '' : location.hostname, codigo: '' };
  const procura = { ativa: false, feita: false, texto: '' };
  /** Varre o Wi-Fi (mesma faixa de endereço deste aparelho) atrás do servidor das pranchetas. */
  async function varrerRede(aceita, aoProgresso) {
    const st = await pluginCentral.estado();
    const meus = (st.enderecos || []).map((u) => u.replace(/^https?:\/\//, '').split(':')[0]).filter((ip) => /^(192\.168|10\.|172\.)/.test(ip));
    const testar = async (ip) => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 1800);
      try {
        const r = await fetch(`http://${ip}:${C.portaCentral}/api/ping`, { signal: ctrl.signal, cache: 'no-store' });
        const d = await r.json();
        return d && d.app === 'pranchetas' && (await aceita(ip)) ? ip : '';
      } catch (e) { return ''; } finally { clearTimeout(t); }
    };
    for (const meu of meus) {
      const base = meu.split('.').slice(0, 3).join('.');
      const lista = [];
      for (let i = 1; i < 255; i++) if (`${base}.${i}` !== meu) lista.push(`${base}.${i}`);
      for (let i = 0; i < lista.length; i += 48) {
        if (aoProgresso && aoProgresso(Math.min(100, Math.round(((i + 48) / lista.length) * 100))) === false) return '';
        const achou = (await Promise.all(lista.slice(i, i + 48).map(testar))).find(Boolean);
        if (achou) return achou;
      }
    }
    return '';
  }
  /** Procura sozinho o tablet chefe no Wi-Fi, para a pessoa só digitar o código. */
  async function procurarCentral() {
    if (!NO_APK || !pluginCentral || procura.ativa) return;
    procura.feita = true;
    procura.texto = 'O Android pode perguntar sobre "dispositivos por perto": toque em Permitir.';
    render();
    if (!(await garantirRedeLocal(true))) {
      procura.texto = 'O Android está bloqueando a rede local. Libere "Dispositivos por perto" nos ajustes e toque em Procurar sozinho.';
      return render();
    }
    procura.ativa = true; procura.texto = 'Procurando o tablet chefe no Wi-Fi...';
    render();
    let achou = '';
    try {
      achou = await varrerRede(async () => true, (pct) => {
        if (view().tela !== 'conectar') return false;
        procura.texto = `Procurando o tablet chefe no Wi-Fi... ${pct}%`;
        const t = app.querySelector('.procura-central span');
        if (t) t.textContent = procura.texto;
        return true;
      });
    } catch (e) { /* segue para a mensagem */ }
    procura.ativa = false;
    if (achou) {
      conexaoForm.endereco = achou;
      procura.texto = `Tablet chefe encontrado: ${achou}. Agora digite o código.`;
      ed.alvoId = 'codigo';
    } else {
      procura.texto = 'Não achei o tablet chefe. Confira o Wi-Fi ou digite o endereço que aparece no painel dele.';
    }
    if (view().tela === 'conectar') render();
  }
  /** O endereço do tablet chefe mudou (roteador reiniciou)? Procura de novo o servidor com a mesma chave. */
  async function reencontrarCentral() {
    if (!NO_APK || !pluginCentral || centralNoTablet() || !cfg.chave || procura.ativa) return;
    if (!(await garantirRedeLocal(false))) return;
    procura.ativa = true;
    try {
      const achou = await varrerRede(async (ip) => {
        // só a central deste aparelho abre o pedido embaralhado com a chave dele
        try { return (await pedirCifrado(`http://${ip}:${C.portaCentral}/`, 'api/status', {}, 3000)).ok; } catch (e) { return false; }
      });
      if (achou) {
        cfg.central = `http://${achou}:${C.portaCentral}`; salvarCfg();
        toast('Tablet chefe encontrado de novo');
        procura.ativa = false;
        sincronizar();
      }
    } catch (e) { /* tenta de novo mais tarde */ }
    procura.ativa = false;
  }
  function telaConectar() {
    alvos = [];
    if (NO_APK) alvos.push({ id: 'endereco', label: 'Endereço da central', type: 'ip', get: () => conexaoForm.endereco, set: (x) => { conexaoForm.endereco = x; } });
    alvos.push({ id: 'codigo', label: 'Código (6 números)', type: 'num', dec: 0, digitos: 6, semMaisMenos: true, get: () => conexaoForm.codigo, set: (x) => { conexaoForm.codigo = x; } });
    contextoEdicao = 'conectar este aparelho';
    // 2.16: o logo fica só na barra de cima; o código e os botões na mesma largura; a assinatura no pé da tela
    const conteudo = `<div class="boas-vindas conectar">
        <header><div><h1>Conectar na rede da usina</h1>
        <p>O aplicativo só funciona dentro da rede da Ubirálcool. Peça ao escritório o ${NO_APK ? 'endereço e o ' : ''}código que aparece no tablet chefe.</p></div></header>
        ${grupoQuadros(alvos)}
        ${NO_APK && pluginCentral ? `<div class="procura-central ${procura.ativa ? 'ativa' : ''}">
          ${procura.ativa ? '<i class="giro"></i>' : ico(conexaoForm.endereco ? 'certo' : 'wifi')}
          <span>${esc(procura.texto || 'O endereço aparece no painel do tablet chefe, embaixo do QR code.')}</span>
          ${procura.ativa ? '' : `<button class="btn" data-a="procurar-central">${ico('wifi')} Procurar sozinho</button>`}
        </div>` : ''}
        <div class="linha-botoes">
          <button class="btn primario" data-a="conectar">${ico('wifi')} Conectar</button>
          <button class="btn" data-a="modo-demo">Só demonstração, sem central</button>
        </div>
        ${pluginCentral ? `<div class="bloco destaque-chefe">
          <span class="escolha-ico">${ico('servidor')}</span>
          <div><b>Usar este aparelho como servidor da usina?</b><p>Ele guarda tudo e recebe os tablets dos setores (pastas ServidorUsina, RelatoriosUsina e BackupUsina). Depois você escolhe se ele também é o tablet chefe ou um setor. Nada que já está guardado é apagado.</p></div>
          <button class="btn primario" data-a="virar-central">Usar como servidor</button>
        </div>` : ''}
        <p class="autoria">Pranchetas Digitais ${VERSAO} · ${esc(AUTORIA)}</p>
      </div>`;
    return `${cabecalho('Pranchetas digitais', 'Primeiro acesso', false)}${telaEdicao(conteudo)}`;
  }
  async function conectar() {
    const endereco = NO_APK ? conexaoForm.endereco.trim() : '';
    if (NO_APK && !/^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(endereco)) return toast('Endereço incompleto. Exemplo: 192.168.1.113', 'erro');
    if (!/^\d{6}$/.test(conexaoForm.codigo)) return toast('O código tem 6 números', 'erro');
    if (!(await garantirRedeLocal(true))) return;
    cfg.central = NO_APK ? `http://${endereco.includes(':') ? endereco : endereco + ':' + C.portaCentral}` : '';
    try {
      const r0 = await buscar('api/ping', {}, 5000);
      const info = await r0.json().catch(() => ({}));
      if (!info || info.app !== 'pranchetas') throw new Error('sem central');
      if (!info.cifra || !info.pub) return avisarCentralAntiga();
      // o código não vai aberto: vai uma prova dele, que só a central consegue conferir
      const { corpo, chavePar } = Cifra.pedidoDeConexao(info.pub, cfg.deviceId, conexaoForm.codigo);
      const r = await postJson('api/parear', corpo, 6000);
      const dados = await r.json().catch(() => ({}));
      if (!r.ok) return toast(dados.erro === 'Código errado' ? 'Código errado. Confira no tablet chefe.' : (dados.erro || 'A central recusou a conexão'), 'erro');
      const { chave } = await Cifra.abrirConexao(chavePar, cfg.deviceId, dados.cifrado);
      cfg.chave = chave; cfg.cifra = 1; cfg.demo = false; cfg.ultimoContato = Date.now(); cfg.novaConexao = true; salvarCfg();
      toast('Aparelho conectado na rede da usina');
      ed.alvoId = null; pilha = [telaInicial()]; render(true); sincronizar();
    } catch (e) {
      toast('Não achei a central. Confira se está no Wi-Fi da usina e se o endereço é o que aparece no tablet chefe.', 'erro');
    }
  }
