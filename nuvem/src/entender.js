/* Assistente 3.1.10: entende sem o modelo as perguntas mais comuns (período, campo, cada dia, média) e as continuações da conversa.
 * Devolve a chamada que o modelo escolheria ({ nome, args }), um texto pronto ({ texto }) ou null, e aí quem decide é o modelo.
 * Permissão, validação e contas continuam em assistente.js. */

const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const NOME_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MES = MESES.join('|');
const UNIDADES = { um: 1, uma: 1, primeiro: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, trinta: 30 };
const PALAVRA = '(?:' + Object.keys(UNIDADES).join('|') + ')';

/** minúsculas, sem acento, número por extenso vira algarismo ("dia primeiro" -> "dia 1", "vinte e dois" -> "22") */
export function normalizar(texto) {
  let t = String(texto).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9/:\s]/g, ' ').replace(/\bpra\b/g, 'para').replace(/\bpro\b/g, 'para o').replace(/\s+/g, ' ').trim();
  t = t.replace(/\b(vinte|trinta) e (um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove)\b/g, (_, a, b) => String(UNIDADES[a] + UNIDADES[b]));
  // "um", "uma" e "primeiro" só depois de "dia": no resto da frase são artigo ("um gráfico") ou outra coisa
  t = t.replace(new RegExp(`\\b(dias?|ao|a|ate|e|ultimos|ultimas) (${PALAVRA})\\b`, 'g'), (m, a, b) => `${a} ${UNIDADES[b]}`);
  t = t.replace(/\b(dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|catorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta)\b/g, (b) => String(UNIDADES[b]));
  // "caldeira 2 de outubro" é a caldeira 2 em outubro, não o dia 2
  return t.replace(/\bcaldeira (1|2)\b/g, 'caldeira$1').replace(/\bdestilaria 1\b/g, 'destilaria1');
}

