/* Pranchetas Digitais - © 2026 Guilherme. Confere o "zerar" direto na central (as duas), sem navegador. */
import fs from 'node:fs';
import path from 'node:path';
import { centralNode, centralJava, SENHA_PROGRAMADOR_TESTE } from './servidores.mjs';
import { novoGrupo, teste, igual, certo, resumo } from './teste.mjs';

const grupo = novoGrupo('Zerar com cópia nas duas centrais');
for (const [nome, ligar, porta] of [['computador', centralNode, 8391], ['tablet chefe', centralJava, 8392]]) {
  await teste(grupo, nome + ': senha, cópia, configuração preservada e geração zerada', async () => {
    const c = await ligar(porta);
    const pedir = (rota, corpo) => c.api(rota, corpo);
    try {
      const hoje = new Date();
      const dia = [hoje.getFullYear(), hoje.getMonth() + 1, hoje.getDate()].map((n) => String(n).padStart(2, '0')).join('-');
      const reg = (chave) => ({ id: `${dia}|caldeira|${chave}`, data: dia, prancheta: 'caldeira', chave, valores: { pressao: '6' }, atualizadoEm: Date.now() });
      const config = { id: 'config|sistema|geral', data: 'config', prancheta: 'sistema', chave: 'geral', base: 0, valores: { operadores: { caldeira: ['Teste'] } }, atualizadoEm: Date.now() };
      const r1 = await pedir('/api/sync', { aparelho: 't', registros: [reg('1'), config] });
      igual(r1.aceitos, 2, 'anotação e configuração válidas'); igual(r1.recusados, []);
      const antes = (await pedir('/api/registros?desde=0')).registros;
      const errada = await pedir('/api/zerar', { confirmar: 'ZERAR', senha: '11111111' });
      certo(errada.erro && !errada.ok, 'apagou sem a senha do programador');
      igual((await pedir('/api/registros?desde=0')).registros, antes, 'senha errada preserva os dados');
      const totalAntes = (await pedir('/api/status')).total;
      const z = await pedir('/api/zerar', { confirmar: 'ZERAR', senha: SENHA_PROGRAMADOR_TESTE });
      certo(z.ok && z.geracao !== r1.geracao, 'zerar não mudou a geração');
      igual(z.apagados, totalAntes - 1, 'apaga todas as anotações e o histórico, preservando a configuração');
      const copia = JSON.parse(fs.readFileSync(path.join(c.pastaBackup, path.basename(z.copia)), 'utf8'));
      igual(copia.length, totalAntes, 'a cópia contém tudo que havia antes de zerar');
      for (const r of antes) igual(copia.find((x) => x.id === r.id), r, 'cópia integral de ' + r.id);
      const mantidos = antes.filter((r) => r.data === 'config');
      igual((await pedir('/api/registros?desde=0')).registros, mantidos, 'configuração preservada');
      const antigo = await pedir('/api/sync', { aparelho: 't', geracao: r1.geracao, registros: [reg('2')] });
      igual(antigo.zerar, true); igual(antigo.zerada, true); igual(antigo.geracao, z.geracao);
      igual((await pedir('/api/registros?desde=0')).registros, mantidos, 'geração zerada não ressuscita dados');
    } finally { await c.desligar(); }
  });
}
const resultado = resumo([grupo]);
console.log(`${resultado.passaram} de ${resultado.total} testes passaram; ${resultado.falharam} falharam`);
process.exitCode = resultado.falharam ? 1 : 0;
