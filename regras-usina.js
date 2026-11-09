/* Pranchetas Digitais - (c) 2026 Guilherme. Regras de quem pode o quê: usadas pela central do computador e pelo banco (nuvem).
 * A central do tablet chefe (ServidorCentral.java) tem a mesma regra escrita em Java. */
'use strict';

function juntarLinhas(a, b) {
  const [velho, novo] = b.atualizadoEm >= a.atualizadoEm ? [a, b] : [b, a];
  const valores = Object.assign({}, velho.valores);
  Object.entries(novo.valores || {}).forEach(([k, x]) => { if (x !== '' && x != null) valores[k] = x; });
  const junta = Object.assign({}, velho, novo, {
    valores, operador: novo.operador || velho.operador,
    criadoEm: Math.min(a.criadoEm, b.criadoEm), atualizadoEm: Math.max(a.atualizadoEm, b.atualizadoEm) + 1,
  });
  delete junta.camposEm; // a mescla legada não tem horário por campo confiável
  return junta;
}
// só entre aparelhos diferentes: o mesmo aparelho mudando a própria linha vale a versão mais nova, como sempre
const criadasSemSaber = (atual, r) => !!(atual && !atual.apagado && !r.apagado && atual.valores && r.valores
  && r.aparelho && atual.aparelho && r.aparelho !== atual.aparelho
  && r.criadoEm && atual.criadoEm && r.criadoEm !== atual.criadoEm);

