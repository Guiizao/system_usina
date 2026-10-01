/* Pranchetas Digitais - (c) 2026 Guilherme. Todos os direitos reservados. Uso somente com autorizacao do autor (veja LICENCA.txt). */
/* O que mudou em cada versão. Aparece uma vez depois que o aplicativo atualiza, e também nos Ajustes.
   A primeira da lista é a versão atual: tem de ser igual ao VERSAO do app.js (os testes conferem).
   Depois do sinal de igual vem JSON puro, porque o servidor do tablet chefe (Java) também lê este arquivo. */
window.NOVIDADES = [
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
