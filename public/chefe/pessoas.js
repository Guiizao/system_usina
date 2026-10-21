/* Pranchetas Ubirálcool - pessoas, permissões e registro do sistema
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * Pessoas do escritório e registro do sistema (versão 2.9)
   * No tablet chefe cada pessoa entra com a sua senha (só a senha já diz quem é). O painel fica sempre à vista;
   * quando alguém faz algo que precisa de permissão, o aplicativo pede a senha uma vez. Depois de 30 minutos
   * sem mexer, a pessoa sai sozinha. O que cada uma pode fazer: o nível dela (forms.js), o ajuste do
   * administrador e o que aquele tablet chefe deixa fazer. O administrador pode tudo.
   * O registro guarda cada mudança (hora, quem, aparelho, antes e depois). O aplicativo escreve o que a pessoa
   * fez; a central escreve entradas, aparelhos e código. Ele não fica nos tablets: o chefe pede o dia na central.
   * ========================================================= */
  const PID_REGISTRO = 'registro';
  // versão 2.15: quem entra no tablet chefe fica até o fim do turno (pedido do Guilherme: uma senha por turno)
  const turnoDaPessoa = () => `${dataProducao()}|${turnoAtual().id}`;
  let demoSemPessoa = false; // demonstração do tablet chefe sem ninguém (para conferir a tela)
  let demoFuncoes = null; // demonstração com uma pessoa que só pode algumas coisas (&funcoes=relatorios,escritorio)
  const pessoaAtual = () => {
    if (cfg.demo && ehCentral()) return demoSemPessoa ? null : demoFuncoes ? { nome: 'Lucas', nivel: 'consulta', funcoes: demoFuncoes } : { nome: 'Guilherme', nivel: 'administrador', extras: {}, teto: null, dono: true };
    if (cfg.soNuvem) return cfg.pessoa || null; // pela nuvem: vale até sair (a nuvem já conferiu a senha)
    if (!ehCentral() || !cfg.pessoa) return null;
    return cfg.pessoaTurno === turnoDaPessoa() ? cfg.pessoa : null;
  };
  /** O que a pessoa pode fazer: o nível, o ajuste do administrador e o que este tablet chefe deixa. */
  function funcoesDe(p) {
    if (!p) return new Set();
    // versão 2.12: a central diz o que vale neste aparelho (a pessoa, o nível do tablet chefe e o limite dele)
    if (Array.isArray(p.funcoes)) return new Set(p.funcoes);
    const todas = C.funcoes.map((f) => f.id);
    if (p.dono) return new Set([...todas, 'pessoas', 'chefes', 'sistema']); // sem a central (demonstração): o dono pode tudo
    if (p.nivel === 'administrador') return new Set([...todas, 'pessoas']);
    const nivel = C.niveis[p.nivel] || { funcoes: [] };
    const s = new Set(nivel.funcoes === 'todas' ? todas : nivel.funcoes);
    Object.entries(p.extras || {}).forEach(([f, sim]) => { if (sim) s.add(f); else s.delete(f); });
    if (Array.isArray(p.teto)) [...s].forEach((f) => { if (!p.teto.includes(f)) s.delete(f); });
    return s;
  }
  const pode = (f) => funcoesDe(pessoaAtual()).has(f);
  // tablet chefe com alguém dentro que não pode corrigir: as folhas dos setores abrem só para consultar
  const soConsulta = () => ehCentral() && !!pessoaAtual() && !pode('corrigir');
  const nomeDaFuncao = (f) => ((C.funcoes.find((x) => x.id === f) || {}).nome || 'isso').replace(/ \(.*\)$/, '').toLowerCase();
  /** Antes de uma ação do tablet chefe: confere a permissão (e pede a senha se ninguém entrou). */
  async function exigir(f) {
    if (pode(f)) return true;
    if (!ehCentral()) return verificarNoSetor(f);
    if (!pessoaAtual()) {
      if (!(await entrarNoChefe())) return false;
      if (pode(f)) return true;
    }
    toast(`${pessoaAtual().nome} não pode ${nomeDaFuncao(f)}. Peça ao administrador.`, 'erro');
    return false;
  }
  async function entrarNoChefe(pinPronto) {
    const pin = pinPronto || await pedirSenhaModal('Quem está usando?', 'Digite a sua senha. Ela diz quem você é.');
    if (pin === undefined) return false;
    const r = await postJson('api/pessoas', { acao: 'entrar', pin }, 10000).catch(() => null);
    if (!r) { toast('Não consegui falar com a central', 'erro'); return false; }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      // tablet chefe que a central ainda não conhece (versão 2.12): libera e entra
      if (d.naoLiberado) { const outra = await liberarEsteAparelho(); return outra === undefined ? false : entrarNoChefe(outra || undefined); }
      toast(d.erro || 'Senha errada', 'erro');
      return false;
    }
    if (d.nivel) cfg.nivelChefe = d.nivel;
    cfg.pessoa = Object.assign({}, d.pessoa, { teto: d.teto || null }, Array.isArray(d.funcoes) ? { funcoes: d.funcoes, dono: !!d.dono } : {}); cfg.pessoaTurno = turnoDaPessoa(); salvarCfg();
    // o que a central não aceitou por falta de alguém dentro (ou de permissão) vai de novo, agora com esta pessoa
    let guardadas = 0;
    Object.values(registros).forEach((r) => { if (r.esperaEntrar) { delete r.esperaEntrar; guardadas += 1; } });
    if (guardadas) { salvarRegistros(); sincronizarLogo(); }
    toast(`Olá, ${d.pessoa.nome}`);
    mandarFolhasParaCentral();
    render();
    return true;
  }
  /* ---------- Liberar este aparelho como tablet chefe (versão 2.12) ----------
     A central só deixa entrar pessoa num tablet chefe liberado, com uma senha: o nível 3 (configurações do sistema)
     só o dono; o 1 ou o 2, quem libera tablets chefe (o administrador). Devolve a senha usada, para já entrar com ela
     (null: entrar pedindo a senha; undefined: não liberou). */
  const nomeDoNivelChefe = (n) => ((C.niveisDoAparelho || {})[n] || {}).nome || `Nível ${n}`;
  async function liberarEsteAparelho() {
    const niveis = C.niveisDoAparelho || {};
    let escolhido = 2;
    const resp = await abrirModal(`<h3>Liberar este aparelho como tablet chefe</h3>
      <p class="dica">Escolha o que este tablet chefe vai poder fazer. Depois, quem libera tablets chefe (o administrador) digita a senha. O nível 3 só o dono do sistema libera.</p>
      <div class="opcoes-nivel">${[1, 2, 3].map((n) => `<button class="nivel-op" data-k="n:${n}"><b>${esc(nomeDoNivelChefe(n))}</b><span>${esc((niveis[n] || {}).texto || '')}</span></button>`).join('')}</div>
      <div class="linha-botoes"><button class="btn pequeno" data-k="recuperar">Sou o dono e perdi a senha ou o tablet</button></div>
      <div class="acoes-modal"><button class="btn" data-k="x">Cancelar</button><button class="btn primario" data-k="ok">Continuar</button></div>`,
    (k, b, fechar, f) => {
      if (k === 'x') return fechar(undefined);
      if (k === 'recuperar') return fechar('recuperar');
      if (k.startsWith('n:')) { escolhido = Number(k.slice(2)); f.querySelectorAll('[data-k^="n:"]').forEach((x) => x.classList.toggle('sel', x.dataset.k === k)); return; }
      if (k === 'ok') fechar(escolhido);
    }, { classe: 'largo com-niveis', aoAbrir: (f) => f.querySelector('[data-k="n:2"]').classList.add('sel') });
    if (resp === undefined) return undefined;
    if (resp === 'recuperar') return recuperarDono();
    const pin = await pedirSenhaModal(`Senha para liberar o ${nomeDoNivelChefe(resp)}`, resp === 3 ? 'Só a senha do dono do sistema libera o nível 3.' : 'A senha de quem libera tablets chefe (o administrador).');
    if (pin === undefined) return undefined;
    const r = await postJson('api/chefes', { acao: 'liberar', pin, nivel: resp }, 10000).catch(() => null);
    if (!r) { toast('Não consegui falar com a central', 'erro'); return undefined; }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast(d.erro || 'A central recusou', 'erro'); return undefined; }
    cfg.nivelChefe = d.nivel; salvarCfg();
    toast(`Aparelho liberado: tablet chefe ${nomeDoNivelChefe(d.nivel)}`);
    return pin;
  }
  /** O dono esqueceu a senha ou perdeu o tablet nível 3: com a senha do programador, este aparelho vira o dele. */
  async function recuperarDono() {
    const senha = await pedirSenhaModal('Senha do programador', 'Com ela, este aparelho vira o tablet do dono (nível 3).');
    if (senha === undefined) return undefined;
    const trocar = await confirmar('Trocar a senha do dono?', 'Se você esqueceu a sua senha, escolha uma nova agora. Se só perdeu o tablet, pode manter a de hoje.', 'Escolher senha nova');
    let novaSenha = '';
    if (trocar) { novaSenha = await pedirSenhaModal('Nova senha do dono', 'De 4 a 8 números.'); if (novaSenha === undefined) return undefined; }
    const r = await postJson('api/chefes', { acao: 'recuperar', senha, novaSenha }, 30000).catch(() => null);
    if (!r) { toast('Não consegui falar com a central', 'erro'); return undefined; }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast(d.erro || 'A central recusou', 'erro'); return undefined; }
    cfg.nivelChefe = 3; salvarCfg();
    toast('Este aparelho agora é o tablet do dono (nível 3)');
    return trocar ? novaSenha : null;
  }
  /** Ao escolher "Tablet chefe": se a central ainda não liberou este aparelho, libera agora. */
  async function garantirLiberacaoDeChefe() {
    const r = await postJson('api/chefes', { acao: 'estado' }, 8000).catch(() => null);
    if (!r || !r.ok) return true; // central de antes da 2.12 (sem a rota) ou sem resposta: ela confere de novo quando a pessoa entrar
    const d = await r.json().catch(() => ({}));
    if (d.nivel) { cfg.nivelChefe = d.nivel; return true; }
    return (await liberarEsteAparelho()) !== undefined;
  }
  /** A central diz quem está neste tablet chefe e o que pode. Se a sessão caiu (o nível mudou, a pessoa foi
      desativada, outra pessoa entrou), sai daqui também; se as funções mudaram, passa a valer na hora. */
  async function conferirSessao() {
    const r = await postJson('api/pessoas', { acao: 'quem' }, 8000).catch(() => null);
    if (!r || !r.ok || !cfg.pessoa) return;
    const d = await r.json().catch(() => ({}));
    if (d.nivel) cfg.nivelChefe = d.nivel;
    if (!d.pessoa || d.pessoa.id !== cfg.pessoa.id) {
      cfg.pessoa = null; salvarCfg();
      toast('Você saiu deste tablet chefe (o nível dele mudou ou a sessão acabou). Entre de novo.');
      return render();
    }
    if (Array.isArray(d.funcoes) && JSON.stringify(d.funcoes) !== JSON.stringify(cfg.pessoa.funcoes || null)) {
      cfg.pessoa = Object.assign({}, cfg.pessoa, { funcoes: d.funcoes, dono: !!d.dono }); salvarCfg();
      if (!modalAberto()) render();
    }
  }
  /* Versão 2.15: outro tablet chefe trocou o código de conexão. Este aparelho (nível 3, do dono) continuou conectado
     e escolhe: manter o código novo ou voltar ao anterior. Pergunta uma vez por troca (Depois: pergunta ao abrir de novo). */
  let codigoTrocadoVisto = '';
  async function avisarCodigoTrocado(t) {
    if (!t || !t.id || t.id === codigoTrocadoVisto || modalAberto()) return;
    codigoTrocadoVisto = t.id;
    const quando = new Date(t.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const acao = await abrirModal(`<h3>O código de conexão foi trocado</h3>
      <p>${esc(t.quem || 'Alguém')} trocou o código no ${esc(t.aparelho || 'tablet chefe')} em ${esc(quando)}. Este aparelho continua conectado.</p>
      <p class="dica">Manter: os outros aparelhos usam o código novo. Voltar: volta o código de antes, e quem já entrou com o novo conecta de novo.</p>
      <div class="acoes-modal"><button class="btn" data-k="voltar">Voltar ao anterior</button><button class="btn primario" data-k="manter">Manter o novo</button></div>
      <div class="acoes-modal um"><button class="btn" data-k="depois">Decidir depois</button></div>`,
    (k, b, fechar) => fechar(k));
    if (acao !== 'manter' && acao !== 'voltar') return;
    const r = await postJson('api/codigo-trocado', { id: t.id, acao }, 10000).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) { codigoTrocadoVisto = ''; return toast(d.erro || 'Não consegui falar com a central', 'erro'); }
    if (d.chave) { cfg.chave = d.chave; cfg.cifra = 1; salvarCfg(); }
    sync.statusJson = ''; sincronizar();
    toast(acao === 'manter' ? 'Código novo mantido' : 'Voltou o código de antes');
  }
  function sairDoChefe(motivo) {
    if (!cfg.pessoa) return;
    postJson('api/pessoas', { acao: 'sair', motivo: motivo || '' }, 5000).catch(() => {});
    cfg.pessoa = null; salvarCfg();
    render();
  }
  /** Tablet de setor (ajustes, liberar operador): a central confere a senha. Sem a central, só a senha de emergência. */
  async function verificarNoSetor(f, titulo, dica) {
    const pin = await pedirSenhaModal(titulo, dica);
    if (pin === undefined) return false;
    const r = cfg.demo ? null : await postJson('api/pessoas', { acao: 'verificar', pin }, 6000).catch(() => null);
    if (!r) {
      if (pin === C.pinAdmin) return true;
      toast(cfg.demo ? 'Senha errada' : 'Sem a central: só a senha do administrador funciona agora', 'erro');
      return false;
    }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast(d.erro || 'Senha errada', 'erro'); return false; }
    if (!funcoesDe(d.pessoa).has(f)) { toast(`${d.pessoa.nome} não pode ${nomeDaFuncao(f)}`, 'erro'); return false; }
    registrar('entrada', `${d.pessoa.nome} liberou ${nomeDaFuncao(f)} no ${nomeDesteAparelho()}`);
    return true;
  }

  /** A central não aceitou algo deste aparelho: uma notificação só, com o motivo. */
  function avisarRecusa(recusados) {
    const m = recusados.map((x) => x.motivo);
    if (m.includes('conflito')) return toast('A configuração mudou em outro tablet. Confira e faça a mudança de novo.', 'erro');
    if (m.includes('sem_sessao')) return toast('Ninguém entrou neste tablet chefe. O que foi anotado ficou guardado aqui e sobe quando alguém entrar.', 'erro');
    if (recusados.some((x) => registros[x.id] && registros[x.id].esperaEntrar)) return toast('Quem está neste aparelho não pode fazer essa anotação. Ela ficou guardada aqui e sobe quando entrar alguém que pode.', 'erro');
    return toast('Quem está neste aparelho não pode fazer essa mudança. Ela foi desfeita.', 'erro');
  }
  const nomeDesteAparelho = () => (ehCentral() ? nomeDoChefe() : ehEscritorio() ? 'Escritório' : setorPorId(cfg.papel) ? `Tablet da ${setorPorId(cfg.papel).nome}` : 'aparelho');
  const quemEstaAqui = () => operadorAtual() || (pessoaAtual() && pessoaAtual().nome) || (ehCentral() ? nomeDoChefe() : 'Sem operador');
  /** Uma linha no registro do sistema. tipo: anotacao, entrada, aparelho ou configuracao. */
  function registrar(tipo, texto, mudancas) {
    if (cfg.demo || !cfg.chave) return;
    const em = Date.now();
    const chave = em.toString(36) + '-' + Math.random().toString(36).slice(2, 6);
    gravar(dataProducao(), PID_REGISTRO, chave, Object.assign({ em, tipo, quem: quemEstaAqui(), aparelho: nomeDesteAparelho(), texto }, mudancas && mudancas.length ? { mudancas } : {}), { operador: quemEstaAqui() });
  }
  const valorNoRegistro = (x) => {
    if (x == null || x === '') return '(vazio)';
    if (Array.isArray(x)) return x.length ? x.map((s) => (s && typeof s === 'object' ? [s.inicio, s.fim].filter(Boolean).join('-') : String(s))).join(', ') : '(vazio)';
    if (typeof x === 'object') return x.hora || x.data || '(marcado)';
    return /^-?\d+\.\d+$/.test(String(x)) ? String(x).replace('.', ',') : String(x);
  };
  /** O que mudou no rascunho (antes e depois de cada quadro, com o nome do quadro). */
  function mudancasDoRascunho() {
    const nomes = {}; alvos.forEach((a) => { nomes[a.id] = a.label; });
    const lista = [];
    const comparar = (antes, depois, prefixo) => Object.keys(Object.assign({}, antes, depois)).forEach((k) => {
      const a = antes ? antes[k] : undefined, d = depois ? depois[k] : undefined;
      const objeto = (x) => x && typeof x === 'object' && !Array.isArray(x) && !('hora' in x) && !('data' in x);
      if (objeto(a) || objeto(d)) return comparar(a || {}, d || {}, (prancheta(k) || {}).nome || k);
      if (/_vol$|^dorna$|Em$/.test(k)) return; // o volume sai da folga; os outros são de controle
      if (JSON.stringify(a == null ? '' : a) === JSON.stringify(d == null ? '' : d)) return;
      lista.push({ campo: (prefixo ? prefixo + ': ' : '') + (nomes[k] || k), antes: valorNoRegistro(a), depois: valorNoRegistro(d) });
    });
    comparar(rascunho.original, rascunho.valores, '');
    const extrasAntes = JSON.parse(rascunho.originalExtras || '{}');
    if ((extrasAntes.obs || '') !== (rascunho.extras.obs || '')) lista.push({ campo: 'Observação', antes: valorNoRegistro(extrasAntes.obs), depois: valorNoRegistro(rascunho.extras.obs) });
    return lista.slice(0, 40);
  }
  /** O que mudou na configuração da usina, em palavras (nunca as senhas). */
  function textoDaConfig(mudanca) {
    const atual = configSistema();
    const partes = [];
    const nomeSetor = (id) => (setorPorId(id) || {}).nome || id;
    Object.keys(mudanca).forEach((k) => {
      const antes = atual[k], depois = mudanca[k];
      if (JSON.stringify(antes) === JSON.stringify(depois)) return;
      if (k === 'operadores') {
        new Set([...Object.keys(antes || {}), ...Object.keys(depois || {})]).forEach((s) => {
          const a = ((antes || {})[s] || []).map(comoOperador), d = ((depois || {})[s] || []).map(comoOperador);
          d.filter((o) => !a.some((x) => x.nome === o.nome)).forEach((o) => partes.push(`cadastrou ${o.nome} na ${nomeSetor(s)}`));
          a.filter((o) => !d.some((x) => x.nome === o.nome)).forEach((o) => partes.push(`tirou ${o.nome} da ${nomeSetor(s)}`));
          d.forEach((o) => { const x = a.find((y) => y.nome === o.nome); if (x && x.senha !== o.senha) partes.push(`${o.senha ? 'trocou' : 'tirou'} a senha de ${o.nome}`); });
        });
      } else if (k === 'setoresDesligados') {
        (depois || []).filter((s) => !(antes || []).includes(s)).forEach((s) => partes.push(`desligou o setor ${nomeSetor(s)}`));
        (antes || []).filter((s) => !(depois || []).includes(s)).forEach((s) => partes.push(`ligou o setor ${nomeSetor(s)}`));
      } else if (k === 'pranchetasDesligadas') partes.push('mudou as folhas ligadas dos setores');
      else if (k === 'medicao') partes.push(depois ? 'mudou as medidas das dornas' : 'voltou para as medidas da planilha');
      else if (k === 'folhas') { /* quem mexe nas folhas escreve o que mudou (editarCampoDaFolha) */ }
      else if (k === 'turnosSetor') {
        new Set([...Object.keys(antes || {}), ...Object.keys(depois || {})]).forEach((s) => {
          if ((antes || {})[s] !== (depois || {})[s]) partes.push(`mudou os turnos da ${nomeSetor(s)} para ${(depois || {})[s] === '12h' ? '2 turnos de 12 horas' : '3 turnos'}`);
        });
      } else if (k === 'lembretes') {
        new Set([...Object.keys(antes || {}), ...Object.keys(depois || {})]).forEach((s) => {
          const a = comoHorario((antes || {})[s]), d = comoHorario((depois || {})[s]);
          if (JSON.stringify(a) === JSON.stringify(d)) return;
          partes.push(d ? `${a ? 'mudou' : 'ligou'} o lembrete da ${nomeSetor(s)}: toca ${textoHorario(d)}` : `desligou o lembrete da ${nomeSetor(s)}`);
        });
      }
      else partes.push({ produtos: 'mudou a lista de produtos', fornecedores: 'mudou a lista de fornecedores', whatsapp: 'mudou o WhatsApp do escritório', email: 'mudou o e-mail do escritório' }[k] || `mudou ${k}`);
    });
    return partes;
  }

  /* ---------- Pessoas e permissões (só o administrador) ---------- */
  function telaPessoas(v) {
    if (!v.lista && !v.carregando) carregarPessoas(v);
    const l = v.lista || { pessoas: [], aparelhos: {} };
    const nivel = (n) => (C.niveis[n] || {}).nome || n;
    const resumoFuncoes = (p) => { const f = funcoesDe(Object.assign({}, p, { teto: null })); return p.id && p.id === l.donoId ? 'dono do sistema, pode tudo' : p.nivel === 'administrador' ? 'tudo' : `${f.size} de ${C.funcoes.length} funções`; };
    const st = sync.status;
    const chefes = new Map();
    ((st && st.aparelhos) || []).filter((a) => a.papel === 'central').forEach((a) => chefes.set(a.id, a));
    Object.keys(l.aparelhos || {}).forEach((id) => { if (!chefes.has(id)) chefes.set(id, { id, papel: 'central', nome: l.aparelhos[id].nome, online: false, minutos: 0 }); });
    return `${topo('Pessoas e permissões', 'Só o administrador mexe aqui', true)}
      <main class="config tela-pessoas">
        <div class="config-grade">
          <section class="bloco">
            <h2>${ico('pessoas')} Pessoas</h2>
            <p class="sub" style="margin:0 0 8px">Cada pessoa entra no tablet chefe com a sua senha. A senha já diz quem é.</p>
            ${v.carregando && !v.lista ? '<p class="sub">Buscando na central...</p>' : l.pessoas.map((p) => `<div class="linha-config ${p.ativo ? '' : 'desligado'}"><span class="escolha-ico">${ico('pessoa')}</span>
              <div><b>${esc(p.nome)}</b><small>${esc(nivel(p.nivel))} · ${esc(resumoFuncoes(p))}${p.ativo ? '' : ' · não entra mais'}</small></div>
              <button class="btn pequeno" data-a="pessoa-editar" data-id="${esc(p.id)}">Mudar</button></div>`).join('')}
            <div class="linha-botoes"><button class="btn pequeno" data-a="pessoa-nova">${ico('mais')} Cadastrar pessoa</button></div>
          </section>
          <section class="bloco">
            <h2>${ico('escritorio')} Tablets chefe</h2>
            <p class="sub" style="margin:0 0 8px">O nível de cada tablet chefe (o 3 é só do dono) e o que ele deixa fazer, seja quem for.</p>
            ${[...chefes.values()].map((a) => {
              const teto = (l.aparelhos[a.id] || {}).teto;
              return `<div class="linha-config"><span class="escolha-ico">${ico('escritorio')}</span>
                <div><b>${esc(a.nome || 'Tablet chefe')}${a.id === cfg.deviceId ? ' (este aparelho)' : ''}</b><small>${(l.aparelhos[a.id] || {}).nivel ? `${esc(nomeDoNivelChefe(l.aparelhos[a.id].nivel))} · ` : 'Não liberado · '}${a.online ? `Ligado${a.pessoa ? `, ${esc(a.pessoa)}` : ', ninguém entrou'}` : 'Sem sinal'} · ${Array.isArray(teto) ? `${teto.length} de ${C.funcoes.length} funções` : 'tudo liberado'}${a.id === cfg.deviceId ? ' · este aparelho' : ''}</small></div>
                <button class="btn pequeno" data-a="aparelho-chefe" data-id="${esc(a.id)}">Mudar</button></div>`;
            }).join('') || '<p class="sub">Nenhum tablet chefe falou com a central ainda.</p>'}
            ${pode('sistema') ? secaoNiveisChefe() : ''}
          </section>
        </div>
      </main>`;
  }
  /* Versão 2.15: o dono escolhe o que cada nível de tablet chefe pode fazer (vale para todos os tablets do nível, junto
     com o que cada pessoa pode). A central confere. Sem escolha: nível 1 = corrigir, relatórios e escritório; nível 2 =
     tudo menos conectar tablets e trocar o código. */
  const funcoesDosNiveis = () => [...C.funcoes, { id: 'pessoas', nome: 'Cadastrar pessoas e senhas' }];
  function funcoesDoNivel(n) {
    const salvo = (configSistema().niveisChefe || {})[n];
    if (Array.isArray(salvo)) return salvo;
    return n === 1 ? ['corrigir', 'relatorios', 'escritorio'] : funcoesDosNiveis().map((f) => f.id).filter((f) => f !== 'conexao');
  }
  function secaoNiveisChefe() {
    const nomes = (ids) => funcoesDosNiveis().filter((f) => ids.includes(f.id)).map((f) => f.nome.replace(/ \(.*\)$/, '').replace(/:.*$/, '')).join(' · ') || 'Nada';
    return `<h3 class="sub-titulo">O que cada nível pode fazer</h3>
      <p class="sub" style="margin:0 0 8px">Vale para todos os tablets chefe do nível. O que ficar desligado some da tela deles. O nível 3 é só o seu e pode tudo.</p>
      ${[1, 2].map((n) => `<div class="linha-config"><div><b>${esc(nomeDoNivelChefe(n))}</b><small>${esc(nomes(funcoesDoNivel(n)))}</small></div>
        <button class="btn pequeno" data-a="nivel-chefe" data-n="${n}">Mudar</button></div>`).join('')}`;
  }
  async function editarNivelChefe(n) {
    const marcadas = new Set(funcoesDoNivel(n));
    const lista = funcoesDosNiveis();
    const desenhar = (f) => {
      f.querySelector('#funcoes-nivel').innerHTML = `<div class="chips funcoes">${lista.map((x) => `<button class="chip-liga ${marcadas.has(x.id) ? 'sel' : ''}" data-k="f:${x.id}">${marcadas.has(x.id) ? ico('certo') : ico('fechar')} ${esc(x.nome)}</button>`).join('')}</div>`;
    };
    const ok = await abrirModal(`<h3>${esc(nomeDoNivelChefe(n))}: o que pode fazer</h3>
      <div class="form-pessoa"><p class="dica">Toque para ligar ou desligar. Vale para quem entrar num tablet chefe deste nível.</p><div id="funcoes-nivel"></div></div>
      <div class="acoes-modal"><button class="btn" data-k="x">Cancelar</button><button class="btn primario" data-k="ok">Salvar</button></div>`,
    (k, b, fechar, f) => {
      if (k === 'x') return fechar(false);
      if (k.startsWith('f:')) { const fn = k.slice(2); if (marcadas.has(fn)) marcadas.delete(fn); else marcadas.add(fn); return desenhar(f); }
      if (k === 'ok') fechar(true);
    }, { classe: 'largo com-form', aoAbrir: (f) => desenhar(f) });
    if (!ok) return;
    const niveis = { 1: funcoesDoNivel(1), 2: funcoesDoNivel(2) };
    niveis[n] = lista.map((x) => x.id).filter((id) => marcadas.has(id));
    salvarConfigSistema({ niveisChefe: niveis });
    toast(`${nomeDoNivelChefe(n)} salvo. Vale na próxima vez que alguém entrar.`);
    render();
  }
  async function carregarPessoas(v) {
    if (cfg.demo) {
      v.lista = { pessoas: [
        { id: 'p1', nome: 'Guilherme', nivel: 'administrador', extras: {}, ativo: true, temSenha: true },
        { id: 'p2', nome: 'Fernando', nivel: 'encarregado', extras: { integracoes: true }, ativo: true, temSenha: true },
        { id: 'p3', nome: 'Lucas', nivel: 'consulta', extras: { ler_folha: true }, ativo: true, temSenha: true },
        { id: 'p4', nome: 'Bruno', nivel: 'encarregado', extras: {}, ativo: false, temSenha: true },
      ], aparelhos: { [cfg.deviceId]: { nome: 'Tablet do escritório', teto: null }, demo2: { nome: 'Tablet da sala de controle', teto: ['anotar', 'avisos', 'relatorios'] } } };
      return;
    }
    v.carregando = true;
    const r = await postJson('api/pessoas', { acao: 'lista' }, 10000).catch(() => null);
    v.carregando = false;
    if (!r) { toast('Não consegui falar com a central', 'erro'); return; }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast(d.erro || 'A central recusou', 'erro'); voltar(); return; }
    v.lista = d;
    if (view() === v) render();
  }
  /** Os quadradinhos das funções (marcado = pode). */
  const chipsDeFuncoes = (marcadas, prefixo) => `<div class="chips funcoes">${C.funcoes.map((f) => `<button class="chip-liga ${marcadas.has(f.id) ? 'sel' : ''}" data-k="${prefixo}:${f.id}">${marcadas.has(f.id) ? ico('certo') : ico('fechar')} ${esc(f.nome)}</button>`).join('')}</div>`;
  async function editarPessoa(v, id) {
    const atual = id ? (v.lista.pessoas.find((p) => p.id === id) || null) : null;
    const estado = { nivel: atual ? atual.nivel : 'encarregado', extras: Object.assign({}, atual ? atual.extras : {}), ativo: atual ? atual.ativo : true };
    const marcadas = () => funcoesDe({ nivel: estado.nivel, extras: estado.extras });
    const desenhar = (f) => {
      f.querySelectorAll('[data-k^="n:"]').forEach((b) => b.classList.toggle('sel', b.dataset.k === 'n:' + estado.nivel));
      f.querySelector('#funcoes-pessoa').innerHTML = estado.nivel === 'administrador' ? '<p class="sub">O administrador pode tudo, inclusive pessoas e permissões.</p>' : chipsDeFuncoes(marcadas(), 'f');
      f.querySelector('[data-k="ativo"]').classList.toggle('sel', estado.ativo);
    };
    const resp = await abrirModal(`<h3>${atual ? `Mudar ${esc(atual.nome)}` : 'Cadastrar pessoa'}</h3>
      <div class="form-pessoa">
        <label>Nome <input id="p-nome" maxlength="40" autocomplete="off" value="${esc(atual ? atual.nome : '')}"></label>
        <label>Senha (4 a 8 números)${atual ? ' <small>deixe em branco para não trocar</small>' : ''} <input id="p-pin" inputmode="numeric" maxlength="8" autocomplete="off" value=""></label>
        <div class="segmentos quebra">${Object.entries(C.niveis).map(([k, n]) => `<button data-k="n:${k}">${esc(n.nome)}</button>`).join('')}</div>
        <div id="funcoes-pessoa"></div>
        <div class="chips"><button class="chip-liga" data-k="ativo">${ico('certo')} Pode entrar</button></div>
      </div>
      <div class="acoes-modal"><button class="btn" data-k="x">Cancelar</button><button class="btn primario" data-k="ok">Salvar</button></div>`,
    async (k, b, fechar, f) => {
      if (k === 'x') return fechar(undefined);
      if (k.startsWith('n:')) { estado.nivel = k.slice(2); return desenhar(f); }
      if (k.startsWith('f:')) {
        const fn = k.slice(2);
        const padrao = funcoesDe({ nivel: estado.nivel, extras: {} }).has(fn);
        const agora = marcadas().has(fn);
        if (!agora === padrao) delete estado.extras[fn]; else estado.extras[fn] = !agora;
        return desenhar(f);
      }
      if (k === 'ativo') { estado.ativo = !estado.ativo; return desenhar(f); }
      if (k !== 'ok') return;
      const nome = f.querySelector('#p-nome').value.trim();
      const pin = f.querySelector('#p-pin').value.trim();
      if (!nome) return toast('Escreva o nome', 'erro');
      if (pin && !/^\d{4,8}$/.test(pin)) return toast('A senha tem de 4 a 8 números', 'erro');
      if (!atual && !pin) return toast('Escolha a senha da pessoa', 'erro');
      const r = await postJson('api/pessoas', { acao: 'salvar', pessoa: { id: atual ? atual.id : '', nome, nivel: estado.nivel, extras: estado.nivel === 'administrador' ? {} : estado.extras, ativo: estado.ativo, pin } }, 15000).catch(() => null);
      if (!r) return toast('Não consegui falar com a central', 'erro');
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return toast(d.erro || 'A central recusou', 'erro');
      fechar(d);
    }, { classe: 'largo com-form', aoAbrir: (f) => desenhar(f) });
    if (!resp) return;
    v.lista = resp;
    toast(atual ? 'Pessoa salva' : 'Pessoa cadastrada');
    render();
  }
  async function editarAparelhoChefe(v, id) {
    const atual = (v.lista.aparelhos || {})[id] || {};
    const st = sync.status;
    const info = ((st && st.aparelhos) || []).find((a) => a.id === id) || {};
    let teto = Array.isArray(atual.teto) ? new Set(atual.teto) : new Set(C.funcoes.map((f) => f.id));
    let nivel = Number(atual.nivel) || 0;
    const souDono = !!(pessoaAtual() || {}).dono;
    const desenhar = (f) => {
      f.querySelector('#funcoes-aparelho').innerHTML = chipsDeFuncoes(teto, 'f');
      f.querySelectorAll('[data-k^="nv:"]').forEach((x) => x.classList.toggle('sel', x.dataset.k === 'nv:' + nivel));
    };
    const resp = await abrirModal(`<h3>Tablet chefe</h3><p class="dica">${esc(id)}</p>
      <div class="form-pessoa">
        <label>Nome do aparelho <input id="a-nome" maxlength="40" autocomplete="off" value="${esc(atual.nome || info.nome || '')}" placeholder="Ex.: Tablet do escritório"></label>
        ${pode('chefes') ? `<p class="sub" style="margin:4px 0">Nível deste tablet chefe:</p>
        <div class="segmentos quebra">${[1, 2, 3].map((n) => `<button data-k="nv:${n}" ${n === 3 && !souDono ? 'disabled' : ''}>${esc(nomeDoNivelChefe(n))}</button>`).join('')}</div>
        <p class="sub" style="margin:2px 0 8px">${esc(((C.niveisDoAparelho || {})[1] || {}).texto || '')}; 2: tudo; 3: só o dono. Quem estiver dentro sai quando o nível muda.</p>` : ''}
        <p class="sub" style="margin:4px 0">O que pode ser feito neste aparelho:</p>
        <div id="funcoes-aparelho"></div>
      </div>
      <div class="acoes-modal"><button class="btn" data-k="x">Cancelar</button><button class="btn primario" data-k="ok">Salvar</button></div>`,
    async (k, b, fechar, f) => {
      if (k === 'x') return fechar(undefined);
      if (k.startsWith('f:')) { const fn = k.slice(2); if (teto.has(fn)) teto.delete(fn); else teto.add(fn); return desenhar(f); }
      if (k.startsWith('nv:')) { nivel = Number(k.slice(3)); return desenhar(f); }
      if (k !== 'ok') return;
      const tudo = C.funcoes.every((x) => teto.has(x.id));
      const pedido = { acao: 'aparelho', id, nome: f.querySelector('#a-nome').value.trim(), teto: tudo ? null : [...teto] };
      if (pode('chefes') && nivel !== (Number(atual.nivel) || 0)) pedido.nivel = nivel;
      const r = await postJson('api/pessoas', pedido, 10000).catch(() => null);
      if (!r) return toast('Não consegui falar com a central', 'erro');
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return toast(d.erro || 'A central recusou', 'erro');
      fechar(d);
    }, { classe: 'largo com-form', aoAbrir: (f) => desenhar(f) });
    if (!resp) return;
    v.lista = resp;
    // o nível deste próprio aparelho mudou: a central tirou quem estava dentro, então entra de novo
    if (id === cfg.deviceId && nivel !== (Number(atual.nivel) || 0)) {
      cfg.nivelChefe = nivel; cfg.pessoa = null; salvarCfg();
      toast(`Este aparelho agora é o ${nomeDoNivelChefe(nivel)}. Entre de novo com a sua senha.`);
      return render();
    }
    toast('Tablet chefe salvo');
    render();
  }

  /* ---------- Registro do sistema ---------- */
  const TIPOS_REGISTRO = [['', 'Tudo'], ['anotacao', 'Anotações'], ['entrada', 'Entradas'], ['aparelho', 'Aparelhos'], ['configuracao', 'Configurações']];
  function telaRegistro(v) {
    if (!v.data) v.data = dataProducao();
    if (!v.linhas && !v.carregando) carregarRegistro(v);
    const hoje = dataProducao();
    const linhas = (v.linhas || []).filter((r) => !v.tipo || r.valores.tipo === v.tipo).slice().reverse();
    const hora = (ms) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${topo('Registro do sistema', `${fmtData(v.data)} · o que aconteceu, de hora em hora`, true)}
      <main class="registro">
        <div class="barra-dia">
          <div class="nav-data">
            <button class="btn" data-a="registro-dia" data-n="-1" aria-label="Dia anterior">${ico('voltar')}</button>
            <div class="data-grande"><b>${fmtData(v.data)}</b><span>${diaSemana(v.data)}, das 07:00 até 06:59 do dia seguinte</span></div>
            <button class="btn" data-a="registro-dia" data-n="1" aria-label="Próximo dia" ${v.data >= hoje ? 'disabled' : ''}>${ico('seta')}</button>
          </div>
        </div>
        <div class="segmentos filtros-registro">${TIPOS_REGISTRO.map(([t, n]) => `<button class="${(v.tipo || '') === t ? 'sel' : ''}" data-a="registro-tipo" data-tipo="${t}">${n}</button>`).join('')}</div>
        <div class="lista-registro">${v.carregando && !v.linhas ? '<p class="sub">Buscando na central...</p>' : linhas.map((r) => {
          const x = r.valores;
          return `<div class="reg-linha reg-${esc(x.tipo)}"><b class="reg-hora">${hora(x.em)}</b><div class="reg-texto"><p>${esc(x.texto)}</p>
            <small>${esc([x.quem, x.aparelho].filter(Boolean).join(' · '))}</small>
            ${(x.mudancas || []).length ? `<ul>${x.mudancas.map((m) => `<li>${esc(m.campo)}: <s>${esc(m.antes)}</s> → <b>${esc(m.depois)}</b></li>`).join('')}</ul>` : ''}
            ${x.antes && x.depois ? `<ul><li><s>${esc(x.antes)}</s> → <b>${esc(x.depois)}</b></li></ul>` : ''}</div></div>`;
        }).join('') || '<p class="sub">Nada registrado neste dia.</p>'}</div>
      </main>`;
  }
  async function carregarRegistro(v) {
    v.carregando = true;
    if (cfg.demo) { v.linhas = registroDeExemplo(v.data); v.carregando = false; return; }
    const r = await buscar('api/registro?dia=' + v.data, {}, 10000).catch(() => null);
    v.carregando = false;
    if (!r || !r.ok) { toast('Não consegui buscar o registro na central', 'erro'); v.linhas = []; }
    else v.linhas = ((await r.json().catch(() => ({}))).registros || []);
    if (view() === v) render();
  }
  /** Demonstração (imagens e auditoria das telas). */
  function registroDeExemplo(data) {
    const [y, m, d] = data.split('-').map(Number);
    const em = (h, mi) => new Date(y, m - 1, d, h, mi).getTime();
    const l = (h, mi, tipo, texto, quem, aparelho, mudancas) => ({ valores: { em: em(h, mi), tipo, texto, quem, aparelho, mudancas } });
    return [
      l(7, 2, 'entrada', 'Guilherme entrou no Tablet chefe', 'Guilherme', 'Tablet chefe'),
      l(7, 10, 'entrada', 'Felipe entrou no Tablet da Hidrólise', 'Felipe', 'Tablet da Hidrólise'),
      l(8, 43, 'anotacao', 'Felipe anotou Hidrólise Nº 1', 'Felipe', 'Tablet da Hidrólise', [{ campo: 'PHF', antes: '(vazio)', depois: '3,5' }, { campo: 'Brix', antes: '(vazio)', depois: '20' }]),
      l(9, 5, 'anotacao', 'Fernando mudou Hidrólise Nº 1', 'Fernando', 'Tablet chefe', [{ campo: 'Brix', antes: '20', depois: '21' }]),
      l(9, 30, 'aparelho', 'Tablet da Caldeira ficou sem sinal', '', 'Tablet da Caldeira'),
      l(9, 41, 'aparelho', 'Tablet da Caldeira voltou a falar com a central (ficou 11 min sem sinal)', '', 'Tablet da Caldeira'),
      l(10, 2, 'configuracao', 'Guilherme cadastrou Jair na Ralo / Pesagem', 'Guilherme', 'Tablet chefe'),
      l(10, 15, 'aparelho', 'Tablet da Destilaria atualizou da versão 2.8.0 para a 2.9.0', '', 'Tablet da Destilaria'),
    ];
  }
