/* Pranchetas Digitais - (c) 2026 Guilherme. Todos os direitos reservados. Uso somente com autorizacao do autor (veja LICENCA.txt). */
/* O que mudou em cada versão. Aparece uma vez depois que o aplicativo atualiza, e também nos Ajustes.
   A primeira da lista é a versão atual: tem de ser igual ao VERSAO do app.js (os testes conferem).
   Depois do sinal de igual vem JSON puro, porque o servidor do tablet chefe (Java) também lê este arquivo. */
window.NOVIDADES = [
  {
    "versao": "3.1.4",
    "data": "2026-11-09",
    "itens": [
      "Celular: Início e Setores novos. O Caminho da produção diz em palavras como está cada etapa, o gráfico mostra os números, e cada setor mostra se está ligado, quem está nele e quanto já foi anotado.",
      "As duas telas se ajustam sozinhas ao tamanho do celular, para caber sem rolar."
    ]
  },
  {
    "versao": "3.1.3",
    "data": "2026-11-09",
    "itens": [
      "Assistente: nova permissão Usar o assistente (IA) na ficha de cada pessoa, em Pessoas. Quem tem usa em qualquer aparelho com internet, no Wi-Fi ou nos dados móveis, inclusive no tablet chefe, sem sair dele. Quem não tem não vê o assistente.",
      "Dono e administradores já vêm com a permissão ligada. Para os outros, é só ligar na ficha da pessoa."
    ]
  },
  {
    "versao": "3.1.2",
    "data": "2026-11-09",
    "itens": [
      "Celular: barra de baixo nova. O botão escolhido sobe numa bolha verde e a curva da barra acompanha o toque. O Assistente fica no meio da barra."
    ]
  },
  {
    "versao": "3.1.1",
    "data": "2026-11-09",
    "itens": [
      "Assistente do painel novo: soma e faz gráfico de qualquer campo das folhas, de um dia, de um período ou hora a hora, e monta na conversa os botões para salvar em imagem ou PDF e enviar pelo WhatsApp.",
      "Quando pedem algo que ele ainda não faz, o assistente avisa e anota o pedido. O dono pergunta a ele o que as pessoas pediram e ele ainda não faz e recebe a lista.",
      "Painel novo: som de gota para avançar e toque macio para voltar.",
      "Painel novo: fundo com cinco efeitos em movimento (ondas, vapor, bolhas, gotas e luz) que se revezam a cada 10 minutos.",
      "Destilaria: a coluna das 7h da manhã seguinte fica no fim da folha do próprio dia, na tela, no papel e na planilha."
    ]
  },
  {
    "versao": "3.1.0",
    "data": "2026-11-09",
    "itens": [
      "Entrar pela nuvem: a troca de turno não derruba mais quem está no celular ou no computador. O acesso dura 5 dias no celular e 1 dia no computador, ou 7 marcando Lembrar. O dono muda esses prazos em Sistema.",
      "Enviar e imprimir um período: somando, sai uma folha por área, com total das quantidades e média, mínima e máxima das medições. Sem somar, sai uma folha por dia. O Resumo segue a mesma escolha.",
      "Dá para incluir o Cálculo de produção e o Rastreamento no envio e no Resumo. Dia que não foi salvo no escritório sai marcado como calculado, não conferido.",
      "Escritório: quando as folhas mudam depois de salvar, aparece o aviso com o botão Atualizar, que refaz as contas e mantém o que foi digitado. Mudar os quilos de um produto já refaz a matéria-prima e o resto da conta.",
      "A etiqueta usa o lote corrigido do álcool. Pela nuvem, o PDF e a etiqueta saem com o que está na tela.",
      "Relatórios: cartões do mesmo tamanho, sem a caixa quebrada no tablet, e nome comprido não estoura mais.",
      "Teclado de letras no padrão do celular, com vírgula, ponto, acento, apagar e página de símbolos. O teclado numérico da Hidrólise não mudou.",
      "Depois de ler uma folha, o operador aparece numa lista para escolher, no lugar do teclado.",
      "Leitor de folhas: agora lê Destilaria e Nova Destilaria, descobre sozinho se a foto está deitada e aprende com as correções. O que veio do aprendido aparece marcado, para conferir.",
      "Folha de outro turno na Hidrólise e na Sacarificação: hora diferente continua a sequência do dia, mesmo que o papel diga linha 1. Hora igual é a mesma dorna e só preenche o que falta. O dia agora aceita até 60 dornas.",
      "Na leitura, quem tem permissão cadastra na hora o operador que faltava.",
      "Painel novo no computador: visão geral com produção por dia, linha de produção, setores agora e fechamento do dia.",
      "Painel novo no celular, com chave em Mais e em Ajustes (vem desligada): início, setores, relatórios e a barra embaixo com o botão verde do assistente. O tablet continua como está.",
      "Assistente: pergunte sobre produção, folhas, avisos e relatórios. Responde só o que você pode ver e pede confirmação antes de imprimir, enviar ou avisar. Funciona para quem entrou pela nuvem.",
      "Leitura de folha que ficou pela metade continua de onde parou, mesmo fechando o aplicativo."
    ]
  },
  {
    "versao": "3.0.1",
    "data": "2026-11-03",
    "itens": [
      "Escritório: o lote, os cálculos, a folha de rastreamento e a etiqueta agora seguem a data escolhida no painel. No dia de hoje, que ainda não fechou, continua valendo o último dia que fechou."
    ]
  },
  {
    "versao": "3.0.0",
    "data": "2026-11-02",
    "itens": [
      "Configurações da usina e ajustes do aparelho organizados em quadros, dois a dois, numa tela só. Cada quadro abre uma parte: Operadores, Áreas, Envios e assim por diante.",
      "Área nova: o dono cria a área, as tabelas dela e os operadores, sem versão nova do aplicativo.",
      "Caixinhas com os totais em cima da tabela do dia: cal, enzima, dornas anotadas. A central guarda 90 dias, a cópia de cada aparelho 2 anos, e o relatório abre qualquer dia guardado no banco.",
      "Tabela: Desligar (dá para ligar de novo) ou Remover de vez, e campo novo já com mínimo e máximo, como a temperatura. O que foi anotado continua guardado.",
      "Banco de dados no centro: o que qualquer aparelho salva vai para o banco e aparece nos outros em poucos segundos, inclusive nos computadores.",
      "O que outra pessoa está digitando na mesma folha aparece como \"ainda não salvo\", com internet ou só no Wi-Fi.",
      "Sem internet, o Wi-Fi da usina continua funcionando e a central leva tudo para o banco quando a internet volta. Falta de dado nunca apaga nada.",
      "Cargos novos: Dono, Administrador, Encarregado, Funcionário (só troca o serviço do aparelho) e Usuário (só consulta). As permissões estão por categoria.",
      "Quem tem permissão entra direto, sem configurar o nível do tablet primeiro. A ficha da pessoa mostra o que ela pode fazer em cada nível.",
      "Sala de controle, só para o dono: aparelhos conectados, tipo de conexão, rede e o histórico de todas as alterações.",
      "Folhas e avisos: tabela nova em cada setor e, em cada campo, tipo (só números, só letras, letras prontas) e saída (total do dia, relatório e API).",
      "Salva e envia sozinho ao sair da folha, quando o aplicativo vai para o fundo e depois de 5 minutos parado.",
      "Todo aparelho, inclusive o computador, guarda os dados em Documentos/Usina/BackupUsina, um arquivo por dia. Apagar os dados do aparelho não mexe no banco.",
      "Leitor de folhas: agora lê a Caldeira e não pega mais o cabeçalho, mesmo com a foto cortada ou com a borda da tabela fora da foto."
    ]
  },
  {
    "versao": "2.18.0",
    "data": "2026-10-28",
    "itens": [
      "Caldeira e destilarias: a folha abre e acompanha a hora atual (antes podia gravar na hora anterior).",
      "O lembrete da hora toca mesmo com o tablet travado; folha parada no dia (ex.: Caldeira 2) não pede leitura.",
      "Dois toques rápidos no Enviar não terminam mais a dorna; o teclado mostra o aviso completo e pergunta antes de salvar valor muito fora.",
      "O que foi digitado e não salvo volta ao abrir o aplicativo de novo; na troca de turno, o que estava aberto é salvo.",
      "Tablet chefe: painel com o que ficou fora do limite e as horas sem leitura; o escritório salva lote e NF das folhas de insumo.",
      "Longe da central, o Conferir da Conexão busca na nuvem na hora e diz o motivo quando não dá.",
      "Computador: Ajustes (letra, cores, versão, sair) e as telas novas chegam sozinhas pela nuvem.",
      "Segurança: a senha inicial do dono precisa ser trocada; nuvem e Base44 só o dono configura."
    ]
  },
  {
    "versao": "2.17.1",
    "data": "2026-10-26",
    "itens": [
      "Dois aparelhos mexendo na mesma linha ao mesmo tempo: cada campo fica com a mudança mais nova (antes a última apagava a outra inteira).",
      "Sair pela nuvem desliga a chave daquele aparelho na nuvem também.",
      "Computador: a senha e as janelas aceitam o teclado (números, Backspace, Delete para limpar e Enter para confirmar).",
      "Celular deitado: teclas e botões maiores; o teclado de letras fica mais largo."
    ]
  },
  {
    "versao": "2.17.0",
    "data": "2026-10-26",
    "itens": [
      "Escritório: a cal e a uréia somam em kg (1 copo de cal = 680 g, 1 caneca de uréia = 780 g) no resumo, no painel, no escritório e na API. Na produção continua em copos e canecas.",
      "Uréia anotada em canecas.",
      "Tablet chefe: liberar não pergunta mais o nível. O que cada um faz vem de quem entra; em Pessoas, dá para prender a pessoa aos aparelhos dela (em outro aparelho ela só consulta).",
      "Computador: entrar escolhendo o nome e digitando a senha; o endereço do servidor fica num botão à parte.",
      "Painel do computador: aparelhos ligados ao vivo, últimas anotações do dia e o escritório pela nuvem (enviar e imprimir).",
      "Logo nova (o U da Ubirálcool) e abertura animada no programa do Windows.",
      "Notificações com × para fechar, ícone de cada tipo e menos tempo na tela."
    ]
  },
  {
    "versao": "2.16.1",
    "data": "2026-10-21",
    "itens": [
      "Mais segurança no acesso pela nuvem: quem entra pelo computador só vê. Trocar a senha da pessoa, desativar ou tirar Relatórios e Escritório desconecta na hora.",
      "Só entra pela nuvem quem tem Relatórios ou Escritório.",
      "O envio dos totais ao fim do turno só aceita endereço https:// fora da rede da usina.",
      "Brix e BHX avisam acima de 25 (26 já avisa; 25 não).",
      "Caixas de digitar com letra visível no tema da noite e cantos arredondados em todas as telas.",
      "Botões e cartões sem caixa sozinha na última linha: até 4 numa linha só; 6 ficam 3 e 3; 8 ficam 4 e 4.",
      "Folhas e avisos: dá para pôr aviso em qualquer quadro de qualquer setor (ex.: temperatura da destilaria) com o texto curto que aparece do lado do número.",
      "Usina: as seções que mandam os totais avisam que não precisa preencher (o sistema do Evandro busca pela API)."
    ]
  },
  {
    "versao": "2.16.0",
    "data": "2026-10-21",
    "itens": [
      "Duas caldeiras: no tablet da Caldeira, escolha a Caldeira 1 ou a Caldeira 2. Cada uma tem a sua folha, o seu relatório e os seus gráficos. O que já foi anotado continua na Caldeira 1.",
      "Atualização mais rápida: quando sai versão nova, os aparelhos ficam sabendo em segundos. A atualização das telas instala sozinha quando ninguém está mexendo no aparelho, sem senha e sem botão.",
      "Relatórios do mesmo tamanho, letras iguais entre botões e quadros vizinhos, tela de Conectar arrumada (sem logo repetido e com a assinatura no pé).",
      "A demonstração já abre com 5 dias anotados, para ver relatórios, gráficos e totais.",
      "Para o escritório: totais do dia, por turno e por período na API (insumos e quilos do ralo, por produto)."
    ]
  },
  {
    "versao": "2.15.0",
    "data": "2026-10-19",
    "itens": [
      "Tablet chefe e escritório numa tela só: os cálculos da produção, o rastreamento de lotes e a etiqueta ficam dentro do painel, para quem tem a função Escritório. O aparelho que era do Escritório vira tablet chefe: na primeira senha, o administrador libera.",
      "Quem entra com a senha fica até o fim do turno. Não sai mais depois de 30 minutos parado.",
      "Cada um vê só o que pode: o que a pessoa ou o nível do tablet não deixa fazer some da tela. O dono escolhe o que o nível 1 e o nível 2 podem (Pessoas e permissões). Sem a função Corrigir, as folhas dos setores abrem só para consultar.",
      "Código de conexão protegido: se outro tablet chefe trocar o código, o aparelho do dono continua conectado e escolhe se mantém o novo ou volta ao de antes.",
      "Telas arrumadas: painel com Ir para e Aparelhos agora; no computador a tela usa a largura toda, com mais setores e gráficos; gráficos do mesmo tamanho; início do setor e configurações sem espaço sobrando. Conferido também no Galaxy Tab S9+ e com a tela dividida."
    ]
  },
  {
    "versao": "2.14.0",
    "data": "2026-10-15",
    "itens": [
      "Com a central desligada ou em outra rede (a outra Starlink), os aparelhos trocam as anotações pela nuvem: um vê na hora o que o outro anotou. Cada hora de cada folha é uma anotação: o que um aparelho fez se junta com o que o outro fez no resto do dia.",
      "Quando a central volta, ela puxa tudo da nuvem e confere as regras de sempre (quem pode anotar o quê, aparelho bloqueado). O que não podia, ela desfaz.",
      "Nome da tela inteiro no alto: quando ele não cabe (celular e tablet em pé), os botões de cima ficam só com o ícone e o Voltar só com a seta."
    ]
  },
  {
    "versao": "2.13.5",
    "data": "2026-10-15",
    "itens": [
      "O aplicativo não trava mais depois de 12 horas sem a central: com a central desligada, em outra rede ou sem internet, continua anotando e guarda tudo no aparelho até uma delas voltar.",
      "Botão Conexão no alto da tela, com duas luzes: a da central e a da nuvem (internet). Toque nele para ver o estado de cada uma e quantas anotações estão esperando."
    ]
  },
  {
    "versao": "2.13.4",
    "data": "2026-10-12",
    "itens": [
      "Turnos de cada setor (Configurações da usina, tablet chefe nível 2 ou 3): 3 turnos, como sempre, ou 2 turnos de 12 horas (7h às 19h e 19h às 7h). Na troca do turno o nome de quem anotava sai e o lembrete para no celular dele; a folha, o Monitorar, o papel e o Enviar seguem os turnos do setor."
    ]
  },
  {
    "versao": "2.13.3",
    "data": "2026-10-12",
    "itens": [
      "Lembrete de anotar com o horário de cada setor (Configurações da usina, no lembrete do setor: Toca das ... às ...). Fora desse horário o celular não apita, mesmo com alguém escolhido no turno."
    ]
  },
  {
    "versao": "2.13.2",
    "data": "2026-10-12",
    "itens": [
      "Lembrete de anotar: tocar em Anotar agora cala o apito e fecha a faixa até a próxima hora. No celular, a faixa ficou menor, com o botão embaixo do texto."
    ]
  },
  {
    "versao": "2.13.1",
    "data": "2026-10-12",
    "itens": [
      "A tela não pisca mais quando chegam as anotações dos outros aparelhos (a cada 5 segundos). O efeito de entrada ficou só para quando você troca de tela."
    ]
  },
  {
    "versao": "2.13.0",
    "data": "2026-10-12",
    "itens": [
      "Escritório: um aparelho novo (escolha Escritório na primeira tela) com os cálculos da produção (matéria-prima, hidrolisado, vinho, álcool e vinhaça), a folha de rastreamento de lotes POP 03 - FOR 011 e a etiqueta das bombonas. Entra quem tem a função Escritório, com a senha.",
      "Lote do dia: UB + ano + letra do mês + dia + 0700 (08/10/2026 = UB26I080700). Validade do álcool de 36 meses e da vinhaça de 5 dias, contadas do fechamento.",
      "Lembrete de anotar a cada hora (liga por setor em Configurações da usina): apito tranquilo na virada da hora; às :30, se a linha ainda estiver vazia, apito chato até anotar.",
      "Enviar e imprimir: escolha as áreas, os turnos e um dia ou um período (de... até...). O Resumo soma tudo, e o Excel de um período ganha a aba com os totais. A janela sobe de baixo e fecha puxando para baixo.",
      "Monitorar: setas para ver os dias anteriores. Aparelho longe da central, com internet, manda as anotações pela nuvem e a central pega depois. O botão voltar do Android não fecha mais o aplicativo, e os quadros crescem até ocupar a tela."
    ]
  },
  {
    "versao": "2.12.0",
    "data": "2026-10-06",
    "itens": [
      "Níveis do tablet chefe: 1 vê, corrige e envia; 2 faz tudo e libera outros tablets chefe; 3 é só do dono, com as configurações do sistema. Tablet chefe novo é liberado com a senha de quem pode (o nível 3, só com a do dono).",
      "O dono esqueceu a senha ou perdeu o tablet nível 3: na tela de liberar, a senha do programador transforma o aparelho no tablet do dono.",
      "Configurações do sistema (só o dono, no tablet nível 3), em Folhas e avisos: a vírgula de cada quadro, mostrar ou esconder um quadro do operador, campos do escritório que o operador também preenche e campos novos em cada folha. O desenho do papel continua igual.",
      "Unidades dos quadros: escolha numa lista (°C, °F, kg, t, L...). A troca vale a partir do dia em que foi feita; os dias antes continuam com a unidade antiga.",
      "Segurança: a central confere o que cada tablet e cada pessoa pode fazer, inclusive o que chega pela sincronização. A senha do programador ficou mais protegida e o bloqueio de aparelho foi revisado."
    ]
  },
  {
    "versao": "2.11.0",
    "data": "2026-10-05",
    "itens": [
      "Vírgula na Temperatura da água (Caldeira) e na Produção Álcool e no Carregamento (Destilaria): agora dá para anotar 95,5 ou 100,5.",
      "Aparelhos: no painel do tablet chefe, toque em \"aparelhos ligados\". Em cima aparece quem está usando; embaixo, o nome do aparelho no Android e o modelo. No + aparecem o endereço na rede, a versão do aplicativo e quando ele conectou.",
      "Bloquear aparelho (só o administrador): na hora você escolhe se ele pede uma senha para liberar ou se trava de vez, e se apaga as anotações guardadas nele. Longe da usina, com internet, ele trava quando abrir o aplicativo (precisa da nuvem ligada). Tudo vai para o registro do sistema.",
      "Cópia alterada do aplicativo não abre: o aplicativo confere a própria assinatura.",
      "Correção: a nuvem não guarda mais a senha do administrador."
    ]
  },
  {
    "versao": "2.10.0",
    "data": "2026-10-01",
    "itens": [
      "Exportar em PDF: na hora de enviar ou guardar a folha do dia, escolha PDF. Cada folha vira uma página, igual ao papel, só dos setores marcados.",
      "Gráficos do dia no painel do tablet chefe: Brix, pH e temperaturas das colunas, hora a hora, com as linhas dos avisos. Toque num gráfico para ver todos.",
      "Folhas e avisos: o tablet chefe muda o nome dos quadros, a unidade, a faixa esperada e os avisos (pH 5, Brix 25...) sem precisar de versão nova. Vale para todos os tablets."
    ]
  },
  {
    "versao": "2.9.0",
    "data": "2026-10-01",
    "itens": [
      "Tablet chefe: cada pessoa entra com a sua senha e o nome dela fica no alto da tela. Depois de 30 minutos sem mexer, precisa entrar de novo.",
      "Pessoas e permissões (só o administrador): cadastrar pessoas e senhas, escolher o nível (Administrador, Encarregado ou Consulta) e ligar ou desligar o que cada um pode fazer.",
      "Cada tablet chefe pode ganhar um nome e um limite do que se faz nele, seja quem for. O administrador pode tudo em qualquer um.",
      "Registro do sistema: a lista do dia com quem anotou ou mudou o quê (com o antes e o depois), quem entrou e saiu, aparelho sem sinal ou atualizado e mudanças na Usina.",
      "Nos tablets dos setores, os ajustes abrem com a senha de quem tem permissão.",
      "Correção: se o tablet chefe estava com a folha aberta quando a anotação do setor chegou, a tela agora mostra o que foi anotado."
    ]
  },
  {
    "versao": "2.8.0",
    "data": "2026-10-01",
    "itens": [
      "Atualização rápida: quando só as telas mudam, o aplicativo baixa só o que mudou, mostra a barra e abre de novo sozinho, sem a janela do Android.",
      "Quando tem versão nova, aparece uma janela com as novidades e o botão Atualizar agora. Se não for a hora, toque em Depois: o botão amarelo fica no alto.",
      "Nuvem: a central manda uma cópia das anotações para a internet. A API do escritório e as atualizações saem de lá. Fica em Usina > Nuvem (internet).",
      "Volume de vinho e Dornas de fermentação agora ficam só no tablet chefe, na área Vinho e Fermentação. A Destilaria fica com a planilha do Mateus.",
      "No Volume de vinho, cada quadro mostra o número da dorna: Folga Nº 7, Brix Nº 7, Fermentando Nº 7."
    ]
  },
  {
    "versao": "2.7.1",
    "data": "2026-09-30",
    "itens": [
      "Nova Destilaria: entrou a Coluna B4 (temperatura do carregamento da coluna B), entre a Coluna B e a Coluna P, como o Bruno pediu.",
      "Nova Destilaria: saiu o Início Aquecimento.",
      "Quando a tela fica apertada e os títulos dos blocos somem, cada quadro mostra o nome inteiro (Coluna Hidro, Condensador Hidro).",
      "Bloco que não cabe numa linha se divide por igual: 4 quadros ficam 2 em cima e 2 embaixo."
    ]
  },
  {
    "versao": "2.7.0",
    "data": "2026-09-29",
    "itens": [
      "O aplicativo agora se atualiza sozinho. Quando tiver versão nova, aparece o botão Atualizar no alto da tela. É só tocar e confirmar no Android.",
      "Os quadros das folhas ficam alinhados, do mesmo tamanho, e ocupam a largura toda da tela. Nada fica escondido atrás da barra de salvar.",
      "O botão de apagar ficou da mesma altura do aviso de envio.",
      "Dornas de fermentação: agora são as 7 a 12. O caderno de encher e mandar para a volante fica nelas.",
      "Dornas de descanso: 1, 2 e 4 a 11, com 6 m de altura.",
      "Tanques de álcool em m³, igual na planilha.",
      "A central tem uma API só de leitura para o sistema novo do escritório."
    ]
  }
];
