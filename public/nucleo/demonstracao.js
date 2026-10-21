/* Pranchetas Ubirálcool - dados da demonstração
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * Dados de exemplo (copiados das fotos e do vídeo das pranchetas)
   * ========================================================= */
  function preencherExemplo() {
    const data = dataProducao();
    const ex = (pid, chave, valores, operador) => { if (!pegar(data, pid, chave)) gravar(data, pid, chave, valores, { operador }); };
    [['08:43', '09:00', '3.5', '4', '20', '6.0', '70', '20', 'FINI', 'Guilherme'], ['09:00', '09:18', '3.5', '4', '21', '6.0', '70', '20', 'FINI', 'Guilherme'],
      ['09:31', '09:55', '5.1', '', '17', '5.2', '70', '20', 'MASSA', 'Guilherme'], ['09:55', '10:14', '5.0', '', '18', '5.1', '70', '19', 'MASSA', 'Guilherme'],
      ['10:35', '10:55', '4.8', '2', '26', '5.0', '70', '22', 'MASSA', 'Guilherme'], ['10:55', '', '5.2', '', '19', '5.2', '70', '18', 'FINI', 'Guilherme']]
      .forEach((l, i) => ex('hid_anexo1', i + 1, { inicio: l[0], fim: l[1], phf: l[2], cal: l[3], brix: l[4], phf2: l[5], enzi: l[6], bhx: l[7], produto: l[8] }, l[9]));
    [['08:43', '6.0', '20'], ['09:00', '6.0', '20'], ['09:31', '5.2', '20'], ['09:55', '5.1', '19'], ['10:35', '5.0', '22']]
      .forEach((l, i) => ex('hid_anexo2', i + 1, { horario: l[0], sac: '4', phf: l[1], bhx: l[2], enz: '100', anti: '100' }, 'Guilherme'));
    [[8, '70', '4', '100', '100'], [9, '210', '4', '300', '300'], [10, '70', '2', '100', '100']].forEach(([h, lp, cal, sac, alc]) => {
      ex('ins_lphera', h, { qtd: lp, unidade: 'mL' }, 'Guilherme');
      ex('ins_cal', h, { qtd: cal, unidade: 'copos' }, 'Guilherme');
      ex('ins_saczyme', h, { qtd: sac, unidade: 'mL' }, 'Guilherme');
      ex('ins_alcolina', h, { qtd: alc, unidade: 'mL' }, 'Guilherme');
    });
    ex('ins_materia_prima', 9, { qtd: '160', unidade: 'kg', produto: 'MASSA' }, 'Jair');
    ex('ins_materia_prima', 10, { qtd: '188.8', unidade: 'kg', produto: 'FINI' }, 'Jair');
    ex('ins_ureia', 11, { qtd: '20', unidade: 'kg' }, 'Mateus');
    [[7, '6', '42', '02', 'OK'], [8, '6', '33', '03', ''], [9, '6', '56', '01', ''], [10, '6', '', '02', ''], [11, '6', '', '03', ''], [12, '6', '', '01', ''],
      [13, '6', '', '02', ''], [14, '6', '', '03', ''], [15, '6', '', '01', ''], [16, '6', '', '02', '']]
      .forEach((l) => ex('caldeira', l[0], { pressao: l[1], temp_agua: l[2], descarga_fundo: l[3], descarga_garrafa: l[4] }, l[0] < 16 ? 'Alberto' : 'Diego'));
    ex('caldeira', 'obs1', { texto: 'DESCARGA DE GARRAFA FEITA AS 07:00' }, 'Alberto');
    // volume de vinho (os números da planilha do escritório) e as dornas de fermentação
    const med = (grupo, valores) => { const g = grupoDaMedicao(grupo); g.dornas.forEach((d) => { const vol = volumeDe(d, valores[d.id + '_folga'], g); if (vol != null) valores[d.id + '_vol'] = vol.toFixed(emM3(g) ? 3 : 2); }); ex(PID_MEDICAO, grupo, Object.assign({ hora: '07:30' }, valores), 'Mateus'); };
    med('sac', { sac1_folga: '0.15', sac1_brix: '18', sac2_folga: '0.2', sac2_brix: '18', sac4_folga: '0.14', sac4_brix: '19' });
    med('fer', { fer7_folga: '0.9', fer7_brix: '5', fer7_ferm: 'Sim', fer8_folga: '0.15', fer8_brix: '7', fer8_ferm: 'Sim', fer9_folga: '1.1', fer9_brix: '1', fer9_ferm: 'Não', fer11_folga: '0.16', fer11_brix: '7', fer11_ferm: 'Sim' });
    med('dsc', { dsc2_folga: '0.15', dsc2_brix: '7', dsc10_folga: '0.16', dsc10_brix: '7', dsc11_folga: '4', dsc11_brix: '10' });
    med('tq', { tq_inox1_folga: '1', tq_abast3_folga: '2.1' });
    ex(PID_MEDICAO, 'param', { brix_ralo: '18', hora_ralo: '09:30', brix_hid: '18', hora_hid: '09:30' }, 'Mateus');
    if (!ciclosPorDorna().size) {
      const ontem = somarDias(data, -1);
      const ciclo = (dia, n, v, op) => gravar(dia, PID_FERMENTACAO, `${n}-exemplo`, Object.assign({ dorna: n, enche_inicio: '', enche_fim: '', brix_inicial: '', volante: [], esvaziada: null, inicioEm: momentoDe(dia, v.enche_inicio) }, v), { operador: op });
      ciclo(ontem, 7, { enche_inicio: '08:10', enche_fim: '10:40', brix_inicial: '8' }, 'Mateus');
      ciclo(ontem, 8, { enche_inicio: '11:00', enche_fim: '13:25', brix_inicial: '9' }, 'Mateus');
      ciclo(ontem, 9, { enche_inicio: '02:15', enche_fim: '04:50', brix_inicial: '8', volante: [{ data, inicio: '09:12', fim: '', operador: 'Mateus' }] }, 'Mateus');
      ciclo(ontem, 11, { enche_inicio: '14:00', enche_fim: '16:30', brix_inicial: '8' }, 'Mateus');
      ciclo(data, 12, { enche_inicio: '10:05' }, 'Mateus');
    }
    [[7, '107.3', '150', '371', '2', '93.7'], [8, '107.3', '150', '375', '2', '93.7'], [9, '107.3', '180', '800', '2', '93.9'], [10, '107.3', '180', '800', '2', '93.5'],
      [11, '107.3', '180', '900', '2', '92.9'], [12, '107.1', '180', '372', '2', '91.0'], [13, '107.0', '180', '979', '2', '93.0'], [14, '107.0', '150', '990', '2', '92.4'], [15, '107.3', '150', '981', '2', '92.6']]
      .forEach((l) => ex('destilaria', l[0], { temp_pe_a: l[1], producao: l[2], carregamento: l[3], vapor: l[4], inpm: l[5] }, 'Mateus'));
  }
