/* Painel do PC pela nuvem (2.16), de ponta a ponta, com a nuvem simulada (o código da nuvem com SQLite) e dados temporários:
 * a central manda as anotações dos 5 dias da demonstração e a pessoa "Lucas" (só a conferência leve da senha);
 * o painel do computador entra pela nuvem com a senha dele, recebe as anotações, mostra só o que ele pode (só ver),
 * e sem internet abre com o que já tinha chegado. Tira as fotos em testes/saida/painel-nuvem/.
 * Uso: node testes/painel-nuvem216.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { pbkdf2Sync } from 'node:crypto';
import { ligarNuvemSQLite } from './nuvem-sqlite.mjs';
import { centralNode, pastaTemporaria, APP } from './servidores.mjs';
import { abrirNavegador, TAMANHOS, dormir } from './navegador.mjs';
import { novoGrupo, teste, certo, resumo } from './teste.mjs';

const SEGREDO = 'segredo-ficticio-painel216';
const PIN = '2468'; // senha de teste do Lucas fictício (nunca a de verdade)
const verificador = (pin, sal = 'b'.repeat(32)) => ({ sal, iteracoes: 1000, verificador: pbkdf2Sync(pin, sal, 1000, 32, 'sha256').toString('hex') });
const FOTOS = path.join(APP, 'testes', 'saida', 'painel-nuvem');

export async function testarPainelNuvem216(g) {
  fs.mkdirSync(FOTOS, { recursive: true });
  const n = await ligarNuvemSQLite(8352, SEGREDO, 'leitura-ficticia-painel216');
  const c = await centralNode(8353, pastaTemporaria('apk-painel216')); // só entrega as telas (como o programa do Windows)
  const nav = await abrirNavegador();
  try {
    // 1. as anotações dos 5 dias da demonstração, como a central manda para a nuvem
    let enviados = 0;
    await teste(g, 'a central manda 5 dias de anotações e a pessoa (sem a senha) para a nuvem', async () => {
      const demo = await nav.novoAparelho('demo', TAMANHOS.computador);
      await demo.ir(c.url + '/?demo&papel=central');
      await demo.esperar('!!document.querySelector(".painel-chefe, main")', 15000, 'demonstração');
      const regs = await demo.avaliar('JSON.stringify(Object.values(registros).filter((r) => /^\\d{4}-/.test(r.data)))').then(JSON.parse);
      await demo.fechar();
      certo(new Set(regs.map((r) => r.data)).size >= 5, 'a demonstração devia ter 5 dias');
      const pessoas = [{ id: 'lucas', nome: 'Lucas', nivel: 'consulta', ativo: true, funcoes: ['escritorio', 'relatorios'], nuvem: verificador(PIN) }];
      for (let i = 0; i < regs.length; i += 120) {
        const lote = regs.slice(i, i + 120).map((r, k) => Object.assign({}, r, { seq: i + k + 1 }));
        const r = await n.pedir('/central/enviar', { senha: SEGREDO, corpo: { geracao: 'demo216', registros: lote, ...(i ? {} : { pessoas }) } });
        certo(r.status === 200, 'envio ' + r.status + ' ' + r.texto);
        enviados += lote.length;
      }
    });

    // 2. o painel do computador entra pela nuvem com a senha do Lucas
    const pc = await nav.novoAparelho('pc', TAMANHOS.pcGrande);
    await teste(g, 'o painel do PC entra pela nuvem com a senha e recebe as anotações', async () => {
      await pc.ir(c.url + '/?nuvem=1');
      await pc.esperar('!!document.querySelector("[data-a=\\"nuvem-entrar\\"]")', 15000, 'tela de entrar pela nuvem');
      await pc.foto(path.join(FOTOS, '1-entrar-pela-nuvem.png'));
      await pc.avaliar(`nuvemForm.url = ${JSON.stringify(n.url)}; 1`);
      await pc.tocar('[data-a="nuvem-entrar"]');
      for (const k of PIN) await pc.tocar(`.modal [data-k="${k}"]`);
      await pc.tocar('.modal [data-k="ok"]');
      await pc.esperar('!!document.querySelector(".menu-pc") && Object.keys(registros).length > 50', 30000, 'painel com as anotações');
      certo(await pc.avaliar('cfg.soNuvem && cfg.pessoa.nome === "Lucas"'), 'entrou como Lucas');
      const total = await pc.avaliar('Object.values(registros).filter((r) => /^\\d{4}-/.test(r.data) && r.prancheta !== "registro").length');
      certo(total >= enviados * 0.9, `chegaram ${total} de ${enviados}`);
      // o dia de hoje pode ter acabado de começar (07:00): a foto mostra o último dia com anotações
      const ultimo = await pc.avaliar('[...new Set(Object.values(registros).map((r) => r.data))].filter((d) => /^\d{4}-/.test(d)).sort().pop()');
      if (ultimo !== await pc.avaliar('dataProducao()')) { await pc.tocar('[data-a="dia"][data-n="-1"], .nav-data .btn'); }
      await dormir(800);
      await pc.foto(path.join(FOTOS, '2-painel.png'));
    });
    await teste(g, 'pela nuvem é só ver: o menu não tem Administrar e as folhas abrem para consultar', async () => {
      const menu = await pc.avaliar('document.querySelector(".menu-pc").innerText');
      certo(!/Pessoas|Aparelhos|Registro|Usina/.test(menu), 'menu com administração: ' + menu);
      certo(/Relatórios/.test(menu) && /Gráficos/.test(menu), 'faltou Relatórios ou Gráficos');
      certo(await pc.avaliar('!pode("corrigir") && pode("relatorios")'), 'permissões erradas');
    });
    await teste(g, 'relatórios, resumo do dia e gráficos da semana pela nuvem', async () => {
      await pc.tocar('.menu-pc [data-a="relatorios"]');
      await pc.esperar('document.querySelectorAll(".relatorio-dia").length >= 5', 15000, 'os 5 dias nos relatórios');
      await pc.foto(path.join(FOTOS, '3-relatorios.png'));
      await pc.tocar('.relatorio-dia [data-a="relatorio-resumo"]');
      await pc.esperar('!!document.querySelector(".modal .resumo-texto")', 8000, 'resumo');
      certo(/TOTAIS DO DIA/.test(await pc.avaliar('document.querySelector(".resumo-texto").textContent')), 'resumo sem os totais');
      await pc.foto(path.join(FOTOS, '4-resumo.png'));
      await pc.tocar('.modal [data-k="x"]');
      await pc.tocar('.menu-pc [data-a="graficos"]');
      await pc.tocar('[data-a="graficos-modo"][data-modo="semana"]');
      await pc.esperar('document.querySelectorAll(".grafico").length > 5', 8000, 'gráficos da semana');
      await pc.foto(path.join(FOTOS, '5-graficos-semana.png'));
    });
    await teste(g, 'sem internet: o painel abre com o que já tinha chegado', async () => {
      await pc.semRede(true);
      await pc.recarregar();
      await pc.esperar('!!document.querySelector(".menu-pc") && Object.keys(registros).length > 50', 15000, 'painel sem internet');
      await pc.tocar('.menu-pc [data-a="abrir-painel"]');
      await dormir(600);
      await pc.foto(path.join(FOTOS, '6-sem-internet.png'));
      await pc.semRede(false);
    });
    await pc.fechar();
  } finally {
    await nav.fechar();
    await c.desligar();
    await n.desligar();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const g = novoGrupo('Painel do PC pela nuvem 2.16');
  await testarPainelNuvem216(g);
  resumo([g]);
}
