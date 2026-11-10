/* Pranchetas Digitais - © 2026 Guilherme. */
/* 3.0 (Fase 9): o Servidor da Usina recebe só a produção: todos os campos de todas as áreas e os totais de cada dia fechado, às 07:00.
   Quem envia é o banco, não os aparelhos: não depende de tablet ligado, e a chave fica nos segredos da nuvem.
   Pessoas, senhas, permissões, código, histórico do sistema e avisos internos ficam só no banco do Guilherme.
   Dia corrigido depois vai de novo, inteiro, para substituir. Erro tenta de novo na próxima volta (10 minutos).
   Sem USINA_URL e USINA_CHAVE não faz nada. USINA_DESDE (AAAA-MM-DD): manda os dias passados a partir dessa data (a primeira carga).
   O formato é o do envio por turno que o Evandro já recebeu (item 4 de API-mudancas-2.16.txt): POST em JSON, X-Pranchetas-Segredo, 2xx confirma, corpo
   igual ao de /api/v1/totais?dia=, mais turnoEncerrado. A produção completa (o corpo de /api/v1/dias/AAAA-MM-DD) vai junto, em "producao". */
import leitura from '../../api-leitura.js';

const SO_PRODUCAO = "prancheta NOT IN ('avisos', 'avisos-recibo', 'registro')";
const POR_VOLTA = 5; // plano grátis: poucos envios por vez; o resto vai nas próximas voltas
const DIAS_OLHADOS = 15; // janela recente acha o dia que acabou de fechar; correções antigas vêm pelo seq

