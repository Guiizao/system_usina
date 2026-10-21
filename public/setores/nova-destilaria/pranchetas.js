/* Pranchetas Ubirálcool - Nova Destilaria: o setor e as folhas dele (campos, limites e avisos)
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
// Mudou algo deste setor? É só aqui. Os tipos de folha e de campo estão explicados no começo de config/forms.js.
window.USINA.setores.push({
      id: 'nova_destilaria',
      nome: 'Nova Destilaria',
      icone: 'fabrica',
      operadores: ['Operador 1'],
      pranchetas: ['nova_destilaria'],
});

Object.assign(window.USINA.pranchetas, {
    /* ---------------- NOVA DESTILARIA ---------------- */
    nova_destilaria: {
      tipo: 'grade',
      nome: 'Controle Diário - Nova Destilaria',
      codigo: 'Controle Diário',
      titulo: 'Usina Ubirálcool - Controle Diário da Destilaria (Nova)',
      papel: { modelo: 'nova' },
      itens: [
        // pedido do Bruno (29/09/2026): saiu o Início Aquecimento e entrou a B4, entre a Coluna B e a Coluna P
        { id: 'coluna_hidro', label: 'Coluna Hidro', labelCurto: 'Hidro', unidade: '°C', type: 'num', dec: 1 },
        { id: 'coluna_b', label: 'Coluna B', labelCurto: 'B', unidade: '°C', type: 'num', dec: 1 },
        { id: 'coluna_b4', label: 'Coluna B4', labelCurto: 'B4', unidade: '°C', type: 'num', dec: 1, dica: 'Temperatura do carregamento da coluna B (no painel, o mostrador embaixo da Coluna B).' },
        { id: 'coluna_p', label: 'Coluna P', labelCurto: 'P', unidade: '°C', type: 'num', dec: 1 },
        { id: 'cond_hidro', label: 'Condensador Hidro', labelCurto: 'Hidro', unidade: '°C', type: 'num', dec: 1 },
        { id: 'cond_b', label: 'Condensador B', labelCurto: 'B', unidade: '°C', type: 'num', dec: 1 },
        { id: 'cond_p', label: 'Condensador P', labelCurto: 'P', unidade: '°C', type: 'num', dec: 1 },
        { id: 'vapor', label: 'Vapor Caldeira', labelCurto: 'Vapor', unidade: 'kgf', type: 'num', dec: 1 },
        { id: 'producao_lth', label: 'Produção LT/H', labelCurto: 'LT/H', type: 'num', dec: 0 },
        { id: 'inpm', label: 'INPM', unidade: '°', type: 'num', dec: 1, min: 80, max: 100 },
      ],
      grupos: [
        { titulo: 'Colunas', campos: ['coluna_hidro', 'coluna_b', 'coluna_b4', 'coluna_p'] },
        { titulo: 'Condensadores', campos: ['cond_hidro', 'cond_b', 'cond_p'] },
        { titulo: 'Vapor e produção', campos: ['vapor', 'producao_lth', 'inpm'] },
      ],
    },
});
