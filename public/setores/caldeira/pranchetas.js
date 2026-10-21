/* Pranchetas Ubirálcool - Caldeira: o setor e as folhas dele (campos, limites e avisos)
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
// Mudou algo deste setor? É só aqui. Os tipos de folha e de campo estão explicados no começo de config/forms.js.
window.USINA.setores.push({
      id: 'caldeira',
      nome: 'Caldeira',
      icone: 'chama',
      operadores: ['Alberto', 'Diego', 'Lucas'],
      pranchetas: ['caldeira', 'caldeira_2'],
});

// A definição é única; cada caldeira recebe seus próprios campos e grupos.
[['caldeira', 1], ['caldeira_2', 2]].forEach(([id, numero]) => {
    /* ---------------- CALDEIRA ---------------- */
    window.USINA.pranchetas[id] = {
      tipo: 'grade',
      nome: `Caldeira ${numero}`,
      codigo: 'Controle Diário',
      titulo: `Controle Diário da Caldeira ${numero}`,
      papel: { modelo: 'caldeira' },
      responsavel: 'Jônatas Tavares Pedrão - Eng. Químico, Produção e Seg. do Trabalho',
      itens: [
        { id: 'inicio_aquec', label: 'Início Aquec.', papel: 'INÍCIO AQUEC', labelCurto: 'Aquecimento', type: 'check' },
        { id: 'parada', label: 'Parada', papel: 'PARADA', type: 'check' },
        { id: 'pressao', label: 'Pressão', papel: 'PRESSÃO', unidade: 'kgf', type: 'num', dec: 1, min: 0, max: 12 },
        // com vírgula desde a 2.11 (pedido de 05/10/2026: 95,5 / 100,5)
        { id: 'temp_agua', label: 'Temperat. Água', papel: 'TEMPERAT AGUA', labelCurto: 'Água', unidade: '°C', type: 'num', dec: 1 },
        { id: 'descarga_fundo', label: 'Descarga de Fundo', papel: 'DESCARGA DE FUNDO', labelCurto: 'De fundo', type: 'choice', opcoes: ['01', '02', '03'] },
        { id: 'descarga_garrafa', label: 'Descarga Garrafa', papel: 'DESCARGA GARRAFA', labelCurto: 'Garrafa', type: 'check' },
        { id: 'retirada_cinza', label: 'Retirada Cinza', labelCurto: 'Retirada', papel: 'RETIRADA CINZA', type: 'check' },
      ],
      grupos: [
        { titulo: 'Caldeira', campos: ['inicio_aquec', 'parada'] },
        { titulo: 'Pressão e água', campos: ['pressao', 'temp_agua'] },
        { titulo: 'Descargas', campos: ['descarga_fundo', 'descarga_garrafa'] },
        { titulo: 'Cinza', campos: ['retirada_cinza'] },
      ],
    };
});
