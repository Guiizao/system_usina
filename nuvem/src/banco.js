/* Pranchetas Digitais - (c) 2026 Guilherme. Todos os direitos reservados. Uso somente com autorizacao do autor (veja LICENCA.txt). */
/*
 * Versão 3.0: o banco é a fonte de tudo. Os aparelhos falam direto com ele, com as mesmas rotas da central
 * (/banco/api/sync, /banco/api/registros, /banco/api/pessoas...). A central do tablet chefe vira a ponte do Wi-Fi:
 * manda o que recebeu e puxa o que chegou por aqui.
 *
 * Regras que nada pode quebrar (docs/superpowers/plans/2026-11-02-versao-3-0.md):
 *  - falta de dado nunca é apagamento: só apaga uma marca explícita ("apagado", com hora);
 *  - quem numera as mudanças é o banco (seq), nunca o aparelho;
 *  - mais novo ganha, campo a campo (juncao.js); reenviar a mesma coisa não muda nada;
 *  - pessoas, aparelhos e níveis são linhas com hora (em): nada é regravado inteiro.
 *
 * O plano grátis dá 10 ms de processamento por pedido: nada de laço caro por aqui. A senha é conferida com o
 * PBKDF2 de 1000 voltas (a mesma conferência da entrada pela nuvem); nunca com o resumo pesado da central.
 */
import { situacaoDoServidorDaUsina } from './usina.js';
import leitura from '../../api-leitura.js';
import Juncao from '../../public/nucleo/juncao.js';
import RegrasUsina from '../../regras-usina.js';
import { assistente } from './assistente.js';

const { criadasSemSaber, juntarLinhas } = RegrasUsina;
const MAX_POR_PEDIDO = 500;
const MAX_RESPOSTA = 1024 * 1024;
const LIBERADO_MS = 10 * 60000;
const ONLINE_MS = 90000, SEM_SINAL_MS = 5 * 60000;
const FUSO_MS = -180 * 60000;

