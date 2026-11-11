/* 3.1.10: o assistente entende sem o modelo milhares de jeitos de perguntar (período, campo, cada dia, média, continuação).
 * Frases montadas por combinação (prefixo x campo x período x modo, em ordens, acentos e maiúsculas diferentes); hoje fixo em 11/11/2026, uma quarta. */
import { entender, pedeLista } from '../nuvem/src/entender.js';
import { novoGrupo, teste, igual, certo, resumo } from './teste.mjs';

const HOJE = '2026-11-11';
const g = novoGrupo('Assistente entende as perguntas (3.1.10)');
const PERIODOS = [
  ['hoje', '2026-11-11', '2026-11-11'], ['ontem', '2026-11-10', '2026-11-10'], ['anteontem', '2026-11-09', '2026-11-09'],
  ['esse mês', '2026-11-01', '2026-11-11'], ['este mês', '2026-11-01', '2026-11-11'], ['neste mês', '2026-11-01', '2026-11-11'], ['do mês', '2026-11-01', '2026-11-11'],
  ['mês passado', '2026-10-01', '2026-10-31'], ['no mês passado', '2026-10-01', '2026-10-31'], ['em outubro', '2026-10-01', '2026-10-31'],
  ['de outubro de 2026', '2026-10-01', '2026-10-31'], ['em setembro', '2026-09-01', '2026-09-30'], ['em novembro', '2026-11-01', '2026-11-11'],
  ['semana passada', '2026-11-02', '2026-11-08'], ['na última semana', '2026-11-02', '2026-11-08'], ['essa semana', '2026-11-09', '2026-11-11'], ['nesta semana', '2026-11-09', '2026-11-11'],
  ['do dia 1 ao dia 8', '2026-11-01', '2026-11-08'], ['dia 1 até dia 8', '2026-11-01', '2026-11-08'], ['de 1 a 8 de novembro', '2026-11-01', '2026-11-08'],
  ['entre os dias 1 e 8', '2026-11-01', '2026-11-08'], ['do dia primeiro ao dia oito', '2026-11-01', '2026-11-08'], ['de 01/11 a 08/11', '2026-11-01', '2026-11-08'],
  ['01/11 até 08/11', '2026-11-01', '2026-11-08'], ['de 1/11/2026 a 8/11/2026', '2026-11-01', '2026-11-08'], ['de 28/10 a 03/11', '2026-10-28', '2026-11-03'],
  ['do dia 28 ao dia 3', '2026-10-28', '2026-11-03'], ['do dia 10 ao 15', '2026-10-10', '2026-10-15'], ['a partir do dia 1', '2026-11-01', '2026-11-11'],
  ['desde o dia 3', '2026-11-03', '2026-11-11'], ['do dia 5 pra cá', '2026-11-05', '2026-11-11'], ['do dia 5 até hoje', '2026-11-05', '2026-11-11'],
  ['nos últimos 7 dias', '2026-11-05', '2026-11-11'], ['últimos 3 dias', '2026-11-09', '2026-11-11'], ['dos últimos quinze dias', '2026-10-28', '2026-11-11'],
  ['no dia 5', '2026-11-05', '2026-11-05'], ['dia 05/11', '2026-11-05', '2026-11-05'], ['5 de novembro', '2026-11-05', '2026-11-05'],
  ['dia 25', '2026-10-25', '2026-10-25'], ['em 03/11/2026', '2026-11-03', '2026-11-03'], ['do dia 20 de outubro ao dia 25 de outubro', '2026-10-20', '2026-10-25'],
];
const PREFIXOS = [['', 0], ['me mostra ', 0], ['mostre ', 0], ['quero ver ', 0], ['qual foi ', 0], ['me diga ', 0], ['pode me passar ', 0], ['liste pra mim ', 1],
  ['me fala ', 0], ['gostaria de saber ', 0], ['consegue me mostrar ', 0], ['traz ', 0], ['me manda ', 0], ['preciso de ', 0]];
