/* Pranchetas Ubirálcool - Ralo / Pesagem: o setor e as folhas dele (campos, limites e avisos)
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
// Mudou algo deste setor? É só aqui. Os tipos de folha e de campo estão explicados no começo de config/forms.js.
window.USINA.setores.push({
      id: 'ralo',
      nome: 'Ralo / Pesagem',
      icone: 'balanca',
      operadores: ['Jair'],
      pranchetas: ['ins_materia_prima'],
});

Object.assign(window.USINA.pranchetas, {
    /* ---------------- RALO ---------------- */
    // No ralo o operador anota o peso do bag e o tipo de produto que está batendo.
    // O fornecedor é opcional (a lista vem do tablet chefe). NF, lote e validade são do escritório.
    ins_materia_prima: Object.assign(insumo('MATÉRIA-PRIMA', 'Matéria-prima', ['kg', 'g']), {
      rotuloQtd: 'Peso do bag',
      // 2.16: vários bags na mesma hora: "+ Outro bag" soma (setores/ralo/regras.js)
      somaPesagens: true,
      camposOperador: [
        { id: 'produto', label: 'Tipo de produto', type: 'choice', opcoes: 'produtos', dica: 'Produto que está sendo batido.' },
        { id: 'fornecedor', label: 'Fornecedor', type: 'choice', opcoes: 'fornecedores', opcional: true, dica: 'Se souber de quem veio.' },
      ],
    }),
});
