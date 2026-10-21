/* Pranchetas Ubirálcool - painel do tablet chefe
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * Tablet chefe: painel
   * ========================================================= */
  // sem ninguém dentro, o botão aparece e pede a senha; com alguém, só o que ela pode
  const veNoChefe = (f) => !pessoaAtual() || pode(f);
  const FUNCOES_DA_USINA = ['usina', 'pessoas', 'registro', 'folhas', 'integracoes', 'conexao', 'chefes', 'sistema', 'ajustes'];
  function atalhosChefe() {
    const abertos = avisosEmAberto().length;
    const p = pessoaAtual();
    return `<button class="atalho pessoa-chefe ${p ? '' : 'alerta'}" data-a="pessoa" aria-label="${p ? `${esc(p.nome)}: toque para sair` : 'Entrar com a sua senha'}">${ico('pessoa')}<span>${esc(p ? p.nome : 'Entrar')}</span></button>
      ${veNoChefe('avisos') ? `<button class="atalho" data-a="avisos" aria-label="Avisos${abertos ? `, ${abertos} esperando` : ''}">${ico('sino')}<span>Avisos</span>${abertos ? `<em class="contador">${abertos}</em>` : ''}</button>` : ''}
      ${veNoChefe('ler_folha') ? `<button class="atalho" data-a="ler-folha">${ico('camera')}<span>Ler folha</span></button>` : ''}
      ${veNoChefe('relatorios') ? `<button class="atalho" data-a="relatorios">${ico('pasta')}<span>Relatórios</span></button>` : ''}
      ${FUNCOES_DA_USINA.some(veNoChefe) ? `<button class="atalho" data-a="config">${ico('pessoas')}<span>Usina</span></button>` : ''}`;
  }
  function telaCentral(v) {
    const data = v.data;
    const hoje = dataProducao();
    const st = sync.status;
    const lista = setores();
    const todos = lista.flatMap((s) => s.pranchetas.flatMap(folhasDe).flatMap((pid) => listar(data, pid)));
    const pend = data === hoje ? lista.flatMap((s) => s.pranchetas.map((pid) => resumoPrancheta(pid, data))).filter((r) => r.estado === 'pendente').length : 0;
    const ligados = st ? st.aparelhos.filter((a) => a.online).length : 0;
    const subtitulo = cfg.demo ? 'Demonstração, dados só neste aparelho' : sync.modo === 'online' ? (centralNoTablet() ? 'Servidor ligado neste aparelho' : 'Acompanhando a central em tempo real') : 'Procurando o servidor';

    return `${cabecalho(nomeDoChefe(), subtitulo, false, atalhosChefe())}
      <main class="painel-chefe">
        <div class="barra-dia">
          <div class="nav-data">
            <button class="btn" data-a="dia" data-n="-1" aria-label="Dia anterior">${ico('voltar')}</button>
            <div class="data-grande"><b>${fmtData(data)}</b><span>${diaSemana(data)}, das 07:00 até 06:59 do dia seguinte</span></div>
            <button class="btn" data-a="dia" data-n="1" aria-label="Próximo dia" ${data >= hoje ? 'disabled' : ''}>${ico('seta')}</button>
            ${data !== hoje ? '<button class="btn pequeno" data-a="dia-hoje">Hoje</button>' : ''}
          </div>
          <div class="numeros">
            <div><b>${todos.length}</b><span>anotações</span></div>
            <div class="${pend ? 'atencao' : ''}"><b>${pend}</b><span>pendências</span></div>
            <button class="numero-botao" data-a="aparelhos"><b>${cfg.demo && !st ? '-' : ligados}</b><span>aparelhos ligados</span></button>
          </div>
        </div>

        <div class="central-grade">
          <section>
            ${veNoChefe('corrigir') || veNoChefe('relatorios') ? `<h2>Setores</h2>
            <div class="setores-grade">${lista.map((s) => {
              const regs = s.pranchetas.flatMap(folhasDe).flatMap((pid) => listar(data, pid)).sort((a, b) => b.atualizadoEm - a.atualizadoEm);
              const resumos = data === hoje ? s.pranchetas.map((pid) => resumoPrancheta(pid, data)) : [];
              const pends = resumos.filter((r) => r.estado === 'pendente');
              const andando = resumos.filter((r) => r.estado === 'andamento');
              const disp = st && st.aparelhos.find((a) => a.papel === s.id);
              const hora = regs[0] ? new Date(regs[0].atualizadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
              // o que falta vem primeiro; depois a dorna em andamento (o escritório vê as duas coisas)
              const agora = [pends[0], andando[0]].filter(Boolean).map((r) => r.texto.replace(/\.$/, '')).join('. ');
              const situacao = diasBuscando.has(data) ? 'Buscando as anotações na central...' : agora ? agora + '.' : regs.length ? `${contar(regs.length, 'anotação', 'anotações')}, a última às ${hora}` : 'Nada anotado neste dia';
              const aparelho = cfg.demo ? '' : disp ? (disp.bloqueio ? 'Bloqueado' : disp.online ? `Ligado${disp.operador ? `, ${disp.operador}` : ''}` : situacaoDoAparelho(disp)) : 'Tablet não conectado';
              const sinal = cfg.demo ? '' : disp && disp.online ? 'ok' : disp ? 'off' : '';
              return `<button class="setor-cartao ${pends.length ? 'pendente' : andando.length ? 'andamento' : regs.length ? 'feito' : ''}" data-a="abrir-setor" data-id="${s.id}">
                <span class="desenho">${ico(s.icone)}</span>
                <span class="texto"><b>${esc(s.nome)}</b>${aparelho ? `<span class="conexao ${sinal}"><i></i>${esc(aparelho)}</span>` : ''}
                <span class="situacao">${esc(situacao)}</span></span><span class="seta">${ico('seta')}</span></button>`;
            }).join('')}</div>` : ''}
            ${htmlGraficosDoPainel(data)}
          </section>

          <aside class="lateral-chefe">
            ${veNoChefe('escritorio') ? blocoEscritorio() : ''}
            ${veNoChefe('relatorios') ? `<section class="bloco">
              <h2>Compartilhar a folha do dia</h2>
              <button class="btn primario largo" data-a="compartilhar" data-destino="escritorio">${ico('enviar')} Enviar para o escritório</button>
              <div class="grade-acoes">
                <button data-a="compartilhar" data-destino="whatsapp">${ico('whatsapp')}<span>WhatsApp</span></button>
                <button data-a="compartilhar" data-destino="email">${ico('email')}<span>E-mail</span></button>
                <button data-a="compartilhar" data-destino="outros">${ico('compartilhar')}<span>Outros apps</span></button>
                <button data-a="compartilhar" data-destino="baixar">${ico('baixar')}<span>Guardar</span></button>
                <button data-a="imprimir">${ico('imprimir')}<span>Imprimir</span></button>
                <button data-a="relatorios">${ico('pasta')}<span>Relatórios</span></button>
              </div>
            </section>` : ''}
            ${blocoAparelhosAgora()}
            ${blocoIrPara()}
            ${cfg.demo || pode('conexao') ? `<section class="bloco conectar">
              <h2>Conectar um tablet</h2>
              ${cfg.demo
                ? '<p class="sub" style="margin:0">Na usina, aqui aparecem o QR code para baixar o aplicativo e o código de conexão.</p>'
                : `<div class="conectar-linha">
                  <button class="qr" id="qr" data-a="qr-grande" aria-label="Ampliar o QR code"></button>
                  <div class="conectar-info"><small>Código de conexão</small>
                  <p class="codigo-grande">${st ? esc(String(st.codigo).replace(/(\d{3})(\d{3})/, '$1 $2')) : '--- ---'}</p>
                  <div class="linha-botoes"><button class="btn pequeno" data-a="qr-grande">Ampliar QR code</button><button class="btn pequeno" data-a="novo-codigo">Trocar código</button></div></div></div>`}
            </section>` : ''}
          </aside>
        </div>
      </main>`;
  }
  /** Escritório dentro do painel (versão 2.15): o lote do dia que fechou e as duas partes, sem trocar de aparelho. */
  function blocoEscritorio() {
    const dia = diaFechado();
    const salvo = rastreioGuardado(dia);
    return `<section class="bloco escritorio-bloco">
      <h2>Escritório</h2>
      <div class="lote-linha"><small>Lote de ${fmtData(somarDias(dia, 1)).slice(0, 5)}</small><b>${esc(window.Rastreamento.lote(C, somarDias(dia, 1)))}</b>
        <span class="conexao ${salvo ? 'ok' : 'off'}"><i></i>${salvo ? 'Rastreamento salvo' : 'Rastreamento ainda não salvo'}</span></div>
      <div class="grade-acoes duas">
        <button data-a="esc-abrir" data-t="esc-calculos" data-dia="${dia}">${ico('grafico')}<span>Cálculos da produção</span></button>
        <button data-a="esc-abrir" data-t="esc-rastreamento" data-dia="${dia}">${ico('documento')}<span>Rastreamento e etiqueta</span></button>
      </div>
    </section>`;
  }
  /** Quem está trabalhando agora: cada aparelho, quem usa e se está ligado (a visão geral do escritório). */
  function blocoAparelhosAgora() {
    const lista = ((sync.status && sync.status.aparelhos) || []).slice().sort((a, b) => Number(!!b.online) - Number(!!a.online));
    if (!lista.length) return '';
    return `<section class="bloco aparelhos-agora"><div class="titulo-secao"><h2>Aparelhos agora</h2><button class="btn pequeno" data-a="aparelhos">Ver todos</button></div>
      ${lista.slice(0, 8).map((a) => `<div class="agora-linha"><span class="conexao ${a.bloqueio ? 'off' : a.online ? 'ok' : 'off'}"><i></i></span>
        <span><b>${esc(funcaoDoAparelho(a))}</b><small>${esc(quemUsa(a))} · ${esc(situacaoDoAparelho(a))}</small></span></div>`).join('')}
      ${lista.length > 8 ? `<p class="sub">E mais ${lista.length - 8}.</p>` : ''}
    </section>`;
  }
  /** Atalhos para as outras telas, só os que a pessoa pode usar. */
  function blocoIrPara() {
    const itens = [['graficos', 'grafico', 'Gráficos', ''], ['relatorios', 'pasta', 'Relatórios', 'relatorios'], ['aparelhos', 'wifi', 'Aparelhos', ''],
      ['pessoas', 'pessoas', 'Pessoas', 'pessoas'], ['registro', 'nota', 'Registro', 'registro'], ['config', 'ajustes', 'Usina', 'usina']]
      .filter(([, , , f]) => !f || veNoChefe(f));
    return `<section class="bloco ir-para"><h2>Ir para</h2><div class="grade-acoes">${itens.map(([a, i, t]) => `<button data-a="${a}">${ico(i)}<span>${t}</span></button>`).join('')}</div></section>`;
  }
  function desenharQr() {
    const el = document.getElementById('qr');
    if (!el || typeof window.qrcode !== 'function' || cfg.demo) return;
    const st = sync.status;
    const url = st && st.enderecos && st.enderecos[0] ? st.enderecos[0] + '/baixar' : '';
    if (!url) { el.innerHTML = '<span class="sub">Procurando o Wi-Fi</span>'; return; }
    // montar o QR code é pesado: guarda o desenho e só refaz se o endereço mudar
    if (qrGuardado.url !== url) {
      const q = window.qrcode(0, 'M'); q.addData(url); q.make();
      qrGuardado.url = url; qrGuardado.svg = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    }
    el.innerHTML = qrGuardado.svg;
  }
  const qrGuardado = { url: '', svg: '' };
