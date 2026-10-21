/* Pranchetas Ubirálcool - Vinho e Fermentação: volume das dornas e enchimentos
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * Volume de vinho (a folga de cada dorna, medida com a trena) e dornas de fermentação
   *   Volume em litros = (altura - folga) x área da base x 1000: a conta da planilha CONTROLE LTS do escritório.
   *   As medidas das dornas ficam em Configurações da usina (começam com as da planilha, em forms.js).
   * ========================================================= */
  const PID_MEDICAO = 'med_dornas', PID_FERMENTACAO = 'fermentacao';
  // as medidas trocadas pelo escritório valem só se forem da mesma versão dos grupos (forms.js)
  const medidasDasDornas = () => { const m = configSistema().medicao; return m && m.versao === C.medicaoPadrao.versao ? m : C.medicaoPadrao; };
  const emM3 = (g) => !!g && g.unidade === 'm³';
  const gruposDaMedicao = () => medidasDasDornas().grupos;
  const grupoDaMedicao = (id) => gruposDaMedicao().find((g) => g.id === id);
  const temMedida = (d) => !!d && Number(d.altura) > 0 && Number(d.area) > 0;
  const arred2 = (n) => Math.round(n * 100) / 100;
  /** Volume da dorna: em litros, ou em m³ nos tanques de álcool (g = o grupo da dorna). */
  function volumeDe(d, folga, g) {
    if (vazio(folga) || !temMedida(d)) return null;
    const v = (Number(d.altura) - Number(folga)) * Number(d.area);
    return emM3(g) ? Math.round(v * 1000) / 1000 : arred2(v * 1000);
  }
  /** Litros como na planilha (7.229,25). curto: sem as casas, para caber do lado do quadro. */
  const litros = (n, curto) => (n == null ? '' : `${Number(n).toLocaleString('pt-BR', { minimumFractionDigits: curto ? 0 : 2, maximumFractionDigits: curto ? 0 : 2 })} L`);
  function volDoRegistro(reg, d, g) {
    if (!reg) return null;
    const x = reg.valores[d.id + '_vol'];
    return vazio(x) ? volumeDe(d, reg.valores[d.id + '_folga'], g) : Number(x);
  }
  /** Volume com a unidade do grupo: 7.229,25 L ou 4,400 m³ (curto: litros sem as casas). */
  const volumeTexto = (n, g, curto) => (n == null ? '' : emM3(g) ? `${Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} m³` : litros(n, curto));
  /** Dia de produção + hora (a folha vai das 07:00 às 06:59) em milissegundos. */
  function momentoDe(data, hhmm) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '') || !/^\d\d:\d\d$/.test(hhmm || '')) return 0;
    const [h, m] = hhmm.split(':').map(Number);
    const [y, mo, d] = (h < C.inicioDoDia ? somarDias(data, 1) : data).split('-').map(Number);
    return new Date(y, mo - 1, d, h, m).getTime();
  }
  /** A medição de um dia: cada grupo com as dornas, o subtotal e o total de vinho da produção.
      aoVivo: { grupo, valores } do grupo que está sendo anotado (o total muda enquanto a pessoa digita). */
  function medicaoDoDia(data, aoVivo) {
    const grupos = gruposDaMedicao().map((g) => {
      const vivo = aoVivo && aoVivo.grupo === g.id;
      const reg = vivo ? { valores: aoVivo.valores } : pegar(data, PID_MEDICAO, g.id);
      const v = reg ? reg.valores : {};
      const linhas = g.dornas.map((d) => ({ d, folga: v[d.id + '_folga'], brix: v[d.id + '_brix'], ferm: v[d.id + '_ferm'], volume: vivo ? volumeDe(d, v[d.id + '_folga'], g) : volDoRegistro(reg, d, g) }));
      const medidas = linhas.filter((l) => l.volume != null);
      return { g, hora: v.hora || '', operador: (!vivo && reg && reg.operador) || '', linhas, medidas: medidas.length, subtotal: arred2(medidas.reduce((s, l) => s + l.volume, 0)) };
    });
    const par = pegar(data, PID_MEDICAO, 'param');
    const soma = (lista) => arred2(lista.reduce((s, x) => s + x.subtotal, 0));
    return {
      grupos, param: par ? par.valores : {}, operadorParam: par ? par.operador || '' : '',
      producao: soma(grupos.filter((x) => x.g.soma)), tanques: soma(grupos.filter((x) => !x.g.soma)),
      medidas: grupos.reduce((s, x) => s + x.medidas, 0), total: grupos.reduce((s, x) => s + x.g.dornas.length, 0),
      hora: (grupos.find((x) => x.hora && x.medidas) || {}).hora || '',
    };
  }

  /* Dornas de fermentação: cada enchimento é um registro no dia em que começou a encher.
     vazia -> enchendo -> fermentando -> na volante (mandando para a coluna) -> com vinho (parou no meio) -> vazia */
  const numeroDaDorna = (d) => Number(String(d.id).replace(/\D/g, ''));
  const dornasDeFermentacao = () => { const g = grupoDaMedicao(prancheta(PID_FERMENTACAO).grupoMedicao); return g ? g.dornas.map((d) => ({ n: numeroDaDorna(d), d })) : []; };
  let ciclos = null, versaoDosCiclos = -1;
  /** Enchimentos de cada dorna, o mais novo primeiro. */
  function ciclosPorDorna() {
    if (!ciclos || versaoDosCiclos !== versaoRegistros) {
      const m = new Map();
      for (const [k, lista] of indiceDasFolhas().porFolha) {
        if (!k.endsWith('|' + PID_FERMENTACAO)) continue;
        lista.forEach((r) => { const n = Number(r.valores.dorna); if (!m.has(n)) m.set(n, []); m.get(n).push(r); });
      }
      m.forEach((l) => l.sort((a, b) => (b.valores.inicioEm || b.criadoEm) - (a.valores.inicioEm || a.criadoEm)));
      ciclos = m; versaoDosCiclos = versaoRegistros;
    }
    return ciclos;
  }
  const cicloAtual = (n) => (ciclosPorDorna().get(n) || [])[0] || null;
  /** O enchimento que estava na dorna num dia (para a folha de um dia que já passou). */
  const cicloNoDia = (n, data) => (ciclosPorDorna().get(n) || []).find((r) => r.data <= data) || null;
  function etapaFerm(r) {
    if (!r || r.valores.esvaziada) return 'vazia';
    const vol = r.valores.volante || [];
    if (vol.some((s) => !s.fim)) return 'volante';
    if (vazio(r.valores.enche_fim)) return 'enchendo';
    return vol.length ? 'com vinho' : 'fermentando';
  }
  const NOME_ETAPA = { vazia: 'vazia', enchendo: 'enchendo', fermentando: 'fermentando', volante: 'na volante', 'com vinho': 'com vinho' };
  /** A última medição da dorna (Brix, volume, fermentando) depois que ela foi enchida, até o dia pedido. */
  function medicaoDaDorna(n, ciclo, ateData) {
    const g = grupoDaMedicao(prancheta(PID_FERMENTACAO).grupoMedicao);
    const d = g && g.dornas.find((x) => numeroDaDorna(x) === n);
    if (!d) return null;
    const desde = ciclo ? ciclo.valores.inicioEm || 0 : 0;
    const fim = ateData || dataProducao();
    for (let i = 0; i < DIAS_NO_CHEFE; i++) {
      const data = somarDias(fim, -i);
      if (ciclo && data < ciclo.data) break;
      const reg = pegar(data, PID_MEDICAO, g.id);
      if (!reg) continue;
      const v = reg.valores;
      if (vazio(v[d.id + '_folga']) && vazio(v[d.id + '_brix']) && vazio(v[d.id + '_ferm'])) continue;
      const em = momentoDe(data, v.hora) || reg.atualizadoEm;
      if (desde && em < desde) return null; // medida de antes deste enchimento (era o vinho anterior)
      return { data, hora: v.hora || '', brix: v[d.id + '_brix'], ferm: v[d.id + '_ferm'], volume: volDoRegistro(reg, d, g), operador: reg.operador || '' };
    }
    return null;
  }
  /** Quem está mandando para a volante agora. */
  const naVolante = () => dornasDeFermentacao().map(({ n }) => ({ n, r: cicloAtual(n) })).filter((x) => etapaFerm(x.r) === 'volante')
    .map((x) => Object.assign({ n: x.n }, (x.r.valores.volante || []).find((s) => !s.fim)));
  function novoCiclo(n, val, operador) {
    const agora = Date.now();
    const data = dataProducao();
    let inicioEm = momentoDe(data, val.enche_inicio) || agora;
    if (inicioEm > agora + 60000) inicioEm -= 86400000; // hora de antes das 07:00 anotada depois: foi na véspera
    return gravar(data, PID_FERMENTACAO, `${n}-${agora.toString(36)}`, Object.assign({ dorna: n, enche_inicio: '', enche_fim: '', brix_inicial: '', inicioEm, volante: [], esvaziada: null }, val), { operador });
  }
  const mudarCiclo = (r, mudanca, extra = {}) => gravar(r.data, PID_FERMENTACAO, r.chave, mudanca, extra);
  /** A folha das dornas de fermentação num dia: o enchimento, a medição e o que foi para a volante naquele dia. */
  function fermentacaoDoDia(data) {
    return dornasDeFermentacao().map(({ n, d }) => {
      let c = cicloNoDia(n, data);
      if (c && c.valores.esvaziada && c.valores.esvaziada.data < data) c = null; // já estava vazia
      const v = c ? c.valores : {};
      const med = c ? medicaoDaDorna(n, c, data) : null;
      const volante = (ciclosPorDorna().get(n) || []).flatMap((r) => (r.valores.volante || []).filter((s) => s.data === data));
      return {
        n, d, ciclo: c, etapa: etapaFerm(c), enchidaEm: c ? c.data : '', inicio: v.enche_inicio || '', fim: v.enche_fim || '', brixInicial: v.brix_inicial || '', operador: c ? c.operador || '' : '',
        medicao: med, volante, esvaziou: v.esvaziada ? v.esvaziada : null,
      };
    });
  }

  /* Central dentro do próprio tablet chefe (só no aplicativo instalado).
     Assim a usina não precisa de um computador ligado o tempo todo. */