/** fontes: config() (pessoas, níveis, sessões...), sistema() (a anotação config|sistema|geral), forms(), liberados() e salvar(). */
function criar(fontes) {
const pessoaDoAparelho = (id) => { const s = fontes.config().sessoes[id]; return s ? fontes.config().pessoas.find((p) => p.id === s.pessoaId && p.ativo !== false && !p.pedeTrocarSenha) || null : null; };
const tetoDoAparelho = (id) => { const a = fontes.config().aparelhosChefe[id]; return a && Array.isArray(a.teto) ? a.teto : null; };
const FUNCOES_PADRAO = ['anotar', 'corrigir', 'avisos', 'relatorios', 'ler_folha', 'usina', 'folhas', 'conexao', 'integracoes', 'ajustes', 'registro', 'chefes', 'escritorio', 'trocar_funcao'];
const FUNCOES_DO_NIVEL_1 = ['corrigir', 'relatorios', 'escritorio'];
const funcoesDoForms = () => { try { return [...new Set([...fontes.forms().funcoes.map((f) => f.id), 'assistente'])]; } catch (e) { return [...FUNCOES_PADRAO, 'assistente']; } };
const niveisDoForms = () => { try { return fontes.forms().niveis || {}; } catch (e) { return {}; } };

const nivelDoAparelho = (id) => { const a = fontes.config().aparelhosChefe[id]; return a && [1, 2, 3].includes(a.nivel) ? a.nivel : 0; };
const ehDono = (p) => !!p && !!fontes.config().donoId && p.id === fontes.config().donoId;
/** As funções da pessoa, sem olhar o aparelho. 'sistema' e 'pessoas' não se dão por ajuste. */
function funcoesDaPessoa(p) {
  if (!p) return new Set();
  const todas = funcoesDoForms();
  if (ehDono(p)) return new Set([...todas, 'pessoas', 'chefes', 'sistema']);
  if (p.nivel === 'administrador') { const s = new Set([...todas, 'pessoas']); if ((p.extras || {}).assistente === false) s.delete('assistente'); return s; }
  const nv = niveisDoForms()[p.nivel] || { funcoes: [] };
  const s = new Set(nv.funcoes === 'todas' ? todas : nv.funcoes || []);
  s.delete('assistente'); // fora do dono e administrador, só o extra pessoal concede IA
  Object.entries(p.extras || {}).forEach(([f, sim]) => { if (f === 'sistema' || f === 'pessoas') return; if (sim) s.add(f); else s.delete(f); });
  return s;
}
/** 2.17: fora dos aparelhos fixos da pessoa ela só consulta: o aparelho (chefe ou de setor) não ganha o nível dela. */
function funcoesDaPessoaNoAparelho(p, aparelho) {
  const proprias = funcoesDaPessoa(p);
  if (!p || !Array.isArray(p.aparelhos) || !p.aparelhos.length || p.aparelhos.includes(aparelho)) return proprias;
  const consulta = funcoesDaPessoa({ nivel: 'consulta' });
  consulta.delete('assistente');
  if (proprias.has('assistente')) consulta.add('assistente');
  return consulta;
}
// shortcut: a central Java (apk/nativo) acompanha a permissão pessoal do assistente no próximo APK.
/** O que quem está no aparelho pode fazer nele: a pessoa, o nível do aparelho e o limite dele. */
function funcoesNoAparelho(aparelho) {
  const p = pessoaDoAparelho(aparelho);
  const nivel = nivelDoAparelho(aparelho);
  if (!p || !nivel || (nivel === 3 && !ehDono(p))) return new Set();
  const s = funcoesDaPessoaNoAparelho(p, aparelho);
  // o código de conexão: só no nível 3 ou com a opção ligada na pessoa por quem administra
  const conexaoNaPessoa = s.has('conexao') && !!(p.extras && p.extras.conexao === true);
  if (nivel !== 3) {
    const cfg = fontes.sistema();
    const niveis = cfg && !cfg.apagado && cfg.valores && cfg.valores.niveisChefe;
    const permitidas = niveis && Array.isArray(niveis[nivel]) ? niveis[nivel] :
      (nivel === 1 ? FUNCOES_DO_NIVEL_1 : [...s].filter((f) => f !== 'conexao'));
    [...s].forEach((f) => { if (f !== 'assistente' && (f === 'sistema' || (!permitidas.includes(f) && !(f === 'conexao' && conexaoNaPessoa)))) s.delete(f); });
  }
  const teto = tetoDoAparelho(aparelho);
  if (teto && nivel !== 3) [...s].forEach((f) => { if (f !== 'assistente' && !teto.includes(f)) s.delete(f); });
  return s;
}
const podeNoAparelho = (aparelho, f) => funcoesNoAparelho(aparelho).has(f);
/** O que o tablet chefe faz sozinho, sem depender de quem está dentro (o relatório das 07:05 e os totais do Base44):
    o que o nível e o limite do próprio aparelho deixam. Às 07:05 o turno virou e normalmente não há ninguém dentro. */
function podeAparelhoSozinho(aparelho, f) {
  const nivel = nivelDoAparelho(aparelho);
  if (!nivel) return false;
  if (nivel === 3) return true;
  const cfg = fontes.sistema();
  const niveis = cfg && !cfg.apagado && cfg.valores && cfg.valores.niveisChefe;
  const permitidas = niveis && Array.isArray(niveis[nivel]) ? niveis[nivel] : nivel === 1 ? FUNCOES_DO_NIVEL_1 : FUNCOES_PADRAO.filter((x) => x !== 'conexao');
  const teto = tetoDoAparelho(aparelho);
  return permitidas.includes(f) && (!teto || teto.includes(f));
}
// tablet de setor: quem digitou a senha nos ajustes fica liberado por 10 minutos (para a central aceitar o que ele mudar)
const LIBERADO_NO_SETOR_MS = 10 * 60000;
// no tablet de setor a senha só abre os ajustes dele (os operadores), seja de quem for: o resto é do tablet chefe
const FUNCOES_NO_SETOR = ['ajustes', 'usina', 'escritorio', 'trocar_funcao'];
function funcoesNoSetor(aparelho) {
  const l = fontes.liberados()[aparelho];
  if (!l || Date.now() > l.ate) return new Set();
  const s = funcoesDaPessoaNoAparelho(fontes.config().pessoas.find((p) => p.id === l.pessoaId && p.ativo !== false && !p.pedeTrocarSenha), aparelho);
  return new Set([...s].filter((f) => FUNCOES_NO_SETOR.includes(f)));
}
/** Setor vem da conexão, nunca de r.setor. O histórico permite escoar a fila anterior à troca. */
function guardarSetor(aparelho, papel) {
  if (nivelDoAparelho(aparelho)) return;
  const setores = fontes.forms().setores.filter((s) => !s.soChefe);
  const mapa = fontes.config().setoresAparelhos || (fontes.config().setoresAparelhos = {});
  const salvo = mapa[aparelho];
  const declarado = papel || (!salvo && fontes.config().aparelhosVistos[aparelho]?.papel);
  if (!setores.some((s) => s.id === declarado) || salvo?.atual === declarado) return;
  const f = funcoesNoSetor(aparelho);
  if (salvo && !f.has('ajustes') && !f.has('usina') && !f.has('trocar_funcao')) return;
  const anteriores = { ...(salvo?.anteriores || {}) };
  if (salvo) anteriores[salvo.atual] = Date.now();
  mapa[aparelho] = { atual: declarado, anteriores, em: Date.now() };
  fontes.salvar();
}
/** 3.0: quem libera tablets chefe entra direto: não pergunta o nível nem pede a senha de novo (o nível muda depois, em Pessoas e permissões). */
function liberarAoEntrar(pessoa, aparelho) {
  if (nivelDoAparelho(aparelho) || !funcoesDaPessoaNoAparelho(pessoa, aparelho).has('chefes')) return false;
  const agora = Date.now();
  fontes.config().aparelhosChefe[aparelho] = Object.assign({}, fontes.config().aparelhosChefe[aparelho], { nivel: 2, liberadoPor: pessoa.nome, liberadoEm: agora, em: agora });
  fontes.salvar();
  return true;
}
function podeFolhaNoSetor(aparelho, r) {
  const forms = fontes.forms();
  const tabelaNova = fontes.sistema()?.valores?.folhas?._tabelas?.[r.prancheta];
  const setor = forms.setores.find((s) => [...s.pranchetas, ...(s.removidas || [])].some((pid) => pid === r.prancheta ||
    (forms.pranchetas[pid]?.partes || []).some((p) => p.prancheta === r.prancheta))) || forms.setores.find((s) => s.id === tabelaNova?.setor);
  if (setor?.soChefe) return false;
  if (!setor) return true;
  const salvo = fontes.config().setoresAparelhos?.[aparelho];
  return !!salvo && (salvo.atual === setor.id || (Number.isFinite(r.atualizadoEm) && r.atualizadoEm > 0 && r.atualizadoEm <= (salvo.anteriores[setor.id] || 0)));
}
const nomeDoNivel = (n) => ({ 1: 'nível 1 (vê, corrige e envia)', 2: 'nível 2', 3: 'nível 3 (do dono)' }[n] || 'sem nível');
/** O que vai para o aplicativo mostrar só o que pode: o nível do aparelho, se é o dono e as funções que valem aqui. */
function permissoesDoAparelho(aparelho, pessoaVerificada) {
  const nivel = nivelDoAparelho(aparelho);
  const p = pessoaVerificada || pessoaDoAparelho(aparelho);
  const funcoes = pessoaVerificada && !nivel ? funcoesDaPessoaNoAparelho(pessoaVerificada, aparelho) : funcoesNoAparelho(aparelho);
  return { nivel, dono: ehDono(p), funcoes: [...funcoes] };
}

/* ---------- O que a central aceita pela sincronização (versão 2.12) ----------
   Configuração da usina ('config|...'): cada parte mudada precisa da função de quem está no aparelho; nas folhas, as
   propriedades novas (vírgula, mostrar ao operador, campos do escritório para o operador, campos novos) só o dono num
   tablet nível 3. Quem não pode mexer nelas não as apaga: a central põe de volta as que vieram faltando.
   Conflito: a configuração leva "base" (a revisão que o aparelho editou); se outro tablet mudou antes, é recusada. */
const FOLHAS_SISTEMA = ['dec', 'oculto', '_operador', '_novos'];
/** Compara dois valores sem depender da ordem das chaves (o mesmo objeto pode chegar com as chaves em outra ordem). */
const ordenado = (x) => (Array.isArray(x) ? x.map(ordenado) : x && typeof x === 'object' ? Object.keys(x).sort().reduce((o, k) => { o[k] = ordenado(x[k]); return o; }, {}) : x);
const mesmoJson = (a, b) => JSON.stringify(ordenado(a === undefined ? null : a)) === JSON.stringify(ordenado(b === undefined ? null : b));
function mudancasDaConfig(atual, nova) {
  const a = (atual && atual.valores) || {};
  const b = nova.valores || {};
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => !mesmoJson(a[k], b[k]));
}
/** Folhas: põe de volta as propriedades do sistema que vieram faltando e diz se alguma do sistema mudou. */
function conferirFolhas(antes, depois, podeSistema) {
  const a = antes || {};
  const b = JSON.parse(JSON.stringify(depois || {}));
  let mexeuSistema = false, mexeuComum = false;
  [...new Set([...Object.keys(a), ...Object.keys(b)])].forEach((pid) => {
    if (pid === '_tabelas' || pid === '_areas' || pid === '_removidas') { // estrutura das folhas: só o dono
      if (!podeSistema) { if (pid in a) b[pid] = a[pid]; else delete b[pid]; }
      else if (!mesmoJson(a[pid], b[pid])) mexeuSistema = true;
      return;
    }
    const fa = a[pid] || {}, fb = b[pid] || (b[pid] = {});
    [...new Set([...Object.keys(fa), ...Object.keys(fb)])].forEach((k) => {
      if (FOLHAS_SISTEMA.includes(k)) {
        if (!podeSistema) { if (k in fa) fb[k] = fa[k]; else delete fb[k]; }
        else if (!mesmoJson(fa[k], fb[k])) mexeuSistema = true;
        return;
      }
      if (k.startsWith('_')) { if (!mesmoJson(fa[k], fb[k])) mexeuComum = true; return; }
      const ca = fa[k] || {}, cb = fb[k] || (fb[k] = {});
      [...new Set([...Object.keys(ca), ...Object.keys(cb)])].forEach((prop) => {
        if (FOLHAS_SISTEMA.includes(prop)) {
          if (!podeSistema) { if (prop in ca) cb[prop] = ca[prop]; else delete cb[prop]; }
          else if (!mesmoJson(ca[prop], cb[prop])) mexeuSistema = true;
        } else if (!mesmoJson(ca[prop], cb[prop])) mexeuComum = true;
      });
      if (!Object.keys(cb).length) delete fb[k];
    });
    if (!Object.keys(fb).length) delete b[pid];
  });
  return { folhas: b, mexeuSistema, mexeuComum };
}
/**
 * Decide uma anotação de configuração que chegou. Devolve { aceita, entrada, motivo }.
 * Aplicativo de antes da 2.12 (manda sem "base"): ele não conhece a recusa e marcaria como enviado. Então vale o que
 * ele podia mudar, o resto fica como está, e a configuração volta para ele na próxima sincronização (sai com um
 * horário mais novo que o dele, e o aparelho troca a cópia).
 */
