/* Pranchetas Ubirálcool - Destilaria e Fermentação: o setor e as folhas dele (campos, limites e avisos)
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
// Mudou algo deste setor? É só aqui. Os tipos de folha e de campo estão explicados no começo de config/forms.js.
window.USINA.setores.push({
      id: 'destilaria',
      nome: 'Destilaria e Fermentação',
      icone: 'coluna',
      operadores: ['Mateus'],
      pranchetas: ['destilaria', 'ins_lactrol', 'ins_ureia'],
});

Object.assign(window.USINA.pranchetas, {
    /* ---------------- FERMENTAÇÃO ---------------- */
    ins_lactrol: insumo('FERMENTAÇÃO - ANTIBIÓTICO LACTROL', 'Antibiótico Lactrol', ['mL', 'L']),
    ins_ureia: insumo('URÉIA PECUÁRIA', 'Uréia Pecuária', ['kg', 'g']),

    /* ---------------- DESTILARIA ---------------- */
    destilaria: {
      tipo: 'grade',
      nome: 'Controle Diário da Destilaria',
      codigo: 'Controle Diário',
      titulo: 'Controle Diário da Destilaria',
      papel: { modelo: 'destilaria' },
      itens: [
        { id: 'temp_pe_a', label: 'Temp. pé da coluna A', labelCurto: 'Pé coluna A', unidade: '°C', type: 'num', dec: 1 },
        // produção e carregamento com vírgula desde a 2.11 (pedido de 05/10/2026)
        { id: 'producao', label: 'Produção Álcool', labelCurto: 'Produção', papel: 'PRODUÇÃO ÁLCOOL', type: 'num', dec: 1 },
        { id: 'carregamento', label: 'Carregamento', labelCurto: 'Carreg.', papel: 'CARREGAMENTO', type: 'num', dec: 1 },
        { id: 'vapor', label: 'Vapor / Caldeira', labelCurto: 'Vapor', papel: 'Vapor/ Caldeira', unidade: 'kgf', type: 'num', dec: 1 },
        { id: 'inpm', label: 'INPM', unidade: '°', type: 'num', dec: 1, min: 80, max: 100 },
      ],
      grupos: [
        { titulo: 'Coluna e vapor', campos: ['temp_pe_a', 'vapor'] },
        { titulo: 'Produção', campos: ['producao', 'carregamento'] },
        { titulo: 'Álcool', campos: ['inpm'] },
      ],
    },
});
