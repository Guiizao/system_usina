/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * Definição das pranchetas de cada setor.
 * Para mudar um campo, um valor padrão ou um aviso, é só editar aqui.
 * Operadores, produtos, fornecedores, WhatsApp e e-mail do escritório ficam no tablet chefe,
 * em Configurações da usina.
 *
 * Tipos de prancheta:
 *   dornas  -> uma linha por dorna (Nº 1, 2, 3...), igual ao Anexo I / II do POP 011
 *   insumo  -> uma linha por hora (07:00 até 06:00), igual ao POP-03-FOR-004
 *   juntas  -> duas pranchetas de insumo na mesma tela (ex.: LPHERA e Cal). Na exportação
 *              cada uma continua sendo uma folha separada, como no papel.
 *   grade   -> itens x horas (controle diário da caldeira / destilaria)
 *
 * Tipos de campo:
 *   num    -> teclado numérico (dec = casas decimais; os botões - e + mudam de 1 em 1
 *             na menor casa, ex.: 14 -> 15 ou 5,0 -> 5,1. Use "passo" para mudar isso)
 *   time   -> hora (tem botão AGORA)
 *   choice -> botões grandes com opções
 *   check  -> marca OK
 *   text   -> texto livre
 *
 * Avisos ("avisos" em cada campo):
 *   { quando: '<', valor: 5, nivel: 'alerta', texto: '...' }
 *   nivel 'alerta' = vermelho (precisa fazer algo), 'atencao' = amarelo (ficar de olho).
 *   O aviso nunca impede de salvar.
 */
