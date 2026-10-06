/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * Versão 2.11, direto na central (as duas: computador e tablet chefe):
 *   - cada aparelho manda o nome no Android, o fabricante, o modelo e a versão do Android; a central mostra com o endereço;
 *   - só o administrador bloqueia (e nunca o próprio aparelho); bloqueado, tudo que o aparelho pede volta 423;
 *   - "pede senha": a senha de desbloqueio libera (a errada não), e o aparelho consegue conferir a senha sozinho;
 *   - "trava de vez": só o administrador desbloqueia;
 */
import crypto from 'node:crypto';
import { teste, certo, igual, SENHA_ENCARREGADO } from './teste.mjs';
import { pastaTemporaria } from './servidores.mjs';
import { conectarTeste } from './cifra.mjs';

const diaProducao = () => { const d = new Date(Date.now() - 7 * 3600000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
/** A mesma conta da central (e do aplicativo) para a senha: sha256(sal:senha) e 20 mil voltas de HMAC. */
export function resumoDaSenha(pin, sal) {
  let h = crypto.createHash('sha256').update(sal + ':' + pin).digest();
  for (let i = 0; i < 20000; i++) h = crypto.createHmac('sha256', h).update(String(pin)).digest();
  return h.toString('hex');
}
export async function testarSeguranca(ligar, porta, grupo) {
  const c = await ligar(porta, pastaTemporaria('seguranca'), {});
  const p = async (cli, rota, corpo) => { const r = await cli.pedir(rota, corpo === undefined ? {} : { corpo }); return Object.assign({ status: r.status }, r.json || {}); };
  const sync = (cli, extra = {}) => p(cli, '/api/sync', Object.assign({ aparelho: cli.aparelho, papel: 'hidrolise', nome: 'Tablet da Hidrólise', versao: '2.11.0', registros: [] }, extra));
  const registro = async (adm) => (await p(adm, '/api/registro?dia=' + diaProducao())).registros.map((r) => r.valores.texto);
  try {
    const adm = await conectarTeste(c.url, c.codigo());
    const setor = await conectarTeste(c.url, c.codigo());
    igual((await p(adm, '/api/pessoas', { acao: 'entrar', pin: SENHA_ENCARREGADO })).status, 200, 'o administrador entra');
    await sync(adm, { papel: 'central', nome: 'Tablet chefe' });

    await teste(grupo, 'o aparelho manda nome, fabricante, modelo e Android; a central mostra com o endereço (e guarda)', async () => {
      const info = { nome: 'Galaxy Tab A11+ de Felipe', fabricante: 'samsung', modelo: 'SM-X230', android: '15', lixo: 'não guarda' };
      igual((await sync(setor, { info })).status, 200);
      const a = (await p(adm, '/api/status')).aparelhos.find((x) => x.id === setor.aparelho);
      certo(a && a.online, 'ligado');
      igual(JSON.stringify(a.info), JSON.stringify({ nome: 'Galaxy Tab A11+ de Felipe', fabricante: 'samsung', modelo: 'SM-X230', android: '15' }));
      igual(a.ip, '127.0.0.1');
      await c.reiniciar();
      const depois = (await p(adm, '/api/status')).aparelhos.find((x) => x.id === setor.aparelho);
      certo(depois && !depois.online && depois.info && depois.info.modelo === 'SM-X230' && depois.ip === '127.0.0.1', 'depois de religar a central: ' + JSON.stringify(depois));
    });

    await teste(grupo, 'só o administrador bloqueia, nunca o próprio aparelho, e a senha de desbloqueio tem de 4 a 8 números', async () => {
      igual((await p(setor, '/api/aparelhos', { acao: 'bloquear', id: adm.aparelho, modo: 'trava' })).status, 403);
      igual((await p(adm, '/api/aparelhos', { acao: 'bloquear', id: adm.aparelho, modo: 'trava' })).status, 400);
      igual((await p(adm, '/api/aparelhos', { acao: 'bloquear', id: setor.aparelho, modo: 'senha', codigo: '12' })).status, 400);
      igual((await p(adm, '/api/aparelhos', { acao: 'bloquear', id: 'nao-existe', modo: 'trava' })).status, 404);
      igual((await sync(setor)).status, 200, 'nada bloqueado ainda');
    });

    let bloqueio, geracao;
    await teste(grupo, 'bloqueado com senha: tudo que ele pede volta 423, e ele consegue conferir a senha sozinho', async () => {
      const r = await p(adm, '/api/aparelhos', { acao: 'bloquear', id: setor.aparelho, modo: 'senha', apagar: true, codigo: '4321' });
      igual(r.status, 200);
      const s = await sync(setor);
      igual(s.status, 423);
      bloqueio = s.bloqueio; geracao = s.geracao;
      certo(geracao && geracao.length > 3, 'o 423 diz de qual central é o bloqueio (geração)');
      certo(bloqueio && bloqueio.modo === 'senha' && bloqueio.apagar === true && bloqueio.em > 0, JSON.stringify(bloqueio));
      igual(resumoDaSenha('4321', bloqueio.sal), bloqueio.resumo, 'a conta da senha bate com a do aplicativo');
      igual((await p(setor, '/api/registros?desde=0')).status, 423, 'nem as anotações ele recebe');
      const a = (await p(adm, '/api/status')).aparelhos.find((x) => x.id === setor.aparelho);
      certo(a.bloqueio && a.bloqueio.modo === 'senha' && !('resumo' in a.bloqueio), 'a lista mostra bloqueado, sem a senha: ' + JSON.stringify(a.bloqueio));
      certo((await registro(adm)).some((t) => /Guilherme bloqueou o Tablet da Hidrólise \(pede a senha de desbloqueio, apagando as anotações guardadas nele\)/.test(t)), 'no registro');
    });

    await teste(grupo, 'a senha errada não libera; a certa libera e fica no registro', async () => {
      igual((await p(setor, '/api/liberar', { codigo: '0000', em: bloqueio.em, rev: bloqueio.rev, geracao })).status, 403);
      igual((await p(setor, '/api/liberar', { codigo: '4321', em: bloqueio.em, rev: bloqueio.rev, geracao: 'outra-central' })).status, 423, 'liberação de outra central (geração) não vale');
      igual((await p(setor, '/api/liberar', { codigo: '4321', em: bloqueio.em, rev: bloqueio.rev, geracao })).status, 200);
      igual((await sync(setor)).status, 200);
      certo((await registro(adm)).some((t) => /Tablet da Hidrólise foi liberado com a senha de desbloqueio/.test(t)), 'no registro');
    });

    await teste(grupo, 'trava de vez: senha nenhuma libera; o administrador desbloqueia', async () => {
      igual((await p(adm, '/api/aparelhos', { acao: 'bloquear', id: setor.aparelho, modo: 'trava' })).status, 200);
      const s = await sync(setor);
      igual(s.status, 423);
      igual(s.bloqueio.modo, 'trava');
      igual((await p(setor, '/api/liberar', { codigo: '4321' })).status, 423);
      const r = await p(adm, '/api/aparelhos', { acao: 'desbloquear', id: setor.aparelho });
      igual(r.status, 200);
      certo(r.aparelhos.every((x) => !x.bloqueio), 'ninguém bloqueado');
      igual((await sync(setor)).status, 200);
      certo((await registro(adm)).some((t) => /Guilherme desbloqueou o Tablet da Hidrólise/.test(t)), 'no registro');
    });

    // revisão do Codex (06/10/2026): a liberação feita longe da usina vale só para aquele bloqueio
    await teste(grupo, 'liberação de um bloqueio antigo não tira o bloqueio novo, mesmo com a mesma senha', async () => {
      igual((await p(adm, '/api/aparelhos', { acao: 'bloquear', id: setor.aparelho, modo: 'senha', codigo: '5555' })).status, 200);
      const antigo = (await sync(setor)).bloqueio;
      igual((await p(adm, '/api/aparelhos', { acao: 'desbloquear', id: setor.aparelho })).status, 200);
      // sem esperar: os dois bloqueios podem ter a mesma hora, mas a revisão (número da central que só sobe) é diferente
      igual((await p(adm, '/api/aparelhos', { acao: 'bloquear', id: setor.aparelho, modo: 'senha', apagar: true, codigo: '5555' })).status, 200);
      const velha = await p(setor, '/api/liberar', { codigo: '5555', em: antigo.em, rev: antigo.rev, geracao });
      igual(velha.status, 423, 'a senha do bloqueio antigo');
      certo(velha.bloqueio && velha.bloqueio.rev > antigo.rev && velha.bloqueio.apagar === true, 'volta o bloqueio novo: ' + JSON.stringify(velha.bloqueio));
      igual((await sync(setor)).status, 423, 'continua bloqueado');
      igual(velha.geracao, geracao, 'o 423 da liberação também diz a geração');
      igual((await p(setor, '/api/liberar', { codigo: '5555', em: velha.bloqueio.em, rev: velha.bloqueio.rev, geracao })).status, 200, 'a senha do bloqueio novo libera');
      igual((await sync(setor)).status, 200);
    });

  } finally {
    await c.desligar();
  }
}