const ALCOOL = ['a produção de álcool', 'o álcool produzido', 'quantos litros de álcool', 'a produção', 'quanto álcool foi feito', 'a produção das destilarias',
  'os litros produzidos', 'quanto de álcool produzimos', 'quanto produziu', 'a produção de alcool da usina'];
const MODOS_ALCOOL = [['', {}], ['por dia', { por: 'dia' }], ['de cada dia', { por: 'dia' }], ['dia a dia', { por: 'dia' }], ['em lista', { por: 'dia' }],
  ['separado por dia', { por: 'dia' }], ['no total', {}], ['a média', { operacao: 'media' }], ['média por dia', { operacao: 'media', por: 'dia' }]];
const CAMPOS = [['a cal', 'ins_cal', 'qtd'], ['quanto de cal gastou', 'ins_cal', 'qtd'], ['a matéria-prima', 'ins_materia_prima', 'qtd'], ['a MP', 'ins_materia_prima', 'qtd'],
  ['a pesagem', 'ins_materia_prima', 'qtd'], ['a uréia', 'ins_ureia', 'qtd'], ['o LPHERA', 'ins_lphera', 'qtd'], ['o saczyme', 'ins_saczyme', 'qtd'],
  ['o lactrol', 'ins_lactrol', 'qtd'], ['o antibiótico', 'ins_alcolina', 'qtd'], ['a pressão da caldeira', 'caldeira', 'pressao'], ['a pressão da caldeira 2', 'caldeira_2', 'pressao'],
  ['a temperatura da água da caldeira', 'caldeira', 'temp_agua'], ['o carregamento', 'destilaria', 'carregamento'], ['o INPM da nova', 'nova_destilaria', 'inpm'],
  ['o vapor da nova destilaria', 'nova_destilaria', 'vapor'], ['a produção da nova destilaria', 'nova_destilaria', 'producao_lth'],
  ['o álcool da destilaria velha', 'destilaria', 'producao'], ['a cal das dornas', 'hid_anexo1', 'cal']];
const MODOS_CAMPO = [['', {}], ['por dia', { por: 'dia' }], ['no total', { por: 'total' }], ['a média', { operacao: 'media' }], ['por hora', { por: 'hora' }], ['dia a dia', { por: 'dia' }]];

const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
/** a frase n: alterna ordem, acento, interrogação e maiúscula para não testar sempre o mesmo jeito de escrever */
function frase(n, prefixo, campo, periodo, modo) {
  let f = n % 2 ? `${prefixo}${campo} ${periodo}${modo ? ' ' + modo : ''}` : `${prefixo}${periodo} ${campo}${modo ? ' ' + modo : ''}`;
  if (n % 3 === 0) f = semAcento(f);
  if (n % 4 === 0) f = f.charAt(0).toUpperCase() + f.slice(1);
  return f.trim() + (n % 2 ? '?' : '');
}
function conferir(lista) {
  const erros = [];
  for (const [f, esperado, hist] of lista) {
    const r = entender(f, hist || [], HOJE);
    if (JSON.stringify(r) !== JSON.stringify(esperado)) erros.push(`"${f}" deu ${JSON.stringify(r)}, esperado ${JSON.stringify(esperado)}`);
  }
  if (erros.length) throw new Error(`${erros.length} de ${lista.length}:\n    ` + erros.slice(0, 12).join('\n    '));
  return `${lista.length} frases`;
}
let total = 0;
const conta = (l) => { total += l.length; return l; };

