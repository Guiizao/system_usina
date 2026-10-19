/* Escritório 2.13: o mesmo contrato nas centrais Node e Android. */
import crypto from 'node:crypto';
import { teste, certo, igual, SENHA_ENCARREGADO } from './teste.mjs';
import { pastaTemporaria } from './servidores.mjs';
import { conectarTeste } from './cifra.mjs';

export async function testarEscritorio(ligar, porta, grupo) {
  const c = await ligar(porta, pastaTemporaria('escritorio213'));
  const pedir = async (cli, rota, corpo) => (await cli.pedir(rota, { corpo })).json;
  const hoje = new Date(Date.now() - 7 * 3600000).toISOString().slice(0, 10);
  let numero = 0;
  const anotacao = (data = hoje) => { const chave = String(++numero); return { id: `${data}|rastreamento|${chave}`, data, prancheta: 'rastreamento', chave, valores: { lote: 'L123' }, atualizadoEm: Date.now() }; };
  const sync = (cli, registros, extra = {}) => pedir(cli, '/api/sync', { aparelho: cli.aparelho, papel: 'escritorio', registros, ...extra });
  try {
    const adm = await c.cliente();
    const setor = await conectarTeste(c.url, c.codigo());
    const consulta = await conectarTeste(c.url, c.codigo());
    const chefe = await conectarTeste(c.url, c.codigo());
    await c.api('/api/pessoas', { acao: 'salvar', pessoa: { nome: 'Consulta', nivel: 'consulta', pin: '3333' } });
    await c.api('/api/pessoas', { acao: 'salvar', pessoa: { nome: 'Escritório', nivel: 'consulta', extras: { escritorio: true }, pin: '4444' } });

    await teste(grupo, 'setor sem senha recusa rastreamento; papel e operador não concedem permissão', async () => {
      const r = await sync(setor, [anotacao()], { operador: 'Guilherme' });
      igual(r.aceitos, 0); igual(r.recusados[0].motivo, 'sem_permissao');
      igual(r.nuvemToken, '', 'sem nuvem, não emite token');
    });
    await teste(grupo, 'verificar com a função Escritório libera o setor, inclusive folha arquivada', async () => {
      const p = await pedir(setor, '/api/pessoas', { acao: 'verificar', pin: '4444' });
      certo(p.funcoes.includes('escritorio'), JSON.stringify(p));
      const r = await sync(setor, [anotacao(), anotacao('2020-01-01')]);
      igual(r.aceitos, 2); igual(r.recusados.length, 0);
    });
    await teste(grupo, 'Consulta não anota rastreamento no setor nem no tablet chefe', async () => {
      await pedir(setor, '/api/pessoas', { acao: 'verificar', pin: '3333' });
      igual((await sync(setor, [anotacao()])).recusados[0].motivo, 'sem_permissao');
      await pedir(consulta, '/api/chefes', { acao: 'liberar', pin: SENHA_ENCARREGADO, nivel: 2 });
      await pedir(consulta, '/api/pessoas', { acao: 'entrar', pin: '3333' });
      igual((await sync(consulta, [anotacao()])).recusados[0].motivo, 'sem_permissao');
    });
    await teste(grupo, 'tablet chefe precisa de sessão com Escritório; o nível 1 também faz o Escritório (2.15)', async () => {
      await pedir(chefe, '/api/chefes', { acao: 'liberar', pin: SENHA_ENCARREGADO, nivel: 2 });
      igual((await sync(chefe, [anotacao()])).recusados[0].motivo, 'sem_permissao');
      await pedir(chefe, '/api/pessoas', { acao: 'entrar', pin: '4444' });
      igual((await sync(chefe, [anotacao()])).aceitos, 1);
      igual((await sync(adm, [anotacao()])).aceitos, 1);
      const n1 = await conectarTeste(c.url, c.codigo());
      await pedir(n1, '/api/chefes', { acao: 'liberar', pin: SENHA_ENCARREGADO, nivel: 1 });
      await pedir(n1, '/api/pessoas', { acao: 'entrar', pin: SENHA_ENCARREGADO });
      // 2.15: o escritório virou parte do tablet chefe; o nível 1 tem a função Escritório (o dono pode tirar)
      igual((await sync(n1, [anotacao()])).aceitos, 1);
    });
    await teste(grupo, 'nome padrão do papel escritorio é Escritório', async () => {
      const lista = await c.api('/api/status');
      const a = lista.aparelhos.find((x) => x.id === setor.aparelho);
      igual(a.nome, 'Escritório');
    });
    await teste(grupo, 'token HMAC pertence ao aparelho autenticado, nunca ao id declarado no corpo', async () => {
      const segredo = 'segredo-ficticio-escritorio213';
      await c.api('/api/nuvem', { acao: 'configurar', url: 'http://127.0.0.1:1', segredo });
      const r = await sync(setor, [], { aparelho: 'id-de-outro' });
      igual(r.nuvemToken, crypto.createHmac('sha256', segredo).update('aparelho|' + setor.aparelho).digest('hex'));
      igual(r.nuvem, 'http://127.0.0.1:1');
      await c.api('/api/nuvem', { acao: 'configurar', url: '' });
    });
  } finally { await c.desligar(); }
}
