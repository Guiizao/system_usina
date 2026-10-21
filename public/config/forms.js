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
 *   medicao -> volume de vinho: a folga de cada dorna, medida com a trena de manhã (medidas em "medicaoPadrao")
 *   fermentacao -> cada dorna de fermentação: enchimento, Brix e volume do dia e envio para a volante
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

  /* Medidas das dornas (da planilha CONTROLE LTS do escritório).
     Volume em litros = (altura - folga) x área da base x 1000 (tanques de álcool: em m³, sem o x1000).
     Altura e folga em metros, área em m². Grupos como o Lucas respondeu em 28/09/2026.
     O escritório corrige em Configurações da usina (vale para todos os tablets); isto aqui é só o começo.
     soma: entra no total de vinho da produção (os tanques de álcool têm o total deles). */
  medicaoPadrao: {
    versao: 2, // muda quando os grupos mudam: medidas guardadas de uma versão antiga não valem mais
    grupos: [
      { id: 'hid', nome: 'Hidrólise', brix: true, soma: true, dornas: [
        { id: 'hid1', nome: 'Dorna 1', altura: 1, area: 2.01 }, { id: 'hid2', nome: 'Dorna 2', altura: 1, area: 2.01 },
        { id: 'hid3', nome: 'Dorna 3', altura: 1, area: 2.01 }, { id: 'hid4', nome: 'Dorna 4', altura: 1, area: 2.01 },
        { id: 'hid5', nome: 'Dorna 5', altura: 1, area: 2.01 }] },
      { id: 'sac', nome: 'Sacarificação', brix: true, soma: true, dornas: [
        { id: 'sac1', nome: 'Dorna 1', altura: 2.7, area: 2.835 }, { id: 'sac2', nome: 'Dorna 2', altura: 2.7, area: 2.835 },
        { id: 'sac3', nome: 'Dorna 3', altura: 2.7, area: 2.835 }, { id: 'sac4', nome: 'Dorna 4', altura: 2.7, area: 2.835 },
        { id: 'sac5', nome: 'Dorna 5', altura: 2.7, area: 2.835 }, { id: 'sac6', nome: 'Dorna 6', altura: 2.7, area: 2.835 }] },
      // fermentação: dornas 7 a 12 (o caderno dos destiladores, com a volante, é destas)
      { id: 'fer', nome: 'Fermentação', brix: true, fermentando: true, soma: true, dornas: [
        { id: 'fer7', nome: 'Dorna 7', altura: 2.7, area: 2.835 }, { id: 'fer8', nome: 'Dorna 8', altura: 2.7, area: 2.835 },
        { id: 'fer9', nome: 'Dorna 9', altura: 2.7, area: 2.835 }, { id: 'fer10', nome: 'Dorna 10', altura: 2.7, area: 2.835 },
        { id: 'fer11', nome: 'Dorna 11', altura: 2.7, area: 2.835 }, { id: 'fer12', nome: 'Dorna 12', altura: 2.7, area: 2.835 }] },
      // descanso: dornas 1 a 11 (sem a 3), as grandes
      { id: 'dsc', nome: 'Dornas de descanso', brix: true, soma: true, dornas: [
        { id: 'dsc1', nome: 'Dorna 1', altura: 6, area: 4.908 }, { id: 'dsc2', nome: 'Dorna 2', altura: 6, area: 4.908 },
        { id: 'dsc4', nome: 'Dorna 4', altura: 6, area: 4.908 }, { id: 'dsc5', nome: 'Dorna 5', altura: 6, area: 4.908 },
        { id: 'dsc6', nome: 'Dorna 6', altura: 6, area: 4.908 }, { id: 'dsc7', nome: 'Dorna 7', altura: 6, area: 4.908 },
        { id: 'dsc8', nome: 'Dorna 8', altura: 6, area: 4.908 }, { id: 'dsc9', nome: 'Dorna 9', altura: 6, area: 4.908 },
        { id: 'dsc10', nome: 'Dorna 10', altura: 6, area: 4.908 }, { id: 'dsc11', nome: 'Dorna 11', altura: 6, area: 4.908 }] },
      // tanques de álcool em m³, como na planilha (sem o x1000)
      { id: 'tq', nome: 'Tanques de álcool', brix: false, soma: false, unidade: 'm³', dornas: [
        { id: 'tq_dest', nome: 'Tanque Destilaria', altura: null, area: null },
        { id: 'tq_inox1', nome: 'Tanque Inox 1', altura: 3.74, area: 1.606 }, { id: 'tq_inox2', nome: 'Tanque Inox 2', altura: 3.74, area: 1.606 },
        { id: 'tq_abast1', nome: 'Tanque Abastecimento 1', altura: 2.5, area: 2.01 }, { id: 'tq_abast2', nome: 'Tanque Abastecimento 2', altura: 2.5, area: 2.01 },
        { id: 'tq_abast3', nome: 'Tanque Abastecimento 3', altura: 5.44, area: 2.835 }, { id: 'tq_neutro', nome: 'Tanque Neutro', altura: 5, area: 6.048 }] },
    ],
  },

  // Troca de folha: o dia de produção começa às 07:00
  inicioDoDia: 7,
  turnos: [
    { id: 1, nome: '1º Turno', inicio: 7, fim: 16 },
    { id: 2, nome: '2º Turno', inicio: 16, fim: 24 },
    { id: 3, nome: '3º Turno', inicio: 0, fim: 7 },
  ],
  // Turnos de 12 horas (versão 2.13.4): o setor que trabalha assim escolhe este modelo nas Configurações da usina
  // (tablet chefe nível 2 ou 3). O dia de produção continua das 7h às 7h.
  turnos12h: [
    { id: 1, nome: '1º Turno', inicio: 7, fim: 19 },
    { id: 2, nome: '2º Turno', inicio: 19, fim: 7 },
  ],

  // Senha de emergência dos ajustes dos tablets dos setores, quando a central não responde (é a do administrador).
  // Com a central, quem entra é cada pessoa com a sua senha (Pessoas e permissões, no tablet chefe).
  pinAdmin: '159357',

  // Pessoas do escritório (versão 2.9): o que cada nível pode fazer no tablet chefe.
  // O administrador ajusta por pessoa (ligar ou desligar uma função) e por tablet chefe (o que aquele aparelho deixa fazer).
  // "Pessoas e permissões" é só do administrador e não aparece na lista.
  funcoes: [
    { id: 'anotar', nome: 'Anotar nas folhas do tablet chefe (Vinho e Fermentação)' },
    { id: 'corrigir', nome: 'Corrigir o que os setores anotaram' },
    { id: 'avisos', nome: 'Mandar avisos aos setores' },
    { id: 'relatorios', nome: 'Relatórios: gerar, enviar, imprimir e apagar' },
    { id: 'ler_folha', nome: 'Ler folha de papel pela foto' },
    { id: 'usina', nome: 'Configurar a usina (operadores, setores, listas e medidas)' },
    { id: 'folhas', nome: 'Mudar as folhas (nomes dos quadros, unidades e avisos)' },
    { id: 'conexao', nome: 'Conectar tablets e trocar o código de conexão' },
    { id: 'integracoes', nome: 'Nuvem e Base44' },
    { id: 'ajustes', nome: 'Ajustes dos tablets (função do aparelho, operadores, apagar dados)' },
    { id: 'registro', nome: 'Ver o registro do sistema' },
    // versão 2.12: liberar um aparelho como tablet chefe (nível 1 ou 2) e mudar o nível dos outros
    { id: 'chefes', nome: 'Liberar tablets chefe e escolher o nível' },
    // versão 2.13: o aparelho do Escritório (cálculos da produção, rastreamento de lotes e etiqueta das bombonas)
    { id: 'escritorio', nome: 'Escritório: cálculos, rastreamento de lotes e etiqueta' },
  ],
  // Níveis do tablet chefe (versão 2.12), do aparelho: a central guarda e confere.
  // O que a pessoa faz no aparelho = funções dela ∩ funções do nível ∩ limite do aparelho.
  niveisDoAparelho: {
    1: { nome: 'Nível 1', texto: 'Vê, corrige, envia e escritório', funcoes: ['corrigir', 'relatorios', 'escritorio'] },
    2: { nome: 'Nível 2', texto: 'Quase tudo, menos conectar tablets (o dono escolhe)', funcoes: 'todas' },
    3: { nome: 'Nível 3', texto: 'Tudo, mais as configurações do sistema (só o dono)', funcoes: 'todas' },
  },
  niveis: {
    administrador: { nome: 'Administrador', funcoes: 'todas' },
    encarregado: { nome: 'Encarregado', funcoes: ['anotar', 'corrigir', 'avisos', 'relatorios', 'ler_folha', 'usina', 'conexao', 'ajustes'] },
    consulta: { nome: 'Consulta', funcoes: ['relatorios'] },
  },

  // Gráficos do dia no tablet chefe (versão 2.10). Cada um junta quadros de uma folha, na ordem em que aparecem.
  // No painel vão os quatro primeiros que tiverem anotação no dia. As linhas tracejadas são os avisos do quadro.
  graficos: [
    { prancheta: 'hid_anexo1', titulo: 'Hidrólise: Brix', campos: ['brix', 'bhx'] },
    { prancheta: 'hid_anexo1', titulo: 'Hidrólise: pH', campos: ['phf', 'phf2'] },
    { prancheta: 'nova_destilaria', titulo: 'Nova Destilaria: colunas', campos: ['coluna_hidro', 'coluna_b', 'coluna_b4', 'coluna_p'] },
    { prancheta: 'destilaria', titulo: 'Destilaria: pé da coluna A', campos: ['temp_pe_a'] },
    { prancheta: 'hid_anexo2', titulo: 'Sacarificação: Brix', campos: ['bhx'] },
    { prancheta: 'hid_anexo2', titulo: 'Sacarificação: pH', campos: ['phf'] },
    { prancheta: 'nova_destilaria', titulo: 'Nova Destilaria: condensadores', campos: ['cond_hidro', 'cond_b', 'cond_p'] },
    { prancheta: 'nova_destilaria', titulo: 'Nova Destilaria: vapor', campos: ['vapor'] },
    { prancheta: 'destilaria', titulo: 'Destilaria: vapor', campos: ['vapor'] },
    { prancheta: 'destilaria', titulo: 'Destilaria: INPM', campos: ['inpm'] },
    { prancheta: 'caldeira', titulo: 'Caldeira: pressão', campos: ['pressao'] },
    { prancheta: 'caldeira', titulo: 'Caldeira: temperatura da água', campos: ['temp_agua'] },
  ],

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
  // Endereço na internet da pasta com o versao.json e o pranchetas.apk (a nuvem das pranchetas).
  // Vazio: as atualizações vêm só da central da usina (o computador passa para os tablets).
  atualizacaoOnline: '',
  // Se o aparelho ficar este tempo sem achar a central, ele trava até voltar para o Wi-Fi da usina

  // Listas que o tablet chefe pode mudar em Configurações da usina (estes são os valores iniciais)
  produtosPadrao: ['MASSA', 'FINI', 'OUTRO'],
  fornecedoresPadrao: [],

  // Escritório (versão 2.13): folha POP 03 - FOR 011 (rastreamento de lotes) e a etiqueta das bombonas.
  // O dia de produção vai das 07:00 de um dia às 07:00 do outro; o lote fecha às 07:00 do dia seguinte (DIA ATUAL).
  rastreamento: {
    // conta que o Lucas passou: hidrolisado (L) = matéria-prima (kg) ÷ 0,29; vinho (L) = hidrolisado × Brix inicial ÷ Brix final
    fatorMateriaPrima: 0.29,
    // lote: UB + ano + letra do mês + dia + hora e minuto do fechamento. 08/10/2026 às 07:00 = UB26I080700
    prefixoLote: 'UB',
    letrasDosMeses: 'LABCDEFGHIJK', // janeiro L, fevereiro A, março B ... outubro I, novembro J, dezembro K
    horaDoLote: '0700',
    validadeAlcoolMeses: 36,
    validadeVinhacaDias: 5,
    // parâmetros impressos no papel (o resultado do dia vai do lado)
    parametros: {
      hidrolise: [['ph', 'PH', '6,00 — 7,00'], ['brix', 'BRIX', '15 — 22'], ['temp', 'TEMP °C', '92° — 96°']],
      alcool: [['inpm', 'GRAU °INMP', '92,5 — 93,5'], ['gl', 'GRAU °GL', '95,0 — 95,8'], ['acidez', 'ACIDEZ (ppm/lts)', '< 1,00']],
    },
    // tanques do papel (nome, e a dorna do Volume de vinho que tem a folga dele; sem dorna: escrito à mão)
    tanques: [
      { titulo: 'HIDRÓLISE · TQs da Hidrólise', lista: [['h1', 'Hid. 1', 'hid1'], ['h2', 'Hid. 2', 'hid2']] },
      { titulo: 'SACARIFICAÇÃO · TQs da Sacarificação', lista: [['s1', 'Sac. 1-7.5', 'sac1'], ['s2', 'Sac. 2-7.5', 'sac2'], ['s3', 'Sac. 3-7.5', 'sac3'], ['s4', 'Sac. 4-7.5', 'sac4'], ['s5', 'Sac. 5-7.5', 'sac5']] },
      { titulo: 'FERMENTAÇÃO', lista: [['f1', 'F1-7.5'], ['f2', 'F2-7.5'], ['f3', 'F3-7.5'], ['f4', 'F4-7.5'], ['f5', 'F5-7.5'], ['v1', 'V1-30 (volante)']] },
      { titulo: 'DORNAS DE DESCANSO', lista: [['d1', 'D1-30', 'dsc1'], ['d2', 'D2-30', 'dsc2'], ['d4', 'D4-30', 'dsc4'], ['d5', 'D5-30', 'dsc5'], ['d6', 'D6-30', 'dsc6'], ['d7', 'D7-30', 'dsc7'], ['d8', 'D8-30', 'dsc8'], ['d9', 'D9-30', 'dsc9'], ['d10', 'D10-30', 'dsc10'], ['d11', 'D11-30', 'dsc11']] },
    ],
    // insumos do papel; com prancheta, a quantidade do dia e o lote, a validade, a NF e o fornecedor vêm das folhas de insumo
    insumos: [
      ['lphera', 'LPHERA', 'ins_lphera'], ['saczyme', 'SACZYME', 'ins_saczyme'], ['ureia', 'URÉIA PECUÁRIA', 'ins_ureia'], ['cal', 'CAL', 'ins_cal'],
      ['ferm_alcolina', 'FERMENTO ALCOLINA'], ['ferm_fleischmann', 'FERMENTO FLEISCHMANN'], ['anti_alcolina', 'ANTI. ALCOLINA', 'ins_alcolina'],
      ['anti_lactol', 'ANTI. LACTOL', 'ins_lactrol'], ['biosperce', 'BIOSPERCE'], ['performax', 'PERFORMAX'], ['amertrol', 'AMERTROL'],
    ],
    tratamentoAgua: [['amersite', 'AMERSITE'], ['cloro', 'CLORO']],
    higienizacao: [['soda', 'SODA CÁUSTICA EM ESCAMAS']],
    encarregado: 'FERNANDO',
    aviso: 'ANOTAR NO VERSO DO DOCUMENTO POP 03-FOR011 AS OCORRÊNCIAS DE PRODUTOS NÃO CONFORMES E LIMPEZA DOS EQUIPAMENTOS',
    // etiqueta da bombona (igual ao adesivo de 01/10/2026). Peso líquido = volume × densidade; peso bruto = líquido + tara.
    // 50 L davam 40,45 kg (0,809 kg/L) e 42,70 kg com a bombona (2,25 kg).
    etiqueta: {
      empresa: 'USINA UBIRALCOOL LTDA',
      endereco: 'Rod. Ubirajara/Alvinlândia, KM 2 s/nº - Água do Caçador - Ubirajara - SP - CEP: 17.449-899 Brasil',
      telefone: '(14) 3042-1870',
      emergencia: '(14) 3042-1870',
      produto: 'ETANOL, ÁLCOOL ETÍLICO HIDRATADO, ÁLCOOL DE CEREAIS',
      onu: '1170',
      nomeEmbarque: 'ETANOL (ÁLCOOL ETÍLICO)',
      classeRisco: '3',
      grupoEmbalagem: 'II',
      numeroRisco: '33',
      composicao: 'Etanol 96%',
      responsavel: 'Jônatas Tavares Pedrão',
      registro: 'CRQ 4ª Reg. Nº 04.493.760',
      perigo: 'Líquido e vapores altamente inflamáveis. Provoca irritação ocular grave.',
      precaucao: 'Mantenha afastado do calor, superfícies quentes, faíscas, chamas abertas e outras fontes de ignição. Não fume. Mantenha o recipiente hermeticamente fechado. Aterre o vaso contentor e o receptor do produto durante transferências. Utilize equipamento elétrico, de ventilação e de iluminação à prova de explosão. Lave cuidadosamente após o manuseio. Use luvas de proteção, roupa de proteção, proteção ocular, proteção facial e proteção auricular.',
      ficha: 'A Ficha Com Dados De Segurança deste produto químico perigoso pode ser obtida por meio de contato no telefone: (14) 3042-1870.',
      volumes: [50],
      densidade: 0.809,
      tara: { 50: 2.25 },
    },
  },

  // Ordem em que os setores aparecem
  // cada setor (com as folhas dele) fica em setores/<setor>/pranchetas.js; a ordem dos setores é a do index.html
  setores: [],


  // as folhas dos setores entram aqui pelos arquivos de cada setor (setores/<setor>/pranchetas.js)
  pranchetas: {
    /* ---------------- ESCRITÓRIO (versão 2.13) ---------------- */
    // Uma anotação por dia de produção (chave 'dia'), feita no aparelho do Escritório. Não é de nenhum setor.
    rastreamento: {
      tipo: 'rastreamento',
      nome: 'Rastreamento de lotes',
      codigo: 'POP 03 - FOR 011',
      titulo: 'RASTREAMENTO DE LOTES DA PRODUÇÃO DE VINHAÇA DE CEREAIS E DE ÁLCOOL',
      revisao: '01/2026',
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
