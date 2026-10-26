/* Nível pela pessoa e aparelhos fixos (2.17), nas duas centrais e só com dados temporários. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { centralNode, centralJava, pastaTemporaria } from './servidores.mjs';
import { conectarTeste } from './cifra.mjs';
import { teste, certo, igual, novoGrupo, resumo, SENHA_ENCARREGADO } from './teste.mjs';

const grupos = [];
for (const [nome, ligar, porta] of [['node', centralNode, 18217], ['java', centralJava, 18218]]) {
  if (process.argv[2] && process.argv[2] !== nome) continue;
  const g = novoGrupo('Nível pela pessoa 2.17 — ' + nome);
  grupos.push(g);
  const pasta = pastaTemporaria('nivel217');
  const arquivo = path.join(pasta, 'ServidorUsina', 'config.json');
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  const conhecidos = Array.from({ length: 50 }, (_, i) => 'fixo-' + i);
  fs.writeFileSync(arquivo, JSON.stringify({
    chave: crypto.randomBytes(18).toString('hex'), codigo: '217217',
    aparelhosChefe: { A: { nivel: 2 }, B: { nivel: 1 } },
    aparelhosVistos: Object.fromEntries(conhecidos.map((id) => [id, { papel: 'central' }])),
    niveisMigrados: 1,
  }));
  const c = await ligar(porta, pasta);
  const pedir = async (cli, rota, corpo) => {
    const r = await cli.pedir(rota, { corpo });
    return { status: r.status, ...r.json };
  };
  const pessoas = (cli, corpo) => pedir(cli, '/api/pessoas', corpo);
  const liberar = (cli, pin, extra = {}) => pedir(cli, '/api/chefes', { acao: 'liberar', pin, ...extra });
  const entrar = (cli, pin) => pessoas(cli, { acao: 'entrar', pin });
  const cfg = () => JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  try {
    const adm = await conectarTeste(c.url, c.codigo(), 'administracao');
    const a = await conectarTeste(c.url, c.codigo(), 'A');
    const b = await conectarTeste(c.url, c.codigo(), 'B');
    const visto = await conectarTeste(c.url, c.codigo(), 'visto');
    // Bootstrap explícito também cobre o aplicativo antigo.
    igual((await liberar(adm, SENHA_ENCARREGADO, { nivel: 2 })).status, 200);
    igual((await entrar(adm, SENHA_ENCARREGADO)).status, 200);
    igual((await pessoas(adm, { acao: 'salvar', pessoa: { nome: 'Administrador', nivel: 'administrador', pin: '2222' } })).status, 200);
    await pedir(visto, '/api/sync', { aparelho: visto.aparelho, papel: 'hidrolise', registros: [] });

    await teste(g, 'aparelho com nível 1 gravado continua 1 ao iniciar e entrar', async () => {
      igual((await pedir(b, '/api/chefes', { acao: 'estado' })).nivel, 1);
      igual((await entrar(b, '2222')).nivel, 1);
      igual(cfg().aparelhosChefe.B.nivel, 1);
    });
    await teste(g, 'liberar sem nível: aparelho novo fica no 2 (também com a senha do dono); já liberado mantém o nível', async () => {
      const admin = await liberar(b, '2222');
      igual(admin.status, 200); igual(admin.nivel, 1, 'o B já era nível 1: continua 1');
      // o dono configura o tablet de outra pessoa com a senha dele: não pode virar "nível 3, só do dono"
      const novo = await conectarTeste(c.url, c.codigo(), 'novo-' + nome);
      const dono = await liberar(novo, SENHA_ENCARREGADO);
      igual(dono.status, 200); igual(dono.nivel, 2);
      igual((await liberar(adm, SENHA_ENCARREGADO, { nivel: 3 })).nivel, 3, 'o nível 3 só quando o dono escolhe');
      igual((await entrar(adm, SENHA_ENCARREGADO)).status, 200);
    });
    // Mantém a preparação independente das falhas esperadas antes da implementação.
    await liberar(b, '2222', { nivel: 2 });
    let lucas;
    const salvarLucas = (extra = {}) => pessoas(adm, { acao: 'salvar', pessoa: {
      ...(lucas ? { id: lucas.id } : { pin: '3333' }), nome: 'Lucas', nivel: 'encarregado', ...extra,
    } });
    await teste(g, 'salva e devolve aparelhos, sem expor a senha', async () => {
      const r = await salvarLucas({ aparelhos: ['A'], extras: { registro: true } });
      igual(r.status, 200);
      lucas = r.pessoas.find((p) => p.nome === 'Lucas');
      igual(lucas.aparelhos, ['A']);
      certo(!('resumo' in lucas) && !('sal' in lucas), 'senha não sai');
      igual(cfg().pessoas.find((p) => p.id === lucas.id).aparelhos, ['A']);
    });
    await teste(g, 'Lucas corrige no A e só consulta no B, inclusive no sync', async () => {
      const ra = await entrar(a, '3333'); const rb = await entrar(b, '3333');
      igual(ra.status, 200); igual(rb.status, 200);
      certo(ra.funcoes.includes('corrigir'), 'corrigir no A');
      igual(rb.funcoes, ['relatorios']);
      igual(rb.pessoa.aparelhos, ['A']);
      const dia = new Date(Date.now() - 7 * 3600000).toLocaleDateString('en-CA');
      const r = { id: `${dia}|hid_anexo1|1`, data: dia, prancheta: 'hid_anexo1', chave: '1', valores: { brix: '18' }, atualizadoEm: Date.now() };
      const s = await pedir(b, '/api/sync', { aparelho: 'A', papel: 'central', registros: [r] });
      igual(s.status, 200);
      certo(s.recusados.some((x) => x.id === r.id && x.motivo === 'sem_permissao'), 'identidade cifrada do B não pode anotar como A');
      igual((await pessoas(b, { acao: 'salvar', pessoa: { ...lucas, aparelhos: [] } })).status, 403);
    });
    await teste(g, 'tablet de setor: Lucas preso ao A só consulta no tablet da produção (ajustes e escritório não abrem)', async () => {
      const r = await pessoas(visto, { acao: 'verificar', pin: '3333' });
      igual(r.status, 200);
      igual(r.funcoes, ['relatorios'], 'fora do aparelho fixo, a senha do Lucas não abre nada além de consulta');
    });
    await teste(g, 'teto continua valendo sobre a consulta fora do aparelho fixo', async () => {
      igual((await pessoas(adm, { acao: 'aparelho', id: 'B', teto: ['corrigir'] })).status, 200);
      igual((await pessoas(b, { acao: 'quem' })).funcoes, []);
      await pessoas(adm, { acao: 'aparelho', id: 'B', teto: null });
    });
    await teste(g, 'recusa tipo errado, id desconhecido, propriedades herdadas e mais de 50 ids', async () => {
      for (const aparelhos of [null, 'A', {}, [1], [null], [{}], [''], ['desconhecido'], ['toString'], ['__proto__'], [...conhecidos, 'A']]) {
        igual((await salvarLucas({ aparelhos })).status, 400, JSON.stringify(aparelhos));
      }
      igual((await pessoas(adm, { acao: 'lista' })).pessoas.find((p) => p.id === lucas.id).aparelhos, ['A']);
    });
    await teste(g, 'aceita aparelho visto ainda não liberado e o limite de 50 ids conhecidos', async () => {
      const vistoSalvo = await salvarLucas({ aparelhos: ['visto'] });
      igual(vistoSalvo.status, 200);
      igual(vistoSalvo.pessoas.find((p) => p.id === lucas.id).aparelhos, ['visto']);
      const r = await salvarLucas({ aparelhos: conhecidos });
      igual(r.status, 200); igual(r.pessoas.find((p) => p.id === lucas.id).aparelhos, conhecidos);
      await salvarLucas({ aparelhos: ['A'] });
    });
    await teste(g, 'edição do aplicativo antigo preserva o vínculo; lista vazia libera qualquer aparelho', async () => {
      igual((await salvarLucas()).status, 200);
      igual((await pessoas(b, { acao: 'quem' })).funcoes, ['relatorios']);
      igual((await salvarLucas({ aparelhos: [] })).status, 200);
      certo((await pessoas(b, { acao: 'quem' })).funcoes.includes('corrigir'), 'lista vazia libera no B sem entrar de novo');
      await salvarLucas({ aparelhos: ['A'] });
    });
    await teste(g, 'pessoa sem lista vale em qualquer aparelho', async () => {
      for (const cli of [a, b]) certo((await entrar(cli, '2222')).funcoes.includes('pessoas'), 'administrador sem lista');
    });
    await teste(g, 'PIN sem permissão e nível explícito inválido continuam recusados', async () => {
      igual((await liberar(visto, '3333')).status, 403);
      igual((await liberar(visto, '0000')).status, 403);
      igual((await liberar(visto, '2222', { nivel: 3 })).status, 403);
      igual((await liberar(visto, '2222', { nivel: 4 })).status, 400);
      igual((await liberar(visto, '2222', { nivel: 1 })).nivel, 1);
    });
    await teste(g, 'reinício preserva a lista fixa e os níveis 1, 2 e 3 gravados', async () => {
      await c.reiniciar();
      igual((await pedir(visto, '/api/chefes', { acao: 'estado' })).nivel, 1);
      igual((await pedir(a, '/api/chefes', { acao: 'estado' })).nivel, 2);
      igual((await pedir(adm, '/api/chefes', { acao: 'estado' })).nivel, 3);
      certo((await entrar(a, '3333')).funcoes.includes('corrigir'), 'A após reinício');
      igual((await entrar(b, '3333')).funcoes, ['relatorios']);
    });
  } finally { await c.desligar(); }
}
const r = resumo(grupos);
console.log(`\n${r.passaram} de ${r.total} testes passaram${r.falharam ? `, ${r.falharam} falharam` : ''}`);
process.exitCode = r.falharam ? 1 : 0;
