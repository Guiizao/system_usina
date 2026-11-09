/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Um jeito simples de escrever e contar os testes. */

/** Senha fictícia do dono já configurado nas centrais de teste; não vem do pacote público. */
export const SENHA_ENCARREGADO = '271828';
/** Teclas para digitar a senha do encarregado e confirmar. */
export const teclasDaSenha = () => [...SENHA_ENCARREGADO.split(''), 'ok'];
/** Tablet chefe (versão 2.9): entra com a senha do administrador (a central nova cadastra o Guilherme com ela). */
export async function entrarComoChefe(a) {
  // a notificação ("Aparelho conectado") fica em cima do botão no alto: fecha antes de tocar
  await a.avaliar('(() => { const t = document.getElementById("toast"); if (t && !t.hidden) t.click(); })()');
  await new Promise((r) => setTimeout(r, 400));
  await a.tocar('[data-a="pessoa"]');
  await a.teclar(teclasDaSenha());
  await a.esperar('!!(JSON.parse(localStorage.getItem("usina.cfg") || "{}").pessoa)', 10000, 'entrar no tablet chefe');
}
/** 3.0: escolher "Tablet chefe" não abre janela (quem pode liberar entra direto, no nível 2). Outro nível, o teste pede à central como o administrador faria. */
export async function liberarSePedir(a, nivel) {
  if (!nivel || nivel === 2) return false;
  await a.avaliar(`postJson('api/chefes', { acao: 'liberar', pin: ${JSON.stringify(SENHA_ENCARREGADO)}, nivel: ${nivel} }).then((r) => r.json()).then((d) => { cfg.nivelChefe = d.nivel; salvarCfg(); return d.nivel; })`);
  await a.esperar(`Number(JSON.parse(localStorage.getItem("usina.cfg") || "{}").nivelChefe) === ${nivel}`, 10000, 'liberar o tablet chefe');
  return true;
}
/** Digita a senha só se ela for pedida (quem já entrou no tablet chefe com permissão não precisa de novo). */
export async function senhaSeAparecer(a) {
  try { await a.esperar('!!document.querySelector(".modal .visor")', 1500); } catch { return; }
  await a.teclar(teclasDaSenha());
}
export function novoGrupo(titulo) { console.log(`\n== ${titulo}`); return { titulo, resultados: [] }; }

export async function teste(grupo, nome, fn) {
  const t0 = Date.now();
  try {
    const obs = await fn();
    grupo.resultados.push({ nome, ok: true, ms: Date.now() - t0, obs: obs || '' });
    console.log(`  ok      ${nome}${obs ? '  (' + obs + ')' : ''}`);
  } catch (e) {
    grupo.resultados.push({ nome, ok: false, ms: Date.now() - t0, erro: e.message });
    console.log(`  FALHOU  ${nome}: ${e.message}`);
  }
}

export function certo(condicao, mensagem) { if (!condicao) throw new Error(mensagem); }
export function igual(veio, esperado, mensagem = '') {
  if (JSON.stringify(veio) !== JSON.stringify(esperado)) throw new Error(`${mensagem} esperava ${JSON.stringify(esperado)}, veio ${JSON.stringify(veio)}`);
}
export const resumo = (grupos) => {
  const todos = grupos.flatMap((g) => g.resultados);
  return { total: todos.length, passaram: todos.filter((r) => r.ok).length, falharam: todos.filter((r) => !r.ok).length };
};

// 2.16: o public foi dividido em pastas
import { createRequire as criarRequire216 } from 'node:module';
import { fileURLToPath as caminhoDoUrl216 } from 'node:url';
const { carregarUsina } = criarRequire216(import.meta.url)('../carregar-usina.js');
const PUBLICO216 = new URL('../public/', import.meta.url);
/** Roda no contexto a configuração da usina como o aplicativo (config/forms.js e as folhas de cada setor). */
export const usinaNoContexto = (ctx) => carregarUsina(caminhoDoUrl216(PUBLICO216), ctx);
const NOVOS216 = { 'forms.js': 'config/forms.js', 'folhas.js': 'config/folhas.js', 'novidades.js': 'config/novidades.js' };
/** Onde ficou cada arquivo que era solto no public (as bibliotecas foram para bibliotecas/). */
export const caminhoNovo = (nome) => NOVOS216[nome] || (/^(rastreamento|xlsx|modelos|pdf|leitor|qrcode|cifra)\.js$/.test(nome) ? 'bibliotecas/' + nome : nome);
