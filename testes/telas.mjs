/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * Confere todas as telas em todos os tamanhos de navegador.mjs (computador, celulares, celular deitado, tablets e tablet em pé):
 * texto saindo da caixa, palavra quebrada no meio, rolagem para o lado, letra e botão pequenos, erros de JavaScript.
 * Uso: node testes/telas.mjs [http://localhost:8080] [tamanho1,tamanho2] [tela1,tela2]
 * Tira uma foto de cada tela em testes/saida/telas/<tamanho>/<tela>.png e grava o relatório em testes/saida/telas.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, TAMANHOS, auditarLayout, dormir } from './navegador.mjs';

const BASE = (process.argv[2] || 'http://localhost:8080').replace(/\/$/, '');
const SO_TAMANHOS = process.argv[3] ? process.argv[3].split(',') : Object.keys(TAMANHOS);
const SO_TELAS = process.argv[4] ? process.argv[4].split(',') : null;
const SAIDA = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), 'saida');

const B = BASE + '/?demo';
const HID = '&papel=hidrolise&op=Guilherme&tela=prancheta&pid=hid_anexo1';
const TELAS = [
  ['conectar', '&tela=conectar'],
  ['escolher-setor', ''],
  ['operador', '&papel=hidrolise&tela=operador'],
  ['operador-caldeira', '&papel=caldeira&tela=operador'],
  ['inicio-hidrolise', '&papel=hidrolise&op=Guilherme'],
  ['inicio-caldeira', '&papel=caldeira&op=Alberto'],
  ['inicio-destilaria', '&papel=destilaria&op=Mateus'],
  ['dorna-sem-teclado', HID],
  ['dorna-teclado', HID + '&campo=brix&teclas=1|8'],
  ['dorna-hora', HID + '&campo=inicio'],
  ['lembrete', '&papel=destilaria&op=Mateus&tela=prancheta&pid=destilaria&lembrete=1'],
  ['lembrete-urgente', '&papel=destilaria&op=Mateus&lembrete=urgente'],
  ['chefe-config-lembrete', '&papel=central&tela=config'],
  ['escritorio', '&papel=escritorio'],
  ['escritorio-calculos', '&papel=escritorio', async (a) => { await a.tocar('[data-a="esc-abrir"][data-t="esc-calculos"]'); await dormir(300); }],
  ['escritorio-rastreamento', '&papel=escritorio', async (a) => { await a.tocar('[data-a="esc-abrir"][data-t="esc-rastreamento"]'); await dormir(300); }],
  ['escritorio-etiqueta', '&papel=escritorio', async (a) => { await a.tocar('[data-a="esc-abrir"][data-t="esc-rastreamento"]'); await dormir(300); await a.tocar('main [data-a="esc-etiqueta"]'); await dormir(400); }],
  ['dorna-aviso-ph', HID + '&campo=phf&teclas=4|,|6'],
  ['dorna-aviso-brix', HID + '&campo=brix&teclas=2|7'],
  ['dorna-produto', HID + '&campo=produto'],
  ['dorna-monitor', HID + '&monitor=1'],
  ['sacarificacao', '&papel=hidrolise&op=Guilherme&tela=prancheta&pid=hid_anexo2&campo=phf&teclas=5|,|0'],
  ['lphera-cal', '&papel=hidrolise&op=Guilherme&tela=prancheta&pid=juntas_lphera_cal'],
  ['saczyme-alcolina', '&papel=hidrolise&op=Guilherme&tela=prancheta&pid=juntas_saczyme_alcolina&chave=9'],
  ['ralo', '&papel=ralo&op=Jair&tela=prancheta&pid=ins_materia_prima&campo=qtd&teclas=5|0|0'],
  ['caldeira', '&papel=caldeira&op=Alberto&tela=prancheta&pid=caldeira&chave=10&campo=pressao'],
  ['caldeira-letras', '&papel=caldeira&op=Alberto&tela=prancheta&pid=caldeira&chave=10&campo=obs&teclas=O|K'],
  ['caldeira-monitor', '&papel=caldeira&op=Alberto&tela=prancheta&pid=caldeira&monitor=1'],
  ['destilaria', '&papel=destilaria&op=Mateus&tela=prancheta&pid=destilaria&chave=13'],
  ['destilaria-monitor', '&papel=destilaria&op=Mateus&tela=prancheta&pid=destilaria&monitor=1'],
  ['hidrolise-monitor-chefe', '&papel=central&tela=prancheta&pid=hid_anexo1&monitor=1'],
  ['lactrol', '&papel=destilaria&op=Mateus&tela=prancheta&pid=ins_lactrol'],
  ['nova-destilaria', '&papel=nova_destilaria&op=Operador%201&tela=prancheta&pid=nova_destilaria'],
  ['chefe-painel', '&papel=central'],
  ['chefe-escolher-formato', '&papel=central&modal=formato'],
  ['chefe-envio-periodo', '&papel=central&modal=formato', async (a) => { await a.tocar('.modal [data-k="m:periodo"]'); await dormir(250); }],
  ['chefe-envio-cheia', '&papel=central&modal=formato', async (a) => { await a.tocar('.modal [data-k="tamanho"]'); await dormir(250); }],
  ['chefe-relatorios', '&papel=central&tela=relatorios'],
  ['chefe-usina', '&papel=central&tela=config'],
  ['chefe-usina-base44', '&papel=central&tela=config&base44=1', async (a) => a.avaliar('document.getElementById("bloco-base44").scrollIntoView()')],
  ['chefe-prancheta', '&papel=central&tela=prancheta&pid=hid_anexo1'],
  ['ajustes', '&papel=hidrolise&op=Guilherme&tela=admin'],
  ['preparando-servidor', '&tela=preparando&fim=1'],
  ['escuro-dorna', '&tema=escuro' + HID + '&campo=brix&teclas=1|8'],
  ['escuro-chefe', '&tema=escuro&papel=central'],
  // telas que precisam de um toque depois de abrir
  ['senha-encarregado', '&papel=hidrolise&op=Guilherme', async (a) => a.tocar('[data-a="admin"]')],
  ['notificacao', '&papel=hidrolise&tela=operador', async (a) => { await a.tocar('[data-a="escolher-operador"]'); await dormir(200); }],
  ['notificacao-erro', '&papel=hidrolise&op=Guilherme', async (a) => { await a.tocar('[data-a="admin"]'); await a.teclar(['9', '9', '9', '9', 'ok']); await dormir(200); }],
  ['avisos-chefe', '&papel=central&tela=avisos'],
  ['letra-maior-operador', '&escala=maior&papel=hidrolise&tela=operador'],
  ['letra-maior-dorna', '&escala=maior' + HID + '&campo=phf&teclas=4|,|6'],
  ['letra-maior-chefe', '&escala=maior&papel=central'],
  ['letra-menor-dorna', '&escala=menor' + HID + '&campo=brix&teclas=1|8'],
  ['aviso-na-tela', '&papel=hidrolise&op=Guilherme&aviso=1'],
  ['operador-nomes-longos', '&papel=hidrolise&tela=operador&nomesLongos=1'],
  ['dorna-enviando', HID + '&chave=6'],
  ['dorna-nova', HID + '&chave=7'],
  ['avisos-chefe-celular', '&papel=central&tela=avisos'],
  // volume de vinho e dornas de fermentação (destiladores)
  ['destilaria-inicio', '&papel=destilaria&op=Mateus'],
  // versão 2.7.2: Volume de vinho e Dornas de fermentação só no tablet chefe (área Vinho e Fermentação)
  ['vinho-no-chefe', '&papel=central&tela=prancheta&pid=med_dornas&chave=dsc'],
  ['vinho-celular-numeros', '&papel=central&tela=prancheta&pid=med_dornas&chave=dsc&campo=dsc2_folga&teclas=0|,|1|5'],
  ['volume-vinho', '&papel=central&tela=prancheta&pid=med_dornas&chave=sac'],
  ['volume-vinho-teclado', '&papel=central&tela=prancheta&pid=med_dornas&chave=sac&campo=sac3_folga&teclas=0|,|2|5'],
  ['volume-vinho-dornas', '&papel=central&tela=prancheta&pid=med_dornas&chave=fer'],
  ['volume-vinho-tanques', '&papel=central&tela=prancheta&pid=med_dornas&chave=tq'],
  ['volume-vinho-folha', '&papel=central&tela=prancheta&pid=med_dornas&monitor=1'],
  ['fermentacao', '&papel=central&tela=prancheta&pid=fermentacao&chave=7'],
  ['fermentacao-volante', '&papel=central&tela=prancheta&pid=fermentacao&chave=9'],
  ['fermentacao-enchendo', '&papel=central&tela=prancheta&pid=fermentacao&chave=12'],
  ['fermentacao-folha', '&papel=central&tela=prancheta&pid=fermentacao&monitor=1'],
  ['chefe-usina-medidas', '&papel=central&tela=config', async (a) => a.avaliar('document.getElementById("bloco-medidas").scrollIntoView()')],
  // versão 2.7: atualização pelo próprio aplicativo e novidades
  ['atualizacao-inicio', '&papel=hidrolise&op=Guilherme&atualizacao=9.8.0'],
  ['atualizacao-dorna', HID + '&atualizacao=9.8.0&campo=brix&teclas=1|8'],
  ['atualizacao-chefe', '&papel=central&atualizacao=9.8.0'],
  ['atualizacao-janela', '&papel=hidrolise&op=Guilherme&atualizacao=9.8.0&modal=atualizacao'],
  ['atualizacao-janela-rapida', '&papel=hidrolise&op=Guilherme&atualizacao=9.8.0&rapida=1&modal=atualizacao'],
  ['atualizacao-ajustes', '&papel=hidrolise&op=Guilherme&tela=admin&atualizacao=9.8.0'],
  ['novidades', '&papel=destilaria&op=Mateus&modal=novidades'],
  // versão 2.9: pessoas, permissões e registro do sistema no tablet chefe
  ['chefe-ninguem', '&papel=central&ninguem=1'],
  ['chefe-entrar', '&papel=central&ninguem=1&modal=entrar'],
  ['chefe-menu-pessoa', '&papel=central', async (a) => { await a.tocar('[data-a="pessoa"]'); await dormir(200); }],
  ['chefe-pessoas', '&papel=central&tela=pessoas'],
  ['chefe-pessoa-nova', '&papel=central&tela=pessoas', async (a) => { await a.tocar('[data-a="pessoa-nova"]'); await dormir(200); }],
  ['chefe-pessoa-mudar', '&papel=central&tela=pessoas', async (a) => { await a.tocar('[data-a="pessoa-editar"][data-id="p3"]'); await dormir(200); }],
  ['chefe-tablet-permissoes', '&papel=central&tela=pessoas', async (a) => { await a.tocar('[data-a="aparelho-chefe"][data-id="demo2"]'); await dormir(200); }],
  ['chefe-registro', '&papel=central&tela=registro'],
  ['chefe-registro-entradas', '&papel=central&tela=registro', async (a) => { await a.tocar('[data-a="registro-tipo"][data-tipo="entrada"]'); await dormir(200); }],
  // versão 2.10: gráficos, folhas e avisos, PDF
  ['chefe-painel-graficos', '&papel=central', async (a) => a.avaliar('(document.querySelector(".graficos-painel") || document.body).scrollIntoView()')],
  ['chefe-graficos', '&papel=central&tela=graficos'],
  ['chefe-graficos-hidrolise', '&papel=central&tela=graficos&setor=hidrolise'],
  ['chefe-folhas', '&papel=central&tela=folhas'],
  ['chefe-folha-ph', '&papel=central&tela=folhas', async (a) => { await a.tocar('[data-a="folha-campo"][data-pid="hid_anexo1"][data-id="phf"]'); await dormir(200); }],
  ['chefe-folha-unidades', '&papel=central&tela=folhas', async (a) => { await a.tocar('[data-a="folha-unidades"][data-pid="ins_lphera"]'); await dormir(200); }],
  // versão 2.12: liberar o tablet chefe, as opções do dono no quadro, a estrutura da folha e o campo novo
  ['chefe-liberar', '&papel=central&modal=liberar'],
  ['chefe-folha-dono', '&papel=central&tela=folhas', async (a) => { await a.tocar('[data-a="folha-campo"][data-pid="caldeira"][data-id="pressao"]'); await dormir(200); }],
  ['chefe-estrutura', '&papel=central&tela=folhas', async (a) => { await a.tocar('[data-a="folha-estrutura"][data-pid="ins_materia_prima"]'); await dormir(200); }],
  ['chefe-campo-novo', '&papel=central&tela=folhas', async (a) => { await a.tocar('[data-a="folha-estrutura"][data-pid="caldeira"]'); await dormir(200); await a.tocar('.modal [data-k="novo"]'); await dormir(250); }],
  ['chefe-enviar-pdf', '&papel=central', async (a) => { await a.tocar('[data-a="compartilhar"][data-destino="whatsapp"]'); await dormir(200); }],
  // versão 2.11: aparelhos (quem usa, nome no Android, modelo, endereço) e bloqueio
  ['chefe-aparelhos', '&papel=central&tela=aparelhos'],
  ['chefe-aparelho-mais', '&papel=central&tela=aparelhos&aparelho=ap-hid001'],
  ['chefe-aparelho-bloqueado', '&papel=central&tela=aparelhos&aparelho=ap-vel003'],
  ['chefe-bloquear', '&papel=central&tela=aparelhos&aparelho=ap-hid001', async (a) => { await a.tocar('.modal [data-k="bloquear"]'); await dormir(200); }],
  ['bloqueado-senha', '&papel=hidrolise&op=Felipe&bloqueio=senha&apagar=1'],
  ['bloqueado-digitar', '&papel=hidrolise&op=Felipe&bloqueio=senha', async (a) => { await a.tocar('[data-a="liberar-senha"]'); await dormir(200); }],
  ['bloqueado-trava', '&papel=hidrolise&op=Felipe&bloqueio=trava'],
];

