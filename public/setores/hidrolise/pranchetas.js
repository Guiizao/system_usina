/* Pranchetas Ubirálcool - Hidrólise e Sacarificação: o setor e as folhas dele (campos, limites e avisos)
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
// Mudou algo deste setor? É só aqui. Os tipos de folha e de campo estão explicados no começo de config/forms.js.
window.USINA.setores.push({
      id: 'hidrolise',
      nome: 'Hidrólise',
      icone: 'tanque',
      operadores: ['Guilherme', 'Felipe', 'Carlindo', 'Cleber', 'Romenique'],
      pranchetas: ['hid_anexo1', 'hid_anexo2', 'juntas_lphera_cal', 'juntas_saczyme_alcolina'],
});

Object.assign(window.USINA.pranchetas, {
    /* ---------------- HIDRÓLISE ---------------- */
    // Dorna de baixo
    hid_anexo1: {
      tipo: 'dornas',
      nome: 'Hidrólise',
      rotulo: 'Dorna',
      // Etapas da dorna (como é feito na área):
      //   enchendo  -> a dorna de baixo está enchendo; o operador anota Brix, pH, cal e enzima
      //   enviando  -> a bomba está mandando a dorna para o tanque de cima (marca o horário de início)
      //   anotada   -> terminou de esvaziar (marca o horário de fim)
      // Uma bomba manda uma dorna de cada vez: ao enviar a próxima, a que estava indo termina no mesmo horário.
      envio: { inicio: 'inicio', fim: 'fim' },
      codigo: 'Anexo I - POP 011',
      titulo: 'Monitoramento do Processo de Hidrólise',
      maxLinhas: 25,
      papel: { modelo: 'pop011', titulo: 'Anexo I-Pop 011-Monitoramento do Processo de Hidrólise' },
      // A ordem abaixo é a das COLUNAS DO PAPEL (tabela e Excel saem assim)
      campos: [
        { id: 'inicio', label: 'Horário Início', papel: 'Horario Início', labelCurto: 'Início', type: 'time', vazioTexto: 'Marca ao enviar', dica: 'Hora em que a dorna começou a ir para o tanque de cima. Marca sozinho no botão Enviar.' },
        { id: 'fim', label: 'Horário Fim', labelCurto: 'Fim', type: 'time', vazioTexto: 'Marca ao terminar', dica: 'Hora em que a dorna terminou de esvaziar.' },
        {
          id: 'phf', label: 'PHF', type: 'num', dec: 1, min: 2, max: 9, dica: 'pH medido antes da cal. Média 4,9 a 5,3. Abaixo de 5,0, coloque cal.',
          avisos: [
            { quando: '<', valor: 5, nivel: 'alerta', texto: 'pH abaixo de 5,0: coloque cal', curto: 'pH baixo' },
            { quando: '>=', valor: 7, nivel: 'atencao', texto: 'pH alto, 7 ou mais', curto: 'pH alto' },
          ],
        },
        { id: 'cal', label: 'Cal', type: 'num', dec: 1, unidade: 'copos', dica: 'Quantos copos de cal (copo de 1 litro). Sem cal, deixe em branco.' },
        {
          id: 'brix', label: 'Brix', type: 'num', dec: 0, min: 3, max: 40, dica: 'Média 15 a 24. Com 25 ou mais, quebre com água e enzima.',
          avisos: [
            { quando: '>=', valor: 25, nivel: 'alerta', texto: 'Brix 25 ou mais: quebre com água e enzima', curto: 'Brix alto' },
          ],
        },
        {
          // pH depois da correção com cal: sem o aviso de pH baixo (ele vale só para o primeiro pH)
          id: 'phf2', label: 'pHf', type: 'num', dec: 1, min: 2, max: 9, dica: 'pH depois da cal. Média 4,9 a 5,3.',
        },
        { id: 'anti', label: 'Anti.', type: 'num', dec: 0, dica: 'Antibiótico, quando for usado.' },
        { id: 'enzi', label: 'Enzi.', type: 'num', dec: 0, padrao: '70', dica: 'Enzima da dorna de baixo. O normal é 70.' },
        {
          // 2.16: o BHX também avisa (pedido de 21/10: 25 ou mais já é Brix alto)
          id: 'bhx', label: 'BHX', type: 'num', dec: 0, min: 3, max: 40, dica: 'Brix depois da água e da enzima.',
          avisos: [
            { quando: '>=', valor: 25, nivel: 'alerta', texto: 'Brix 25 ou mais: quebre com água e enzima', curto: 'Brix alto' },
          ],
        },
        { id: 'produto', label: 'Produto', type: 'choice', opcoes: 'produtos', dica: 'Produto que está sendo trabalhado.' },
      ],
      // Como os quadros ficam agrupados na tela
      grupos: [
        { titulo: 'Horário', campos: ['inicio', 'fim'] },
        { titulo: 'Brix', campos: ['brix', 'bhx'] },
        { titulo: 'pH', campos: ['phf', 'phf2'] },
        { titulo: 'Cal e enzima', campos: ['cal', 'enzi'] },
        { titulo: 'Produto e antibiótico', campos: ['produto', 'anti'] },
      ],
      // Colunas copiadas da dorna anterior ao criar uma nova.
      // Brix, pH e cal não repetem: são medidos em cada dorna, e o aviso de pH/Brix só vale com a medida nova.
      copiarDaAnterior: ['anti', 'enzi', 'produto'],
    },

    // Dorna de cima: repete a dorna de baixo de mesmo número
    hid_anexo2: {
      tipo: 'dornas',
      nome: 'Sacarificação',
      rotulo: 'Dorna',
      codigo: 'Anexo II - POP 011',
      titulo: 'Monitoramento do Processo de Sacarificação',
      maxLinhas: 25,
      papel: { modelo: 'pop011', titulo: 'Anexo II-Pop 011-Monitoramento do Processo de SACARIFICAÇÃO' },
      campos: [
        { id: 'horario', label: 'Horário', type: 'time', agoraAoCriar: true },
        { id: 'sac', label: 'SAC', type: 'num', dec: 0, padrao: '4', dica: 'Número da dorna de sacarificação.' },
        {
          // é o pH final da Hidrólise, já corrigido: sem o aviso de pH baixo
          id: 'phf', label: 'PHF', type: 'num', dec: 1, min: 2, max: 9, dica: 'Média 4,9 a 5,3.',
        },
        {
          id: 'bhx', label: 'BHX', type: 'num', dec: 0, min: 3, max: 40, dica: 'Média 15 a 24. Com 25 ou mais, quebre.',
          avisos: [
            { quando: '>=', valor: 25, nivel: 'alerta', texto: 'Brix 25 ou mais: quebre com água e enzima', curto: 'Brix alto' },
          ],
        },
        { id: 'enz', label: 'ENZ.', type: 'num', dec: 0, padrao: '100', dica: 'Saczyme da dorna de cima. O normal é 100.' },
        { id: 'anti', label: 'Anti.', type: 'num', dec: 0, padrao: '100', dica: 'Antibiótico da dorna de cima. O normal é 100.' },
      ],
      grupos: [
        { titulo: 'Horário e dorna', campos: ['horario', 'sac'] },
        { titulo: 'pH e Brix', campos: ['phf', 'bhx'] },
        { titulo: 'Enzima e antibiótico', campos: ['enz', 'anti'] },
      ],
      // A dorna de mesmo número da Hidrólise cria e preenche esta linha sozinha: horário de início, pH final e Brix final.
      // Enquanto ninguém mudar esses quadros aqui, eles acompanham a Hidrólise. Mudou à mão, para de copiar
      // (dá para voltar a copiar no botão "Copiar da Hidrólise").
      vemDe: { prancheta: 'hid_anexo1', campos: { horario: 'inicio', phf: 'phf2', bhx: 'bhx' } },
      copiarDaAnterior: ['sac', 'enz', 'anti'],
    },

    // Duas pranchetas de insumo na mesma tela. As horas são somadas sozinhas das dornas enviadas naquela hora
    // (ex.: duas dornas das 08h = 140 de LPHERA e 200 de Saczyme); o operador só confere e confirma.
    juntas_lphera_cal: {
      tipo: 'juntas',
      nome: 'LPHERA / Cal',
      codigo: 'POP-03-FOR-004',
      partes: [
        { prancheta: 'ins_lphera', sugestao: { prancheta: 'hid_anexo1', campo: 'enzi', hora: 'inicio' } },
        { prancheta: 'ins_cal', sugestao: { prancheta: 'hid_anexo1', campo: 'cal', hora: 'inicio' } },
      ],
    },
    juntas_saczyme_alcolina: {
      tipo: 'juntas',
      nome: 'Saczyme / Antibiótico',
      codigo: 'POP-03-FOR-004',
      partes: [
        { prancheta: 'ins_saczyme', sugestao: { prancheta: 'hid_anexo2', campo: 'enz', hora: 'horario' } },
        { prancheta: 'ins_alcolina', sugestao: { prancheta: 'hid_anexo2', campo: 'anti', hora: 'horario' } },
      ],
    },

    ins_lphera: insumo('LPHERA', 'LPHERA', ['mL', 'L']),
    // a cal é medida num copo de 1 litro: anota quantos copos
    ins_cal: insumo('CAL', 'Cal', ['copos']),
    ins_saczyme: insumo('SACZYME', 'Saczyme', ['mL', 'L']),
    ins_alcolina: insumo('FERMENTAÇÃO - ANTIBIÓTICO ALCOLINA', 'Antibiótico', ['mL', 'L']),
});
