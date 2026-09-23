/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * Confere todas as telas em vários tamanhos (celular, celular deitado, tablet pequeno, tablet, tablet em pé):
 * texto saindo da caixa, palavra quebrada no meio, rolagem para o lado, letra e botão pequenos, erros de JavaScript.
 * Uso: node testes/telas.mjs [http://localhost:8080] [tamanho1,tamanho2] [tela1,tela2]
 * Tira uma foto de cada tela em testes/saida/telas/<tamanho>/<tela>.png e grava o relatório em testes/saida/telas.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, TAMANHOS, auditarLayout, dormir } from './navegador.mjs';

const BASE = (process.argv[2] || 'http://localhost:8080').replace(/\/$/, '');
const SO_TAMANHOS = process.argv[3] ? process.argv[3].split(',') : ['celular', 'motorola', 'celularDeitado', 'tablet8', 'tablet10', 'tablet', 'tabletEmPe'];
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
  ['lactrol', '&papel=destilaria&op=Mateus&tela=prancheta&pid=ins_lactrol'],
  ['nova-destilaria', '&papel=nova_destilaria&op=Operador%201&tela=prancheta&pid=nova_destilaria'],
  ['chefe-painel', '&papel=central'],
  ['chefe-escolher-formato', '&papel=central&modal=formato'],
  ['chefe-relatorios', '&papel=central&tela=relatorios'],
  ['chefe-usina', '&papel=central&tela=config'],
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
