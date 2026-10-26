/* Revisão 2.17: regressões com o código real e centrais em pastas temporárias. */
import { createRequire } from 'node:module';
import { centralNode, centralJava, pastaTemporaria, SENHA_PROGRAMADOR_TESTE } from './servidores.mjs';
import { conectarTeste, clienteCifrado, Cifra } from './cifra.mjs';
import { novoGrupo, teste, igual, certo, resumo, SENHA_ENCARREGADO } from './teste.mjs';
const require = createRequire(import.meta.url);
const { carregarUsina } = require('../carregar-usina.js');
const Folhas = require('../public/config/folhas.js');
const leitura = require('../api-leitura.js');
const Rastreamento = require('../public/bibliotecas/rastreamento.js');
const g = novoGrupo('Regressões da revisão 2.17');
const dia = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
const reg = (pid, data = dia) => ({ id: `${data}|${pid}|8`, data, prancheta: pid, chave: '8', valores: { qtd: '1' }, atualizadoEm: Date.now() });

await teste(g, 'folhas em vigor preservam kg da uréia antiga após aplicar e remover ajustes', () => {
  const C = carregarUsina('public'), originais = new Map();
  for (const folhas of [{}, { ins_ureia: { _unidades: ['g', 'kg'] } }, {}]) {
    Folhas.aplicar(C, folhas, originais);
    igual(C.pranchetas.ins_ureia.unidade, folhas.ins_ureia ? 'g' : 'kg');
  }
  const antigo = [reg('ins_ureia')];
  igual(leitura.criar(C).totais({ de: dia, ate: dia, dias: [dia] }, antigo).total.insumos.find(x => x.prancheta === 'ins_ureia').quantidade, 1);
  igual(Rastreamento.calcular(C, dia, antigo).insumos.ureia.qtd, 1);
});

for (const [nome, ligar, porta] of [['node', centralNode, 18317], ['java', centralJava, 18318]]) {
  const c = await ligar(porta, pastaTemporaria('revisao217'));
  try {
    const setor = await conectarTeste(c.url, c.codigo(), 'ralo-revisao');
    const hid = await conectarTeste(c.url, c.codigo(), 'hid-revisao');
    const sync = (cli, papel, registros) => cli.pedir('/api/sync', { corpo: { aparelho: cli.aparelho, papel, registros } });
    for (const data of [dia, '2020-01-01']) {
      await teste(g, `${nome}: setor não escreve insumos da Hidrólise nem folhas do chefe (${data})`, async () => {
        const regs = ['ins_cal', 'ins_lphera', 'ins_saczyme', 'ins_alcolina', 'med_dornas', 'fermentacao'].map(pid => reg(pid, data));
        const r = await sync(setor, 'ralo', regs);
        igual(r.status, 200);
        igual(r.json.recusados.map(x => x.id).sort(), regs.map(x => x.id).sort());
        certo(r.json.recusados.every(x => x.motivo === 'sem_permissao'));
      });
    }
    await teste(g, `${nome}: Hidrólise grava suas quatro folhas de insumos e chefe grava vinho`, async () => {
      const regs = ['ins_cal', 'ins_lphera', 'ins_saczyme', 'ins_alcolina'].map(pid => reg(pid));
      const r = await sync(hid, 'hidrolise', regs);
      igual(r.json.recusados, []); igual(r.json.aceitos, 4);
      const vinho = await c.api('/api/sync', { registros: [reg('med_dornas'), reg('fermentacao')] });
      igual(vinho.recusados, []); igual(vinho.aceitos, 2);
    });
    await teste(g, `${nome}: 12 tablets simultâneos preservam 120 linhas distintas após reinício`, async () => {
      // Aparelhos já pareados: o limite de seis pareamentos/minuto/IP não faz parte da carga de sync.
      const clientes = Array.from({ length: 12 }, (_, i) => clienteCifrado(c.url, `carga-${i}`, Cifra.chaveDoAparelho(c.chave(), `carga-${i}`)));
      const respostas = await Promise.all(clientes.map((cli, i) => sync(cli, 'caldeira', Array.from({ length: 10 }, (_, j) => {
        const chave = `carga-${i}-${j}`;
        return { ...reg('caldeira'), id: `${dia}|caldeira|${chave}`, chave, valores: { pressao: String(j) }, aparelho: cli.aparelho };
      }))));
      certo(respostas.every(r => r.status === 200 && r.json.aceitos === 10 && !r.json.recusados.length), 'envio recusado');
      await c.reiniciar();
      const dados = await c.api('/api/registros?desde=0');
      const linhas = dados.registros.filter(r => r.chave.startsWith('carga-'));
      igual(linhas.length, 120); igual(new Set(linhas.map(r => r.seq)).size, 120);
    });
    const chefe = await c.cliente();
    const novo = await conectarTeste(c.url, c.codigo(), 'novo-revisao');
    await teste(g, `${nome}: administrador não rebaixa o aparelho exclusivo do dono pela liberação`, async () => {
      await c.api('/api/pessoas', { acao: 'salvar', pessoa: { nome: 'Administrador', nivel: 'administrador', pin: '2222' } });
      igual((await novo.pedir('/api/chefes', { corpo: { acao: 'liberar', pin: SENHA_ENCARREGADO, nivel: 3 } })).status, 200);
      igual((await novo.pedir('/api/chefes', { corpo: { acao: 'liberar', pin: '2222', nivel: 2 } })).status, 403);
    });
    await teste(g, `${nome}: senha de administrador fixo em outro aparelho não libera este`, async () => {
      const lista = await c.api('/api/pessoas', { acao: 'lista' });
      const admin = lista.pessoas.find(p => p.nome === 'Administrador');
      igual((await c.api('/api/pessoas', { acao: 'salvar', pessoa: { ...admin, aparelhos: [chefe.aparelho] } })).pessoas.find(p => p.id === admin.id).aparelhos, [chefe.aparelho]);
      igual((await hid.pedir('/api/chefes', { corpo: { acao: 'liberar', pin: '2222' } })).status, 403);
    });
    await teste(g, `${nome}: recuperação do dono preso ao tablet perdido restaura as funções no novo`, async () => {
      const lista = await c.api('/api/pessoas', { acao: 'lista' });
      const dono = lista.pessoas.find(p => p.id === lista.donoId);
      await c.api('/api/pessoas', { acao: 'salvar', pessoa: { ...dono, aparelhos: [chefe.aparelho] } });
      igual((await novo.pedir('/api/chefes', { corpo: { acao: 'recuperar', senha: SENHA_PROGRAMADOR_TESTE } })).status, 200);
      const entrada = await novo.pedir('/api/pessoas', { corpo: { acao: 'entrar', pin: SENHA_ENCARREGADO } });
      igual(entrada.status, 200);
      certo(entrada.json.funcoes.includes('sistema') && entrada.json.funcoes.includes('pessoas'), 'recuperou sem poder administrar');
    });
  } finally { await c.desligar(); }
}
const r = resumo([g]);
console.log(`${r.passaram} de ${r.total} testes passaram`);
process.exitCode = r.falharam ? 1 : 0;
