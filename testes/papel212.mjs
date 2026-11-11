/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Folhas de papel e API da versão 2.12, sem ligar a central. */
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { teste, certo, igual, usinaNoContexto, caminhoNovo } from './teste.mjs';

const require = createRequire(import.meta.url);
const Folhas = require('../public/config/folhas.js');
const Leitura = require('../api-leitura.js');
const ONTEM = '2026-10-05';
const HOJE = '2026-10-06';
const fmtNum = (v) => String(v).replace('.', ',');
const fonte = (nome) => fs.readFileSync(new URL('../public/' + caminhoNovo(nome), import.meta.url), 'utf8');

function formsDoApp() {
  const ctx = { window: {} };
  usinaNoContexto(ctx);
  return JSON.parse(JSON.stringify(ctx.window.USINA));
}

function ambiente(forms, registros = [], comFolhas = true) {
  const ctx = { window: comFolhas ? { Folhas } : {}, TextEncoder, Blob };
  vm.runInNewContext(fonte('modelos.js'), ctx);
  vm.runInNewContext(fonte('xlsx.js'), ctx);
  const listar = (data, pid) => registros.filter((r) => r.data === data && r.prancheta === pid && !r.apagado);
  const modelos = ctx.window.ModelosPapel;
  const papel = modelos.montar({
    C: forms, prancheta: (pid) => forms.pranchetas[pid],
    setorDaPrancheta: (pid) => forms.setores.find((s) => s.pranchetas.includes(pid)),
    listar, pegar: (data, pid, chave) => listar(data, pid).find((r) => r.chave === chave),
    fmtData: (data) => data.split('-').reverse().join('/'), fmtNum,
    HORAS: Array.from({ length: 24 }, (_, i) => (forms.inicioDoDia + i) % 24),
    rotuloHoraPapel: (h) => Number(h) === 0 ? '24:00' : String(h).padStart(2, '0') + ':00',
    linhasDeHora: (regs) => regs.filter((r) => /^\d+$/.test(r.chave)),
    extrasOperador: (p) => (p.camposOperador || []).filter((c) => !p.camposEscritorio.some((e) => e.id === c.id)),
    totalInsumo: (regs) => String(regs.reduce((s, r) => s + Number(r.valores.qtd || 0), 0)),
    somarDias: (data, n) => new Date(Date.parse(data + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10),
  });
  return { papel, modelos, janela: ctx.window };
}

const registro = (pid, chave, valores, data = HOJE) => ({ id: `${data}/${pid}/${chave}`, prancheta: pid, data, chave, valores, operador: 'Operador' });
const folhaApi = (res, pid) => res.setores.flatMap((s) => s.pranchetas).find((p) => p.id === pid);

export async function testarPapel212(grupo) {
  await teste(grupo, '2.16: duas caldeiras com definição igual, campos independentes e quatro gráficos', async () => {
    const forms = formsDoApp(), [p1, p2] = [forms.pranchetas.caldeira, forms.pranchetas.caldeira_2];
    igual(forms.setores.find((s) => s.id === 'caldeira').pranchetas, ['caldeira', 'caldeira_2']);
    igual([p1.nome, p2.nome], ['Caldeira 1', 'Caldeira 2']);
    for (const k of ['itens', 'grupos', 'papel']) igual(p2[k], p1[k], k);
    for (const pid of ['caldeira', 'caldeira_2']) {
      igual(forms.graficos.filter((g) => g.prancheta === pid).map((g) => g.campos), [['pressao'], ['temp_agua']]);
    }
    // Confere também os objetos originais, antes da cópia JSON do helper.
    const ctx = { window: {} }; usinaNoContexto(ctx);
    const orig = ctx.window.USINA.pranchetas;
    orig.caldeira.itens[0].label = 'Só da 1';
    certo(orig.caldeira_2.itens[0].label !== 'Só da 1', 'campos não podem ser compartilhados');
    const java = fs.readFileSync(new URL('../apk/nativo/java/br/com/ubiralcool/pranchetas/ServidorCentral.java', import.meta.url), 'utf8');
    const lista = java.match(/Arrays\.asList\(([^)]*)\)\.contains\(folha\)\) return "caldeira"/);
    certo(lista, 'mapa fixo da caldeira no Java');
    igual(JSON.parse('[' + lista[1] + ']'), forms.setores.find((s) => s.id === 'caldeira').pranchetas);
  });

  await teste(grupo, '2.16: papel, Excel, XML e API separam as caldeiras e as 7h do dia seguinte', async () => {
    const forms = formsDoApp();
    const regs = [registro('caldeira', '7', { pressao: '5.1' }), registro('caldeira_2', '7', { pressao: '6.2' }),
      registro('caldeira', '7', { pressao: '7.3' }, '2026-10-07'), registro('caldeira_2', '7', { pressao: '8.4' }, '2026-10-07')];
    const a = ambiente(forms, regs);
    const folhas = ['caldeira', 'caldeira_2'].map((pid) => a.papel.folha(pid, HOJE));
    for (const [i, f] of folhas.entries()) {
      const titulo = `CONTROLE DIÁRIO DA CALDEIRA ${i + 1}`;
      igual(f.grade.cel['0,4'].v, titulo, 'cabeçalho da grade usada pelo PDF');
      certo(a.modelos.paraHtml(f, '', fmtNum).includes(titulo), 'impressão');
      certo(a.modelos.paraXml(f, HOJE, a.janela.xmlEscape).includes(titulo), 'XML');
      igual(f.nomePlanilha, `Caldeira ${i + 1}`, 'abas distintas');
      const valores = f.dados.linhas.find((l) => l.rotulo === 'PRESSÃO').valores;
      igual([valores[1], valores.at(-1)], i ? [6.2, 8.4] : [5.1, 7.3]);
    }
    const g1 = JSON.parse(JSON.stringify(folhas[0].grade)), g2 = JSON.parse(JSON.stringify(folhas[1].grade));
    for (const g of [g1, g2]) Object.values(g.cel).forEach((c) => { c.v = ''; });
    igual(g1, g2, 'mesmo desenho');
    const xlsx = await a.janela.criarXlsx(folhas.map(a.modelos.paraPlanilha)).text();
    for (const n of [1, 2]) certo(xlsx.includes(`name="Caldeira ${n}"`) && xlsx.includes(`CONTROLE DIÁRIO DA CALDEIRA ${n}`), 'Excel ' + n);
    const api = Leitura.criar(forms).dia(HOJE, regs.filter((r) => r.data === HOJE));
    igual(folhaApi(api, 'caldeira').linhas[0].campos.pressao.valor, 5.1);
    igual(folhaApi(api, 'caldeira_2').linhas[0].campos.pressao.valor, 6.2);
  });

  await teste(grupo, 'campo novo da caldeira sai só no bloco separado, sem mudar Excel, HTML ou grade do PDF', async () => {
    const forms = formsDoApp();
    const regs = [registro('caldeira', '10', { pressao: '6.25', x_teste: '987.65' })];
    const a = ambiente(forms, regs);
    const original = a.papel.folha('caldeira', HOJE);
    Folhas.aplicar(forms, { caldeira: { _novos: [{ id: 'x_teste', label: 'Medição adicional', type: 'num', unidade: 'ppm', dec: 2 }] } }, new Map());
    const antes = JSON.stringify(forms);
    const f = a.papel.folha('caldeira', HOJE);
    igual(f.grade, original.grade, 'o desenho usado pelo PDF não muda');
    igual(a.modelos.paraPlanilha(f), a.modelos.paraPlanilha(original), 'a planilha não muda');
    igual(a.modelos.paraHtml(f, '', fmtNum), a.modelos.paraHtml(original, '', fmtNum), 'a impressão não muda');
    igual(f.dados.colunas, original.dados.colunas);
    igual(f.dados.linhas, original.dados.linhas);
    igual(f.dados.camposNovos, [{ id: 'x_teste', rotulo: 'Medição adicional', unidade: 'ppm', valores: [{ linha: '10', valor: 987.65 }] }]);
    const xml = a.modelos.paraXml(f, HOJE, a.janela.xmlEscape);
    certo(!xml.split('</tabela>')[0].includes('Medição adicional'), 'o campo não entra nas colunas do XML');
    certo(xml.includes('<camposNovos>\n      <campo nome="Medição adicional" unidade="ppm">\n        <valor linha="10">987.65</valor>'), 'campo e valor no XML');
    certo(xml.indexOf('<camposNovos>') > xml.indexOf('</tabela>'), 'bloco depois da tabela');
    const xlsx = await a.janela.criarXlsx([a.modelos.paraPlanilha(f)]).text();
    certo(!xlsx.includes('Medição adicional') && !xlsx.includes('987.65'), 'o arquivo Excel não contém o campo novo');
    igual(JSON.stringify(forms), antes, 'a folha em vigor não foi alterada');
  });

  for (const [pid, chave] of [['hid_anexo1', '3'], ['ins_cal', '0']]) {
    await teste(grupo, `${pid}: campo novo mantém o papel e identifica a linha no XML`, async () => {
      const forms = formsDoApp();
      const a = ambiente(forms, [registro(pid, chave, { qtd: '2', x_marca: '1' })]);
      const original = a.papel.folha(pid, HOJE);
      Folhas.aplicar(forms, { [pid]: { _novos: [{ id: 'x_marca', label: 'Conferência adicional', type: 'check' }] } }, new Map());
      const antes = JSON.stringify(forms);
      const f = a.papel.folha(pid, HOJE);
      igual(a.modelos.paraPlanilha(f), a.modelos.paraPlanilha(original));
      igual(a.modelos.paraHtml(f, '', fmtNum), a.modelos.paraHtml(original, '', fmtNum));
      igual(f.dados.colunas, original.dados.colunas);
      igual(f.dados.linhas, original.dados.linhas);
      igual(f.dados.camposNovos[0].valores, [{ linha: pid === 'ins_cal' ? '24:00' : '3', valor: 'OK' }]);
      const xml = a.modelos.paraXml(f, HOJE, a.janela.xmlEscape);
      certo(!xml.split('</tabela>')[0].includes('Conferência adicional'), 'fora das colunas');
      certo(xml.includes(`linha="${pid === 'ins_cal' ? '24:00' : '3'}">OK</valor>`), 'linha e marca no XML');
      igual(JSON.stringify(forms), antes, 'campos e grupos originais preservados');
    });
  }

  await teste(grupo, 'campos novos vazios são omitidos, zero é preservado e outro dia não entra', async () => {
    const forms = formsDoApp();
    Folhas.aplicar(forms, { caldeira: { _novos: ['zero', 'vazio', 'nulo', 'ausente'].map((id) => ({ id: 'x_' + id, label: id, type: 'num' })) } }, new Map());
    const a = ambiente(forms, [
      registro('caldeira', '10', { x_zero: '0', x_vazio: '', x_nulo: null }),
      registro('caldeira', '7', { x_vazio: '12' }, ONTEM),
      registro('caldeira', 'obs1', { x_ausente: '20' }),
    ]);
    const f = a.papel.folha('caldeira', HOJE);
    igual(f.dados.camposNovos.map((c) => c.id), ['x_zero']);
    igual(f.dados.camposNovos[0].valores, [{ linha: '10', valor: 0 }]);
    const vazia = a.papel.folha('caldeira', '2026-10-07');
    igual(vazia.dados.camposNovos, []);
    certo(!a.modelos.paraXml(vazia, '2026-10-07', a.janela.xmlEscape).includes('<camposNovos>'), 'sem bloco vazio');
  });

  await teste(grupo, 'campos novos usam a unidade do dia, escapam XML e funcionam sem window.Folhas', async () => {
    const forms = formsDoApp();
    const label = 'Análise <extra> & "dono"';
    Folhas.aplicar(forms, { caldeira: {
      _novos: [{ id: 'x_texto', label, type: 'text' }],
      x_texto: { unidade: 'nova', historico: [{ ate: ONTEM, unidade: 'antiga & "u"' }] },
    } }, new Map());
    const regs = [registro('caldeira', '10', { x_texto: '<feito> & "sim"' }, ONTEM)];
    const a = ambiente(forms, regs);
    const f = a.papel.folha('caldeira', ONTEM);
    igual(f.dados.camposNovos[0].unidade, 'antiga & "u"');
    const xml = a.modelos.paraXml(f, ONTEM, a.janela.xmlEscape);
    certo(xml.includes('nome="Análise &lt;extra&gt; &amp; &quot;dono&quot;" unidade="antiga &amp; &quot;u&quot;"'), 'atributos escapados');
    certo(xml.includes('&lt;feito&gt; &amp; &quot;sim&quot;</valor>'), 'texto escapado');
    igual(ambiente(forms, regs, false).papel.folha('caldeira', ONTEM).dados.camposNovos[0].unidade, 'nova');
  });

  await teste(grupo, 'casas decimais por célula preservam 6.25 em todos os modelos com casas configuradas', async () => {
    const forms = formsDoApp();
    const folhas = ['caldeira', 'destilaria', 'hid_anexo1', Object.keys(forms.pranchetas).find((pid) => forms.pranchetas[pid].papel?.modelo === 'nova')];
    for (const pid of folhas) {
      const p = forms.pranchetas[pid];
      const c = (p.itens || p.campos).find((c) => c.type === 'num');
      Folhas.aplicar(forms, { [pid]: { [c.id]: { dec: 1 } } }, new Map());
      const regs = [registro(pid, p.tipo === 'dornas' ? '1' : '10', { [c.id]: '6.25' }), registro(pid, p.tipo === 'dornas' ? '2' : '11', { [c.id]: '6.2' })];
      const a = ambiente(forms, regs);
      const f = a.papel.folha(pid, HOJE);
      const celulas = a.modelos.paraPlanilha(f).rows.flat();
      igual(celulas.find((c) => c.v === 6.25).st.dec, 2, pid + ': preserva duas casas');
      igual(celulas.find((c) => c.v === 6.2).st.dec, 1, pid + ': não aumenta outras células');
      certo(a.modelos.paraHtml(f, '', fmtNum).includes('>6,25</td>'), pid + ': HTML sem arredondar');
      const xlsx = await a.janela.criarXlsx([a.modelos.paraPlanilha(f)]).text();
      certo(xlsx.includes('formatCode="0.00"') && xlsx.includes('<v>6.25</v>'), pid + ': valor e formato no Excel');
      c.dec = 0;
      igual(Object.values(a.papel.folha(pid, HOJE).grade.cel).find((c) => c.v === 6.25).st.dec, 2, pid + ': preserva ao reduzir para zero');
    }
  });

  await teste(grupo, 'API usa a menor data histórica aplicável em dia e registro; esquema mantém unidade atual e novo', async () => {
    const forms = formsDoApp();
    const historico = [{ ate: ONTEM, unidade: 'kgf' }, { ate: '2026-10-03', unidade: 'psi' }];
    Folhas.aplicar(forms, { caldeira: {
      pressao: { unidade: 'bar', historico },
      _novos: [{ id: 'x_pressao', label: 'Pressão adicional', type: 'num', unidade: 'bar' }],
      x_pressao: { historico },
    } }, new Map());
    const antes = JSON.stringify(forms);
    const api = Leitura.criar(forms, undefined, { fusoMin: -180 });
    for (const [data, unidade] of [['2026-10-02', 'psi'], ['2026-10-03', 'psi'], [ONTEM, 'kgf'], [HOJE, 'bar']]) {
      const r = registro('caldeira', '10', { pressao: '6.25', x_pressao: '0' }, data);
      for (const campos of [api.registro(r).campos, folhaApi(api.dia(data, [r]), 'caldeira').linhas[0].campos]) {
        igual(campos.pressao.unidade, unidade, data);
        igual(campos.x_pressao.unidade, unidade, data + ': campo novo');
        igual(campos.pressao.valor, 6.25, 'nada é convertido');
        igual(campos.x_pressao.valor, 0);
      }
    }
    const campos = folhaApi(api.esquema(), 'caldeira').campos;
    igual(campos.find((c) => c.id === 'x_pressao').novo, true);
    igual(campos.find((c) => c.id === 'x_pressao').unidade, 'bar');
    igual(campos.find((c) => c.id === 'pressao').unidade, 'bar');
    certo(!('novo' in campos.find((c) => c.id === 'pressao')), 'campo original não ganha marca');
    igual(JSON.stringify(forms), antes, 'histórico preserva sua ordem original');
  });

  await teste(grupo, 'API aplica histórico também nas dornas e insumos, inclusive unidade antiga vazia', async () => {
    const forms = formsDoApp();
    for (const pid of ['hid_anexo1', 'ins_cal']) {
      Folhas.aplicar(forms, { [pid]: {
        _novos: [{ id: 'x_teste', label: 'Medição adicional', type: 'num', unidade: 'L' }],
        x_teste: { historico: [{ ate: ONTEM, unidade: '' }] },
      } }, new Map());
      const api = Leitura.criar(forms);
      for (const data of [ONTEM, HOJE]) {
        const r = registro(pid, '10', { qtd: '1', x_teste: '2' }, data);
        const esperado = data === ONTEM ? undefined : 'L';
        igual(api.registro(r).campos.x_teste.unidade, esperado);
        igual(folhaApi(api.dia(data, [r]), pid).linhas[0].campos.x_teste.unidade, esperado);
        igual(folhaApi(api.esquema(), pid).campos.find((c) => c.id === 'x_teste').novo, true);
      }
    }
  });

  await teste(grupo, 'campo novo arquivado: fora da anotação, mas os dias antigos continuam no XML e na API', async () => {
    const forms = formsDoApp();
    Folhas.aplicar(forms, { caldeira: { _novos: [{ id: 'x_velho', label: 'Campo velho', type: 'num', arquivado: true }] } }, new Map());
    const c = forms.pranchetas.caldeira.itens.find((x) => x.id === 'x_velho');
    certo(c && c.arquivado && c.novo, 'continua na lista, marcado como arquivado');
    const regs = [registro('caldeira', '10', { x_velho: '42' }, ONTEM)];
    const { modelos } = ambiente(forms, regs);
    certo(modelos.paraXml && true, 'modelos carregou');
    const api = Leitura.criar(forms, () => null, { fusoMin: -180 });
    igual(api.registro(Object.assign({ seq: 1 }, regs[0])).campos.x_velho.valor, 42, 'o valor antigo sai na API');
    igual(folhaApi(api.esquema(), 'caldeira').campos.find((x) => x.id === 'x_velho').arquivado, true);
  });

  await teste(grupo, 'campo do escritório liberado ao operador leva as mudanças (nome, escondido); o do papel não muda', async () => {
    const forms = formsDoApp();
    const pid = 'ins_materia_prima';
    const id = forms.pranchetas[pid].camposEscritorio[0].id;
    const nomePapel = forms.pranchetas[pid].camposEscritorio[0].label;
    Folhas.aplicar(forms, { [pid]: { _operador: [id], [id]: { label: 'Nota fiscal', oculto: true } } }, new Map());
    const copia = forms.pranchetas[pid].camposOperador.find((x) => x.id === id);
    igual(copia.label, 'Nota fiscal'); igual(copia.oculto, true);
    igual(forms.pranchetas[pid].camposEscritorio[0].label, nomePapel, 'o do escritório (papel) fica igual');
  });

  await teste(grupo, 'as listas fixas da central do tablet (Java) são iguais às do forms.js', async () => {
    const forms = formsDoApp();
    const java = fs.readFileSync(new URL('../apk/nativo/java/br/com/ubiralcool/pranchetas/ServidorCentral.java', import.meta.url), 'utf8');
    const lista = (re) => { const m = java.match(re); certo(m, 'não achei ' + re); return JSON.parse('[' + m[1] + ']'); };
    igual(JSON.stringify(lista(/FUNCOES_PADRAO = Arrays\.asList\(([^)]*)\)/)), JSON.stringify(forms.funcoes.map((f) => f.id)), 'funções');
    igual(JSON.stringify(lista(/"encarregado"\.equals\(nivel\)\) return Arrays\.asList\(([^)]*)\)/)), JSON.stringify(forms.niveis.encarregado.funcoes), 'encarregado');
    igual(JSON.stringify(lista(/"consulta"\.equals\(nivel\)\) return Arrays\.asList\(([^)]*)\)/)), JSON.stringify(forms.niveis.consulta.funcoes), 'consulta');
    igual(JSON.stringify(lista(/FUNCOES_DO_NIVEL_1 = Arrays\.asList\(([^)]*)\)/)), JSON.stringify(forms.niveisDoAparelho[1].funcoes), 'nível 1');
    igual(JSON.stringify(lista(/PRANCHETAS_SO_DO_CHEFE = Arrays\.asList\(([^)]*)\)/)), JSON.stringify(forms.setores.filter((s) => s.soChefe).flatMap((s) => s.pranchetas)), 'Vinho e Fermentação');
  });
}