const dia = (base, n) => new Date(Date.parse(base + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const iso = (a, m, d) => `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const fimDoMes = (a, m) => new Date(Date.UTC(a, m, 0)).getUTCDate();
const valido = (a, m, d) => m >= 1 && m <= 12 && d >= 1 && d <= fimDoMes(a, m);
const ddmm = (d) => d.slice(8, 10) + '/' + d.slice(5, 7);
const mesAntes = (a, m) => (m === 1 ? [a - 1, 12] : [a, m - 1]);
const ano4 =(a) => (a ? (a.length === 2 ? 2000 + Number(a) : Number(a)) : null);

/** Período citado na frase, ou null. Data sem ano é a mais recente que já passou; dia sem mês é deste mês (ou do anterior, se ainda não chegou). */
export function periodoDaFrase(t, hoje) {
  const [A, M, D] = hoje.split('-').map(Number);
  const mesCitado = new RegExp(`\\b(${MES})\\b(?:\\s+(?:de\\s+)?(\\d{4}))?`).exec(t);
  const mesPassado = /\b(mes passado|ultimo mes|mes anterior)\b/.test(t);
  const comAno = (m, d, a) => { if (a) return iso(a, m, d); const x = iso(A, m, d); return x > hoje ? iso(A - 1, m, d) : x; };
  // dia sem mês: o mês citado na frase, o passado ou o atual
  const doMes = (d) => {
    if (mesCitado) { const m = MESES.indexOf(mesCitado[1]) + 1; return valido(A, m, d) || mesCitado[2] ? comAno(m, d, ano4(mesCitado[2])) : null; }
    const [a, m] = mesPassado ? (M === 1 ? [A - 1, 12] : [A, M - 1]) : [A, M];
    if (!mesPassado && d > D) return M === 1 ? (valido(A - 1, 12, d) ? iso(A - 1, 12, d) : null) : valido(A, M - 1, d) ? iso(A, M - 1, d) : null;
    return valido(a, m, d) ? iso(a, m, d) : null;
  };
  const data = (d, m, a) => (m ? (valido(ano4(a) || A, +m, +d) ? comAno(+m, +d, ano4(a)) : null) : doMes(+d));
  const faixa = (de, ate) => (de && ate ? (de <= ate ? { de, ate } : null) : null);
  let r;
  // 01/11 a 08/11, 1/11/2026 ate 8/11/2026
  if ((r = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s+(?:(?:a|ao|ate|e|para)\s+)?(?:o\s+)?(?:dia\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(t)))
    return faixa(data(r[1], r[2], r[3]), data(r[4], r[5], r[6] || r[3]));
  // do dia 28 de outubro ao dia 3 de novembro
  if ((r = new RegExp(`\\b(\\d{1,2}) de (${MES})(?: de (\\d{4}))? (?:a|ao|ate|e) (?:o )?(?:dia )?(\\d{1,2}) de (${MES})(?: de (\\d{4}))?\\b`).exec(t)))
    return faixa(data(r[1], MESES.indexOf(r[2]) + 1, r[3]), data(r[4], MESES.indexOf(r[5]) + 1, r[6] || r[3]));
  // a partir do dia 1, desde 03/11, do dia 5 para ca / ate hoje / em diante
  if ((r = /\b(?:a partir|desde|depois)\s+(?:d[oae]\s+)?(?:o\s+)?(?:dia\s+)?(\d{1,2})(?:\/(\d{1,2})(?:\/(\d{2,4}))?)?\b/.exec(t)) ||
      (r = /\b(?:do|de)\s+(?:dia\s+)?(\d{1,2})(?:\/(\d{1,2})(?:\/(\d{2,4}))?)?\s+(?:para ca|ate hoje|ate agora|ate o momento|em diante)\b/.exec(t)))
    return faixa(data(r[1], r[2], r[3]), hoje);
  // do dia 1 ao dia 8, dia 1 ate 8, entre os dias 1 e 8, de 1 a 8 de novembro
  if ((r = /\b(?:(?:do|de|dos|entre(?:\s+os|\s+o)?)\s+(?:dias?\s+)?|dias?\s+)(\d{1,2})\s+(?:a|ao|ate|e)\s+(?:o\s+)?(?:dia\s+)?(\d{1,2})\b(?!\s*(?:\/|horas?\b|h\b))/.exec(t))) {
    const d1 = +r[1], d2 = +r[2];
    if (mesCitado || mesPassado) return faixa(doMes(d1), doMes(d2));
    // os dois dias no mesmo mês (o anterior, se o último ainda não chegou); "do dia 28 ao dia 3" começa no mês antes
    const [a, m] = d2 > D ? mesAntes(A, M) : [A, M], [pa, pm] = d1 > d2 ? mesAntes(a, m) : [a, m];
    return faixa(valido(pa, pm, d1) ? iso(pa, pm, d1) : null, valido(a, m, d2) ? iso(a, m, d2) : null);
  }
  if ((r = /\bultim[oa]s\s+(\d{1,2})\s+dias\b|\b(\d{1,2})\s+ultimos\s+dias\b/.exec(t))) { const n = +(r[1] || r[2]); return n >= 1 ? { de: dia(hoje, 1 - n), ate: hoje } : null; }
  if ((r = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(t))) return faixa(data(r[1], r[2], r[3]), data(r[1], r[2], r[3]));
  if ((r = /\bdia\s+(\d{1,2})\b/.exec(t)) || (r = new RegExp(`\\b(\\d{1,2})\\s+de\\s+(?:${MES})\\b`).exec(t))) { const d = data(r[1]); return faixa(d, d); }
  if (/\banteontem\b|\bantes de ontem\b/.test(t)) return { de: dia(hoje, -2), ate: dia(hoje, -2) };
  if (/\bontem\b/.test(t)) return { de: dia(hoje, -1), ate: dia(hoje, -1) };
  if (/\bhoje\b/.test(t)) return { de: hoje, ate: hoje };
  const segunda = dia(hoje, -((new Date(hoje + 'T12:00:00Z').getUTCDay() + 6) % 7));
  if (/\b(semana passada|ultima semana|semana anterior)\b/.test(t)) return { de: dia(segunda, -7), ate: dia(segunda, -1) };
  if (/\b(essa|esta|nesta|nessa|desta|dessa) semana\b|\bsemana atual\b/.test(t)) return { de: segunda, ate: hoje };
  if (mesPassado) { const [a, m] = M === 1 ? [A - 1, 12] : [A, M - 1]; return { de: iso(a, m, 1), ate: iso(a, m, fimDoMes(a, m)) }; }
  if (mesCitado) {
    const m = MESES.indexOf(mesCitado[1]) + 1, a = ano4(mesCitado[2]) || (m > M ? A - 1 : A);
    const ate = iso(a, m, fimDoMes(a, m));
    return iso(a, m, 1) > hoje ? null : { de: iso(a, m, 1), ate: ate > hoje ? hoje : ate };
  }
  if (/\b(esse|este|neste|nesse|desse|deste|do|no) mes\b|\bmes atual\b/.test(t)) return { de: iso(A, M, 1), ate: hoje };
  return null;
}

/* O que a pessoa quer ver. A primeira regra que casa vence: campo específico antes de "produção". */
const caldeira = (t) => (/\bcaldeira2\b|\bsegunda caldeira\b/.test(t) ? 'caldeira_2' : 'caldeira');
const DESTILARIA_VELHA = /\bdestilaria(1| velha| antiga| de baixo)\b|\bprimeira destilaria\b|\bdestilaria e fermentacao\b/;
const qualDestilaria = (t) => (/\bnova\b/.test(t) ? 'nova_destilaria' : DESTILARIA_VELHA.test(t) ? 'destilaria' : null);
const CAMPOS = [
  [/\bmateria prima\b|\bmp\b|\bpesage(m|ns)\b|\bbagaco\b/, () => ['ins_materia_prima', 'qtd']],
  [/\bureia\b/, () => ['ins_ureia', 'qtd']],
  [/\blphera\b/, () => ['ins_lphera', 'qtd']],
  [/\bsac ?zyme\b/, () => ['ins_saczyme', 'qtd']],
  [/\blactrol\b/, () => ['ins_lactrol', 'qtd']],
  [/\bantibiotico\b|\balcolina\b/, () => ['ins_alcolina', 'qtd']],
  [/\bcal\b.*\b(dornas?|hidrolise)\b|\b(dornas?|hidrolise)\b.*\bcal\b/, () => ['hid_anexo1', 'cal']],
  [/\bcal\b/, () => ['ins_cal', 'qtd']],
  [/\bpress(ao|oes)\b/, (t) => [caldeira(t), 'pressao']],
  [/\btemperatura (da )?agua\b|\bagua da caldeira/, (t) => [caldeira(t), 'temp_agua']],
  [/\bcarregamento\b/, () => ['destilaria', 'carregamento']],
  [/\bpe da coluna\b/, () => ['destilaria', 'temp_pe_a']],
  // INPM e vapor existem nas duas destilarias: sem dizer qual, fica com o modelo
  [/\binpm\b|\bgrau alcoolico\b/, (t) => (qualDestilaria(t) ? [qualDestilaria(t), 'inpm'] : null)],
  [/\bvapor\b/, (t) => (qualDestilaria(t) ? [qualDestilaria(t), 'vapor'] : null)],
  // álcool: as duas destilarias juntas, a não ser que a pessoa diga qual
  [/\balcool\b|\bproducao\b|\bproduzi(u|do|da|mos|ram)?\b|\bfabricad[oa]s?\b|\blitros\b/, (t) => {
    const d = qualDestilaria(t);
    return d === 'nova_destilaria' ? ['nova_destilaria', 'producao_lth'] : d === 'destilaria' ? ['destilaria', 'producao'] : ['producao'];
  }],
];
const LISTA = /\bcada dia\b|\bpor dia\b|\bdia a dia\b|\bdia por dia\b|\bdiari[ao]s?\b|\bdiariamente\b|\blist(a|e|ar|agem)\b|\bseparad[ao]s?\b|\bum por um\b|\btodos os dias\b|\bem cada\b/;
const HORA = /\bpor hora\b|\bcada hora\b|\bhora a hora\b|\bde hora em hora\b/;
const MEDIA = /\bmedi[ao]s?\b/;
const TOTAL = /\btotal\b|\bsoma\b|\bsomad[oa]s?\b|\bao todo\b|\bno geral\b|\bacumulad[oa]s?\b/;
export const pedeLista = (pergunta) => LISTA.test(normalizar(pergunta));

/** o modo vale tanto para pergunta nova quanto para "agora por dia", "e a média?" */
function comModo(t, nome, args) {
  const a = { ...args };
  if (MEDIA.test(t)) a.operacao = 'media';
  else if (TOTAL.test(t) && a.operacao === 'media') { if (nome === 'consulta') a.operacao = 'soma'; else delete a.operacao; }
  if (HORA.test(t) && nome === 'consulta') a.por = 'hora';
  else if (LISTA.test(t)) a.por = 'dia';
  else if (TOTAL.test(t)) { if (nome === 'consulta') a.por = 'total'; else delete a.por; }
  for (const k of Object.keys(a)) if (a[k] === undefined) delete a[k];
  return a;
}

/** a última chamada da conversa, tirada da memória da resposta (ferramenta, argumentos, de, ate) */
function ultimaChamada(historico) {
  for (let i = historico.length - 1; i >= 0; i--) {
    const m = historico[i];
    if (m.de !== 'ia') continue;
    const f = /^ferramenta: (\w+)$/m.exec(m.texto), a = /^argumentos: (.*)$/m.exec(m.texto);
    if (!f) continue; // resposta em texto (confirmação, saudação): vale a chamada de antes
    let args = {};
    try { args = JSON.parse(a ? a[1] : '{}'); } catch { return null; }
    const de = (/^de: (\d{4}-\d\d-\d\d)$/m.exec(m.texto) || [])[1], ate = (/^ate: (\d{4}-\d\d-\d\d)$/m.exec(m.texto) || [])[1];
    return { nome: f[1], args, de, ate };
  }
  return null;
}

const AJUDA = 'Somo, faço média e gráfico de qualquer campo das folhas, listo a produção de álcool de cada dia, mostro quem trabalhou, os avisos e o que saiu do limite, e preparo impressão, envio e aviso. Exemplos: "álcool de cada dia desta semana", "média da pressão da caldeira ontem", "cal do mês passado".';
const CONFIRMA = /^(e |mas )?(isso|isto|ess[ea] (total|valor|numero|resultado|grafico|soma|media)|esses (dados|valores|numeros)|o total|o resultado)( ai)? (e|foi|sao|era|seria|eh|se refere|corresponde|vale)\b|\b(qual|que) (e )?(o )?periodo\b|\bde quando (e|sao|foi|foram)\b|\b(que|quais) dias (sao|foram|entram)\b/;
const textoPeriodo = (de, ate) => {
  const mes = de.slice(0, 7) === ate.slice(0, 7) ? `, em ${NOME_MES[Number(de.slice(5, 7)) - 1]}` : '';
  return de === ate ? `do dia ${ddmm(de)}${mes}` : `de ${ddmm(de)} a ${ddmm(ate)}${mes}`;
};

/** pergunta -> { nome, args } | { texto } | null */
export function entender(pergunta, historico, hoje) {
  const t = normalizar(pergunta);
  if (!t) return null;
  if (/^(oi|ola|opa|bom dia|boa tarde|boa noite|e ai|tudo bem)( tudo bem)?$/.test(t)) return { texto: 'Olá! ' + AJUDA };
  if (/^(muito )?(obrigad[oa]|valeu|brigad[oa]|show|beleza|ok|certo|perfeito|otimo)( obrigad[oa])?$/.test(t)) return { texto: 'Por nada!' };
  if (/\bo que (voce )?(sabe|consegue|pode) fazer\b|\bcomo (te )?(uso|usar)\b|^ajuda$/.test(t)) return { texto: AJUDA };
  const antes = ultimaChamada(historico || []);
  let periodo = periodoDaFrase(t, hoje);
  if (periodo && (Date.parse(periodo.ate) - Date.parse(periodo.de)) / 864e5 + 1 > 62)
    return { texto: 'Consigo mostrar até 62 dias por pergunta. Peça por mês, por exemplo "álcool de cada dia de outubro".' };
  // "isso é de novembro?", "qual o período?": responde com o período da última resposta, sem consultar nada
  if (antes && antes.de && antes.ate && CONFIRMA.test(t)) {
    const mostrado = textoPeriodo(antes.de, antes.ate);
    if (!periodo) return { texto: `O período mostrado vai ${mostrado}.`.replace('vai do dia', 'é o dia') };
    const dentro = antes.de >= periodo.de && antes.ate <= periodo.ate;
    return { texto: `${dentro ? 'Sim' : 'Não'}. O período mostrado vai ${mostrado}.`.replace('vai do dia', 'é o dia') };
  }
  // pedidos que mudam algo (imprimir, enviar, mandar aviso) ficam com o modelo e com a confirmação na tela
  if (/\bimprim|\b(envi|mand)\w*\b.*\b(relatorio|aviso|escritorio|setor|whatsapp|email)\b|\bprepar|\bescrev/.test(t)) return null;
  const umDia = (nome) => {
    const p = periodo || { de: hoje, ate: hoje };
    return p && p.de === p.ate ? { nome, args: { data: p.de } } : null;
  };
  if (/\bfora (do|dos) limites?\b|\bfora da faixa\b|\b(passou|passaram) do limite\b|\b(acima|abaixo) do limite\b|\balertas?\b/.test(t)) return umDia('fora_do_limite');
  if (/\bquem (trabalhou|trabalha|anotou|esta trabalhando|estava|esteve|tava|lancou|preencheu)\b|\bquais (os )?operadores\b|\bquem (eram|foram) os operadores\b/.test(t)) return umDia('quem_trabalha');
  if (/\bavisos?\b/.test(t)) return umDia('avisos');
  const casou = CAMPOS.find(([re]) => re.test(t));
  if (casou) {
    const alvo = casou[1](t);
    if (!alvo) return null;
    // "e de matéria-prima?": sem período na frase, vale o da pergunta anterior
    if (!periodo && antes && antes.de && antes.ate && ['producao', 'consulta'].includes(antes.nome)) periodo = { de: antes.de, ate: antes.ate };
    if (!periodo) return null;
    const [folha, campo] = alvo;
    return folha === 'producao'
      ? { nome: 'producao', args: comModo(t, 'producao', { de: periodo.de, ate: periodo.ate }) }
      : { nome: 'consulta', args: comModo(t, 'consulta', { folha, campo, de: periodo.de, ate: periodo.ate }) };
  }
  // continuação: "e em outubro?", "e ontem?", "agora por dia", "e a média?"
  if (!antes || !['producao', 'consulta', 'quem_trabalha', 'avisos', 'fora_do_limite'].includes(antes.nome)) return null;
  const mudaModo = LISTA.test(t) || HORA.test(t) || MEDIA.test(t) || TOTAL.test(t);
  if (!periodo && !mudaModo) return null;
  if (t.split(' ').length > 9) return null; // frase longa sem campo conhecido: o modelo entende melhor
  if (['quem_trabalha', 'avisos', 'fora_do_limite'].includes(antes.nome)) return periodo && periodo.de === periodo.ate ? { nome: antes.nome, args: { data: periodo.de } } : null;
  const args = { ...antes.args, ...(periodo ? { de: periodo.de, ate: periodo.ate } : {}) };
  return { nome: antes.nome, args: comModo(t, antes.nome, args) };
}