function decidirConfig(atual, r, aparelho) {
  const chefe = nivelDoAparelho(aparelho) > 0;
  const funcoes = chefe ? funcoesNoAparelho(aparelho) : funcoesNoSetor(aparelho);
  const vivo = atual && !atual.apagado ? atual : null;
  const antigo = !('base' in r);
  // conflito: alguém mudou a configuração depois da cópia que este aparelho editou
  if (!antigo && vivo && Number(r.base || 0) !== Number(vivo.rev || 0)) return { aceita: false, motivo: 'conflito' };
  const antes = (vivo && vivo.valores) || {};
  // a configuração da usina não se apaga pela sincronização (o aplicativo nunca apaga): o aparelho antigo recebe ela de volta
  if (r.apagado) return antigo && vivo ? { aceita: true, entrada: Object.assign({}, vivo, { atualizadoEm: Math.max(r.atualizadoEm, vivo.atualizadoEm || 0) + 1, rev: Number(vivo.rev || 0) + 1 }) } : { aceita: false, motivo: 'sem_permissao' };
  const entrada = JSON.parse(JSON.stringify(r));
  delete entrada.base;
  const valores = Object.assign({}, entrada.valores);
  // o que não pode: o aplicativo novo recebe a recusa; do antigo, fica como estava
  const naoPode = (k) => { if (!antigo) return true; if (k in antes) valores[k] = antes[k]; else delete valores[k]; return false; };
  if ('folhas' in valores || 'folhas' in antes) {
    const f = conferirFolhas(antes.folhas, valores.folhas, funcoes.has('sistema'));
    // folhas só no tablet chefe: as do sistema com 'sistema' (o dono no nível 3), as outras com 'folhas'
    const pode = chefe && (!f.mexeuSistema || funcoes.has('sistema')) && (!f.mexeuComum || funcoes.has('folhas') || funcoes.has('sistema'));
    if ((f.mexeuSistema || f.mexeuComum) && !pode) { if (naoPode('folhas')) return { aceita: false, motivo: 'sem_permissao' }; }
    else if (f.folhas && Object.keys(f.folhas).length) valores.folhas = f.folhas;
    else delete valores.folhas;
  }
  for (const k of mudancasDaConfig({ valores: antes }, { valores })) {
    if (k === 'folhas') continue;
    // no tablet de setor só os operadores (ajustes); no tablet chefe, o resto da usina
    const precisa = k === 'niveisChefe' ? ['sistema'] : r.prancheta === 'memoria_leitor' ? (chefe ? ['ler_folha'] : null) : !chefe ? (k === 'operadores' ? ['ajustes', 'usina'] : null) : ['usina'];
    if ((!precisa || !precisa.some((f) => funcoes.has(f))) && naoPode(k)) return { aceita: false, motivo: 'sem_permissao' };
  }
  if ('niveisChefe' in valores) {
    const n = valores.niveisChefe;
    const validas = new Set([...funcoesDoForms(), 'pessoas', 'chefes']);
    if (!n || typeof n !== 'object' || Array.isArray(n) || Object.keys(n).some((k) => !['1', '2'].includes(k)) ||
        !['1', '2'].every((k) => Array.isArray(n[k]) && n[k].every((f) => typeof f === 'string' && validas.has(f)) && new Set(n[k]).size === n[k].length))
      return { aceita: false, motivo: 'invalido' };
  }
  entrada.valores = valores;
  entrada.rev = Number(vivo ? vivo.rev || 0 : 0) + 1;
  // a central guardou diferente do que veio (do antigo, ou as do sistema que voltaram): vai de volta para o aparelho
  if (!mesmoJson(valores, r.valores || {})) entrada.atualizadoEm = Math.max(r.atualizadoEm, vivo ? vivo.atualizadoEm || 0 : 0) + 1;
  return { aceita: true, entrada };
}
/** Folhas que só o tablet chefe anota (Vinho e Fermentação): pedem 'anotar'. As dos setores, 'corrigir'. */
const pranchetasSoDoChefe = () => { try { return fontes.forms().setores.filter((s) => s.soChefe).flatMap((s) => s.pranchetas); } catch (e) { return ['med_dornas', 'fermentacao']; } };
/**
 * Anotação que chegou de um tablet chefe: a mesma função que a tela pede, de quem está dentro dele.
 * Sem ninguém dentro: 'sem_sessao' (o aparelho guarda a anotação e manda de novo quando alguém entrar).
 */
