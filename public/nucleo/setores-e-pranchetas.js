/* Pranchetas Ubirálcool - setores, pranchetas e configuração da usina
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * Setores, pranchetas e configuração da usina
   * ========================================================= */
  const todosSetores = C.setores;
  const setorPorId = (id) => todosSetores.find((s) => s.id === id);
  const prancheta = (pid) => C.pranchetas[pid];
  /** Setor de uma prancheta. Prancheta de insumo que fica dentro de uma tela "juntas" pertence ao setor da tela. */
  function setorDaPrancheta(pid) {
    const direto = todosSetores.find((s) => s.pranchetas.includes(pid));
    if (direto) return direto;
    const juntas = Object.keys(C.pranchetas).find((k) => C.pranchetas[k].tipo === 'juntas' && C.pranchetas[k].partes.some((pt) => pt.prancheta === pid));
    return juntas ? todosSetores.find((s) => s.pranchetas.includes(juntas)) : null;
  }
  /** Folhas de papel por trás de uma prancheta da tela (uma tela "juntas" tem duas folhas). */
  const folhasDe = (pid) => (prancheta(pid).tipo === 'juntas' ? prancheta(pid).partes.map((pt) => pt.prancheta) : [pid]);

  /* Configuração que o tablet chefe define e vale para todos os aparelhos.
     Fica guardada como um registro normal, então viaja pela mesma sincronização. */
  const CFG_SISTEMA = { data: 'config', pid: 'sistema', chave: 'geral' };
  const configSistema = () => (pegar(CFG_SISTEMA.data, CFG_SISTEMA.pid, CFG_SISTEMA.chave) || { valores: {} }).valores;
  function salvarConfigSistema(mudanca) {
    const partes = typeof textoDaConfig === 'function' ? textoDaConfig(mudanca) : [];
    if (partes.length) registrar('configuracao', `${quemEstaAqui()} ${partes.join(', ')}`);
    gravar(CFG_SISTEMA.data, CFG_SISTEMA.pid, CFG_SISTEMA.chave, mudanca, { operador: 'escritório' });
  }
  const listaDaUsina = (nome) => configSistema()[nome] || (nome === 'produtos' ? C.produtosPadrao : C.fornecedoresPadrao) || [];
  const opcoesDe = (c) => (Array.isArray(c.opcoes) ? c.opcoes : listaDaUsina(c.opcoes));

  const setorAtivo = (id) => (configSistema().setoresDesligados || []).indexOf(id) < 0;
  const setoresAtivos = () => todosSetores.filter((s) => setorAtivo(s.id));
  function pranchetasDo(setorId) {
    const s = setorPorId(setorId);
    if (!s) return [];
    const desligadas = (configSistema().pranchetasDesligadas || {})[setorId] || [];
    return s.pranchetas.filter((pid) => desligadas.indexOf(pid) < 0);
  }
  /** Setores ligados, já com as pranchetas ligadas de cada um. */
  const setores = () => setoresAtivos().map((s) => Object.assign({}, s, { pranchetas: pranchetasDo(s.id) }));
  const ehCentral = () => cfg.papel === 'central';
  const ehEscritorio = () => cfg.papel === 'escritorio'; // versão 2.13: o aparelho do Escritório (não é setor nem tablet chefe)

  /* Operadores: cada um tem a sua senha de 4 números, para ninguém anotar no nome do outro.
     A senha é guardada embaralhada, não em texto puro. Serve para evitar troca sem autorização,
     não é segurança de banco. O encarregado sempre consegue destravar com a senha dele. */
  const comoOperador = (o) => (typeof o === 'string' ? { nome: o, senha: '' } : { nome: o.nome, senha: o.senha || '' });
  const operadoresDo = (id) => ((configSistema().operadores || {})[id] || cfg.operadores[id] || (setorPorId(id) || {}).operadores || []).map(comoOperador);
  const operadorPorNome = (id, nome) => operadoresDo(id).find((o) => o.nome === nome);
  function embaralharSenha(nome, senha) {
    let h = 5381;
    const texto = `${nome}:${senha}:ubiralcool`;
    for (let i = 0; i < texto.length; i++) h = ((h * 33) ^ texto.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }
  function salvarOperadores(setorId, lista) {
    const mapa = Object.assign({}, configSistema().operadores || {});
    mapa[setorId] = lista;
    if (ehCentral() || cfg.chave) salvarConfigSistema({ operadores: mapa });
    else { cfg.operadores[setorId] = lista; salvarCfg(); }
  }