/** Pela internet só com https (com http a chave iria aberta); o endereço local é o dos testes. */
function ligado(env) {
  if (!env.USINA_URL || !env.USINA_CHAVE) return false;
  try { const u = new URL(env.USINA_URL); return u.protocol === 'https:' || u.hostname === '127.0.0.1'; } catch (e) { return false; }
}
const somarDias = (dia, n) => new Date(Date.parse(dia + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);

export async function enviarAoServidorDaUsina(env, agora, fusoMin) {
  if (!ligado(env)) return { desligado: true, enviados: 0, erros: 0 };
  const [{ results: infos }, ultimo] = await Promise.all([
    env.DB.prepare("SELECT chave, valor FROM info WHERE chave IN ('forms', 'medidas', 'usinaSeq', 'usinaDesde', 'usinaInicio')").all(),
    env.DB.prepare('SELECT COALESCE(MAX(seq), 0) AS seq FROM registros').first(),
  ]);
  const info = Object.fromEntries(infos.map((l) => [l.chave, l.valor]));
  if (!info.forms) return { enviados: 0, erros: 0 };
  const C = JSON.parse(info.forms), medidas = info.medidas ? JSON.parse(info.medidas) : null;
  const inicio = Number.isFinite(C.inicioDoDia) ? C.inicioDoDia : 7;
  // o dia que já fechou: antes das 07:00, ainda é o de anteontem
  const fechado = somarDias(new Date(agora + fusoMin * 60000 - inicio * 3600000).toISOString().slice(0, 10), -1);
  const janela = somarDias(fechado, -DIAS_OLHADOS);
  const carga = leitura.ehDia(env.USINA_DESDE) ? env.USINA_DESDE : '';
  // usinaInicio: o primeiro dia que coube a este envio; dia fechado depois dele vai, mesmo se nenhuma volta rodou naquela manhã
  const primeiroDia = info.usinaInicio && info.usinaInicio < fechado ? info.usinaInicio : fechado;
  const desde = carga && carga < primeiroDia ? carga : primeiroDia;
  // Mudar USINA_DESDE abre outra primeira carga, sem reler todo o histórico nas voltas seguintes.
  const primeiraCarga = info.usinaSeq == null || (info.usinaDesde || '') !== carga;
  const cursor = primeiraCarga ? 0 : Number(info.usinaSeq) || 0;
  const [recentes, antigos, errosAntigos] = await Promise.all([
    env.DB.prepare(`SELECT r.data, MAX(r.seq) AS seq, e.seq AS enviado, e.ok FROM registros r
      LEFT JOIN usina_envios e ON e.dia = r.data
      WHERE r.data >= ? AND r.data <= ? AND ${SO_PRODUCAO} GROUP BY r.data ORDER BY r.data`).bind(janela, fechado).all(),
    env.DB.prepare(`SELECT r.data, MAX(r.seq) AS seq, e.seq AS enviado, e.ok FROM registros r INDEXED BY registros_seq
      LEFT JOIN usina_envios e ON e.dia = r.data
      WHERE r.seq > ? AND r.seq <= ? AND r.data < ? AND ${SO_PRODUCAO} GROUP BY r.data ORDER BY r.data`).bind(cursor, ultimo.seq, janela).all(),
    env.DB.prepare(`SELECT e.dia AS data, MAX(r.seq) AS seq FROM usina_envios e
      JOIN registros r ON r.data = e.dia WHERE e.ok = 0 AND e.dia < ? AND ${SO_PRODUCAO} GROUP BY e.dia`).bind(janela).all(),
  ]);
  const precisa = (d, novo = false) => d.ok == null ? novo || d.data >= desde : !d.ok || d.seq > d.enviado;
  const passados = new Map([...antigos.results.filter((d) => precisa(d, !primeiraCarga)), ...errosAntigos.results].map((d) => [d.data, d]));
  const pendentes = [...recentes.results.filter((d) => precisa(d, !primeiraCarga && d.seq > cursor)), ...passados.values()].sort((a, b) => a.data.localeCompare(b.data));
  const falta = pendentes.slice(0, POR_VOLTA);
  const api = leitura.criar(C, () => medidas, { fusoMin });
  let ok = 0, erros = 0;
  for (const { data: dia, seq } of falta) {
    const { results } = await env.DB.prepare(`SELECT json FROM registros WHERE data = ? AND ${SO_PRODUCAO}`).bind(dia).all();
    const registros = results.map((l) => JSON.parse(l.json));
    // montar o corpo fica fora do try: defeito aqui é nosso, não é o servidor fora do ar
    const corpo = JSON.stringify({ ...api.totais(leitura.intervaloTotais(new URLSearchParams({ dia })), registros.filter((x) => !x.apagado)),
      turnoEncerrado: (C.turnos || []).find((t) => t.fim === inicio) || null, producao: api.dia(dia, registros) });
    let status = 0, erro = '';
    try {
      // 'manual', não 'error': a Cloudflare recusa 'error' antes de o pedido sair (3.1.8: por isso nada chegava). Redirecionamento volta como 3xx e não é seguido.
      const r = await fetch(env.USINA_URL, {
        method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(20000),
        headers: { 'Content-Type': 'application/json', 'X-Pranchetas-Segredo': env.USINA_CHAVE },
        body: corpo,
      });
      status = r.status;
      if (!r.ok) erro = `O Servidor da Usina respondeu ${r.status}`;
    } catch (e) { erro = `Sem resposta do Servidor da Usina${e && e.name === 'TimeoutError' ? ' em 20 segundos' : e && e.name && e.name !== 'Error' ? ` (${e.name})` : ''}`; } // só o tipo do erro: o texto dele pode citar o pedido
    await env.DB.prepare('INSERT INTO usina_envios (dia, seq, ok, em, status, erro) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(dia) DO UPDATE SET seq = excluded.seq, ok = excluded.ok, em = excluded.em, status = excluded.status, erro = excluded.erro')
      .bind(dia, seq, erro ? 0 : 1, agora, status, erro).run();
    if (erro) erros++; else ok++;
  }
  // O snapshot foi lido antes dos candidatos: correção durante o envio fica para a próxima volta.
  // Se algum dia ficou fora do lote, conserva o cursor até todos caberem numa volta.
  if (pendentes.length <= POR_VOLTA) {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO info (chave, valor) VALUES ('usinaSeq', ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor").bind(String(ultimo.seq)),
      env.DB.prepare("INSERT INTO info (chave, valor) VALUES ('usinaDesde', ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor").bind(carga),
      env.DB.prepare("INSERT INTO info (chave, valor) VALUES ('usinaInicio', ?) ON CONFLICT(chave) DO NOTHING").bind(primeiroDia),
    ]);
  }
  return { enviados: ok, erros };
}

/** Para o dono ver na Usina: o último envio e se ele deu certo. */
export async function situacaoDoServidorDaUsina(env) {
  if (!ligado(env)) return { ligado: false };
  const u = await env.DB.prepare('SELECT dia, ok, em, erro FROM usina_envios ORDER BY em DESC, dia DESC LIMIT 1').first();
  return { ligado: true, dia: (u && u.dia) || '', ok: !!(u && u.ok), em: (u && u.em) || 0, erro: (u && u.erro) || '' };
}
