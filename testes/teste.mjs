/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Um jeito simples de escrever e contar os testes. */
import fs from 'node:fs';

/** Senha do encarregado, lida do forms.js (os testes não guardam a senha em outro lugar). */
export const SENHA_ENCARREGADO = (fs.readFileSync(new URL('../public/forms.js', import.meta.url), 'utf8').match(/pinAdmin:\s*'(\d+)'/) || [])[1];
/** Teclas para digitar a senha do encarregado e confirmar. */
export const teclasDaSenha = () => [...SENHA_ENCARREGADO.split(''), 'ok'];
/** Tablet chefe (versão 2.9): entra com a senha do administrador (a central nova cadastra o Guilherme com ela). */
export async function entrarComoChefe(a) {
  // tablet chefe novo (versão 2.12): a central pede para liberar; fica o nível 2 (já marcado) com a senha do dono
  await liberarSePedir(a);
  // a notificação ("Aparelho conectado") fica em cima do botão no alto: fecha antes de tocar
  await a.avaliar('(() => { const t = document.getElementById("toast"); if (t && !t.hidden) t.click(); })()');
  await new Promise((r) => setTimeout(r, 400));
  await a.tocar('[data-a="pessoa"]');
  await a.teclar(teclasDaSenha());
  await liberarSePedir(a);
  await a.esperar('!!(JSON.parse(localStorage.getItem("usina.cfg") || "{}").pessoa)', 10000, 'entrar no tablet chefe');
}
/** Se a tela "Liberar este aparelho como tablet chefe" abriu: continua com o nível marcado e digita a senha. */
export async function liberarSePedir(a, nivel) {
  try { await a.esperar('!!document.querySelector(".modal .opcoes-nivel")', 2500); } catch { return false; }
  if (nivel) await a.tocar(`.modal [data-k="n:${nivel}"]`);
  await a.tocar('.modal [data-k="ok"]');
  await a.teclar(teclasDaSenha());
  // espera a central responder (o nível fica guardado) e a janela fechar, para nada cair em cima do próximo toque
  await a.esperar('(() => { const c = JSON.parse(localStorage.getItem("usina.cfg") || "{}"); return !!c.nivelChefe && !document.querySelector(".modal"); })()', 10000, 'liberar o tablet chefe');
  await a.avaliar('(() => { const t = document.getElementById("toast"); if (t && !t.hidden) t.click(); })()');
  await new Promise((r) => setTimeout(r, 400));
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