window.USINA = {
  empresa: 'UBIRÁLCOOL ÁLCOOL DE CEREAIS',

  // Troca de folha: o dia de produção começa às 07:00
  inicioDoDia: 7,
  turnos: [
    { id: 1, nome: '1º Turno', inicio: 7, fim: 16 },
    { id: 2, nome: '2º Turno', inicio: 16, fim: 24 },
    { id: 3, nome: '3º Turno', inicio: 0, fim: 7 },
  ],

  pinAdmin: '159357',

  // Dados que aparecem no cabeçalho e no rodapé das folhas de papel (Excel, XML e impressão saem iguais)
  documentos: {
    pop011: {
      empresa: 'UBIRÁLCOOL ÁLCOOL DE CEREAIS',
      codigo: 'POP 011-RC',
      lateral: ['POP 011-RC', 'ELAB. JÔNATAS', 'REV. FERNANDO', 'APROV. ANT. Marcelo 07/03/2026'],
      aprovacao: [['Elaborador', 'Jônatas Tavares Pedrão'], ['Revisor', 'Fernando Dias'], ['Aprovador', 'Marcelo Franco P.'], ['Data de aprovação', '07.03.2026']],
    },
    pop03: {
      sistema: 'Sistema de Gestão da Qualidade',
      titulo: 'POP-03-FOR-004-REGISTRO DE INSUMOS ADICIONADOS AO PROCESSO',
      assunto: 'Boas Práticas de Fabricação - BPF',
      pagina: 'Página 1 de 1',
      revisao: '00',
      data: '01/06/2026',
    },
    caldeira: {
      responsavel: ['RESPONSAVEL', '', 'JÔNATAS TAVARES PEDRÃO', 'ENGENHEIRO QUÍMICO,', 'PRODUÇÃO E SEGURANÇA', 'DO TRABALHO'],
    },
  },

  // Depois deste tempo sem ninguém mexer, o tablet pede a senha do operador de novo
  minutosSemMexer: 30,

  // Rede da usina
  portaCentral: 8080,
  // Se o aparelho ficar este tempo sem achar a central, ele trava até voltar para o Wi-Fi da usina
  horasForaDaRede: 12,

  // Listas que o tablet chefe pode mudar em Configurações da usina (estes são os valores iniciais)
  produtosPadrao: ['MASSA', 'FINI', 'OUTRO'],
  fornecedoresPadrao: [],

  // Ordem em que os setores aparecem
  setores: [
    {
      id: 'caldeira',
      nome: 'Caldeira',
      icone: 'chama',
      operadores: ['Alberto', 'Diego', 'Lucas'],
      pranchetas: ['caldeira'],
    },
    {
      id: 'ralo',
      nome: 'Ralo / Pesagem',
      icone: 'balanca',
      operadores: ['Jair'],
      pranchetas: ['ins_materia_prima'],
    },
    {
      id: 'hidrolise',
      nome: 'Hidrólise',
      icone: 'tanque',
      operadores: ['Guilherme', 'Felipe', 'Carlindo', 'Cleber', 'Romenique'],
      pranchetas: ['hid_anexo1', 'hid_anexo2', 'juntas_lphera_cal', 'juntas_saczyme_alcolina'],
    },
    {
      id: 'destilaria',
      nome: 'Destilaria e Fermentação',
      icone: 'coluna',
      operadores: ['Mateus'],
      pranchetas: ['destilaria', 'ins_lactrol', 'ins_ureia'],
    },
    {
      id: 'nova_destilaria',
      nome: 'Nova Destilaria',
      icone: 'fabrica',
      operadores: ['Operador 1'],
      pranchetas: ['nova_destilaria'],
    },
  ],

  pranchetas: {
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
          id: 'brix', label: 'Brix', type: 'num', dec: 0, min: 3, max: 40, dica: 'Média 15 a 25. Acima de 25, quebre com água e enzima.',
          avisos: [
            { quando: '>', valor: 25, nivel: 'alerta', texto: 'Brix acima de 25: quebre com água e enzima', curto: 'Brix alto' },
          ],
        },
        {
          // pH depois da correção com cal: sem o aviso de pH baixo (ele vale só para o primeiro pH)
          id: 'phf2', label: 'pHf', type: 'num', dec: 1, min: 2, max: 9, dica: 'pH depois da cal. Média 4,9 a 5,3.',
        },
        { id: 'anti', label: 'Anti.', type: 'num', dec: 0, dica: 'Antibiótico, quando for usado.' },
        { id: 'enzi', label: 'Enzi.', type: 'num', dec: 0, padrao: '70', dica: 'Enzima da dorna de baixo. O normal é 70.' },
        { id: 'bhx', label: 'BHX', type: 'num', dec: 0, min: 3, max: 40, dica: 'Brix depois da água e da enzima.' },
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
          id: 'bhx', label: 'BHX', type: 'num', dec: 0, min: 3, max: 40, dica: 'Média 15 a 25.',
          avisos: [
            { quando: '>', valor: 25, nivel: 'alerta', texto: 'Brix acima de 25: quebre com água e enzima', curto: 'Brix alto' },
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

    /* ---------------- RALO ---------------- */
    // No ralo o operador anota o peso do bag e o tipo de produto que está batendo.
    // O fornecedor é opcional (a lista vem do tablet chefe). NF, lote e validade são do escritório.
    ins_materia_prima: Object.assign(insumo('MATÉRIA-PRIMA', 'Matéria-prima', ['kg', 'g']), {
      rotuloQtd: 'Peso do bag',
      camposOperador: [
        { id: 'produto', label: 'Tipo de produto', type: 'choice', opcoes: 'produtos', dica: 'Produto que está sendo batido.' },
        { id: 'fornecedor', label: 'Fornecedor', type: 'choice', opcoes: 'fornecedores', opcional: true, dica: 'Se souber de quem veio.' },
      ],
    }),

    /* ---------------- FERMENTAÇÃO ---------------- */
    ins_lactrol: insumo('FERMENTAÇÃO - ANTIBIÓTICO LACTROL', 'Antibiótico Lactrol', ['mL', 'L']),
    ins_ureia: insumo('URÉIA PECUÁRIA', 'Uréia Pecuária', ['kg', 'g']),

    /* ---------------- CALDEIRA ---------------- */
    caldeira: {
      tipo: 'grade',
      nome: 'Controle Diário da Caldeira',
      codigo: 'Controle Diário',
      titulo: 'Controle Diário da Caldeira',
      papel: { modelo: 'caldeira' },
      responsavel: 'Jônatas Tavares Pedrão - Eng. Químico, Produção e Seg. do Trabalho',
      itens: [
        { id: 'inicio_aquec', label: 'Início Aquec.', papel: 'INÍCIO AQUEC', labelCurto: 'Aquecimento', type: 'check' },
        { id: 'parada', label: 'Parada', papel: 'PARADA', type: 'check' },
        { id: 'pressao', label: 'Pressão', papel: 'PRESSÃO', unidade: 'kgf', type: 'num', dec: 1, min: 0, max: 12 },
        { id: 'temp_agua', label: 'Temperat. Água', papel: 'TEMPERAT AGUA', labelCurto: 'Água', unidade: '°C', type: 'num', dec: 0 },
        { id: 'descarga_fundo', label: 'Descarga de Fundo', papel: 'DESCARGA DE FUNDO', labelCurto: 'De fundo', type: 'choice', opcoes: ['01', '02', '03'] },
        { id: 'descarga_garrafa', label: 'Descarga Garrafa', papel: 'DESCARGA GARRAFA', labelCurto: 'Garrafa', type: 'check' },
        { id: 'retirada_cinza', label: 'Retirada Cinza', papel: 'RETIRADA CINZA', type: 'check' },
      ],
      grupos: [
        { titulo: 'Caldeira', campos: ['inicio_aquec', 'parada'] },
        { titulo: 'Pressão e água', campos: ['pressao', 'temp_agua'] },
        { titulo: 'Descargas', campos: ['descarga_fundo', 'descarga_garrafa'] },
        { titulo: 'Cinza', campos: ['retirada_cinza'] },
      ],
    },

    /* ---------------- DESTILARIA ---------------- */
    destilaria: {
      tipo: 'grade',
      nome: 'Controle Diário da Destilaria',
      codigo: 'Controle Diário',
      titulo: 'Controle Diário da Destilaria',
      papel: { modelo: 'destilaria' },
      itens: [
        { id: 'temp_pe_a', label: 'Temp. pé da coluna A', unidade: '°C', type: 'num', dec: 1 },
        { id: 'producao', label: 'Produção Álcool', papel: 'PRODUÇÃO ÁLCOOL', type: 'num', dec: 0 },
        { id: 'carregamento', label: 'Carregamento', papel: 'CARREGAMENTO', type: 'num', dec: 0 },
        { id: 'vapor', label: 'Vapor / Caldeira', papel: 'Vapor/ Caldeira', unidade: 'kgf', type: 'num', dec: 1 },
        { id: 'inpm', label: 'INPM', unidade: '°', type: 'num', dec: 1, min: 80, max: 100 },
      ],
      grupos: [
        { titulo: 'Coluna e vapor', campos: ['temp_pe_a', 'vapor'] },
        { titulo: 'Produção', campos: ['producao', 'carregamento'] },
        { titulo: 'Álcool', campos: ['inpm'] },
      ],
    },

    /* ---------------- NOVA DESTILARIA ---------------- */
    nova_destilaria: {
      tipo: 'grade',
      nome: 'Controle Diário - Nova Destilaria',
      codigo: 'Controle Diário',
      titulo: 'Usina Ubirálcool - Controle Diário da Destilaria (Nova)',
      papel: { modelo: 'nova' },
      itens: [
        { id: 'inicio_aquec', label: 'Início Aquecimento', papel: 'Inicio Aquecimento', labelCurto: 'Aquecimento', type: 'check' },
        { id: 'coluna_hidro', label: 'Coluna Hidro', labelCurto: 'Hidro', unidade: '°C', type: 'num', dec: 1 },
        { id: 'coluna_b', label: 'Coluna B', labelCurto: 'B', unidade: '°C', type: 'num', dec: 1 },
        { id: 'coluna_p', label: 'Coluna P', labelCurto: 'P', unidade: '°C', type: 'num', dec: 1 },
        { id: 'cond_hidro', label: 'Condensador Hidro', labelCurto: 'Hidro', unidade: '°C', type: 'num', dec: 1 },
        { id: 'cond_b', label: 'Condensador B', labelCurto: 'B', unidade: '°C', type: 'num', dec: 1 },
        { id: 'cond_p', label: 'Condensador P', labelCurto: 'P', unidade: '°C', type: 'num', dec: 1 },
        { id: 'vapor', label: 'Vapor Caldeira', labelCurto: 'Vapor', unidade: 'kgf', type: 'num', dec: 1 },
        { id: 'producao_lth', label: 'Produção LT/H', labelCurto: 'LT/H', type: 'num', dec: 0 },
        { id: 'inpm', label: 'INPM', unidade: '°', type: 'num', dec: 1, min: 80, max: 100 },
      ],
      grupos: [
        { titulo: 'Colunas', campos: ['coluna_hidro', 'coluna_b', 'coluna_p'] },
        { titulo: 'Condensadores', campos: ['cond_hidro', 'cond_b', 'cond_p'] },
        { titulo: 'Aquecimento e vapor', campos: ['inicio_aquec', 'vapor'] },
        { titulo: 'Produção', campos: ['producao_lth', 'inpm'] },
      ],
    },
  },
};

function insumo(nomeNoPapel, nomeCurto, unidades) {
  return {
    tipo: 'insumo',
    nome: nomeCurto,
    codigo: 'POP-03-FOR-004',
    titulo: 'Registro de Insumos Adicionados ao Processo - ' + nomeNoPapel,
    // como o nome aparece em cima da tabela, no papel
    rotuloPapel: /^(FERMENTAÇÃO|MATÉRIA)/.test(nomeNoPapel) ? nomeNoPapel.replace(' - ', ' ') : 'Nome do Insumo/Produto: ' + nomeNoPapel,
    unidade: unidades[0],
    unidades: unidades,
    // Campos que o operador não precisa preencher (o escritório completa)
    camposEscritorio: [
      { id: 'fornecedor', label: 'Fornecedor' },
      { id: 'nf', label: 'Nº NF' },
      { id: 'lote', label: 'Lote' },
      { id: 'validade', label: 'Data de Validade do Lote' },
    ],
  };
}
