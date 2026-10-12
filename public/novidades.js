/* Pranchetas Digitais - (c) 2026 Guilherme. Todos os direitos reservados. Uso somente com autorizacao do autor (veja LICENCA.txt). */
/* O que mudou em cada versão. Aparece uma vez depois que o aplicativo atualiza, e também nos Ajustes.
   A primeira da lista é a versão atual: tem de ser igual ao VERSAO do app.js (os testes conferem).
   Depois do sinal de igual vem JSON puro, porque o servidor do tablet chefe (Java) também lê este arquivo. */
window.NOVIDADES = [
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
