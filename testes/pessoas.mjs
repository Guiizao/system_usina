/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * Versão 2.9: pessoas do escritório, permissões e registro do sistema, nas duas centrais.
 *   - cada pessoa entra no tablet chefe com a sua senha (só a senha diz quem é); a central nova já tem o Guilherme;
 *   - níveis (Administrador, Encarregado, Consulta), ajuste por pessoa e o que cada tablet chefe deixa fazer;
 *   - só o administrador cadastra pessoas; senha repetida, último administrador e pessoa desativada são recusados;
 *   - o registro guarda entradas, anotações com o antes e o depois, aparelhos (novo, sem sinal) e configurações;
 *   - o registro não vai para os tablets dos setores, nem para a API.
 */
import { TAMANHOS, dormir } from './navegador.mjs';
import { teste, certo, igual, teclasDaSenha, entrarComoChefe } from './teste.mjs';
import { pastaTemporaria } from './servidores.mjs';
import { conectarTeste } from './cifra.mjs';

const diaProducao = () => { const d = new Date(Date.now() - 7 * 3600000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const FERNANDO = '789456', LUCAS = '456123';

export async function testarPessoas(nav, ligar, porta, grupo) {
  const c = await ligar(porta, pastaTemporaria('pessoas'), { REGISTRO_SEM_SINAL_MS: '6000' });
  const aparelhos = [];
  async function novo(nome, tamanho) { const a = await nav.novoAparelho(nome, tamanho); aparelhos.push(a); return a; }
  async function conectar(a, papel, operador) {
    await a.ir(c.url + '/', 'document.querySelector("[data-quadro=\\"codigo\\"]")');
    await a.tocar('[data-quadro="codigo"]');
    await a.teclar(c.codigo().split(''));
    await a.tocar('[data-ed="ocultar"]');
    await a.tocar('[data-a="conectar"]');
    await a.tocar(`[data-a="papel"][data-id="${papel}"]`, null, { esperarMs: 15000 });
    if (papel === 'central') await entrarComoChefe(a);
    if (operador) await a.tocar(`[data-a="escolher-operador"][data-nome="${operador}"]`);
  }
  const semNotificacao = async (a) => { await a.avaliar('(() => { const t = document.getElementById("toast"); if (!t.hidden) t.click(); })()'); await dormir(350); };
  const texto = (a, sel) => a.avaliar(`(document.querySelector(${JSON.stringify(sel)}) || {}).textContent || ''`);
  const digitar = (a, pin) => a.teclar([...pin.split(''), 'ok']);
  const registro = async () => (await c.api('/api/registro?dia=' + diaProducao())).registros.map((r) => r.valores);
  const esperarRegistro = async (achar, descricao, ms = 20000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { const l = await registro(); const r = l.find(achar); if (r) return r; await dormir(600); }
    throw new Error('não apareceu no registro: ' + descricao + ' | ' + (await registro()).map((x) => x.texto).join(' / '));
  };

  try {
    // versão 2.12: tablet chefe novo é liberado com a senha (nível 2) antes de alguém entrar nele
    const liberar = (cli) => cli.pedir('/api/chefes', { corpo: { acao: 'liberar', pin: teclasDaSenha().slice(0, -1).join(''), nivel: 2 } });
    const adm = await conectarTeste(c.url, c.codigo());
    const outro = await conectarTeste(c.url, c.codigo());
    await liberar(adm); await liberar(outro);
    const p = async (cli, corpo) => { const r = await cli.pedir('/api/pessoas', { corpo }); return { status: r.status, ...r.json }; };

    await teste(grupo, 'a central nova já tem o administrador: Guilherme, com a senha de sempre', async () => {
      const r = await p(adm, { acao: 'entrar', pin: teclasDaSenha().slice(0, -1).join('') });
      igual(r.status, 200); igual(r.pessoa.nome, 'Guilherme'); igual(r.pessoa.nivel, 'administrador');
    });
    await teste(grupo, 'só o administrador cadastra; senha repetida e o último administrador são recusados', async () => {
      igual((await p(adm, { acao: 'salvar', pessoa: { nome: 'Fernando', nivel: 'encarregado', pin: FERNANDO } })).status, 200);
      igual((await p(adm, { acao: 'salvar', pessoa: { nome: 'Lucas', nivel: 'consulta', pin: FERNANDO } })).erro, 'Essa senha já é de outra pessoa. Escolha outra.');
      igual((await p(adm, { acao: 'salvar', pessoa: { nome: 'Lucas', nivel: 'consulta', pin: LUCAS } })).status, 200);
      const f = await p(outro, { acao: 'entrar', pin: FERNANDO });
      igual(f.pessoa.nome, 'Fernando');
      igual((await p(outro, { acao: 'lista' })).status, 403, 'Encarregado não pode mexer nas pessoas');
      const lista = (await p(adm, { acao: 'lista' })).pessoas;
      const gui = lista.find((x) => x.nome === 'Guilherme');
      certo(lista.every((x) => !('resumo' in x) && !('sal' in x)), 'a senha (nem o resumo dela) não pode sair da central');
      // versão 2.12: o Guilherme é o dono do sistema e continua administrador (a regra do último administrador continua para os outros)
      igual((await p(adm, { acao: 'salvar', pessoa: { id: gui.id, nome: 'Guilherme', nivel: 'consulta' } })).erro, 'O dono do sistema continua administrador e ativo');
    });
    await teste(grupo, 'pessoa desativada não entra; senha errada 5 vezes faz esperar um minuto', async () => {
      const lucas = (await p(adm, { acao: 'lista' })).pessoas.find((x) => x.nome === 'Lucas');
      await p(adm, { acao: 'salvar', pessoa: { id: lucas.id, nome: 'Lucas', nivel: 'consulta', ativo: false } });
      const terceiro = await conectarTeste(c.url, c.codigo());
      await liberar(terceiro);
      igual((await p(terceiro, { acao: 'entrar', pin: LUCAS })).status, 403, 'desativado');
      for (let i = 0; i < 4; i++) await p(terceiro, { acao: 'entrar', pin: '000000' });
      igual((await p(terceiro, { acao: 'entrar', pin: FERNANDO })).status, 429, 'depois de 5 erradas, espera');
      await p(adm, { acao: 'salvar', pessoa: { id: lucas.id, nome: 'Lucas', nivel: 'consulta', ativo: true } });
    });

    // ---------- no aplicativo ----------
    const chefe = await novo('tablet chefe', TAMANHOS.tablet);
    const hid = await novo('tablet da Hidrólise', TAMANHOS.tablet);
    await teste(grupo, 'tablet chefe: entra com a senha e o nome fica no alto', async () => {
      await conectar(chefe, 'central');
      certo((await texto(chefe, '[data-a="pessoa"]')).includes('Guilherme'), 'nome no alto');
    });
    await teste(grupo, 'Consulta (Lucas) não abre a Usina; Encarregado (Fernando) abre', async () => {
      await semNotificacao(chefe);
      await chefe.tocar('[data-a="pessoa"]'); await chefe.tocar('[data-k="sair"]');
      await chefe.tocar('[data-a="config"]');
      await chefe.esperar('!!document.querySelector(".modal .visor")', 5000, 'pede a senha');
      await digitar(chefe, LUCAS);
      await chefe.esperar('document.getElementById("toast").textContent.includes("Lucas não pode")', 8000, 'Lucas recusado');
      certo(!(await chefe.avaliar('!!document.querySelector("main.config")')), 'não podia ter aberto a Usina');
      await semNotificacao(chefe);
      await chefe.tocar('[data-a="pessoa"]'); await chefe.tocar('[data-k="sair"]');
      await chefe.tocar('[data-a="config"]');
      await digitar(chefe, FERNANDO);
      await chefe.esperar('!!document.querySelector("main.config")', 8000, 'Fernando abriu a Usina');
      await chefe.tocar('[data-a="voltar"]');
    });
    await teste(grupo, 'o que este tablet chefe deixa fazer vale para todos, menos para o administrador', async () => {
      const id = await chefe.avaliar('JSON.parse(localStorage.getItem("usina.cfg")).deviceId');
      igual((await p(adm, { acao: 'aparelho', id, nome: 'Tablet do escritório', teto: ['relatorios'] })).aparelhos[id].nome, 'Tablet do escritório');
      await semNotificacao(chefe);
      await chefe.tocar('[data-a="pessoa"]'); await chefe.tocar('[data-k="sair"]');
      await chefe.tocar('[data-a="config"]');
      await digitar(chefe, FERNANDO);
      await chefe.esperar('document.getElementById("toast").textContent.includes("Fernando não pode")', 8000, 'Fernando barrado neste aparelho');
      await semNotificacao(chefe);
      await chefe.tocar('[data-a="pessoa"]'); await chefe.tocar('[data-k="sair"]');
      await entrarComoChefe(chefe);
      await chefe.tocar('[data-a="config"]');
      await chefe.esperar('!!document.querySelector("main.config")', 8000, 'o administrador pode tudo');
      await chefe.tocar('[data-a="voltar"]');
      await p(adm, { acao: 'aparelho', id, teto: null });
    });
    await teste(grupo, 'tablet do setor: os ajustes abrem com a senha de quem pode (Fernando), não com a de Consulta', async () => {
      await conectar(hid, 'hidrolise', 'Felipe');
      await semNotificacao(hid);
      await hid.tocar('[data-a="admin"]'); await digitar(hid, LUCAS);
      await hid.esperar('document.getElementById("toast").textContent.includes("Lucas não pode")', 8000, 'Lucas recusado');
      await semNotificacao(hid);
      await hid.tocar('[data-a="admin"]'); await digitar(hid, FERNANDO);
      await hid.esperar('!!document.querySelector("main.config")', 8000, 'ajustes abertos');
      await hid.tocar('[data-a="voltar"]');
    });
    await teste(grupo, 'registro: quem anotou e quem corrigiu, com o antes e o depois', async () => {
      await hid.tocar('[data-a="abrir-prancheta"][data-id="hid_anexo1"]');
      await hid.tocar('[data-quadro="brix"]'); await hid.teclar(['1', '8']);
      await hid.tocar('[data-ed="ocultar"]');
      await hid.tocar('[data-a="salvar"]');
      const anotou = await esperarRegistro((x) => x.tipo === 'anotacao' && /Felipe anotou Hidrólise/.test(x.texto), 'Felipe anotou');
      certo((anotou.mudancas || []).some((m) => m.campo === 'Brix' && m.depois === '18'), 'Brix 18: ' + JSON.stringify(anotou.mudancas));
      await semNotificacao(chefe);
      await chefe.tocar('[data-a="abrir-setor"][data-id="hidrolise"]');
      // espera a anotação do Felipe chegar no tablet chefe (antes disso a Nº 1 é só o botão de dorna nova)
      await chefe.esperar('!!document.querySelector(".seletor:not(.seletor-nova) [data-a=\\"linha\\"][data-chave=\\"1\\"]")', 15000, 'dorna 1 no chefe');
      await chefe.tocar('[data-a="linha"][data-chave="1"]');
      await chefe.tocar('[data-quadro="brix"]'); await chefe.tocar('[data-ed="limpar"]'); await chefe.teclar(['1', '9']);
      await chefe.tocar('[data-ed="ocultar"]');
      await chefe.tocar('[data-a="salvar"]');
      const mudou = await esperarRegistro((x) => x.tipo === 'anotacao' && /Guilherme mudou Hidrólise/.test(x.texto), 'Guilherme corrigiu');
      certo((mudou.mudancas || []).some((m) => m.campo === 'Brix' && m.antes === '18' && m.depois === '19'), 'Brix 18 -> 19: ' + JSON.stringify(mudou.mudancas));
      igual(mudou.aparelho, 'Painel do escritório');
      await esperarRegistro((x) => x.tipo === 'entrada' && /Felipe entrou no Tablet da Hidrólise/.test(x.texto), 'Felipe entrou');
      await esperarRegistro((x) => x.tipo === 'entrada' && /Fernando entrou/.test(x.texto), 'Fernando entrou');
      await esperarRegistro((x) => x.tipo === 'entrada' && /Senha errada/.test(x.texto), 'senha errada');
      await esperarRegistro((x) => x.tipo === 'aparelho' && /conectou na central pela primeira vez/.test(x.texto), 'aparelho novo');
      await esperarRegistro((x) => x.tipo === 'configuracao' && /Guilherme cadastrou Fernando \(Encarregado\)/.test(x.texto), 'pessoa cadastrada');
      await chefe.tocar('[data-a="painel"]');
    });
    await teste(grupo, 'o registro não fica nos tablets e não sai pela sincronização', async () => {
      const sinc = await c.api('/api/registros?desde=0');
      igual(sinc.registros.filter((r) => r.prancheta === 'registro').length, 0);
      await dormir(6500); // a próxima sincronização e a limpeza da memória do tablet
      igual(await hid.avaliar('Object.values(JSON.parse(localStorage.getItem("usina.registros") || "{}")).filter((r) => r.prancheta === "registro" && r.sincronizado).length'), 0);
    });
    await teste(grupo, 'tela do registro: o dia com quem fez o quê, e o filtro', async () => {
      await semNotificacao(chefe);
      await chefe.tocar('[data-a="pessoa"]'); await chefe.tocar('[data-k="registro"]');
      await chefe.esperar('document.querySelectorAll(".reg-linha").length > 3', 10000, 'linhas do registro');
      const tudo = await texto(chefe, '.lista-registro');
      certo(tudo.includes('Guilherme mudou Hidrólise') && tudo.includes('19'), 'correção na tela');
      await chefe.tocar('[data-a="registro-tipo"][data-tipo="entrada"]');
      certo(await chefe.avaliar('[...document.querySelectorAll(".reg-linha")].every((l) => l.classList.contains("reg-entrada"))'), 'só entradas');
      await chefe.tocar('[data-a="voltar"]');
    });
    await teste(grupo, 'tela de pessoas: o administrador cadastra pelo tablet chefe', async () => {
      await semNotificacao(chefe);
      await chefe.tocar('[data-a="pessoa"]'); await chefe.tocar('[data-k="pessoas"]');
      await chefe.esperar('document.body.innerText.includes("Fernando")', 10000, 'lista de pessoas');
      await chefe.tocar('[data-a="pessoa-nova"]');
      await chefe.avaliar('(() => { document.getElementById("p-nome").value = "Bruno"; document.getElementById("p-pin").value = "246810"; return true; })()');
      await chefe.tocar('[data-k="n:consulta"]');
      await chefe.tocar('.modal [data-k="ok"]');
      await chefe.esperar('!document.querySelector(".modal") && document.body.innerText.includes("Bruno")', 10000, 'Bruno cadastrado');
      igual((await p(outro, { acao: 'entrar', pin: '246810' })).pessoa.nome, 'Bruno');
    });
    await teste(grupo, 'aparelho que para de falar com a central vai para o registro', async () => {
      await hid.fechar();
      aparelhos.splice(aparelhos.indexOf(hid), 1);
      await esperarRegistro((x) => x.tipo === 'aparelho' && /Tablet da Hidrólise ficou sem sinal/.test(x.texto), 'sem sinal', 30000);
    });
    await teste(grupo, 'nenhum erro de JavaScript', async () => {
      const erros = aparelhos.flatMap((a) => a.erros.map((e) => `${a.nome}: ${e}`));
      certo(!erros.length, erros.join(' | ').slice(0, 500));
    });
  } finally {
    await Promise.all(aparelhos.map((a) => a.fechar()));
    await c.desligar();
  }
}
