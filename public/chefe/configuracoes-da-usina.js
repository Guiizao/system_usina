/* Pranchetas Ubirálcool - configurações da usina
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * Configurações da usina (tablet chefe): valem para todos os aparelhos
   * ========================================================= */
  const LIMITE_NOMES = 4;
  function telaConfig(v) {
    const cs = configSistema();
    const desligadas = cs.pranchetasDesligadas || {};
    const abertos = v.abertos || {};
    const lista = (nome, rotulo) => `<div class="chips">${listaDaUsina(nome).map((x, i) => `<span class="chip-item">${esc(x)}<button data-a="lista-remove" data-lista="${nome}" data-i="${i}" aria-label="Remover ${esc(x)}">${ico('fechar')}</button></span>`).join('') || `<span class="sub" style="margin:0">Nenhum ${rotulo} cadastrado</span>`}
      <button class="btn pequeno" data-a="lista-add" data-lista="${nome}">${ico('mais')} Adicionar</button></div>`;
    return `${topo('Configurações da usina', 'Vale para todos os tablets', true)}
      <main class="config">
        <p class="sub">O que você mudar aqui chega nos tablets dos setores em alguns segundos.</p>
        ${pode('pessoas') || pode('registro') || pode('folhas') ? `<div class="linha-botoes" style="margin:0 0 10px">${pode('pessoas') ? `<button class="btn pequeno" data-a="pessoas">${ico('pessoas')} Pessoas e permissões</button>` : ''}${pode('registro') ? `<button class="btn pequeno" data-a="registro">${ico('planilha')} Registro do sistema</button>` : ''}${pode('folhas') ? `<button class="btn pequeno" data-a="folhas">${ico('lapis')} Folhas e avisos</button>` : ''}</div>` : ''}
        <div class="config-grade">
          <section class="bloco">
            <h2>${ico('enviar')} Enviar para o escritório</h2>
            <p class="sub">O botão "Enviar para o escritório" manda direto para o WhatsApp. Sem número, usa o e-mail.</p>
            <div class="linha-config"><span class="escolha-ico">${ico('whatsapp')}</span><div><b>WhatsApp</b><small>${esc(cs.whatsapp ? formatarTelefone(cs.whatsapp) : 'não cadastrado')}</small></div>
              <button class="btn pequeno" data-a="contato" data-campo="whatsapp">${cs.whatsapp ? 'Trocar' : 'Cadastrar'}</button></div>
            <div class="linha-config"><span class="escolha-ico">${ico('email')}</span><div><b>E-mail</b><small>${esc(cs.email || 'não cadastrado')}</small></div>
              <button class="btn pequeno" data-a="contato" data-campo="email">${cs.email ? 'Trocar' : 'Cadastrar'}</button></div>
          </section>
          <section class="bloco" id="bloco-medidas">
            <h2>${ico('regua')} Medidas das dornas</h2>
            <p class="sub" style="margin:0 0 6px">Para o volume de vinho: volume = (altura − folga) × base × 1000, em litros. Nos tanques de álcool fica em m³, sem o × 1000. Começou com as medidas da planilha CONTROLE LTS.</p>
            ${gruposDaMedicao().map((g) => {
              const semMedida = g.dornas.filter((d) => !temMedida(d)).length;
              const iguais = g.dornas.every((d) => d.altura === g.dornas[0].altura && d.area === g.dornas[0].area);
              const txt = iguais && temMedida(g.dornas[0]) ? `${contar(g.dornas.length, 'dorna', 'dornas')}: altura ${fmtNum(String(g.dornas[0].altura))} m, base ${fmtNum(String(g.dornas[0].area))} m²` : `${contar(g.dornas.length, 'dorna', 'dornas')} com medidas diferentes`;
              return `<div class="linha-config"><span class="escolha-ico">${ico(g.fermentando ? 'tanque' : 'regua')}</span><div><b>${esc(g.nome)}</b><small>${esc(txt)}${semMedida ? ` · ${contar(semMedida, 'sem medida', 'sem medida')}` : ''}</small></div>
                <button class="btn pequeno" data-a="medida-grupo" data-grupo="${g.id}">Trocar</button></div>`;
            }).join('')}
            ${cs.medicao ? `<div class="linha-botoes"><button class="btn pequeno" data-a="medidas-planilha">Voltar para as medidas da planilha</button></div>` : ''}
          </section>
          <section class="bloco" id="bloco-base44">
            <h2>${ico('escritorio')} Totais do dia no Base44</h2>
            ${htmlBase44()}
          </section>
          <section class="bloco" id="bloco-nuvem">
            <h2>${ico('servidor')} Nuvem (internet)</h2>
            ${htmlNuvem()}
          </section>
          <section class="bloco">
            <h2>${ico('balanca')} Listas do ralo</h2>
            <h3>Tipos de produto</h3>${lista('produtos', 'produto')}
            <h3 style="margin-top:14px">Fornecedores</h3>${lista('fornecedores', 'fornecedor')}
          </section>
          <section class="bloco">
            <h2>${ico('wifi')} Aparelhos conectados</h2>
            ${htmlAparelhos()}
            <div class="linha-botoes"><button class="btn pequeno" data-a="aparelhos">${ico('wifi')} Ver todos os aparelhos</button><button class="btn pequeno" data-a="ver-erros">${ico('alerta')} Ver erros dos aparelhos</button></div>
          </section>
          <section class="bloco">
            <h2>${ico('lixeira')} Apagar todos os dados do sistema</h2>
            <p class="sub" style="margin:0 0 10px">Apaga as anotações de todos os setores, na central e em todos os tablets. Operadores, senhas, contatos e listas continuam. Uma cópia fica em BackupUsina. Pede a senha do programador.</p>
            <div class="linha-botoes"><button class="btn pequeno perigo" data-a="zerar-tudo">${ico('lixeira')} Apagar todos os dados do sistema</button></div>
          </section>
        </div>
        <h2 style="margin-top:8px">Setores</h2>
        <div class="config-grade">${todosSetores.map((s) => {
          const ligado = setorAtivo(s.id);
          const off = desligadas[s.id] || [];
          const ops = operadoresDo(s.id);
          const aberto = abertos[s.id];
          const visiveis = aberto ? ops : ops.slice(0, LIMITE_NOMES);
          return `<section class="bloco setor-config ${ligado ? '' : 'desligado'}">
            <div class="setor-config-cab"><span class="desenho">${ico(s.icone)}</span><h2>${esc(s.nome)}</h2>
              <button class="interruptor ${ligado ? 'ligado' : ''}" data-a="setor-liga" data-id="${s.id}" aria-label="${ligado ? 'Desligar' : 'Ligar'} ${esc(s.nome)}"><i></i><span>${ligado ? 'Ligado' : 'Desligado'}</span></button></div>
            ${ligado ? `<h3>Pranchetas</h3>
              <div class="chips">${s.pranchetas.map((pid) => {
                const on = off.indexOf(pid) < 0;
                return `<button class="chip-liga ${on ? 'sel' : ''}" data-a="prancheta-liga" data-setor="${s.id}" data-id="${pid}">${on ? ico('certo') : ico('fechar')} ${esc(prancheta(pid).nome)}</button>`;
              }).join('')}</div>
              ${!s.soChefe ? linhaTurnos(s) : ''}
              ${!s.soChefe && s.pranchetas.some((pid) => prancheta(pid).tipo === 'grade') ? linhaLembrete(s) : ''}
              ${s.soChefe ? '<p class="sub" style="margin:10px 0 0">Só o tablet chefe anota estas folhas. Nenhum tablet de setor fica com elas.</p>' : `<h3 style="margin-top:14px">Operadores <small>${ops.length}</small></h3>
              <div class="pessoas">${visiveis.map((o) => {
                const i = ops.indexOf(o);
                return `<div><span class="nome">${ico('pessoa')} <b>${esc(o.nome)}</b><small class="${o.senha ? '' : 'sem-senha'}">${o.senha ? 'com senha' : 'sem senha'}</small></span>
                <span class="acoes"><button class="btn pequeno" data-a="op-senha" data-setor="${s.id}" data-i="${i}">Senha</button>
                <button class="btn pequeno perigo" data-a="op-remove" data-setor="${s.id}" data-i="${i}" aria-label="Remover ${esc(o.nome)}">${ico('lixeira')}</button></span></div>`;
              }).join('') || '<div class="vazio">Nenhum operador cadastrado</div>'}</div>
              <div class="linha-botoes">
                ${ops.length > LIMITE_NOMES ? `<button class="btn pequeno" data-a="mostrar-mais" data-setor="${s.id}">${aberto ? 'Mostrar menos' : `Mostrar mais (${ops.length - LIMITE_NOMES})`}</button>` : ''}
                <button class="btn pequeno" data-a="op-add" data-setor="${s.id}">${ico('mais')} Cadastrar operador</button></div>`}` : '<p class="sub" style="margin:8px 0 0">Setor desligado. O tablet dele mostra um aviso e não deixa anotar.</p>'}
          </section>`;
        }).join('')}</div>
      </main>`;
  }
  function htmlAparelhos() {
    const st = sync.status;
    if (cfg.demo) return '<p class="sub" style="margin:0">Na demonstração não há outros aparelhos.</p>';
    const lista = st && st.aparelhos ? st.aparelhos : [];
    if (!lista.length) return '<p class="sub" style="margin:0">Nenhum aparelho mandou nada desde que a central ligou.</p>';
    return `<div class="lista-aparelhos">${lista.slice(0, 6).map(linhaDoAparelho).join('')}</div>${lista.length > 6 ? `<p class="sub" style="margin:6px 0 0">E mais ${lista.length - 6} em Ver todos os aparelhos.</p>` : ''}`;
  }
  async function verErros() {
    let lista = [];
    try {
      const r = await buscar('api/erros', {}, 6000);
      lista = r.ok ? (await r.json()).erros || [] : [];
    } catch (e) { return toast('Não consegui falar com a central', 'erro'); }
    const quando = (ms) => new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    await abrirModal(`<h3>Erros dos aparelhos</h3>
      <p class="dica">${lista.length ? `Os ${Math.min(lista.length, 40)} mais recentes. Ficam guardados em ServidorUsina, no arquivo erros.log.` : 'Nenhum erro registrado. Tudo certo.'}</p>
      <div class="lista-erros">${lista.slice(-40).reverse().map((e) => `<div><b>${esc(quando(e.quando || e.recebidoEm))} · ${esc((setorPorId(e.papel) || {}).nome || e.papel || '')} · ${esc(e.aparelho || '')}</b><span>${esc(e.msg)}</span><small>tela ${esc(e.tela || '-')} · versão ${esc(e.versao || '-')}</small></div>`).join('')}</div>
      <div class="acoes-modal um"><button class="btn primario" data-k="x">Fechar</button></div>`, (k, b, fechar) => fechar(), { classe: 'largo' });
  }
  function mudarConfigLista(tipo, setorId, pid) {
    const cs = configSistema();
    if (tipo === 'setor') {
      const lista = [...(cs.setoresDesligados || [])];
      const i = lista.indexOf(setorId);
      if (i < 0) lista.push(setorId); else lista.splice(i, 1);
      salvarConfigSistema({ setoresDesligados: lista });
    } else {
      const mapa = Object.assign({}, cs.pranchetasDesligadas || {});
      const lista = [...(mapa[setorId] || [])];
      const i = lista.indexOf(pid);
      if (i < 0) lista.push(pid); else lista.splice(i, 1);
      mapa[setorId] = lista;
      salvarConfigSistema({ pranchetasDesligadas: mapa });
    }
    render();
  }
  const telefoneLimpo = (t) => String(t || '').replace(/\D/g, '');
  const telefoneInternacional = (t) => { const n = telefoneLimpo(t); return n.length <= 11 ? '55' + n : n; };
  function formatarTelefone(t) {
    const n = telefoneLimpo(t);
    return n.length === 11 ? `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}` : n.length === 10 ? `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}` : n;
  }
