/* Pranchetas Ubirálcool - toques: o que cada botão faz
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * Toques
   * ========================================================= */
  document.addEventListener('click', (e) => {
    if (modalAberto()) return;
    const q = e.target.closest('[data-quadro]');
    if (q) {
      const a = alvos.find((x) => x.id === q.dataset.quadro);
      if (a && a.type === 'check' && ed.alvoId === a.id && !ed.oculto) { a.set(vazio(a.get()) ? 'OK' : ''); return atualizarEdicao(); }
      if (a && a.type === 'check' && vazio(a.get())) a.set('OK');
      return selecionar(q.dataset.quadro);
    }
    const t = e.target.closest('[data-ed]');
    if (t) return tecla(t.dataset.ed);
  });

  /** Ações do tablet chefe e a função que cada uma precisa ("folha": anotar nas folhas do chefe ou corrigir as dos setores). */
  const PRECISA = {
    salvar: 'folha', 'enviar-dorna': 'folha', 'terminar-dorna': 'folha', 'copiar-vemde': 'folha', 'apagar-linha': 'folha',
    'ferm-encher': 'anotar', 'ferm-terminou': 'anotar', 'ferm-volante': 'anotar', 'ferm-parar': 'anotar', 'ferm-esvaziou': 'anotar', 'ferm-apagar': 'anotar',
    compartilhar: 'relatorios', relatorios: 'relatorios', 'relatorio-enviar': 'relatorios', 'relatorio-apagar': 'relatorios', 'gerar-hoje': 'relatorios', imprimir: 'relatorios',
    'aviso-enviar': 'avisos', 'aviso-cancelar': 'avisos', 'ler-folha': 'ler_folha', 'leitura-salvar': 'ler_folha',
    config: 'usina', 'medida-grupo': 'usina', 'medidas-planilha': 'usina', contato: 'usina', 'lista-add': 'usina', 'lista-remove': 'usina',
    'setor-liga': 'usina', 'prancheta-liga': 'usina', 'lembrete-liga': 'usina', 'lembrete-horario': 'usina', 'turnos-setor': 'usina', 'op-add': 'usina', 'op-senha': 'usina', 'op-remove': 'usina',
    'nuvem-url': 'integracoes', 'nuvem-segredo': 'integracoes', 'nuvem-enviar': 'integracoes', 'base44-url': 'integracoes', 'base44-segredo': 'integracoes', 'base44-enviar': 'integracoes',
    'novo-codigo': 'conexao',
    graficos: 'relatorios', folhas: 'folhas', 'folha-campo': 'folhas', 'folha-unidades': 'folhas',
  };
  app.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-a]');
    if (!b || modalAberto()) return;
    const a = b.dataset.a;
    const v = view();
    // tablet chefe: confere se quem está usando pode fazer isso (e pede a senha se ninguém entrou)
    if (ehCentral() && PRECISA[a]) {
      const f = PRECISA[a] === 'folha' ? (soDoChefe(v.pid) ? 'anotar' : 'corrigir') : PRECISA[a];
      if (!(await exigir(f))) return;
    }
    switch (a) {
      case 'pessoa': {
        if (!pessoaAtual()) return entrarNoChefe();
        const p = pessoaAtual();
        const opcoes = [pode('pessoas') ? '<button class="btn" data-k="pessoas">Pessoas e permissões</button>' : '', pode('registro') ? '<button class="btn" data-k="registro">Registro do sistema</button>' : '', pode('folhas') ? '<button class="btn" data-k="folhas">Folhas e avisos</button>' : ''].join('');
        const resp = await abrirModal(`<h3>${esc(p.nome)}</h3><p class="dica">${esc((C.niveis[p.nivel] || {}).nome || p.nivel)} neste tablet chefe.</p>
          ${opcoes ? `<div class="linha-botoes">${opcoes}</div>` : ''}
          <div class="acoes-modal"><button class="btn" data-k="x">Fechar</button><button class="btn primario" data-k="sair">${ico('voltar')} Sair</button></div>`, (k, b2, fechar) => fechar(k), {});
        if (resp === 'sair') { sairDoChefe(); toast('Saiu. O painel continua à vista.'); }
        if (resp === 'pessoas') return ir({ tela: 'pessoas' });
        if (resp === 'registro') return ir({ tela: 'registro', data: dataProducao() });
        if (resp === 'folhas') return ir({ tela: 'folhas' });
        return;
      }
      case 'pessoas': if (!(await exigir('pessoas'))) return; return ir({ tela: 'pessoas' });
      case 'registro': if (!(await exigir('registro'))) return; return ir({ tela: 'registro', data: dataProducao() });
      case 'registro-dia': { const d = somarDias(v.data, Number(b.dataset.n)); if (d > dataProducao()) return; pilha[pilha.length - 1] = { tela: 'registro', data: d, tipo: v.tipo }; return render(); }
      case 'registro-tipo': v.tipo = b.dataset.tipo || ''; return render();
      case 'pessoa-nova': return editarPessoa(v, '');
      case 'pessoa-editar': return editarPessoa(v, b.dataset.id);
      case 'aparelho-chefe': return editarAparelhoChefe(v, b.dataset.id);
      case 'nivel-chefe': if (!(await exigir('sistema'))) return; return editarNivelChefe(Number(b.dataset.n));
      case 'aparelhos': return ir({ tela: 'aparelhos' });
      case 'aparelho-info': return verAparelho(b.dataset.id);
      case 'status-con': return verConexao();
      case 'conferir-bloqueio': sincronizar(); conferirNaNuvem(true); return toast('Conferindo...');
      case 'liberar-senha': {
        const blq = cfg.bloqueio;
        if (!blq || blq.modo !== 'senha') return;
        if (Date.now() < (cfg.esperaLiberar || 0)) return toast('Muitas senhas erradas. Espere um minuto.', 'erro');
        // o bloqueio chegou só pela nuvem (sem a senha): quem confere é a central, no Wi-Fi da usina
        if (!blq.resumo) return toast('Para usar a senha de desbloqueio, conecte este aparelho no Wi-Fi da usina.', 'erro');
        const pin = await pedirSenhaModal('Senha de desbloqueio', 'A senha que o administrador escolheu ao bloquear este aparelho.');
        if (pin === undefined) return;
        if (!/^\d{4,8}$/.test(pin) || resumoDaSenha(pin, blq.sal) !== blq.resumo) {
          cfg.errosLiberar = (cfg.errosLiberar || 0) + 1;
          if (cfg.errosLiberar >= 5) { cfg.errosLiberar = 0; cfg.esperaLiberar = Date.now() + 60000; }
          salvarCfg();
          return toast('Senha errada', 'erro');
        }
        cfg.errosLiberar = 0;
        cfg.liberacao = { em: blq.em, rev: blq.rev || 0, geracao: cfg.blqGeracao || '', codigo: pin }; // a central fica sabendo na próxima conversa
        salvarCfg();
        return liberarAparelho('Aparelho liberado. Pode usar.', blq.rev || 0);
      }
      case 'graficos': return ir({ tela: 'graficos', data: v.data || dataProducao(), setor: b.dataset.setor || '' });
      case 'graficos-dia': { const d = somarDias(v.data, Number(b.dataset.n)); if (d > dataProducao()) return; pilha[pilha.length - 1] = Object.assign({}, v, { data: d }); return render(true); }
      case 'graficos-setor': v.setor = b.dataset.setor || ''; return render();
      case 'folhas': return ir({ tela: 'folhas' });
      case 'folha-campo': return editarCampoDaFolha(b.dataset.pid, b.dataset.id);
      case 'folha-unidades': return editarUnidadesDaFolha(b.dataset.pid);
      case 'folha-estrutura': return editarEstruturaDaFolha(b.dataset.pid);
      case 'voltar': return voltar();
      case 'tema':
        cfg.tema = cfg.tema === 'escuro' ? 'claro' : 'escuro'; salvarCfg(); aplicarTema();
        return render();
      case 'tema-fixo': cfg.tema = b.dataset.valor; salvarCfg(); aplicarTema(); return render();
      case 'escala': cfg.escala = b.dataset.valor; salvarCfg(); ajustarEscala(); return render();
      case 'conectar': return conectar();
      case 'procurar-central': return procurarCentral();
      case 'atualizacao': return oferecerAtualizacao();
      case 'procurar-atualizacao': return procurarAtualizacao(true);
      case 'novidades': return mostrarNovidades();
      case 'modo-demo': cfg.demo = true; salvarCfg(); ed.alvoId = null; pilha = [telaInicial()]; return render(true);
      case 'virar-central': return prepararTabletChefe();
      case 'voltar-conectar': cfg.papel = null; salvarCfg(); pilha = [telaInicial()]; return render(true);
      case 'abrir-painel': pilha = [telaInicial()]; return render(true);
      case 'desligar-servidor': {
        if (!(await confirmar('Desligar o servidor deste aparelho?', 'Os tablets param de enviar até ele ser ligado de novo (aqui ou em outro aparelho). Nada é apagado: as anotações continuam guardadas neste aparelho.', 'Desligar', true))) return;
        try { await pluginCentral.parar(); } catch (e) { /* já estava desligado */ }
        cfg.servidor = false; cfg.chave = null; cfg.central = ''; salvarCfg();
        toast('Servidor desligado. Conecte este aparelho numa central.');
        pilha = [telaInicial()]; return render(true);
      }
      case 'esc-entrar': if (await entrarNoEscritorio()) render(true); return;
      case 'esc-sair': cfg.escritorio = null; salvarCfg(); pilha = [telaInicial()]; return render(true);
      case 'esc-dia': {
        const d = somarDias(v.data, Number(b.dataset.n));
        if (d > dataProducao()) return;
        buscarDia(d); renovarEscritorio();
        pilha[pilha.length - 1] = Object.assign({}, v, { data: d }); return render();
      }
      case 'esc-abrir': {
        if (ehCentral() && !(await exigir('escritorio'))) return;
        renovarEscritorio();
        const dia = b.dataset.dia || v.data;
        buscarDia(dia); return ir({ tela: b.dataset.t, data: dia });
      }
      case 'esc-campo': return mudarCampoEsc(v, b.dataset.c, b.dataset.r);
      case 'esc-salvar': return salvarEsc(v);
      case 'esc-recalcular': {
        if (!(await confirmar('Refazer com as anotações de agora?', 'Os números voltam a ser os das folhas dos setores. O que foi digitado aqui se perde (até salvar, nada muda no que já está salvo).', 'Refazer'))) return;
        v.valores = prepararValores(window.Rastreamento.calcular(C, v.data, anotacoesDoDia(v.data))); v.sujo = true; return render();
      }
      case 'esc-arquivo': return enviarRastreamento(v);
      case 'esc-etiqueta': return etiquetaEsc(v);
      case 'esc-folha': return imprimirFolhaEsc(v);
      case 'papel': {
        if (b.dataset.id === 'central' && !cfg.demo && cfg.chave && !centralNoTablet() && !(await garantirLiberacaoDeChefe())) return;
        cfg.papel = b.dataset.id; salvarCfg();
        pilha = [telaInicial()];
        if (!ehCentral() && !ehEscritorio() && !operadorAtual()) pilha.push({ tela: 'operador' });
        rascunho = null; ed.alvoId = null; render(true); entrarTelaCheia(); sincronizar();
        return;
      }
      case 'trocar-operador': return ir({ tela: 'operador' });
      case 'escolher-operador': {
        const nome = b.dataset.nome;
        const op = operadorPorNome(cfg.papel, nome);
        if (op && op.senha) {
          const digitada = await pedirSenhaModal(`Senha de ${nome}`, 'Só quem sabe a senha entra com este nome.');
          if (digitada === undefined) return;
          if (embaralharSenha(nome, digitada) !== op.senha) {
            const comEncarregado = await confirmar('Senha errada', 'Se esqueceu a senha, o encarregado pode liberar com a senha dele.', 'Chamar encarregado', false);
            if (!comEncarregado) return;
            if (!(await verificarNoSetor('ajustes', 'Senha do encarregado', `Liberar ${nome} neste turno.`))) return;
          }
        }
        definirOperador(nome); toast(`Bom trabalho, ${nome}`);
        if (pilha.length > 1) pilha.pop(); else pilha = [telaInicial()];
        rascunho = null; render(true);
        setTimeout(verificarAvisos, 700); // aviso guardado para esta pessoa aparece logo que ela entra
        return;
      }
      case 'admin': {
        if (!(await (ehCentral() ? exigir('ajustes') : verificarNoSetor('ajustes')))) return;
        return ir({ tela: 'admin' });
      }
      case 'abrir-prancheta': return ir({ tela: 'prancheta', pid: b.dataset.id });
      // ao trocar de prancheta, continua no modo que a pessoa estava (anotando ou monitorando)
      case 'aba': {
        const nova = { tela: 'prancheta', pid: b.dataset.id, data: v.data, monitor: v.monitor };
        const ch = v.tela === 'prancheta' ? chaveParaAba(v, b.dataset.id) : undefined;
        if (ch != null) { nova.chave = ch; lembrar[`${dataDaView(v)}|${b.dataset.id}`] = ch; }
        return ir(nova, true);
      }
      // saindo do Monitorar num dia anterior, o tablet do setor volta para a folha de hoje
      case 'monitor': return ir(Object.assign({}, v, { monitor: !v.monitor }, v.monitor && !ehCentral() ? { data: undefined, chave: undefined } : {}), true);
      case 'monitor-dia': {
        const d = somarDias(dataDaView(v), Number(b.dataset.n));
        if (d > dataProducao()) return;
        buscarDia(d);
        return ir(Object.assign({}, v, { data: d === dataProducao() && !ehCentral() ? undefined : d, chave: undefined }), true);
      }
      case 'inicio-setor': return ir({ tela: 'inicio' }, true);
      case 'painel': return ir({ tela: 'central', data: v.data || dataProducao() }, true);
      case 'linha': {
        const chave = /^\d+$/.test(b.dataset.chave) ? Number(b.dataset.chave) : b.dataset.chave;
        if (rascunho && rascunho.chave === chave && !v.monitor) return;
        // tablet do setor olhando um dia anterior no Monitorar, ou tablet chefe sem a função Corrigir: só consulta
        if (v.monitor && !ehCentral() && dataDaView(v) !== dataProducao()) return;
        if (soConsulta()) return;
        if (rascunhoSujo()) salvarRascunho(true);
        rascunho = null; ed.alvoId = null;
        pilha[pilha.length - 1] = Object.assign({}, v, { chave, monitor: false });
        return render(true);
      }
      case 'salvar': {
        if (!exigeOperador()) return;
        const nomesAutorizar = quemPrecisaAutorizar();
        if (nomesAutorizar.length && !(await autorizar(nomesAutorizar))) return;
        if (!salvarRascunho(false, { autorizado: true })) return;
        // continua na mesma linha, para ver como ela ficou
        pilha[pilha.length - 1] = Object.assign({}, v, { chave: rascunho.chave });
        ed.alvoId = null; rascunho = null;
        return render();
      }
      case 'enviar-dorna': {
        if (!exigeOperador()) return;
        const p = prancheta(v.pid);
        const data = dataDaView(v);
        const k = Number(rascunho.chave);
        if (vazio(rascunho.valores[p.envio.inicio])) rascunho.valores[p.envio.inicio] = horaAgora();
        const hora = rascunho.valores[p.envio.inicio];
        // a bomba manda uma dorna de cada vez: a que estava indo para cima termina agora
        const indo = dornasDoDia(data, v.pid).filter((r) => Number(r.chave) !== k && etapaDaDorna(p, r) === 'enviando');
        if (!salvarRascunho(false, { silencioso: true })) return;
        indo.forEach((r) => { gravar(data, v.pid, r.chave, { [p.envio.fim]: hora }); depoisDeMudarDorna(data, v.pid, Number(r.chave)); });
        toast(indo.length ? `Nº ${listaE(indo.map((r) => r.chave))} terminou às ${hora}. Nº ${k} enviando.` : `Dorna Nº ${k} enviando desde ${hora}`);
        pilha[pilha.length - 1] = Object.assign({}, v, { chave: k });
        ed.alvoId = null; rascunho = null;
        return render();
      }
      case 'terminar-dorna': {
        if (!exigeOperador()) return;
        const p = prancheta(v.pid);
        const data = dataDaView(v);
        const k = Number(b.dataset.chave);
        const hora = horaAgora();
        if (rascunho && Number(rascunho.chave) === k) {
          if (vazio(rascunho.valores[p.envio.fim])) rascunho.valores[p.envio.fim] = hora;
          if (!salvarRascunho(false, { silencioso: true })) return;
        } else {
          // o que estava sendo anotado na dorna aberta é salvo antes
          if (rascunhoSujo()) salvarRascunho(true, { silencioso: true });
          gravar(data, v.pid, k, { [p.envio.fim]: hora });
          depoisDeMudarDorna(data, v.pid, k);
        }
        toast(`Dorna Nº ${k} terminou de enviar às ${hora}`);
        // vai para a próxima que está enchendo, se tiver
        const proxima = rascunho && Number(rascunho.chave) === k ? dornasDoDia(data, v.pid).find((r) => etapaDaDorna(p, r) === 'enchendo') : null;
        if (proxima) pilha[pilha.length - 1] = Object.assign({}, v, { chave: Number(proxima.chave) });
        ed.alvoId = null; rascunho = null;
        return render(true);
      }
      case 'copiar-vemde': {
        const p = prancheta(v.pid);
        const data = dataDaView(v);
        const base = pegar(data, p.vemDe.prancheta, rascunho.chave);
        if (!base) return;
        const antes = pegar(data, v.pid, rascunho.chave);
        if (ehCentral() && antes && antes.operador && antes.operador !== 'escritório' && !(await autorizar([antes.operador]))) return;
        Object.entries(p.vemDe.campos).forEach(([meu, dela]) => { if (!vazio(base.valores[dela])) rascunho.valores[meu] = base.valores[dela]; });
        const r = pegar(data, v.pid, rascunho.chave);
        gravar(data, v.pid, rascunho.chave, rascunho.valores, { operador: (r && r.operador) || operadorAtual() || '', manuais: [] });
        somarInsumosDoDia(data);
        toast(`Copiado da ${prancheta(p.vemDe.prancheta).nome}. Volta a acompanhar.`);
        ed.alvoId = null; rascunho = null;
        return render();
      }
      case 'apagar-linha': {
        const p = prancheta(v.pid);
        const k = Number(rascunho.chave);
        const dep = dependentesDe(v.pid).map((x) => prancheta(x).nome);
        const texto = p.vemDe
          ? `A linha sai da folha. Ela volta se a dorna Nº ${k} for salva de novo na ${prancheta(p.vemDe.prancheta).nome}.`
          : `A dorna sai da folha${dep.length ? ` e da ${dep.join(' e da ')}` : ''}. As seguintes sobem um número (${k + 1} vira ${k}), como no papel.`;
        const dona = pegar(dataDaView(v), v.pid, k);
        if (await confirmar(`Apagar a ${p.rotulo.toLowerCase()} Nº ${k}?`, texto, 'Apagar', true)) {
          const data = dataDaView(v);
          if (ehCentral() && dona && dona.operador && dona.operador !== 'escritório' && !(await autorizar([dona.operador]))) return;
          if (p.vemDe) { apagar(data, v.pid, k); somarInsumosDoDia(data); } else apagarDorna(data, v.pid, k);
          registrar('anotacao', `${quemEstaAqui()} apagou ${prancheta(v.pid).nome} Nº ${k}`);
          toast(`Dorna Nº ${k} apagada`); rascunho = null; ed.alvoId = null;
          delete lembrar[`${data}|${v.pid}`];
          pilha[pilha.length - 1] = Object.assign({}, v, { chave: undefined }); render(true);
        }
        return;
      }
      case 'dia': return ir(Object.assign({}, v, { data: somarDias(v.data, Number(b.dataset.n)) }), true);
      case 'dia-hoje': return ir(Object.assign({}, v, { data: dataProducao() }), true);
      case 'abrir-setor': return ir({ tela: 'prancheta', pid: pranchetasDasAbas(b.dataset.id)[0], data: v.data, monitor: soConsulta() || undefined });
      case 'compartilhar': return compartilhar(b.dataset.destino, v.data || dataProducao());
      case 'relatorios': return ir({ tela: 'relatorios' });
      case 'avisos': return ir({ tela: 'avisos' });
      case 'ver-erros': return verErros();
      case 'caber-folha': cfg.folhaNormal = !cfg.folhaNormal; salvarCfg(); return render();
      case 'rolar-folha': {
        const w = b.closest('.folha') && b.closest('.folha').querySelector('.tabela-wrap');
        if (w) w.scrollBy({ left: Number(b.dataset.dir) * w.clientWidth * 0.75, behavior: movimentoReduzido() ? 'auto' : 'smooth' });
        return;
      }
      case 'zerar-tudo': {
        if (!(await confirmar('Apagar todos os dados do sistema?', 'Somem as anotações de todos os setores, nesta central e nos tablets, assim que eles se conectarem. Operadores, senhas e contatos continuam. Uma cópia fica em BackupUsina.', 'Apagar tudo', true))) return;
        if (cfg.demo) { zerarLocal(''); toast('Anotações apagadas'); return render(true); }
        const senha = await pedirSenhaModal('Senha do programador', 'Só quem programa o sistema tem esta senha.');
        if (senha === undefined) return;
        try {
          const r = await postJson('api/zerar', { confirmar: 'ZERAR', senha }, 15000);
          const d = await r.json();
          if (r.status === 403) return toast('Senha do programador errada. Nada foi apagado.', 'erro');
          if (!r.ok || !d.ok) throw new Error(d.erro || 'falhou');
          zerarLocal(d.geracao);
          toast(`${contar(d.apagados, 'anotação apagada', 'anotações apagadas')}. Cópia em ${d.copia}.`);
        } catch (e) { toast('Não consegui zerar. Confira se a central está ligada.', 'erro'); }
        return render(true);
      }
      case 'aviso-setor': v.form.setor = b.dataset.id; v.form.nome = ''; return render();
      case 'aviso-pessoa': v.form.nome = b.dataset.nome; return render();
      case 'aviso-frase': {
        const junto = ((v.form.texto || '').trim() + ' ' + b.dataset.texto).trim();
        v.form.texto = junto.slice(0, TAMANHO_AVISO); return render();
      }
      case 'aviso-enviar': {
        const f = v.form;
        const campo = document.getElementById('aviso-texto');
        if (campo) f.texto = campo.value;
        const texto = (f.texto || '').replace(/\s+/g, ' ').trim();
        if (!f.setor) return toast('Escolha o setor', 'erro');
        if (texto.length < 2) return toast('Escreva a mensagem do aviso', 'erro');
        enviarAviso(f.setor, f.nome, texto.slice(0, TAMANHO_AVISO));
        registrar('anotacao', `${quemEstaAqui()} mandou um aviso para ${f.nome || 'quem estiver'} na ${(setorPorId(f.setor) || {}).nome || f.setor}: "${texto.slice(0, 120)}"`);
        const setor = setorPorId(f.setor).nome;
        const agora = !cfg.demo && trabalhandoAgora(f.setor, f.nome);
        toast(agora ? `Aviso enviado. Aparece agora na tela da ${setor}.` : `Aviso guardado. Aparece quando ${f.nome || 'alguém'} entrar na ${setor}.`);
        f.texto = ''; return render();
      }
      case 'aviso-cancelar': {
        if (!(await confirmar('Cancelar este aviso?', 'Ele não vai mais aparecer na tela da pessoa.', 'Cancelar aviso', true))) return;
        gravar(b.dataset.data, PID_AVISO, b.dataset.id, { cancelado: true, canceladoEm: Date.now() }, { operador: 'escritório' });
        toast('Aviso cancelado'); return render();
      }
      case 'ler-folha': return comecarLeitura(v.data || dataProducao());
      case 'leitura-linha': { const l = v.leitura.linhas[Number(b.dataset.i)]; if (l.temValor) l.incluir = !l.incluir; return render(); }
      case 'leitura-cel': return corrigirCelula(v, Number(b.dataset.i), b.dataset.c);
      case 'leitura-salvar': return salvarLeitura(v);
      case 'relatorio-enviar': return enviarDia(b.dataset.data);
      case 'relatorio-abrir': return ir({ tela: 'central', data: b.dataset.data });
      case 'relatorio-apagar': {
        if (!(await confirmar(`Apagar o arquivo de ${fmtData(b.dataset.data)}?`, 'O Excel e o XML guardados deste dia são apagados. As anotações continuam no sistema e dá para gerar o arquivo de novo.', 'Apagar', true))) return;
        const r = await postJson('api/relatorio-apagar', { data: b.dataset.data }).catch(() => null);
        toast(r && r.ok ? 'Arquivo apagado' : 'Não consegui apagar o arquivo', r && r.ok ? 'ok' : 'erro');
        v.carregado = false; return render();
      }
      case 'gerar-hoje': {
        const data = dataProducao();
        const ok = await guardarNaCentral(data, [gerarArquivo('xlsx', data, setores().map((s) => s.id)), gerarArquivo('xml', data, setores().map((s) => s.id))]);
        toast(ok ? 'Excel e XML de hoje guardados' : 'Não consegui guardar no servidor', ok ? 'ok' : 'erro');
        v.carregado = false; return render();
      }
      case 'config': {
        // mexe no número do escritório, operadores e setores de todos os tablets: a permissão foi conferida antes (PRECISA)
        carregarBase44(); carregarNuvem();
        return ir({ tela: 'config' });
      }
      case 'nuvem-url': {
        const valor = await textoLivre({ titulo: 'Endereço da nuvem', dica: 'O endereço que apareceu no fim do publicar.ps1, como https://pranchetas-nuvem.seu-nome.workers.dev. Deixe em branco para parar de mandar.', valor: (nuvemInfo && nuvemInfo.url) || '', tipo: 'url', max: 300 });
        if (valor === undefined) return;
        if (valor && !/^https:\/\/\S+\.\S+$/i.test(valor)) return toast('Endereço incompleto. Ele começa com https://', 'erro');
        if (!(await configurarNuvem({ url: valor }))) return;
        toast(valor ? 'Endereço salvo. A cópia vai sozinha.' : 'Cópia na nuvem desligada');
        return render();
      }
      case 'nuvem-segredo': {
        const valor = await textoLivre({ titulo: 'Senha da central', dica: 'A senha da central que apareceu no fim do publicar.ps1 (SEGREDO_CENTRAL).', tipo: 'text', max: 200 });
        if (!valor) return;
        if (!(await configurarNuvem({ segredo: valor }))) return;
        toast('Senha salva');
        return render();
      }
      case 'nuvem-enviar': {
        toast('Mandando para a nuvem...');
        const r = await postJson('api/nuvem', { acao: 'enviar' }, 60000).catch(() => null);
        if (!r || !r.ok) return toast(r ? ((await r.json().catch(() => ({}))).erro || 'A central recusou') : 'Não consegui falar com a central', 'erro');
        nuvemInfo = await r.json(); if (sync.status) sync.status.nuvem = Object.assign({}, nuvemInfo); sync.statusJson = '';
        toast(nuvemInfo.erro ? 'Não foi: ' + nuvemInfo.erro : nuvemInfo.faltam ? `Mandou. Faltam ${nuvemInfo.faltam}` : 'Tudo na nuvem', nuvemInfo.erro ? 'erro' : 'ok');
        return render();
      }
      case 'base44-url': {
        const atual = (base44Info && base44Info.url) || '';
        const valor = await textoLivre({ titulo: 'Endereço no Base44', dica: 'Quem montou o sistema do escritório copia do Base44 (a função receberTotaisPranchetas). Começa com https://. Deixe em branco para parar de enviar.', valor: atual, tipo: 'url', max: 300 });
        if (valor === undefined) return;
        if (valor && !/^https?:\/\/\S+\.\S+$/i.test(valor)) return toast('Endereço incompleto. Ele começa com https://', 'erro');
        const r = await postJson('api/base44', { acao: 'configurar', url: valor, desde: dataProducao() }, 8000).catch(() => null);
        if (!r || !r.ok) return toast(r ? ((await r.json().catch(() => ({}))).erro || 'A central recusou') : 'Não consegui falar com a central', 'erro');
        base44Info = await r.json(); if (sync.status) sync.status.base44 = Object.assign({}, base44Info); sync.statusJson = '';
        toast(valor ? 'Endereço salvo. Os totais vão sozinhos quando o dia fechar.' : 'Envio para o Base44 desligado');
        return render();
      }
      case 'base44-segredo': {
        let valor = await textoLivre({ titulo: 'Segredo do Base44', dica: 'O mesmo texto cadastrado no Base44 como PRANCHETAS_SEGREDO. Deixe em branco e toque em Salvar para o aplicativo criar um.', tipo: 'text', max: 200 });
        if (valor === undefined) return;
        const criado = !valor;
        if (criado) {
          const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          valor = Array.from(crypto.getRandomValues(new Uint8Array(20)), (x) => letras[x % letras.length]).join('').replace(/(.{5})(?=.)/g, '$1-');
        }
        const r = await postJson('api/base44', { acao: 'configurar', url: (base44Info && base44Info.url) || '', segredo: valor }, 8000).catch(() => null);
        if (!r || !r.ok) return toast('Não consegui falar com a central', 'erro');
        base44Info = await r.json(); if (sync.status) sync.status.base44 = Object.assign({}, base44Info); sync.statusJson = '';
        if (criado) {
          await abrirModal(`<h3>Segredo criado</h3><p class="dica">Passe para quem montou o Base44 cadastrar como PRANCHETAS_SEGREDO. Ele não aparece de novo aqui.</p>
            <p class="segredo-grande">${esc(valor)}</p>
            <div class="acoes-modal um"><button class="btn primario" data-k="x">Anotei</button></div>`, (k, b2, fechar) => fechar());
        } else toast('Segredo salvo');
        return render();
      }
      case 'base44-enviar': {
        const data = b.dataset.data;
        b.disabled = true;
        toast(`Mandando os totais de ${fmtData(data)} para o Base44...`);
        const r = await enviarBase44(data, true);
        if (r.ok) toast(`Totais de ${fmtData(data)} enviados para o Base44`);
        else toast(`Não foi: ${r.erro}`, 'erro');
        sync.statusJson = '';
        await carregarBase44();
        return render();
      }
      case 'ferm-encher': {
        if (!exigeOperador() || !rascunho) return;
        const n = rascunho.chave;
        const r = cicloAtual(n);
        if (r && etapaFerm(r) !== 'vazia' && !(await confirmar(`A Nº ${n} ainda tem vinho`, `Ela foi enchida em ${fmtData(r.data)} e não foi marcada como vazia. Começar um enchimento novo mesmo assim?`, 'Começar'))) return;
        const val = { enche_inicio: rascunho.valores.enche_inicio || horaAgora(), enche_fim: rascunho.valores.enche_fim || '', brix_inicial: rascunho.valores.brix_inicial || '' };
        novoCiclo(n, val, quemAnota());
        rascunho = null; ed.alvoId = null;
        registrar('anotacao', `${quemEstaAqui()}: dorna Nº ${n} começou a encher às ${val.enche_inicio}`);
        toast(`Nº ${n} enchendo desde ${val.enche_inicio}`);
        return render();
      }
      case 'ferm-terminou': {
        if (!exigeOperador() || !rascunho) return;
        const n = rascunho.chave;
        const r = cicloAtual(n);
        if (!r || etapaFerm(r) === 'vazia') return;
        const brix = rascunho.valores.brix_inicial;
        mudarCiclo(r, { enche_inicio: rascunho.valores.enche_inicio || r.valores.enche_inicio, enche_fim: rascunho.valores.enche_fim || horaAgora(), brix_inicial: brix || '' });
        rascunho = null; ed.alvoId = null;
        render();
        // falta o Brix inicial: já abre o teclado nele
        if (vazio(brix)) { selecionar('brix_inicial'); toast('Nº ' + n + ' cheia. Anote o Brix inicial e toque em Salvar.'); } else toast(`Nº ${n} cheia. Fermentando.`);
        return;
      }
      case 'ferm-volante': {
        if (!exigeOperador() || !rascunho) return;
        const n = rascunho.chave;
        if (rascunhoSujo()) salvarRascunho(true, { silencioso: true });
        const outras = naVolante().filter((s) => s.n !== n);
        if (outras.length && !(await confirmar('A volante já está recebendo', `${outras.map((s) => `A Nº ${s.n} está mandando desde ${s.inicio}`).join('. ')}. Mandar a Nº ${n} junto?`, 'Mandar junto'))) return;
        const r = cicloAtual(n);
        if (!r || etapaFerm(r) === 'vazia') return;
        const hora = horaAgora();
        mudarCiclo(r, { volante: [...(r.valores.volante || []), { data: dataProducao(), inicio: hora, fim: '', operador: quemAnota(), inicioEm: Date.now() }] });
        rascunho = null; ed.alvoId = null;
        registrar('anotacao', `${quemEstaAqui()}: dorna Nº ${n} começou a mandar para a volante às ${hora}`);
        toast(`Nº ${n} mandando para a volante desde ${hora}`);
        return render();
      }
      case 'ferm-parar': {
        if (!exigeOperador() || !rascunho) return;
        const n = rascunho.chave;
        const r = cicloAtual(n);
        if (!r || etapaFerm(r) !== 'volante') return;
        const resp = await abrirModal(`<h3>Parou de mandar a Nº ${n}</h3><p class="dica">A dorna esvaziou?</p>
          <div class="acoes-modal"><button class="btn" data-k="nao">Não, ainda tem vinho</button><button class="btn primario" data-k="sim">${ico('certo')} Sim, esvaziou</button></div>
          <div class="acoes-modal um"><button class="btn" data-k="x">Cancelar</button></div>`, (k, b2, fechar) => fechar(k));
        if (resp !== 'sim' && resp !== 'nao') return;
        const hora = horaAgora();
        const vol = (r.valores.volante || []).map((s) => (s.fim ? s : Object.assign({}, s, { fim: hora, fimEm: Date.now(), operadorFim: operadorAtual() })));
        mudarCiclo(r, Object.assign({ volante: vol }, resp === 'sim' ? { esvaziada: { data: dataProducao(), hora, em: Date.now(), operador: quemAnota() } } : {}));
        rascunho = null; ed.alvoId = null;
        registrar('anotacao', `${quemEstaAqui()}: dorna Nº ${n} parou de mandar para a volante às ${hora}${resp === 'sim' ? ' e ficou vazia' : ', ainda com vinho'}`);
        toast(resp === 'sim' ? `Nº ${n} vazia` : `Nº ${n} parou de mandar às ${hora}`);
        return render();
      }
      case 'ferm-esvaziou': {
        if (!exigeOperador() || !rascunho) return;
        const n = rascunho.chave;
        const r = cicloAtual(n);
        if (!r || etapaFerm(r) === 'vazia') return;
        if (!(await confirmar(`A Nº ${n} está vazia?`, 'Marca que não sobrou vinho nela. O próximo passo é Começar a encher.', 'Está vazia'))) return;
        mudarCiclo(r, { esvaziada: { data: dataProducao(), hora: horaAgora(), em: Date.now(), operador: quemAnota() } });
        rascunho = null; ed.alvoId = null;
        registrar('anotacao', `${quemEstaAqui()}: dorna Nº ${n} ficou vazia`);
        toast(`Nº ${n} vazia`);
        return render();
      }
      case 'ferm-apagar': {
        if (!rascunho) return;
        const n = rascunho.chave;
        const r = cicloAtual(n);
        if (!r) return;
        if (!(await confirmar(`Apagar o enchimento da Nº ${n}?`, `O enchimento de ${fmtData(r.data)}${r.valores.enche_inicio ? ` (começou às ${r.valores.enche_inicio})` : ''} sai da folha. Use só se foi anotado por engano.`, 'Apagar', true))) return;
        if (ehCentral() && r.operador && !ehDoChefe(r.operador) && !(await autorizar([r.operador]))) return;
        apagar(r.data, PID_FERMENTACAO, r.chave);
        rascunho = null; ed.alvoId = null;
        registrar('anotacao', `${quemEstaAqui()} apagou o enchimento da dorna Nº ${n}`);
        toast(`Enchimento da Nº ${n} apagado`);
        return render();
      }
      case 'medida-grupo': {
        const g = grupoDaMedicao(b.dataset.grupo);
        if (!g) return;
        const num = (x) => (x == null || x === '' ? '' : String(x).replace('.', ','));
        const resp = await abrirModal(`<h3>Medidas: ${esc(g.nome)}</h3><p class="dica">Altura da dorna e área da base, em metros. Volume = (altura − folga) × base${emM3(g) ? ', em m³' : ' × 1000, em litros'}.</p>
          <div class="medidas-form"><div class="medidas-cab"><span></span><span>Altura (m)</span><span>Base (m²)</span></div>
          ${g.dornas.map((d, i) => `<label><span>${esc(d.nome)}</span><input id="alt${i}" inputmode="decimal" autocomplete="off" value="${esc(num(d.altura))}"><input id="area${i}" inputmode="decimal" autocomplete="off" value="${esc(num(d.area))}"></label>`).join('')}</div>
          <div class="acoes-modal"><button class="btn" data-k="x">Cancelar</button><button class="btn primario" data-k="ok">Salvar</button></div>`,
        (k, b2, fechar, f) => {
          if (k === 'x') return fechar(undefined);
          if (k !== 'ok') return;
          const ler = (id) => { const t = f.querySelector('#' + id).value.trim().replace(',', '.'); return t === '' ? null : Number(t); };
          const novas = g.dornas.map((d, i) => ({ altura: ler('alt' + i), area: ler('area' + i) }));
          const ruim = novas.findIndex((x) => [x.altura, x.area].some((y) => y != null && !(y > 0 && y < 100)));
          if (ruim >= 0) { toast(`${g.dornas[ruim].nome}: medida errada. Use números como 2,7`, 'erro'); return; }
          fechar(novas);
        }, { classe: 'largo' });
        if (!resp) return;
        const med = JSON.parse(JSON.stringify(medidasDasDornas()));
        const gg = med.grupos.find((x) => x.id === g.id);
        gg.dornas.forEach((d, i) => { d.altura = resp[i].altura; d.area = resp[i].area; });
        salvarConfigSistema({ medicao: med });
        toast(`Medidas de ${g.nome} salvas`);
        return render();
      }
      case 'medidas-planilha': {
        if (!(await confirmar('Voltar para as medidas da planilha?', 'As medidas trocadas aqui voltam a ser as da planilha CONTROLE LTS. As medições já salvas continuam com o volume que tinham.', 'Voltar'))) return;
        salvarConfigSistema({ medicao: null });
        toast('Medidas da planilha de volta');
        return render();
      }
      case 'contato': {
        const campo = b.dataset.campo;
        const atual = configSistema()[campo] || '';
        const valor = await textoLivre(campo === 'whatsapp'
          ? { titulo: 'WhatsApp do escritório', dica: 'Com DDD, só números. Exemplo: 14991234567', valor: atual, tipo: 'tel' }
          : { titulo: 'E-mail do escritório', dica: 'Exemplo: escritorio@ubiralcool.com.br', valor: atual, tipo: 'email' });
        if (valor === undefined) return;
        if (campo === 'whatsapp' && valor && telefoneLimpo(valor).length < 10) return toast('Número incompleto. Coloque o DDD e o número.', 'erro');
        if (campo === 'email' && valor && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(valor)) return toast('E-mail incompleto. Confira.', 'erro');
        salvarConfigSistema({ [campo]: campo === 'whatsapp' ? telefoneLimpo(valor) : valor });
        toast(valor ? 'Contato salvo' : 'Contato apagado');
        return render();
      }
      case 'lista-add': {
        const nome = b.dataset.lista;
        const valor = await textoLivre({ titulo: nome === 'produtos' ? 'Novo tipo de produto' : 'Novo fornecedor', dica: 'Escreva como deve aparecer para o operador.' });
        if (!valor) return;
        const lista = [...listaDaUsina(nome)];
        if (!lista.includes(valor.toUpperCase())) lista.push(valor.toUpperCase());
        salvarConfigSistema({ [nome]: lista });
        return render();
      }
      case 'lista-remove': {
        const nome = b.dataset.lista;
        const lista = [...listaDaUsina(nome)];
        lista.splice(Number(b.dataset.i), 1);
        salvarConfigSistema({ [nome]: lista });
        return render();
      }
      case 'mostrar-mais': { const abertos = Object.assign({}, v.abertos); abertos[b.dataset.setor] = !abertos[b.dataset.setor]; v.abertos = abertos; return render(); }
      case 'setor-liga': return mudarConfigLista('setor', b.dataset.id);
      case 'lembrete-liga': {
        const m = Object.assign({}, configSistema().lembretes || {});
        m[b.dataset.id] = m[b.dataset.id] ? false : { de: 7, ate: 7 };
        salvarConfigSistema({ lembretes: m });
        return render();
      }
      case 'lembrete-horario': return escolherHorarioLembrete(b.dataset.id);
      case 'turnos-setor': return mudarTurnosDoSetor(b.dataset.id, b.dataset.modelo === '12h');
      case 'prancheta-liga': return mudarConfigLista('prancheta', b.dataset.setor, b.dataset.id);
      case 'op-add': {
        const setor = b.dataset.setor;
        const nome = await textoLivre({ titulo: `Novo operador da ${setorPorId(setor).nome}`, dica: 'Escreva como deve aparecer na prancheta.' });
        if (!nome) return;
        const senha = await pedirSenhaModal(`Senha de ${nome}`, 'Quatro números, que só essa pessoa vai saber. Pode deixar em branco.');
        salvarOperadores(setor, [...operadoresDo(setor), { nome, senha: senha ? embaralharSenha(nome, senha) : '' }]);
        toast(senha ? `${nome} cadastrado com senha` : `${nome} cadastrado sem senha`);
        return render();
      }
      case 'op-senha': {
        const setor = b.dataset.setor;
        const lista = [...operadoresDo(setor)];
        const op = lista[Number(b.dataset.i)];
        const senha = await pedirSenhaModal(`Nova senha de ${op.nome}`, 'Quatro números. Em branco, tira a senha.');
        if (senha === undefined) return;
        lista[Number(b.dataset.i)] = { nome: op.nome, senha: senha ? embaralharSenha(op.nome, senha) : '' };
        salvarOperadores(setor, lista);
        toast(senha ? `Senha de ${op.nome} trocada` : `${op.nome} ficou sem senha`);
        return render();
      }
      case 'op-remove': {
        const setor = b.dataset.setor;
        const lista = [...operadoresDo(setor)];
        const op = lista[Number(b.dataset.i)];
        if (!(await confirmar(`Remover ${op.nome}?`, 'O nome sai da lista. O que essa pessoa já anotou continua na folha.', 'Remover', true))) return;
        lista.splice(Number(b.dataset.i), 1);
        salvarOperadores(setor, lista);
        return render();
      }
      case 'imprimir': return imprimirEscolhendo(v.data || dataProducao());
      case 'qr-grande': {
        const st = sync.status;
        const endereco = st && st.enderecos && st.enderecos[0] ? st.enderecos[0] : '';
        if (!endereco || typeof window.qrcode !== 'function') return toast('Ainda procurando o endereço no Wi-Fi', 'erro');
        const q = window.qrcode(0, 'M'); q.addData(endereco + '/baixar'); q.make();
        await abrirModal(`<h3>Conectar um tablet</h3>
          <div class="qr-modal">
            <div class="qr-grande">${q.createSvgTag({ cellSize: 8, margin: 2, scalable: true })}</div>
            <ol class="passos-conectar">
              <li><b>Aponte a câmera</b> do tablet novo para o QR code e baixe o aplicativo.</li>
              <li><b>Instale e abra.</b> Ele procura este tablet sozinho. Se pedir o endereço: <span class="endereco">${esc(endereco.replace(/^http:\/\//, ''))}</span></li>
              <li><b>Digite o código</b> <span class="codigo-grande">${esc(String(st.codigo).replace(/(\d{3})(\d{3})/, '$1 $2'))}</span></li>
            </ol>
          </div>
          <div class="acoes-modal um"><button class="btn primario" data-k="x">Fechar</button></div>`,
        (k, b2, fechar) => fechar(), { classe: 'largo' });
        return;
      }
      case 'novo-codigo': {
        if (!(await confirmar('Trocar o código de conexão?', 'Os outros aparelhos são desconectados e só voltam com o código novo (o do dono continua e decide se mantém). Use se um aparelho foi perdido ou roubado.', 'Trocar', true))) return;
        const r = await postJson('api/novo-codigo', {}).catch(() => null);
        if (r && !r.ok) { const d = await r.json().catch(() => ({})); return toast(d.erro || 'A central não trocou o código', 'erro'); }
        if (r && r.ok) {
          const d = await r.json().catch(() => ({}));
          if (d.chave) { cfg.chave = d.chave; cfg.cifra = 1; salvarCfg(); } // este aparelho continua conectado
          sync.statusJson = ''; await sincronizar(); toast('Código trocado. Os outros aparelhos vão pedir o código novo.'); render();
        }
        return;
      }
      case 'exemplo': preencherExemplo(); toast('Dados de exemplo adicionados'); return render();
      case 'limpar-tudo': {
        const aviso = pendentes() ? `Atenção: ${contar(pendentes(), 'anotação ainda não chegou', 'anotações ainda não chegaram')} na central.` : 'O que já foi enviado continua guardado na central.';
        if (centralNoTablet()) return toast('Este aparelho é o servidor da usina. Desligue o servidor antes de apagar os dados dele.', 'erro');
        if (await confirmar('Apagar os dados deste aparelho?', `${aviso} Depois você escolhe de novo onde ele vai ficar.`, 'Apagar tudo', true)) {
          registros = {}; salvarRegistros();
          cfg.ultimoSeq = 0; cfg.papel = null; cfg.op = null; salvarCfg();
          toast('Dados deste aparelho apagados'); pilha = [telaInicial()]; render(true);
        }
        return;
      }
      case 'desconectar':
        if (await confirmar('Desconectar da central?', 'Para usar de novo vai ser preciso digitar o código de conexão.', 'Desconectar', true)) {
          cfg.chave = null; cfg.demo = false; cfg.papel = null; salvarCfg(); pilha = [telaInicial()]; render(true);
        }
        return;
      case 'tela-cheia': {
        cfg.telaCheia = b.dataset.valor === '1'; salvarCfg();
        aplicarTelaCheia();
        return render();
      }
      case 'instalar':
        if (eventoInstalar) { eventoInstalar.prompt(); eventoInstalar = null; }
        else await confirmar('Como instalar', 'No Chrome do Android, toque nos três pontinhos no canto de cima e depois em "Adicionar à tela inicial".', 'Entendi');
        return;
    }
  });
  app.addEventListener('input', (e) => {
    if (e.target.id !== 'aviso-texto') return;
    const v = view();
    if (v.form) { v.form.texto = e.target.value; atualizarTelaAvisos(); }
  });
  let eventoInstalar = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); eventoInstalar = e; });

  function exigeOperador() {
    if (ehCentral() || operadorAtual()) return true;
    toast('Primeiro escolha o seu nome', 'erro');
    ir({ tela: 'operador' });
    return false;
  }

  // teclado físico (útil no computador do escritório)
  document.addEventListener('keydown', (e) => {
    if (modalAberto() || !painelVisivel() || e.ctrlKey || e.altKey || e.metaKey) return;
    const a = alvoAtual();
    let k = null;
    if (/^\d$/.test(e.key)) k = e.key;
    else if (e.key === ',' || e.key === '.') k = e.key;
    else if (e.key === 'Backspace') k = 'apagar';
    else if (e.key === 'Enter' || e.key === 'Tab') k = 'prox';
    else if (e.key === '+' || e.key === '-') k = e.key;
    else if (e.key === ' ' && a.type === 'text') k = 'espaco';
    else if (/^[a-zA-ZÀ-ú]$/.test(e.key) && a.type === 'text') k = e.key;
    if (k) { e.preventDefault(); tecla(k); }
  });