export function criarBanco(h) {
  const { responder, mesmoSegredo, tokenDoAparelho, leitorDaNuvem, idAparelho, senhaDoPedido, reservarTentativa, devolverTentativa, corpoFila, selar, hex, telasPublicadas } = h;

  /* ---------- gravar: junta com o que está guardado e numera ---------- */
  const conteudo = (r) => JSON.stringify([r.valores || {}, !!r.apagado, r.operador || '']);
  /** O que fica guardado ao receber r em cima de a; null quando não muda nada. */
  function mesclar(a, r) {
    if (!a) return r;
    if (r.data === 'config') {
      // a central e o banco numeram a revisão cada um: fica a maior; na mesma, a mais nova
      const ra = Number(a.rev) || 0, rr = Number(r.rev) || 0;
      return rr > ra || (rr === ra && r.atualizadoEm > a.atualizadoEm) ? r : null;
    }
    const j = Juncao.juntar(a, r);
    if (j) return JSON.stringify([j.valores, j.camposEm]) === JSON.stringify([a.valores, a.camposEm]) && j.atualizadoEm === a.atualizadoEm ? null : j;
    if (criadasSemSaber(a, r)) { const m = juntarLinhas(a, r); return conteudo(m) === conteudo(a) ? null : m; }
    if (r.atualizadoEm > a.atualizadoEm) return r;
    // empate com conteúdo diferente: o mesmo resultado em qualquer ordem de chegada
    if (r.atualizadoEm === a.atualizadoEm && conteudo(r) > conteudo(a)) return r;
    return null;
  }
  const limpar = (r, agora) => {
    const { sincronizado, naNuvem, esperaEntrar, base, doBanco, ...limpo } = r;
    limpo.recebidoEm = agora;
    return limpo;
  };
  async function lerLinhas(env, ids) {
    if (!ids.length) return new Map();
    const { results } = await env.DB.prepare('SELECT id, seq, json FROM registros WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(ids)).all();
    return new Map(results.map((l) => [l.id, Object.assign(JSON.parse(l.json), { seq: l.seq })]));
  }
  const mudancas = (r) => (r && r.meta ? r.meta.changes : r && r.changes) || 0;
  /** Grava a lista (já conferida). Dois aparelhos ao mesmo tempo: a segunda escrita não vale e junta de novo. Devolve quantas mudaram. */
  async function gravar(env, lista0) {
    let total = 0;
    const lista = lista0.map((r) => Juncao.semFuturo(r, Date.now()));
    for (let vez = 0; vez < 4 && lista.length; vez++) {
      const atuais = await lerLinhas(env, [...new Set(lista.map((r) => r.id))]);
      const novos = new Map();
      for (const r of lista) {
        const e = mesclar(novos.get(r.id) || atuais.get(r.id), r);
        if (e) novos.set(r.id, e);
      }
      if (!novos.size) return total;
      const agora = Date.now();
      const carga = [...novos.values()].map((r) => limpar(r, agora));
      const n = carga.length;
      const lidos = JSON.stringify(carga.map((r) => ({ id: r.id, lido: atuais.has(r.id) ? atuais.get(r.id).seq : null })));
      const dias = JSON.stringify([...new Set(carga.map((r) => r.data).filter((d) => leitura.ehDia(d)))]);
      const rs = await env.DB.batch([
        env.DB.prepare(`INSERT INTO info (chave, valor) SELECT 'seqBanco', COALESCE((SELECT MAX(seq) FROM registros), 0) + CAST(? AS INTEGER) WHERE true
          ON CONFLICT(chave) DO UPDATE SET valor = CAST(info.valor AS INTEGER) + CAST(? AS INTEGER)`).bind(n, n),
        env.DB.prepare(`INSERT INTO registros (id, data, prancheta, setor, chave, seq, atualizadoEm, apagado, json)
          SELECT json_extract(value, '$.id'), json_extract(value, '$.data'), json_extract(value, '$.prancheta'), json_extract(value, '$.setor'), json_extract(value, '$.chave'),
            (SELECT CAST(valor AS INTEGER) FROM info WHERE chave = 'seqBanco') - ? + CAST(key AS INTEGER) + 1, json_extract(value, '$.atualizadoEm'),
            CASE WHEN json_extract(value, '$.apagado') THEN 1 ELSE 0 END,
            json_set(value, '$.seq', (SELECT CAST(valor AS INTEGER) FROM info WHERE chave = 'seqBanco') - ? + CAST(key AS INTEGER) + 1)
          FROM json_each(?) WHERE true
          ON CONFLICT(id) DO UPDATE SET data = excluded.data, prancheta = excluded.prancheta, setor = excluded.setor, chave = excluded.chave,
            seq = excluded.seq, atualizadoEm = excluded.atualizadoEm, apagado = excluded.apagado, json = excluded.json
          WHERE registros.seq IS (SELECT json_extract(l.value, '$.lido') FROM json_each(?) l WHERE json_extract(l.value, '$.id') = excluded.id)`).bind(n, n, JSON.stringify(carga), lidos),
        env.DB.prepare('UPDATE dias SET anotacoes = 0 WHERE data IN (SELECT value FROM json_each(?))').bind(dias),
        env.DB.prepare(`INSERT INTO dias (data, anotacoes)
          SELECT data, COUNT(*) FROM registros WHERE apagado = 0 AND prancheta NOT IN ('avisos', 'avisos-recibo', 'registro') AND data IN (SELECT value FROM json_each(?)) GROUP BY data
          ON CONFLICT(data) DO UPDATE SET anotacoes = excluded.anotacoes`).bind(dias),
      ]);
      const feitas = mudancas(rs[1]);
      total += feitas;
      if (feitas >= n) return total;
    }
    return total;
  }
  const seqAtual = async (env) => {
    const l = await env.DB.prepare("SELECT CAST(valor AS INTEGER) AS seq FROM info WHERE chave = 'seqBanco'").first();
    return (l && l.seq) || 0;
  };

  /* ---------- o aviso em tempo real ---------- */
  async function avisar(env, msg) {
    if (!env.SALA) return;
    try { await env.SALA.get(env.SALA.idFromName('usina')).fetch('https://sala/avisar', { method: 'POST', body: JSON.stringify(msg) }); } catch (e) { /* o aparelho puxa no próximo ciclo */ }
  }
  async function vivos(env) {
    if (!env.SALA) return [];
    try { return await (await env.SALA.get(env.SALA.idFromName('usina')).fetch('https://sala/vivos')).json(); } catch (e) { return []; }
  }

  /* ---------- estado da usina: pessoas, níveis, setores e bloqueios ---------- */
  const lerJson = (t, padrao) => { try { return t ? JSON.parse(t) : padrao; } catch (e) { return padrao; } };
  async function lerPessoas(env) {
    const { results } = await env.DB.prepare('SELECT json FROM pessoas').all();
    return results.map((l) => JSON.parse(l.json));
  }
  /** Monta o que as regras precisam (o mesmo formato do config.json da central) para este aparelho. */
  async function contexto(env, quem) {
    const { results } = await env.DB.prepare("SELECT chave, valor FROM info WHERE chave IN ('geracao', 'estado', 'forms', 'seqBanco', 'bloqueiosRev', 'aparelhos', 'aparelhosEm')").all();
    const info = Object.fromEntries(results.map((l) => [l.chave, l.valor]));
    const estado = Object.assign({ donoId: '', aparelhosChefe: {}, setoresAparelhos: {}, geracoesZeradas: [] }, lerJson(info.estado, {}));
    const pessoas = await lerPessoas(env);
    const sessao = await env.DB.prepare('SELECT pessoa FROM acessos_nuvem WHERE aparelho = ?').bind(quem.aparelho).first();
    const lib = await env.DB.prepare('SELECT pessoa, ate FROM liberados_setor WHERE aparelho = ?').bind(quem.aparelho).first();
    const sist = await env.DB.prepare("SELECT json FROM registros WHERE id = 'config|sistema|geral'").first();
    const sistema = sist ? JSON.parse(sist.json) : null;
    const forms = lerJson(info.forms, { setores: [], pranchetas: {}, funcoes: [], niveis: {} });
    const config = {
      pessoas, donoId: estado.donoId, aparelhosChefe: estado.aparelhosChefe, setoresAparelhos: estado.setoresAparelhos, aparelhosVistos: {},
      sessoes: sessao ? { [quem.aparelho]: { pessoaId: sessao.pessoa } } : {},
    };
    // computador que entrou pela nuvem: vale a sessão da pessoa (o dono com tudo; os outros como nível 2) até alguém dar outro nível a ele
    if (quem.pc && !config.aparelhosChefe[quem.aparelho]) {
      const dono = sessao && sessao.pessoa === estado.donoId;
      config.aparelhosChefe = Object.assign({}, config.aparelhosChefe, { [quem.aparelho]: { nivel: dono ? 3 : 2, daSessao: true } });
    }
    const ctx = { info, estado, config, pessoas, sistema, forms, estadoMudou: false, novosRegistros: [], liberados: lib ? { [quem.aparelho]: { pessoaId: lib.pessoa, ate: lib.ate } } : {} };
    ctx.regras = RegrasUsina.criar({ config: () => config, sistema: () => ctx.sistema, forms: () => ctx.forms, liberados: () => ctx.liberados, salvar: () => { ctx.estadoMudou = true; } });
    return ctx;
  }
  async function salvarEstado(env, ctx) {
    if (!ctx.estadoMudou) return;
    const { daSessao, ...limpo } = ctx.estado;
    limpo.setoresAparelhos = ctx.config.setoresAparelhos;
    const estado = JSON.stringify(limpo);
    await env.DB.prepare("INSERT INTO info (chave, valor) VALUES ('estado', ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor").bind(estado).run();
    ctx.estadoMudou = false;
  }
  const textoPessoa = (p) => JSON.stringify(p);
  const gravarPessoas = (env, lista) => env.DB.batch(lista.map((p) => env.DB.prepare('INSERT INTO pessoas (id, json) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json').bind(p.id, textoPessoa(p))));
  const pessoaPublica = (p) => ({ id: p.id, nome: p.nome, nivel: p.nivel, extras: p.extras || {}, aparelhos: p.aparelhos || [], ativo: p.ativo !== false, temSenha: !!(p.nuvem && p.nuvem.selado) });

  /* ---------- registro do sistema (a mesma folha "registro" da central) ---------- */
  function diaDaUsina(ctx, ms) {
    const inicio = Number.isFinite(ctx.forms.inicioDoDia) ? ctx.forms.inicioDoDia : 7;
    return new Date(ms + FUSO_MS - inicio * 3600000).toISOString().slice(0, 10);
  }
  function registrar(ctx, tipo, texto, extra = {}) {
    const em = Date.now(), data = diaDaUsina(ctx, em);
    const chave = em.toString(36) + '-' + crypto.randomUUID().slice(0, 6);
    ctx.novosRegistros.push({ id: `${data}|registro|${chave}`, data, prancheta: 'registro', setor: 'central', chave, valores: Object.assign({ em, tipo, quem: '', aparelho: '', texto }, extra),
      criadoEm: em, atualizadoEm: em, aparelho: 'banco', operador: extra.quem || '', apagado: false });
  }
  const nomeDe = (ctx, aparelhoLinha, id) => (ctx.config.aparelhosChefe[id] && ctx.config.aparelhosChefe[id].nome) || (aparelhoLinha && aparelhoLinha.nome) || 'Aparelho ' + String(id).slice(-6);

  /* ---------- senhas ---------- */
  async function verificadorDe(pin, sal, iteracoes) {
    const enc = new TextEncoder();
    const chave = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
    return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(sal), iterations: iteracoes }, chave, 256));
  }
  async function senhaConfere(env, p, pin) {
    const n = p && p.nuvem;
    if (!n || !n.selado || !n.sal || n.iteracoes !== 1000) return false;
    return mesmoSegredo(await selar(env.SEGREDO_CENTRAL, await verificadorDe(pin, n.sal, n.iteracoes)), n.selado);
  }
  async function pessoaDaSenha(env, pessoas, pin) {
    for (const p of pessoas) if (p.ativo !== false && !p.pedeTrocarSenha && await senhaConfere(env, p, pin)) return p;
    return null;
  }
  async function novaSenha(env, pin) {
    const sal = hex(crypto.getRandomValues(new Uint8Array(16))), iteracoes = 1000;
    return { sal, iteracoes, selado: await selar(env.SEGREDO_CENTRAL, await verificadorDe(pin, sal, iteracoes)) };
  }
  /** Reserva a tentativa antes de conferir (pedidos ao mesmo tempo também respeitam o limite). */
  async function reservar(req, env, aparelho) {
    const agora = Date.now(), geral = 'todos:' + Math.floor(agora / 3600000);
    const chaves = ['ip:' + (req.headers.get('CF-Connecting-IP') || 'sem-ip'), 'aparelho:' + aparelho, geral];
    for (let i = 0; i < chaves.length; i++) {
      const ok = chaves[i] === geral ? await reservarTentativa(env, geral, agora, 20, [3600000, 3600000]) : await reservarTentativa(env, chaves[i], agora);
      if (!ok) { for (const c of chaves.slice(0, i)) await devolverTentativa(env, c).run(); return null; }
    }
    return chaves;
  }
  const devolver = (env, chaves) => env.DB.batch(chaves.map((c) => devolverTentativa(env, c)));

  /* ---------- quem está pedindo ---------- */
  async function autenticar(req, env) {
    const aparelho = req.headers.get('X-Aparelho');
    if (!idAparelho(aparelho) || !env.SEGREDO_CENTRAL) return null;
    const recebido = senhaDoPedido(req);
    if (await mesmoSegredo(recebido, await tokenDoAparelho(env.SEGREDO_CENTRAL, aparelho))) return { aparelho, pc: false };
    const acesso = await leitorDaNuvem(env, aparelho, recebido);
    return acesso ? { aparelho, pc: true, expira: acesso.expira } : null;
  }

  /* ---------- aparelhos ligados ---------- */
  const textoCurto = (x, n = 80) => String(x == null ? '' : x).slice(0, n);
  function infoLimpa(info) {
    if (!info || typeof info !== 'object' || Array.isArray(info)) return null;
    const t = JSON.stringify(info);
    return t.length <= 2000 ? info : null;
  }
  /** Atualiza a linha do aparelho e registra o que mudou: novo, outra versão, outra função. */
  async function verAparelho(req, env, ctx, quem, corpo) {
    const id = quem.aparelho, agora = Date.now();
    const linha = await env.DB.prepare('SELECT json FROM aparelhos WHERE id = ?').bind(id).first();
    const antes = linha ? JSON.parse(linha.json) : null;
    const pessoa = ctx.regras.pessoaDoAparelho(id);
    const novo = {
      id, nome: textoCurto(corpo.nome, 60) || (antes && antes.nome) || '', papel: textoCurto(corpo.papel, 30), operador: textoCurto(corpo.operador, 60), versao: textoCurto(corpo.versao, 20),
      pessoa: pessoa ? pessoa.nome : '', info: infoLimpa(corpo.info) || (antes && antes.info) || null, tipo: quem.pc ? 'computador' : textoCurto(corpo.tipo, 20) || 'tablet', rede: textoCurto(corpo.rede, 20),
      ip: req.headers.get('CF-Connecting-IP') || '', pais: req.headers.get('CF-IPCountry') || '', desde: (antes && antes.desde) || agora, vistoEm: agora,
    };
    ctx.linhaDoAparelho = novo;
    const nome = nomeDe(ctx, novo, id);
    if (!antes) registrar(ctx, 'aparelho', `${nome} ligou no banco pela primeira vez`, { aparelho: nome });
    else {
      if (novo.versao && antes.versao && novo.versao !== antes.versao) registrar(ctx, 'aparelho', `${nome} atualizou da versão ${antes.versao} para a ${novo.versao}`, { aparelho: nome, antes: antes.versao, depois: novo.versao });
      if (novo.papel && antes.papel && novo.papel !== antes.papel) registrar(ctx, 'aparelho', `${nome} mudou de função`, { aparelho: nome, antes: antes.papel, depois: novo.papel });
    }
    await env.DB.prepare('INSERT INTO aparelhos (id, json, vistoEm) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json, vistoEm = excluded.vistoEm').bind(id, JSON.stringify(novo), agora).run();
    return novo;
  }
  async function listaDeAparelhos(env, ctx) {
    const agora = Date.now();
    const [linhas, ao, bloq] = await Promise.all([
      env.DB.prepare('SELECT json FROM aparelhos ORDER BY vistoEm DESC LIMIT 200').all(), vivos(env),
      env.DB.prepare('SELECT id, json FROM bloqueios').all(),
    ]);
    const naSala = new Map(ao.map((a) => [a.aparelho, a]));
    const bloqueios = new Map(bloq.results.map((b) => [b.id, JSON.parse(b.json)]));
    const sessoes = await env.DB.prepare('SELECT aparelho, pessoa FROM acessos_nuvem').all();
    const quemNo = new Map(sessoes.results.map((s) => [s.aparelho, s.pessoa]));
    const noBanco = linhas.results.map((l) => JSON.parse(l.json));
    // 3.0: quem só tem Wi-Fi fala com a central, e ela manda a lista para cá. Sem lista nova há 5 minutos, ninguém dela aparece ligado.
    const fotoEm = Number(ctx.info.aparelhosEm) || 0, ids = new Set(noBanco.map((a) => a.id));
    const peloWifi = lerJson(ctx.info.aparelhos, []).filter((a) => a && a.id && !ids.has(a.id)).map((a) => ({ ...a, rede: 'Wi-Fi da central', vistoEm: agora - fotoEm > SEM_SINAL_MS ? Math.min(Number(a.vistoEm) || 0, agora - ONLINE_MS) : Number(a.vistoEm) || 0 }));
    return [...noBanco, ...peloWifi].map((a) => {
      const online = naSala.has(a.id) || agora - a.vistoEm < ONLINE_MS;
      const b = bloqueios.get(a.id);
      const p = ctx.pessoas.find((x) => x.id === quemNo.get(a.id));
      return {
        id: a.id, papel: a.papel, setor: a.papel === 'central' ? '' : a.papel, vistoEm: naSala.has(a.id) ? agora : a.vistoEm, operador: a.operador, ip: a.ip, versao: a.versao,
        nome: nomeDe(ctx, a, a.id), pessoa: p ? p.nome : a.pessoa || '', teto: ctx.regras.tetoDoAparelho(a.id), info: a.info, desde: a.desde, tipo: a.tipo, rede: a.rede || '', aoVivo: naSala.has(a.id),
        nivel: ctx.regras.nivelDoAparelho(a.id), online, minutos: Math.round((agora - a.vistoEm) / 60000),
        bloqueio: b ? { em: b.em, modo: b.modo, apagar: !!b.apagar, por: b.por || '' } : null,
      };
    }).sort((x, y) => (y.online - x.online) || (x.minutos - y.minutos));
  }

  /* ---------- /banco/api/sync: o mesmo que a central faz, conferido aqui ---------- */
  async function bloqueioDe(env, id) {
    const b = await env.DB.prepare('SELECT json FROM bloqueios WHERE id = ?').bind(id).first();
    return b ? JSON.parse(b.json) : null;
  }
  const bloqueioPublico = (b) => ({ em: b.em, rev: b.rev || 0, modo: b.modo, apagar: !!b.apagar });
  async function apiSync(req, env, quem, url) {
    let corpo;
    try { corpo = await corpoFila(req); } catch (status) { return responder(status === 413 ? 413 : 400, { erro: status === 413 ? 'Máximo de 1 MB por envio' : 'JSON inválido' }); }
    const lista = Array.isArray(corpo.registros) ? corpo.registros : [];
    if (lista.length > MAX_POR_PEDIDO) return responder(400, { erro: `Máximo de ${MAX_POR_PEDIDO} anotações por envio` });
    const ctx = await contexto(env, quem);
    const aparelho = quem.aparelho;
    const b0 = await bloqueioDe(env, aparelho);
    if (b0) return responder(423, { erro: 'bloqueado', bloqueio: bloqueioPublico(b0), geracao: ctx.info.geracao || '' });
    const regras = ctx.regras;
    regras.guardarSetor(aparelho, corpo.papel);
    await verAparelho(req, env, ctx, quem, corpo);
    if (corpo.geracao && corpo.geracao !== ctx.info.geracao && (ctx.estado.geracoesZeradas || []).includes(corpo.geracao)) {
      await salvarEstado(env, ctx);
      return responder(200, { ok: false, zerar: true, zerada: true, geracao: ctx.info.geracao || '', seq: await seqAtual(env), agora: Date.now() });
    }
    const guardadas = await lerLinhas(env, [...new Set(lista.filter((r) => r && typeof r.id === 'string').map((r) => r.id))]);
    const nivelAqui = regras.nivelDoAparelho(aparelho);
    const recusados = [], revs = {}, aceitar = [];
    for (const r0 of lista) {
      let r = r0;
      if (!r || typeof r.id !== 'string' || typeof r.atualizadoEm !== 'number') continue;
      if (r.id.length > 300 || r.id !== `${r.data}|${r.prancheta}|${r.chave}` || !(r.data === 'config' || leitura.ehDia(r.data)) || !Number.isSafeInteger(r.atualizadoEm) || r.atualizadoEm < 0 || !Juncao.valido(r)) { recusados.push({ id: r.id, motivo: 'invalido' }); continue; }
      const guardada = guardadas.get(r.id) || null;
      if (r.data === 'config') {
        const d = regras.decidirConfig(guardada, r, aparelho);
        if (!d.aceita) { recusados.push({ id: r.id, motivo: d.motivo, atual: guardada }); continue; }
        r = d.entrada; revs[r.id] = r.rev;
        if (r.id === 'config|sistema|geral') ctx.sistema = r; // a mudança seguinte do mesmo envio já vê esta
      } else if (r.prancheta === 'rastreamento') {
        const f = nivelAqui ? regras.funcoesNoAparelho(aparelho) : regras.funcoesNoSetor(aparelho);
        if (!f.has('escritorio')) { recusados.push({ id: r.id, motivo: 'sem_permissao' }); continue; }
      } else if (nivelAqui && !['registro', 'avisos-recibo'].includes(r.prancheta)) {
        const motivo = regras.motivoNoChefe(aparelho, r, guardada);
        if (motivo) { recusados.push({ id: r.id, motivo }); continue; }
      } else if (r.prancheta === 'avisos') {
        recusados.push({ id: r.id, motivo: 'sem_permissao' }); continue;
      }
      if (!nivelAqui && r.data !== 'config' && !regras.podeFolhaNoSetor(aparelho, r)) { recusados.push({ id: r.id, motivo: 'sem_permissao' }); continue; }
      if (!nivelAqui && r.valores && !regras.funcoesNoSetor(aparelho).has('escritorio')) {
        const soEscritorio = regras.camposSoDoEscritorio(r.prancheta);
        if (soEscritorio.length) {
          const valores = Object.assign({}, r.valores);
          soEscritorio.forEach((c) => { if (guardada && guardada.valores && c in guardada.valores) valores[c] = guardada.valores[c]; else delete valores[c]; });
          const camposEm = r.camposEm && Object.assign({}, r.camposEm);
          if (camposEm) soEscritorio.forEach((c) => {
            if (guardada && guardada.camposEm && Object.hasOwn(guardada.camposEm, c)) camposEm[c] = guardada.camposEm[c];
            else delete camposEm[c];
          });
          r = Object.assign({}, r, { valores }, camposEm ? { camposEm } : {});
          if (camposEm) r.atualizadoEm = Math.max(r.atualizadoEm, ...Object.values(camposEm));
        }
      }
      aceitar.push(r);
    }
    const aceitos = await gravar(env, [...aceitar, ...ctx.novosRegistros]);
    await salvarEstado(env, ctx);
    const seq = await seqAtual(env);
    if (aceitos) await avisar(env, { seq, de: aparelho });
    const rev = Number(ctx.info.bloqueiosRev) || 0;
    return responder(200, {
      ok: true, aceitos, recusados, revs, seq, agora: Date.now(), geracao: ctx.info.geracao || '', nuvem: url.origin,
      ...(quem.pc ? {} : { nuvemToken: senhaDoPedido(req) }), bloqueiosRev: rev, atualizacao: await telasPublicadas(env),
    });
  }

  /* ---------- /banco/api/registros: o que mudou depois de um número ---------- */
  async function apiRegistros(env, url) {
    const dia = url.searchParams.get('dia');
    if (dia) {
      if (!leitura.ehDia(dia)) return responder(400, { erro: 'dia inválido' });
      const { results } = await env.DB.prepare("SELECT json FROM registros WHERE data = ? AND prancheta <> 'registro'").bind(dia).all();
      return responder(200, { seq: await seqAtual(env), registros: results.map((l) => JSON.parse(l.json)) });
    }
    const seq = await seqAtual(env);
    const desde = Number(url.searchParams.get('desde') || 0) || 0;
    const base = desde > seq ? 0 : desde; // banco voltou atrás: manda tudo de novo (receber de novo não muda nada)
    const aPartirDe = leitura.ehDia(url.searchParams.get('aPartirDe')) ? url.searchParams.get('aPartirDe') : '0000-00-00';
    const { results } = await env.DB.prepare(`SELECT json, seq FROM registros WHERE seq > ? AND prancheta <> 'registro'
      AND (data >= ? OR prancheta IN ('avisos', 'avisos-recibo', 'fermentacao')) ORDER BY seq LIMIT ?`).bind(base, aPartirDe, MAX_POR_PEDIDO + 1).all();
    const registros = []; let bytes = 200, ultimo = base, mais = false;
    for (const l of results) {
      if (registros.length === MAX_POR_PEDIDO || bytes + l.json.length > MAX_RESPOSTA) { mais = true; break; }
      registros.push(JSON.parse(l.json)); bytes += l.json.length + 1; ultimo = l.seq;
    }
    return responder(200, { seq: mais ? ultimo : seq, mais, registros });
  }

  async function apiDias(env) {
    const { results } = await env.DB.prepare('SELECT data FROM dias WHERE anotacoes > 0 ORDER BY data DESC').all();
    return responder(200, { dias: results.map((d) => d.data) });
  }

  /* ---------- /banco/api/status ---------- */
  async function apiStatus(env, quem) {
    const ctx = await contexto(env, quem);
    const pode = ctx.regras.podeNoAparelho(quem.aparelho, 'conexao');
    const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM dias').first();
    const segredos = pode ? await abrirSegredos(env, ctx.estado.segredos) : null;
    return responder(200, {
      seq: await seqAtual(env), total: (total && total.n) || 0, codigo: (segredos && segredos.codigo) || '', enderecos: [], apk: false, base44: { ligado: false }, nuvem: { ligada: true, viaBanco: true },
      pastas: {}, aparelhos: await listaDeAparelhos(env, ctx), aparelhosEm: Number(ctx.info.aparelhosEm) || 0,
      usina: pode ? await situacaoDoServidorDaUsina(env) : undefined,
    });
  }

  /* ---------- /banco/api/pessoas ---------- */
  async function apiPessoas(req, env, quem) {
    const corpo = await corpoFila(req, 100000).catch(() => null);
    if (!corpo) return responder(400, { erro: 'JSON inválido' });
    const ctx = await contexto(env, quem);
    const regras = ctx.regras, aparelho = quem.aparelho;
    const linhaAparelho = await env.DB.prepare('SELECT json FROM aparelhos WHERE id = ?').bind(aparelho).first();
    const aqui = nomeDe(ctx, linhaAparelho && JSON.parse(linhaAparelho.json), aparelho);
    const concluir = async (resposta, status = 200) => {
      await salvarEstado(env, ctx);
      if (ctx.novosRegistros.length) await gravar(env, ctx.novosRegistros);
      return responder(status, resposta);
    };
    const eu = regras.pessoaDoAparelho(aparelho);
    if (corpo.acao === 'entrar' || corpo.acao === 'verificar') {
      const pin = String(corpo.pin || '');
      if (!/^\d{4,8}$/.test(pin)) return responder(403, { erro: 'Senha errada' });
      const chaves = await reservar(req, env, aparelho);
      if (!chaves) return responder(429, { erro: 'Muitas senhas erradas. Espere um pouco.' });
      const pessoa = await pessoaDaSenha(env, ctx.pessoas, pin);
      if (!pessoa) { registrar(ctx, 'entrada', `Senha errada no ${aqui}`, { aparelho: aqui }); return concluir({ erro: 'Senha errada' }, 403); }
      await devolver(env, chaves);
      if (corpo.acao === 'entrar') {
        if (!quem.pc && regras.liberarAoEntrar(pessoa, aparelho)) {
          ctx.estado.aparelhosChefe[aparelho] = ctx.config.aparelhosChefe[aparelho];
          registrar(ctx, 'configuracao', `${pessoa.nome} liberou o ${aqui} como tablet chefe nível 2`, { quem: pessoa.nome, aparelho: aqui });
        }
        const nivel = regras.nivelDoAparelho(aparelho);
        if (!nivel) return concluir({ erro: 'Este aparelho ainda não foi liberado como tablet chefe', naoLiberado: true }, 403);
        if (nivel === 3 && !regras.ehDono(pessoa)) return concluir({ erro: 'Este tablet é só do dono do sistema' }, 403);
        await env.DB.prepare('INSERT INTO acessos_nuvem (aparelho, pessoa) VALUES (?, ?) ON CONFLICT(aparelho) DO UPDATE SET pessoa = excluded.pessoa').bind(aparelho, pessoa.id).run();
        ctx.config.sessoes[aparelho] = { pessoaId: pessoa.id };
        if (!eu || eu.id !== pessoa.id) registrar(ctx, 'entrada', `${pessoa.nome} entrou no ${aqui}`, { quem: pessoa.nome, aparelho: aqui });
      } else if (!regras.nivelDoAparelho(aparelho)) {
        await env.DB.prepare('INSERT INTO liberados_setor (aparelho, pessoa, ate) VALUES (?, ?, ?) ON CONFLICT(aparelho) DO UPDATE SET pessoa = excluded.pessoa, ate = excluded.ate').bind(aparelho, pessoa.id, Date.now() + LIBERADO_MS).run();
      }
      return concluir(Object.assign({ pessoa: pessoaPublica(pessoa), teto: regras.tetoDoAparelho(aparelho) }, regras.permissoesDoAparelho(aparelho, corpo.acao === 'entrar' ? null : pessoa)));
    }
    if (corpo.acao === 'sair') {
      if (eu) {
        await env.DB.prepare('DELETE FROM acessos_nuvem WHERE aparelho = ?').bind(aparelho).run();
        registrar(ctx, 'entrada', `${eu.nome} saiu do ${aqui}${corpo.motivo ? ` (${textoCurto(corpo.motivo, 60)})` : ''}`, { quem: eu.nome, aparelho: aqui });
      }
      return concluir({ ok: true });
    }
    if (corpo.acao === 'quem') return responder(200, Object.assign({ pessoa: eu ? pessoaPublica(eu) : null, teto: regras.tetoDoAparelho(aparelho) }, regras.permissoesDoAparelho(aparelho)));
    if (!eu || !regras.podeNoAparelho(aparelho, 'pessoas')) return responder(403, { erro: 'Só o administrador mexe nas pessoas e permissões' });
    const listaPessoas = () => ({ pessoas: ctx.pessoas.map(pessoaPublica), aparelhos: ctx.config.aparelhosChefe, donoId: ctx.config.donoId || '' });
    if (corpo.acao === 'lista') return responder(200, listaPessoas());
    if (corpo.acao === 'salvar') return salvarPessoa(env, ctx, eu, aqui, corpo.pessoa || {}, listaPessoas, concluir);
    if (corpo.acao === 'aparelho') return mudarAparelho(ctx, eu, aqui, corpo, aparelho, listaPessoas, concluir, env);
    return responder(400, { erro: 'ação desconhecida' });
  }
  const NOME_DO_NIVEL = (ctx, n) => ((ctx.forms.niveis || {})[n] || {}).nome || n;
  async function salvarPessoa(env, ctx, eu, aqui, d, listaPessoas, concluir) {
    const regras = ctx.regras;
    if (d.id === ctx.config.donoId && String(d.pin) === '159357') return responder(400, { erro: 'Escolha uma senha diferente da inicial' });
    const nome = String(d.nome || '').trim().slice(0, 40);
    if (!nome) return responder(400, { erro: 'Falta o nome' });
    if (!Object.hasOwn(ctx.forms.niveis || {}, d.nivel)) return responder(400, { erro: 'Nível inválido' });
    const existente = d.id ? ctx.pessoas.find((x) => x.id === d.id) : null;
    if (d.id && !existente) return responder(404, { erro: 'Pessoa não encontrada' });
    if (regras.ehDono(existente) && !regras.ehDono(eu)) return responder(403, { erro: 'Só o dono do sistema muda os dados dele' });
    if (regras.ehDono(existente) && (d.nivel !== 'administrador' || d.ativo === false)) return responder(400, { erro: 'O dono do sistema continua administrador e ativo' });
    const fixos = 'aparelhos' in d ? d.aparelhos : (existente && existente.aparelhos) || [];
    if (!Array.isArray(fixos) || fixos.length > 50 || fixos.some((id) => typeof id !== 'string' || !id)) return responder(400, { erro: 'Aparelhos inválidos' });
    if (ctx.pessoas.some((x) => x !== existente && x.nome.toLowerCase() === nome.toLowerCase())) return responder(400, { erro: 'Já tem uma pessoa com esse nome' });
    const pin = d.pin == null || d.pin === '' ? null : String(d.pin);
    if (pin !== null && !/^\d{4,8}$/.test(pin)) return responder(400, { erro: 'A senha tem de 4 a 8 números' });
    if (!existente && !pin) return responder(400, { erro: 'Falta a senha' });
    if (pin && await pessoaDaSenha(env, ctx.pessoas.filter((x) => x !== existente), pin)) return responder(400, { erro: 'Essa senha já é de outra pessoa. Escolha outra.' });
    const ativo = d.ativo !== false;
    const admins = ctx.pessoas.filter((x) => x !== existente && x.nivel === 'administrador' && x.ativo !== false).length;
    if (existente && existente.nivel === 'administrador' && (d.nivel !== 'administrador' || !ativo) && !admins) return responder(400, { erro: 'Precisa ficar pelo menos um administrador' });
    const extras = {};
    Object.entries(d.extras || {}).forEach(([k, v]) => { if (/^[a-z_]{2,30}$/.test(k) && typeof v === 'boolean') extras[k] = v; });
    const agora = Date.now();
    const novo = existente || { id: 'p' + crypto.randomUUID().replace(/-/g, '').slice(0, 8), criadoEm: agora };
    const antes = existente ? { nome: existente.nome, nivel: existente.nivel, ativo: existente.ativo !== false, extras: JSON.stringify(existente.extras || {}), aparelhos: JSON.stringify(existente.aparelhos || []) } : null;
    Object.assign(novo, { nome, nivel: d.nivel, extras, aparelhos: fixos, ativo, em: agora });
    if (pin) { novo.nuvem = await novaSenha(env, pin); delete novo.pedeTrocarSenha; }
    if (!existente) ctx.pessoas.push(novo);
    novo.funcoes = [...regras.funcoesDaPessoa(novo)].filter((f) => !['conexao', 'sistema'].includes(f)).sort();
    await gravarPessoas(env, [novo]);
    if (!ativo) await env.DB.prepare('DELETE FROM acessos_nuvem WHERE pessoa = ?').bind(novo.id).run();
    const partes = [];
    if (!antes) partes.push(`cadastrou ${nome} (${NOME_DO_NIVEL(ctx, d.nivel)})`);
    else {
      if (antes.nome !== nome) partes.push(`mudou o nome de ${antes.nome} para ${nome}`);
      if (antes.nivel !== d.nivel) partes.push(`mudou ${nome} de ${NOME_DO_NIVEL(ctx, antes.nivel)} para ${NOME_DO_NIVEL(ctx, d.nivel)}`);
      if (antes.ativo !== ativo) partes.push(`${ativo ? 'reativou' : 'desativou'} ${nome}`);
      if (antes.extras !== JSON.stringify(extras)) partes.push(`mudou as funções de ${nome}`);
      if (antes.aparelhos !== JSON.stringify(fixos)) partes.push(`mudou os aparelhos fixos de ${nome}`);
      if (pin) partes.push(`trocou a senha de ${nome}`);
    }
    if (partes.length) registrar(ctx, 'configuracao', `${eu.nome} ${partes.join(', ')}`, { quem: eu.nome, aparelho: aqui });
    await avisar(env, { tipo: 'estado' });
    return concluir(listaPessoas());
  }
  async function mudarAparelho(ctx, eu, aqui, corpo, aparelho, listaPessoas, concluir, env) {
    const regras = ctx.regras;
    const id = String(corpo.id || '').slice(0, 80);
    if (!id) return responder(400, { erro: 'Falta o aparelho' });
    const a = { ...(ctx.estado.aparelhosChefe[id] || {}) };
    const nomeAntes = nomeDe(ctx, null, id);
    if (typeof corpo.nome === 'string') a.nome = corpo.nome.trim().slice(0, 40);
    if ('teto' in corpo) a.teto = Array.isArray(corpo.teto) ? corpo.teto.filter((x) => /^[a-z_]{2,30}$/.test(x)) : null;
    let mudanca = '';
    if ('nivel' in corpo) {
      const novoNivel = Number(corpo.nivel) || 0;
      const nivelAntes = regras.nivelDoAparelho(id);
      if (![0, 1, 2, 3].includes(novoNivel)) return responder(400, { erro: 'Nível inválido' });
      if (!regras.podeNoAparelho(aparelho, 'chefes')) return responder(403, { erro: 'Quem está neste aparelho não libera tablets chefe', semPermissao: 'chefes' });
      if ((novoNivel === 3 || nivelAntes === 3 || id === aparelho) && !regras.ehDono(eu)) return responder(403, { erro: 'Só o dono do sistema muda este nível' });
      if (novoNivel !== nivelAntes) {
        if (novoNivel) a.nivel = novoNivel; else delete a.nivel;
        await env.DB.prepare('DELETE FROM acessos_nuvem WHERE aparelho = ?').bind(id).run();
        mudanca = `${eu.nome} mudou o ${nomeAntes} de ${regras.nomeDoNivel(nivelAntes)} para ${regras.nomeDoNivel(novoNivel)}`;
      }
    }
    a.em = Date.now();
    ctx.estado.aparelhosChefe[id] = a;
    ctx.config.aparelhosChefe = Object.assign({}, ctx.config.aparelhosChefe, { [id]: a });
    ctx.estadoMudou = true;
    if (mudanca) registrar(ctx, 'configuracao', mudanca, { quem: eu.nome, aparelho: aqui });
    registrar(ctx, 'configuracao', `${eu.nome} mudou o que o ${nomeAntes} pode fazer${a.nome && a.nome !== nomeAntes ? ` (agora se chama ${a.nome})` : ''}`, { quem: eu.nome, aparelho: aqui });
    await avisar(env, { tipo: 'estado' });
    return concluir(listaPessoas());
  }

  /* ---------- /banco/api/chefes: liberar este aparelho como tablet chefe ---------- */
  async function apiChefes(req, env, quem) {
    const corpo = await corpoFila(req, 10000).catch(() => null);
    if (!corpo) return responder(400, { erro: 'JSON inválido' });
    const ctx = await contexto(env, quem);
    const regras = ctx.regras, aparelho = quem.aparelho;
    if (corpo.acao === 'estado') return responder(200, { nivel: regras.nivelDoAparelho(aparelho) });
    if (corpo.acao !== 'liberar') return responder(501, { erro: 'Esta ação só existe na central da usina' });
    const pin = String(corpo.pin || '');
    if (!/^\d{4,8}$/.test(pin)) return responder(403, { erro: 'Senha errada' });
    const chaves = await reservar(req, env, aparelho);
    if (!chaves) return responder(429, { erro: 'Muitas senhas erradas. Espere um pouco.' });
    const pessoa = await pessoaDaSenha(env, ctx.pessoas, pin);
    const linha = await env.DB.prepare('SELECT json FROM aparelhos WHERE id = ?').bind(aparelho).first();
    const aqui = nomeDe(ctx, linha && JSON.parse(linha.json), aparelho);
    if (!pessoa) {
      registrar(ctx, 'entrada', `Senha errada ao liberar o ${aqui} como tablet chefe`, { aparelho: aqui });
      await gravar(env, ctx.novosRegistros);
      return responder(403, { erro: 'Senha errada' });
    }
    await devolver(env, chaves);
    const antes = regras.nivelDoAparelho(aparelho);
    const nivel = 'nivel' in corpo ? Number(corpo.nivel) : antes || 2;
    if (![1, 2, 3].includes(nivel)) return responder(400, { erro: 'Nível inválido' });
    if ((nivel === 3 || antes === 3) && !regras.ehDono(pessoa)) return responder(403, { erro: 'Só o dono do sistema muda o nível 3' });
    if (!regras.funcoesDaPessoaNoAparelho(pessoa, aparelho).has('chefes')) return responder(403, { erro: `${pessoa.nome} não pode liberar tablet chefe neste aparelho` });
    const a = Object.assign({}, ctx.estado.aparelhosChefe[aparelho], { nivel, liberadoPor: pessoa.nome, liberadoEm: Date.now(), em: Date.now() });
    ctx.estado.aparelhosChefe[aparelho] = a;
    ctx.estadoMudou = true;
    await env.DB.prepare('DELETE FROM acessos_nuvem WHERE aparelho = ?').bind(aparelho).run();
    registrar(ctx, 'configuracao', `${pessoa.nome} liberou o ${aqui} como tablet chefe ${regras.nomeDoNivel(nivel)}${antes ? ` (antes: ${regras.nomeDoNivel(antes)})` : ''}`, { quem: pessoa.nome, aparelho: aqui });
    await salvarEstado(env, ctx);
    await gravar(env, ctx.novosRegistros);
    return responder(200, { ok: true, nivel });
  }

  /* ---------- /banco/api/aparelhos: bloquear e desbloquear ---------- */
  async function trocarBloqueios(env, ctx) {
    ctx.estado.bloqueiosEm = Date.now();
    ctx.estadoMudou = true;
    const rev = (Number(ctx.info.bloqueiosRev) || 0) + 1;
    await env.DB.prepare("INSERT INTO info (chave, valor) VALUES ('bloqueiosRev', ?), ('bloqueiosGeracao', ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor").bind(String(rev), ctx.info.geracao || '').run();
    return rev;
  }
  async function apiAparelhos(req, env, quem) {
    const corpo = await corpoFila(req, 10000).catch(() => null);
    if (!corpo) return responder(400, { erro: 'JSON inválido' });
    const ctx = await contexto(env, quem);
    const regras = ctx.regras, eu = regras.pessoaDoAparelho(quem.aparelho);
    if (!eu || !regras.podeNoAparelho(quem.aparelho, 'pessoas')) return responder(403, { erro: 'Só o administrador bloqueia e desbloqueia aparelhos' });
    const id = textoCurto(corpo.id);
    const linha = id && await env.DB.prepare('SELECT json FROM aparelhos WHERE id = ?').bind(id).first();
    if (!linha) return responder(404, { erro: 'Aparelho não encontrado' });
    if (regras.nivelDoAparelho(id) === 3 && !regras.ehDono(eu)) return responder(403, { erro: 'Quem está neste aparelho não pode fazer isso', semPermissao: 'sistema' });
    const nome = nomeDe(ctx, JSON.parse(linha.json), id);
    const linhaAqui = await env.DB.prepare('SELECT json FROM aparelhos WHERE id = ?').bind(quem.aparelho).first();
    const aqui = nomeDe(ctx, linhaAqui && JSON.parse(linhaAqui.json), quem.aparelho);
    if (corpo.acao === 'bloquear') {
      if (id === quem.aparelho) return responder(400, { erro: 'Não dá para bloquear o aparelho que você está usando' });
      const modo = corpo.modo === 'senha' ? 'senha' : 'trava';
      const b = { id, em: Date.now(), modo, apagar: !!corpo.apagar, por: eu.nome };
      if (modo === 'senha') {
        const codigo = String(corpo.codigo || '');
        if (!/^\d{4,8}$/.test(codigo)) return responder(400, { erro: 'A senha de desbloqueio tem de 4 a 8 números' });
        b.nuvem = await novaSenha(env, codigo);
      }
      b.rev = await trocarBloqueios(env, ctx);
      await env.DB.batch([
        env.DB.prepare('INSERT INTO bloqueios (id, json) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json').bind(id, JSON.stringify(b)),
        env.DB.prepare('DELETE FROM acessos_nuvem WHERE aparelho = ?').bind(id),
      ]);
      registrar(ctx, 'configuracao', `${eu.nome} bloqueou o ${nome} (${modo === 'senha' ? 'pede a senha de desbloqueio' : 'travado de vez'}${b.apagar ? ', apagando as anotações guardadas nele' : ''})`, { quem: eu.nome, aparelho: aqui });
    } else if (corpo.acao === 'desbloquear') {
      if (await bloqueioDe(env, id)) {
        await trocarBloqueios(env, ctx);
        await env.DB.prepare('DELETE FROM bloqueios WHERE id = ?').bind(id).run();
        registrar(ctx, 'configuracao', `${eu.nome} desbloqueou o ${nome}`, { quem: eu.nome, aparelho: aqui });
      }
    } else return responder(400, { erro: 'ação desconhecida' });
    await salvarEstado(env, ctx);
    await gravar(env, ctx.novosRegistros);
    await avisar(env, { tipo: 'estado' });
    return responder(200, { ok: true, aparelhos: await listaDeAparelhos(env, ctx) });
  }
  /** Aparelho bloqueado que pede senha: a senha de desbloqueio libera. */
  async function apiLiberar(req, env, quem) {
    const corpo = await corpoFila(req, 10000).catch(() => null);
    if (!corpo) return responder(400, { erro: 'JSON inválido' });
    const b = await bloqueioDe(env, quem.aparelho);
    if (!b) return responder(200, { ok: true });
    const ctx = await contexto(env, quem);
    const geracao = ctx.info.geracao || '';
    if (b.modo !== 'senha' || !b.nuvem || Number(corpo.rev) !== (b.rev || 0)) return responder(423, { erro: 'bloqueado', bloqueio: bloqueioPublico(b), geracao });
    const chaves = await reservar(req, env, quem.aparelho);
    if (!chaves) return responder(429, { erro: 'Muitas senhas erradas. Espere um pouco.' });
    const codigo = String(corpo.codigo || '');
    if (!/^\d{4,8}$/.test(codigo) || !(await senhaConfere(env, { nuvem: b.nuvem }, codigo))) return responder(403, { erro: 'Senha errada', bloqueio: bloqueioPublico(b), geracao });
    await devolver(env, chaves);
    await trocarBloqueios(env, ctx);
    await env.DB.prepare('DELETE FROM bloqueios WHERE id = ?').bind(quem.aparelho).run();
    await salvarEstado(env, ctx);
    return responder(200, { ok: true });
  }
  async function apiRegistro(env, quem, url) {
    const ctx = await contexto(env, quem);
    if (!ctx.regras.podeNoAparelho(quem.aparelho, 'registro')) return responder(403, { erro: 'Quem está neste aparelho não pode fazer isso', semPermissao: 'registro' });
    const dia = url.searchParams.get('dia');
    if (!leitura.ehDia(dia)) return responder(400, { erro: 'dia inválido' });
    const { results } = await env.DB.prepare("SELECT json FROM registros WHERE data = ? AND prancheta = 'registro' AND apagado = 0").bind(dia).all();
    return responder(200, { registros: results.map((l) => JSON.parse(l.json)).sort((a, b) => (a.valores.em || 0) - (b.valores.em || 0)) });
  }

  /* ---------- ativar um aparelho novo com o código, pela internet ---------- */
  async function chaveDeSelo(env) {
    const bits = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('estado|' + env.SEGREDO_CENTRAL));
    return crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['encrypt', 'decrypt']);
  }
  async function selarSegredos(env, obj) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const dados = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await chaveDeSelo(env), new TextEncoder().encode(JSON.stringify(obj)));
    return hex(iv) + ':' + hex(dados);
  }
  const deHex = (t) => Uint8Array.from(t.match(/../g).map((x) => parseInt(x, 16)));
  async function abrirSegredos(env, selado) {
    if (typeof selado !== 'string' || !selado.includes(':')) return null;
    try {
      const [iv, dados] = selado.split(':');
      const claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deHex(iv) }, await chaveDeSelo(env), deHex(dados));
      return JSON.parse(new TextDecoder().decode(claro));
    } catch (e) { return null; }
  }
  async function hmacHex(chave, texto) {
    const enc = new TextEncoder();
    const k = await crypto.subtle.importKey('raw', enc.encode(chave), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return hex(await crypto.subtle.sign('HMAC', k, enc.encode(texto)));
  }
  async function ativar(req, env, url) {
    if (req.method !== 'POST') return responder(405, { erro: 'Use POST' });
    const corpo = await corpoFila(req, 1024).catch(() => null);
    if (!corpo || !idAparelho(corpo.aparelho) || !/^\d{6}$/.test(String(corpo.codigo || ''))) return responder(400, { erro: 'Aparelho ou código inválidos' });
    const chaves = await reservar(req, env, corpo.aparelho);
    if (!chaves) return responder(429, { erro: 'Muitas tentativas. Espere um pouco.' });
    if (await bloqueioDe(env, corpo.aparelho)) return responder(423, { erro: 'bloqueado' });
    const l = await env.DB.prepare("SELECT valor FROM info WHERE chave = 'estado'").first();
    const segredos = await abrirSegredos(env, lerJson(l && l.valor, {}).segredos);
    if (!segredos || !segredos.codigo) return responder(409, { erro: 'A central ainda não mandou o código para o banco' });
    if (!(await mesmoSegredo(String(corpo.codigo), segredos.codigo))) return responder(403, { erro: 'Código errado' });
    await devolver(env, chaves);
    return responder(200, {
      nuvem: url.origin, nuvemToken: await tokenDoAparelho(env.SEGREDO_CENTRAL, corpo.aparelho),
      // a mesma chave que a central daria: o aparelho também fala com a ponte do Wi-Fi quando a achar
      chave: segredos.chave ? await hmacHexDeChave(segredos.chave, corpo.aparelho) : '',
    });
  }
  const hmacHexDeChave = (chave, aparelho) => hmacHex(chave, 'aparelho|' + aparelho);

  /* ---------- a central da usina (ponte do Wi-Fi) ---------- */
  /** O que chegou por aqui, inclusive o registro do sistema e a configuração. */
  async function novidades(env, url) {
    const seq = await seqAtual(env);
    const desde = Number(url.searchParams.get('desde') || 0) || 0;
    const base = desde > seq ? 0 : desde;
    const { results } = await env.DB.prepare('SELECT json, seq FROM registros WHERE seq > ? ORDER BY seq LIMIT ?').bind(base, MAX_POR_PEDIDO + 1).all();
    const registros = []; let bytes = 200, ultimo = base, mais = false;
    for (const l of results) {
      if (registros.length === MAX_POR_PEDIDO || bytes + l.json.length > MAX_RESPOSTA) { mais = true; break; }
      registros.push(JSON.parse(l.json)); bytes += l.json.length + 1; ultimo = l.seq;
    }
    return responder(200, { seq: mais ? ultimo : seq, mais, registros });
  }
  /** Mapa de id -> { em }: fica a linha com a hora mais nova. Nada some por não ter vindo. */
  function juntarMapa(meu, dele) {
    const r = Object.assign({}, meu);
    Object.entries(dele || {}).forEach(([id, x]) => {
      if (!x || typeof x !== 'object' || !idAparelho(id)) return;
      if (!r[id] || (Number(x.em) || 0) > (Number(r[id].em) || 0)) r[id] = x;
    });
    return r;
  }
  const PESSOA_OK = (p, niveis) => p && idAparelho(p.id) && typeof p.nome === 'string' && p.nome.trim() && p.nome.length <= 40 && Object.hasOwn(niveis, p.nivel);
  /** A central manda pessoas, níveis e o código; volta o que o banco tem de mais novo. */
  async function sincronia(req, env) {
    const corpo = await req.json().catch(() => null);
    if (!corpo || typeof corpo !== 'object') return responder(400, { erro: 'JSON inválido' });
    const l = await env.DB.prepare("SELECT valor FROM info WHERE chave = 'estado'").first();
    const f = await env.DB.prepare("SELECT valor FROM info WHERE chave = 'forms'").first();
    const niveis = { administrador: 1, encarregado: 1, consulta: 1, funcionario: 1, ...lerJson(f && f.valor, {}).niveis };
    const estado = Object.assign({ donoId: '', aparelhosChefe: {}, setoresAparelhos: {}, geracoesZeradas: [] }, lerJson(l && l.valor, {}));
    const e = corpo.estado && typeof corpo.estado === 'object' ? corpo.estado : {};
    if (e.donoId && !estado.donoId) { estado.donoId = String(e.donoId).slice(0, 80); }
    estado.aparelhosChefe = juntarMapa(estado.aparelhosChefe, e.aparelhosChefe);
    estado.setoresAparelhos = juntarMapa(estado.setoresAparelhos, e.setoresAparelhos);
    if (Array.isArray(e.geracoesZeradas)) estado.geracoesZeradas = [...new Set([...(estado.geracoesZeradas || []), ...e.geracoesZeradas.filter((g) => typeof g === 'string' && g.length <= 100)])].slice(-50);
    // o código e a chave da rede ficam selados com o segredo da central (o banco sozinho não abre)
    const antesSegredos = await abrirSegredos(env, estado.segredos);
    if (e.codigo && e.chave && (Number(e.codigoEm) || 0) >= (Number(estado.codigoEm) || 0)) {
      estado.segredos = await selarSegredos(env, { codigo: String(e.codigo), chave: String(e.chave) });
      estado.codigoEm = Number(e.codigoEm) || 0;
    }
    const segredos = (await abrirSegredos(env, estado.segredos)) || antesSegredos;
    // pessoas: a do banco ganha quando for mais nova; mesmo nome com outro id é a mesma pessoa (fica a do banco)
    const atuais = await lerPessoas(env);
    const porId = new Map(atuais.map((p) => [p.id, p]));
    const trocar = [];
    const lista = Array.isArray(corpo.pessoas) ? corpo.pessoas.slice(0, 500) : [];
    const soInativos = !lista.some((p) => p && p.ativo !== false); // central antiga recém-zerada: não esvazia o banco
    for (const p of lista) {
      if (!PESSOA_OK(p, niveis) || (soInativos && !p.em)) continue;
      const a = porId.get(p.id);
      if (!a && atuais.some((x) => x.nome.toLowerCase() === p.nome.trim().toLowerCase())) continue;
      const emNova = Number(p.em) || 0, emAtual = Number(a && a.em) || 0;
      // sem hora nos dois lados (central antiga), vale o que ela mandou: tirar uma permissão tem de cortar o acesso na hora
      if (a && (emNova < emAtual || (emNova && emNova === emAtual))) continue;
      const copia = { id: p.id, nome: p.nome.trim(), nivel: p.nivel, ativo: p.ativo !== false, extras: p.extras && typeof p.extras === 'object' ? p.extras : {}, aparelhos: Array.isArray(p.aparelhos) ? p.aparelhos : [],
        funcoes: Array.isArray(p.funcoes) ? [...new Set(p.funcoes)].filter((x) => typeof x === 'string' && !['conexao', 'sistema'].includes(x)) : [], criadoEm: Number(p.criadoEm) || 0, em: Number(p.em) || 0 };
      if (p.nuvem && p.nuvem.verificador && /^[a-f0-9]{32}$/.test(p.nuvem.sal || '') && /^[a-f0-9]{64}$/.test(p.nuvem.verificador) && p.nuvem.iteracoes === 1000) copia.nuvem = { sal: p.nuvem.sal, iteracoes: 1000, selado: await selar(env.SEGREDO_CENTRAL, p.nuvem.verificador) };
      else if (a && a.nuvem) copia.nuvem = a.nuvem;
      porId.set(p.id, copia); trocar.push(copia);
    }
    if (trocar.length) await gravarPessoas(env, trocar);
    // o dono pode ter mudado o estado (o teto de um aparelho, por exemplo) enquanto esta lia: não desfaz; a central manda de novo na próxima volta
    const escrita = l
      ? env.DB.prepare("UPDATE info SET valor = ? WHERE chave = 'estado' AND valor = ?").bind(JSON.stringify(estado), l.valor)
      : env.DB.prepare("INSERT INTO info (chave, valor) VALUES ('estado', ?) ON CONFLICT(chave) DO NOTHING").bind(JSON.stringify(estado));
    if (!mudancas(await escrita.run())) return responder(503, { erro: 'O estado mudou agora. A central tenta de novo.' });
    const { results: bloq } = await env.DB.prepare('SELECT json FROM bloqueios').all();
    const { segredos: _s, ...publico } = estado;
    return responder(200, { pessoas: [...porId.values()], estado: Object.assign(publico, segredos ? { codigo: segredos.codigo, chave: segredos.chave } : {}), bloqueios: bloq.map((b) => JSON.parse(b.json)) });
  }

  /* ---------- rotas ---------- */
  async function rota(req, env, url) {
    const p = url.pathname;
    if (p === '/banco/ativar') return ativar(req, env, url);
    if (p === '/banco/aovivo') {
      if (req.headers.get('Upgrade') !== 'websocket') return responder(426, { erro: 'Use WebSocket' });
      const protocolos = String(req.headers.get('Sec-WebSocket-Protocol') || '').split(',').map((x) => x.trim());
      const aparelho = url.searchParams.get('a'), token = protocolos[1] || '';
      const pedido = new Request(req.url, { headers: { 'X-Aparelho': aparelho || '', Authorization: 'Bearer ' + token } });
      const quem = await autenticar(pedido, env);
      if (!quem || !env.SALA) return responder(401, { erro: 'Credencial inválida' });
      return env.SALA.get(env.SALA.idFromName('usina')).fetch(`https://sala/entrar?a=${encodeURIComponent(aparelho)}&expira=${quem.expira || 0}`, req);
    }
    const quem = await autenticar(req, env);
    if (!quem) return responder(401, { erro: 'Credencial do aparelho inválida' });
    if (p === '/banco/assistente') return assistente(req, env, quem, { responder, corpoFila, contexto, autenticar });
    if (p === '/banco/api/sync' && req.method === 'POST') return apiSync(req, env, quem, url);
    if (p === '/banco/api/registros') return apiRegistros(env, url);
    if (p === '/banco/api/dias' && req.method === 'GET') return apiDias(env);
    if (p === '/banco/api/status') return apiStatus(env, quem);
    if (p === '/banco/api/registro') return apiRegistro(env, quem, url);
    if (p === '/banco/api/pessoas' && req.method === 'POST') return apiPessoas(req, env, quem);
    if (p === '/banco/api/chefes' && req.method === 'POST') return apiChefes(req, env, quem);
    if (p === '/banco/api/aparelhos' && req.method === 'POST') return apiAparelhos(req, env, quem);
    if (p === '/banco/api/liberar' && req.method === 'POST') return apiLiberar(req, env, quem);
    return responder(404, { erro: 'rota desconhecida' });
  }
  return { contexto, rota, gravar, novidades, sincronia, avisar, seqAtual, selarSegredos, abrirSegredos };
}