await teste(g, 'produção de álcool: prefixo x jeito de dizer x período x modo', async () => {
  const lista = []; let n = 0;
  for (const c of ALCOOL) for (const [p, de, ate] of PERIODOS) for (const [m, extra] of MODOS_ALCOOL) {
    const [pre, lista1] = PREFIXOS[n % PREFIXOS.length];
    const args = { de, ate, ...extra };
    if (lista1 && !args.por) args.por = 'dia';
    lista.push([frase(n++, pre, c, p, m), { nome: 'producao', args }]);
  }
  return conferir(conta(lista));
});
await teste(g, 'qualquer campo: insumos, caldeiras e destilarias x período x modo', async () => {
  const lista = []; let n = 0;
  for (const [c, folha, campo] of CAMPOS) for (const [p, de, ate] of PERIODOS) for (const [m, extra] of MODOS_CAMPO) {
    const [pre, lista1] = PREFIXOS[n % PREFIXOS.length];
    const args = { folha, campo, de, ate, ...extra };
    if (lista1 && !extra.por) args.por = 'dia';
    lista.push([frase(n++, pre, c, p, m), { nome: 'consulta', args }]);
  }
  return conferir(conta(lista));
});
const mem = (nome, args, de, ate) => [{ de: 'eu', texto: 'pergunta' }, { de: 'ia', texto: `ferramenta: ${nome}\nargumentos: ${JSON.stringify(args)}\nde: ${de}\nate: ${ate}\ndias com valor: 3` }];
const HP = mem('producao', { de: '2026-11-01', ate: '2026-11-10' }, '2026-11-01', '2026-11-10');
const HC = mem('consulta', { folha: 'ins_cal', campo: 'qtd', de: '2026-11-01', ate: '2026-11-10' }, '2026-11-01', '2026-11-10');
await teste(g, 'continuação: "e em outubro?", "agora por dia", "e a média?", "e de matéria-prima?"', async () => {
  const P = { de: '2026-11-01', ate: '2026-11-10' }, C = { folha: 'ins_cal', campo: 'qtd', ...P };
  const casos = [['e em outubro?', { de: '2026-10-01', ate: '2026-10-31' }], ['e ontem?', { de: '2026-11-10', ate: '2026-11-10' }], ['E na semana passada?', { de: '2026-11-02', ate: '2026-11-08' }],
    ['e o mês passado', { de: '2026-10-01', ate: '2026-10-31' }], ['e de 01/11 a 05/11?', { de: '2026-11-01', ate: '2026-11-05' }], ['e do dia 1 ao 5?', { de: '2026-11-01', ate: '2026-11-05' }],
    ['e hoje?', { de: '2026-11-11', ate: '2026-11-11' }], ['agora por dia', { por: 'dia' }], ['lista por dia', { por: 'dia' }], ['mostra dia a dia', { por: 'dia' }],
    ['e a média?', { operacao: 'media' }], ['quero a média', { operacao: 'media' }], ['de cada dia', { por: 'dia' }]];
  const lista = [];
  for (const [f, muda] of casos) {
    lista.push([f, { nome: 'producao', args: { ...P, ...muda } }, HP]);
    lista.push([f, { nome: 'consulta', args: { ...C, ...muda } }, HC]);
  }
  lista.push(['e de matéria-prima?', { nome: 'consulta', args: { folha: 'ins_materia_prima', campo: 'qtd', ...P } }, HP]);
  lista.push(['e a cal?', { nome: 'consulta', args: { folha: 'ins_cal', campo: 'qtd', ...P } }, HP]);
  lista.push(['e o álcool?', { nome: 'producao', args: P }, HC]);
  lista.push(['e no total?', { nome: 'consulta', args: { ...C, por: 'total' } }, HC]);
  // a última resposta foi texto (confirmação): vale a chamada de antes
  lista.push(['e em outubro?', { nome: 'producao', args: { de: '2026-10-01', ate: '2026-10-31' } }, [...HP, { de: 'eu', texto: 'isso é de novembro?' }, { de: 'ia', texto: 'Sim.' }]]);
  return conferir(conta(lista));
});
await teste(g, 'confirmação do período mostrado responde sem consultar ("Isso é no mês de novembro?")', async () => {
  const sim = { texto: 'Sim. O período mostrado vai de 01/11 a 10/11, em novembro.' }, nao = { texto: 'Não. O período mostrado vai de 01/11 a 10/11, em novembro.' };
  const so = { texto: 'O período mostrado vai de 01/11 a 10/11, em novembro.' };
  return conferir(conta([['Isso é no mês de novembro?', sim, HP], ['isso é de novembro?', sim, HP], ['isso foi em novembro?', sim, HP], ['Isso é novembro?', sim, HC],
    ['esse total é de outubro?', nao, HP], ['isso é de ontem?', nao, HP], ['isso é desse mês?', sim, HP], ['qual o período?', so, HP], ['de quando é isso?', so, HC],
    ['quais dias são?', so, HP], ['Qual é o período?', so, HP]]));
});
await teste(g, 'quem trabalhou, avisos, fora do limite, saudação e ajuda', async () => {
  return conferir(conta([['quem trabalhou ontem?', { nome: 'quem_trabalha', args: { data: '2026-11-10' } }], ['quais operadores anotaram hoje', { nome: 'quem_trabalha', args: { data: '2026-11-11' } }],
    ['Quem trabalhou em 01/11/2026?', { nome: 'quem_trabalha', args: { data: '2026-11-01' } }], ['avisos de ontem', { nome: 'avisos', args: { data: '2026-11-10' } }],
    ['teve algum aviso hoje?', { nome: 'avisos', args: { data: '2026-11-11' } }], ['o que ficou fora do limite ontem?', { nome: 'fora_do_limite', args: { data: '2026-11-10' } }],
    ['alertas de 05/11', { nome: 'fora_do_limite', args: { data: '2026-11-05' } }], ['obrigado', { texto: 'Por nada!' }], ['Valeu!', { texto: 'Por nada!' }]]));
});
await teste(g, 'o que não entende fica com o modelo; período acima de 62 dias explica o limite', async () => {
  for (const f of ['Me conta uma piada', 'qual a previsão do tempo?', 'manda um aviso pra caldeira conferir a pressão', 'imprime o relatório de ontem',
    'envia o relatório de ontem pro escritório', 'vapor ontem', 'INPM ontem', 'produção do ano', 'como está a fermentação agora?']) igual(entender(f, [], HOJE), null, f);
  certo(entender('álcool de 01/08 a 31/10', [], HOJE).texto.includes('62 dias'));
  igual(entender('do dia 28 de outubro ao dia 3 de novembro a cal', [], HOJE).args, { folha: 'ins_cal', campo: 'qtd', de: '2026-10-28', ate: '2026-11-03' });
  for (const f of ['oi', 'Bom dia', 'e aí?', 'o que você sabe fazer?']) certo(/Somo, faço média/.test(entender(f, [], HOJE).texto), f);
  total += 15;
});
await teste(g, 'as duas perguntas da foto do Guilherme (09 e 10/11)', async () => {
  igual(entender('Liste para min a produção de álcool de cada dia a partir do dia 1 desse mes', [], HOJE), { nome: 'producao', args: { de: '2026-11-01', ate: '2026-11-11', por: 'dia' } });
  igual(entender('Quantos litros de produção de álcool teve esse mês?', [], HOJE), { nome: 'producao', args: { de: '2026-11-01', ate: '2026-11-11' } });
  igual(entender('Isso é no mês de novembro?', HP, HOJE).texto, 'Sim. O período mostrado vai de 01/11 a 10/11, em novembro.');
  certo(pedeLista('Liste para min a produção') && pedeLista('de cada dia') && !pedeLista('quanto deu esse mês'));
  total += 3;
  return `${total} frases ao todo`;
});

const r = resumo([g]);
console.log(`\n${r.passaram} de ${r.total} testes passaram; ${r.falharam} falharam (${total} frases)`);
process.exit(r.falharam ? 1 : 0);