function motivoNoChefe(aparelho, r, guardado) {
  if (!pessoaDoAparelho(aparelho)) return 'sem_sessao';
  const f = funcoesNoAparelho(aparelho);
  if (r.prancheta === 'avisos') return f.has('avisos') ? '' : 'sem_permissao';
  if (pranchetasSoDoChefe().includes(r.prancheta)) return f.has('anotar') ? '' : 'sem_permissao';
  return f.has('corrigir') || (f.has('escritorio') && soMudouEscritorio(r, guardado)) ? '' : 'sem_permissao';
}
// A função Escritório não permite alterar quantidade, autoria nem apagar a linha.
function soMudouEscritorio(r, guardado) {
  const permitidos = camposSoDoEscritorio(r.prancheta);
  if (!permitidos.length || r.apagado || guardado?.apagado) return false;
  const antes = guardado?.valores || {}, depois = r.valores || {};
  if (guardado && r.operador !== guardado.operador) return false;
  return [...new Set([...Object.keys(antes), ...Object.keys(depois), ...Object.keys(r.camposEm || {})])].every((k) =>
    permitidos.includes(k) || (JSON.stringify(antes[k]) === JSON.stringify(depois[k]) &&
      (r.camposEm?.[k] || 0) === (guardado?.camposEm?.[k] || 0)));
}
/** Campos do escritório de cada folha de insumo que o operador não preenche (o tablet do setor não muda). */
function camposSoDoEscritorio(pid) {
  let p = null;
  try { p = fontes.forms().pranchetas[pid]; } catch (e) { return []; }
  if (!p || p.tipo !== 'insumo') return [];
  const cs = fontes.sistema();
  const folhas = cs && !cs.apagado && cs.valores ? cs.valores.folhas || {} : {};
  const liberados = new Set([...(p.camposOperador || []).map((c) => c.id), ...((folhas[pid] || {})._operador || [])]);
  return [...(p.camposEscritorio || []).map((c) => c.id), 'verificado'].filter((id) => !liberados.has(id));
}
  return { liberarAoEntrar, pessoaDoAparelho, tetoDoAparelho, FUNCOES_PADRAO, FUNCOES_DO_NIVEL_1, funcoesDoForms, niveisDoForms, nivelDoAparelho, ehDono, funcoesDaPessoa, funcoesDaPessoaNoAparelho, funcoesNoAparelho, podeNoAparelho, podeAparelhoSozinho, LIBERADO_NO_SETOR_MS, funcoesNoSetor, guardarSetor, podeFolhaNoSetor, nomeDoNivel, permissoesDoAparelho, decidirConfig, pranchetasSoDoChefe, motivoNoChefe, soMudouEscritorio, camposSoDoEscritorio };
}

module.exports = { criar, juntarLinhas, criadasSemSaber };
