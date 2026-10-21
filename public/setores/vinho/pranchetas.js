/* Pranchetas Ubirálcool - Vinho e Fermentação (só o tablet chefe): o setor e as folhas dele (campos, limites e avisos)
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
// Mudou algo deste setor? É só aqui. Os tipos de folha e de campo estão explicados no começo de config/forms.js.
window.USINA.setores.push({
      // o que o Lucas pediu (planilha CONTROLE LTS): só o tablet chefe anota (decisão de 01/10/2026).
      // soChefe: não aparece na escolha da função dos tablets dos setores, só no painel do tablet chefe
      id: 'vinho',
      nome: 'Vinho e Fermentação',
      icone: 'regua',
      soChefe: true,
      operadores: [],
      pranchetas: ['med_dornas', 'fermentacao'],
});

Object.assign(window.USINA.pranchetas, {
    /* ---------------- VOLUME DE VINHO E FERMENTAÇÃO (destiladores) ---------------- */
    // Medição da manhã: a folga de cada dorna com a trena. O volume sai na hora (medidas em medicaoPadrao).
    med_dornas: {
      tipo: 'medicao',
      nome: 'Volume de vinho',
      codigo: 'Controle LTS',
      titulo: 'Controle de Volume das Dornas (LTS)',
      papel: { modelo: 'medicao' },
      // Parâmetros da produção (Brix e horário), anotados junto com a medição
      parametros: [
        { id: 'brix_ralo', label: 'Brix no ralo', labelCurto: 'Ralo', type: 'num', dec: 1 },
        { id: 'hora_ralo', label: 'Horário (ralo)', labelCurto: 'Horário', type: 'time' },
        { id: 'brix_hid', label: 'Brix na hidrólise', labelCurto: 'Hidrólise', type: 'num', dec: 1 },
        { id: 'hora_hid', label: 'Horário (hidrólise)', labelCurto: 'Horário', type: 'time' },
        { id: 'brix_ferm', label: 'Brix na fermentação', labelCurto: 'Fermentação', type: 'num', dec: 1 },
        { id: 'hora_ferm', label: 'Horário (fermentação)', labelCurto: 'Horário', type: 'time' },
      ],
    },
    // Caderno das dornas de fermentação: as dornas são as do grupo "fer" da medição (7 a 12)
    fermentacao: {
      tipo: 'fermentacao',
      nome: 'Dornas de fermentação',
      codigo: 'Caderno da fermentação',
      titulo: 'Controle das Dornas de Fermentação',
      grupoMedicao: 'fer',
      papel: { modelo: 'fermentacao' },
      campos: [
        { id: 'enche_inicio', label: 'Começou a encher', labelCurto: 'Início', type: 'time', vazioTexto: 'Marca ao começar' },
        { id: 'enche_fim', label: 'Terminou de encher', labelCurto: 'Fim', type: 'time', vazioTexto: 'Marca ao terminar' },
        { id: 'brix_inicial', label: 'Brix inicial', type: 'num', dec: 1, min: 0, max: 40, dica: 'Brix da dorna quando terminou de encher.' },
      ],
    },
});
