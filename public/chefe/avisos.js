/* Pranchetas Ubirálcool - avisos que o tablet chefe manda
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * Tela de avisos do tablet chefe: escrever, mandar e acompanhar
   * ========================================================= */
  const FRASES_AVISO = ['Passe no escritório.', 'Ligue para o escritório.', 'Venha falar comigo quando puder.'];
  function previaDoAviso(f) {
    const setor = (setorPorId(f.setor) || {}).nome || '';
    const quem = f.nome || 'alguém';
    if (cfg.demo) return `Demonstração: no aparelho da ${setor}, o aviso aparece quando ${quem} entrar.`;
    if (trabalhandoAgora(f.setor, f.nome)) return f.nome ? `${f.nome} está trabalhando agora: o aviso aparece na tela em poucos segundos.` : `Tem gente trabalhando agora na ${setor}: o aviso aparece na tela em poucos segundos.`;
    return f.nome ? `${f.nome} não está trabalhando agora. O aviso fica guardado e aparece quando ${f.nome} entrar.` : `Ninguém trabalhando agora na ${setor}. O aviso fica guardado e aparece quando alguém entrar.`;
  }
  function htmlListaAvisos() {
    const lista = todosAvisos().slice(0, 50);
    if (!lista.length) return '<p class="sub">Nenhum aviso enviado ainda.</p>';
    return lista.map((av) => {
      const s = situacaoDoAviso(av);
      const setor = (setorPorId(av.paraSetor) || {}).nome || av.paraSetor;
      const quando = av.enviadoEm ? horaCurta(av.enviadoEm) + (av.data !== dataProducao() ? ` · ${fmtData(av.data)}` : '') : '';
      return `<div class="aviso-item ${s.estado}">
        <div class="aviso-item-cab"><b>${esc(av.paraNome || 'Quem estiver no setor')}</b><span>${esc(setor)}${quando ? ` · ${esc(quando)}` : ''}</span></div>
        <p>${esc(av.texto)}</p>
        <div class="aviso-item-pe"><span class="selo ${s.estado}">${esc(s.texto)}</span>
          ${['esperando', 'na-tela'].includes(s.estado) ? `<button class="btn pequeno" data-a="aviso-cancelar" data-id="${esc(av.id)}" data-data="${esc(av.data)}">Cancelar</button>` : ''}</div>
      </div>`;
    }).join('');
  }
  function telaAvisos(v) {
    const lista = setores();
    const f = v.form || (v.form = { setor: (lista[0] || {}).id, nome: '', texto: '' });
    if (!lista.some((s) => s.id === f.setor)) { f.setor = (lista[0] || {}).id; f.nome = ''; }
    const ops = f.setor ? operadoresDo(f.setor) : [];
    if (f.nome && !ops.some((o) => o.nome === f.nome)) f.nome = '';
    return `${cabecalho('Avisos', 'Mensagens para quem está trabalhando', true)}
      <main class="tela-avisos">
        <div class="avisos-grade">
          <section class="bloco novo-aviso">
            <h2>${ico('sino')} Novo aviso</h2>
            <h3>Para qual setor?</h3>
            <div class="chips-escolha">${lista.map((s) => `<button class="${s.id === f.setor ? 'sel' : ''}" data-a="aviso-setor" data-id="${s.id}">${ico(s.icone)}<span>${esc(s.nome)}</span></button>`).join('')}</div>
            <h3>Para quem?</h3>
            <div class="chips-escolha">
              <button class="${!f.nome ? 'sel' : ''}" data-a="aviso-pessoa" data-nome="">${ico('pessoas')}<span>Quem estiver no setor</span></button>
              ${ops.map((o) => `<button class="${f.nome === o.nome ? 'sel' : ''}" data-a="aviso-pessoa" data-nome="${esc(o.nome)}">${ico('pessoa')}<span>${esc(o.nome)}</span>${trabalhandoAgora(f.setor, o.nome) ? '<small class="trabalhando">trabalhando</small>' : ''}</button>`).join('')}
            </div>
            <h3><label for="aviso-texto">Mensagem</label></h3>
            <textarea id="aviso-texto" maxlength="${TAMANHO_AVISO}" rows="3" placeholder="Escreva aqui o aviso">${esc(f.texto)}</textarea>
            <div class="frases">${FRASES_AVISO.map((t) => `<button class="btn pequeno" data-a="aviso-frase" data-texto="${esc(t)}">${esc(t)}</button>`).join('')}</div>
            <p class="aviso-previa" id="aviso-previa">${esc(previaDoAviso(f))}</p>
            <button class="btn primario largo" data-a="aviso-enviar">${ico('enviar')} Enviar aviso</button>
          </section>
          <section class="bloco">
            <h2>Avisos enviados</h2>
            <div id="lista-avisos" class="lista-avisos">${htmlListaAvisos()}</div>
          </section>
        </div>
      </main>`;
  }
  function atualizarTelaAvisos() {
    const el = document.getElementById('lista-avisos');
    if (el) el.innerHTML = htmlListaAvisos();
    const v = view();
    const p = document.getElementById('aviso-previa');
    if (p && v.form) p.textContent = previaDoAviso(v.form);
  }
  /** Fecha o aviso da tela se o escritório cancelou enquanto ele estava aberto. */
  function revisarAvisoNaTela() {
    if (!avisoNaTela) return;
    const av = todosAvisos().find((x) => x.id === avisoNaTela);
    if (av && av.cancelado && modalAberto()) { fecharModalAtual(); toast('O escritório cancelou o aviso'); }
  }
