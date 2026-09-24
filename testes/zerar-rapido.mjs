/* Pranchetas Digitais - © 2026 Guilherme. Confere o "zerar" direto na central (as duas), sem navegador. */
import fs from 'node:fs';
import path from 'node:path';
import { centralNode, centralJava, SENHA_PROGRAMADOR_TESTE } from './servidores.mjs';

for (const [nome, ligar, porta] of [['computador', centralNode, 8391], ['tablet chefe', centralJava, 8392]]) {
  const c = await ligar(porta);
  const pedir = async (rota, corpo) => (await fetch(c.url + rota, { method: corpo ? 'POST' : 'GET', headers: { 'X-Chave': c.chave(), 'Content-Type': 'application/json' }, body: corpo ? JSON.stringify(corpo) : undefined })).json();
  try {
    const reg = (id, data) => ({ id, data, prancheta: 'x', chave: '1', valores: { a: 1 }, atualizadoEm: Date.now() });
    const r1 = await pedir('/api/sync', { aparelho: 't', registros: [reg('2026-09-23|x|1', '2026-09-23'), reg('config|sistema|geral', 'config')] });
    const g0 = r1.geracao;
    const errada = await pedir('/api/zerar', { confirmar: 'ZERAR', senha: '11111111' });
    if (!errada.erro) throw new Error('apagou sem a senha do programador');
    const z = await pedir('/api/zerar', { confirmar: 'ZERAR', senha: SENHA_PROGRAMADOR_TESTE });
    const lista = (await pedir('/api/registros?desde=0')).registros;
    const antigo = await pedir('/api/sync', { aparelho: 't', geracao: g0, registros: [reg('2026-09-23|x|2', '2026-09-23')] });
    const depois = (await pedir('/api/registros?desde=0')).registros;
    const copia = fs.existsSync(path.join(c.pastaBackup, z.copia.split('/').pop()));
    const ok = z.ok && z.apagados === 1 && lista.length === 1 && lista[0].data === 'config' && antigo.zerar === true && depois.length === 1 && z.geracao !== g0 && copia;
    console.log(nome, ok ? 'ok' : 'FALHOU', JSON.stringify({ apagados: z.apagados, sobrou: lista.map((r) => r.data), recusouAntigo: antigo.zerar, copia }));
  } finally { await c.desligar(); }
}