/* A sala dos aparelhos ligados: uma só para a usina. Com a hibernação da Cloudflare, conexão parada não custa nada. */
export class Sala {
  constructor(state) {
    this.state = state;
    state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/entrar') {
      const par = new WebSocketPair();
      const aparelho = url.searchParams.get('a') || '';
      this.state.acceptWebSocket(par[1], [aparelho]);
      par[1].serializeAttachment({ aparelho, desde: Date.now(), expira: Number(url.searchParams.get('expira')) || 0 });
      await this.agendarPrazo();
      return new Response(null, { status: 101, webSocket: par[0], headers: { 'Sec-WebSocket-Protocol': 'pranchetas' } });
    }
    if (url.pathname === '/avisar') {
      const texto = await req.text();
      for (const ws of this.state.getWebSockets()) if (!this.vencido(ws)) { try { ws.send(texto); } catch (e) { /* já caiu */ } }
      return new Response(null, { status: 204 });
    }
    if (url.pathname === '/vivos') {
      const lista = this.state.getWebSockets().filter((ws) => !this.vencido(ws)).map((ws) => ws.deserializeAttachment() || {});
      return new Response(JSON.stringify(lista), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(null, { status: 404 });
  }
  /** O "ping" é respondido sozinho. O rascunho (o que alguém está digitando, ainda não salvo) só passa pelos outros: não grava nada. */
  webSocketMessage(ws, msg) {
    if (this.vencido(ws)) return;
    if (typeof msg !== 'string' || msg.length > 8000) return;
    let d;
    try { d = JSON.parse(msg); } catch (e) { return; }
    if (!d || d.tipo !== 'rascunho') return;
    const { aparelho } = ws.deserializeAttachment() || {};
    const texto = JSON.stringify({ tipo: 'rascunho', de: aparelho, pid: String(d.pid), data: String(d.data), chave: String(d.chave), quem: String(d.quem || '').slice(0, 60), valores: d.valores && typeof d.valores === 'object' ? d.valores : null });
    for (const outro of this.state.getWebSockets()) if (outro !== ws && !this.vencido(outro)) { try { outro.send(texto); } catch (e) { /* já caiu */ } }
  }
  vencido(ws) {
    const { expira } = ws.deserializeAttachment() || {};
    if (!expira || Date.now() < expira) return false;
    try { ws.close(4401, 'O prazo da sessão acabou'); } catch (e) { /* já fechou */ }
    return true;
  }
  async agendarPrazo() {
    let proximo = Infinity;
    for (const ws of this.state.getWebSockets()) {
      if (this.vencido(ws)) continue;
      const { expira } = ws.deserializeAttachment() || {};
      if (expira) proximo = Math.min(proximo, expira);
    }
    if (Number.isFinite(proximo)) await this.state.storage.setAlarm(proximo);
    else await this.state.storage.deleteAlarm();
  }
  async alarm() { await this.agendarPrazo(); }
  webSocketClose(ws) { try { ws.close(); } catch (e) { /* já fechou */ } }
  webSocketError(ws) { try { ws.close(); } catch (e) { /* já fechou */ } }
}