const relatorio = { base: BASE, quando: new Date().toISOString(), telas: [] };
const nav = await abrirNavegador();
try {
  for (const nomeTam of SO_TAMANHOS) {
    const a = await nav.novoAparelho(nomeTam, TAMANHOS[nomeTam]);
    for (const [nome, sufixo, acao] of TELAS) {
      if (SO_TELAS && !SO_TELAS.includes(nome)) continue;
      const antes = a.erros.length;
      let probs = [];
      let falhou = null;
      try {
        await a.ir(B + sufixo, 'document.querySelector("#app header, #app main")');
        await dormir(250);
        if (acao) await acao(a);
        // com a letra "Menor" escolhida nos ajustes, aceita letra um pouco menor (até 10 px)
        probs = await a.avaliar(auditarLayout(nome.startsWith('letra-menor') ? 10 : 11.5));
      } catch (e) { falhou = e.message; }
      await a.foto(path.join(SAIDA, 'telas', nomeTam, nome + '.png'));
      const erros = a.erros.slice(antes);
      relatorio.telas.push({ tamanho: nomeTam, tela: nome, problemas: probs, erros, falhou });
      const resumo = probs.length ? probs.reduce((m, p) => ((m[p.tipo] = (m[p.tipo] || 0) + 1), m), {}) : {};
      console.log(`${nomeTam.padEnd(15)} ${nome.padEnd(24)} ${falhou ? 'FALHOU: ' + falhou : Object.keys(resumo).length ? JSON.stringify(resumo) : 'ok'}${erros.length ? '  ERROS JS: ' + erros.join(' | ').slice(0, 200) : ''}`);
    }
    await a.fechar();
  }
} finally {
  await nav.fechar();
}
fs.mkdirSync(SAIDA, { recursive: true });
fs.writeFileSync(path.join(SAIDA, 'telas.json'), JSON.stringify(relatorio, null, 1));
const total = relatorio.telas.reduce((s, t) => s + t.problemas.length + t.erros.length + (t.falhou ? 1 : 0), 0);
console.log(`\n${relatorio.telas.length} telas conferidas, ${total} problema(s). Detalhes em testes/saida/telas.json`);
