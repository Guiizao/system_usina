/* Pranchetas Ubirálcool - tela inicial do setor
 * © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* Parte do aplicativo: no navegador cada parte é um arquivo; no APK elas viram um app.js só (apk/juntar-app.js). */
'use strict';

  /* =========================================================
   * Tela inicial do setor
   * ========================================================= */
  function resumoPrancheta(pid, data) {
    const p = prancheta(pid);
    const hoje = data === dataProducao();
    if (p.tipo === 'medicao') {
      const m = medicaoDoDia(data);
      if (!m.medidas) return { texto: hoje ? 'Nenhuma medição hoje' : 'Nenhuma medição neste dia' };
      return { texto: `${m.medidas} de ${m.total} dornas medidas${m.hora ? ` (${m.hora})` : ''}. Vinho da produção: ${litros(m.producao, true)}`, estado: 'feito' };
    }
    if (p.tipo === 'fermentacao') {
      if (!hoje) {
        const enchidas = dornasDeFermentacao().filter(({ n }) => (ciclosPorDorna().get(n) || []).some((r) => r.data === data)).length;
        return enchidas ? { texto: `${contar(enchidas, 'dorna enchida', 'dornas enchidas')} neste dia`, estado: 'feito' } : { texto: 'Nenhuma dorna enchida neste dia' };
      }
      const et = dornasDeFermentacao().map(({ n }) => ({ n, et: etapaFerm(cicloAtual(n)) }));
      const por = (e) => et.filter((x) => x.et === e).map((x) => x.n);
      const vol = naVolante();
      const partes = [];
      if (vol.length) partes.push(`Volante: Nº ${listaE(vol.map((s) => s.n))} desde ${vol[0].inicio}`);
      if (por('enchendo').length) partes.push(`Enchendo: Nº ${listaE(por('enchendo'))}`);
      if (por('fermentando').length) partes.push(`Fermentando: Nº ${listaE(por('fermentando'))}`);
      if (!partes.length) return { texto: 'Nenhuma dorna com vinho' };
      return { texto: partes.join('. ') + '.', estado: vol.length || por('enchendo').length ? 'andamento' : 'feito' };
    }
    if (p.tipo === 'dornas') {
      const linhas = dornasDoDia(data, pid);
      if (!linhas.length) return { texto: hoje ? 'Nada anotado hoje' : 'Nada anotado neste dia' };
      if (p.envio && hoje) {
        const indo = linhas.find((r) => etapaDaDorna(p, r) === 'enviando');
        const enchendo = linhas.filter((r) => etapaDaDorna(p, r) === 'enchendo').map((r) => r.chave);
        const partes = [];
        if (indo) partes.push(`Nº ${indo.chave} enviando desde ${indo.valores[p.envio.inicio]}`);
        if (enchendo.length) partes.push(`Nº ${listaE(enchendo)} enchendo`);
        // dorna enchendo ou indo para cima é o trabalho normal, não é pendência
        if (partes.length) return { texto: partes.join('. ') + '.', estado: 'andamento' };
      }
      return { texto: `${contar(linhas.length, 'dorna anotada', 'dornas anotadas')}. Última: Nº ${linhas[linhas.length - 1].chave}`, estado: 'feito' };
    }
    if (p.tipo === 'juntas') {
      const conferir = new Set(p.partes.flatMap((pt) => linhasDeHora(listar(data, pt.prancheta)).filter((r) => r.conferir).map((r) => Number(r.chave))));
      if (conferir.size) return { texto: `Conferir: ${nomesDasHoras(conferir)}`, estado: 'pendente' };
      const horasAnotadas = new Set(p.partes.flatMap((pt) => linhasDeHora(listar(data, pt.prancheta)).filter((r) => !vazio(r.valores.qtd)).map((r) => Number(r.chave))));
      const horasDasDornas = new Set(p.partes.flatMap((pt) => listar(data, pt.sugestao.prancheta).map((r) => horaDoTexto(r.valores[pt.sugestao.hora])).filter((h) => h != null)));
      const faltam = [...horasDasDornas].filter((h) => !horasAnotadas.has(h));
      if (faltam.length && hoje) return { texto: `Falta anotar das ${faltam.map((h) => pad2(h) + 'h').join(', ')}`, estado: 'pendente' };
      if (!horasAnotadas.size) return { texto: hoje ? 'Nada adicionado hoje' : 'Nada adicionado neste dia' };
      return { texto: contar(horasAnotadas.size, 'hora anotada', 'horas anotadas'), estado: 'feito' };
    }
    if (p.tipo === 'insumo') {
      const linhas = linhasDeHora(listar(data, pid)).filter((r) => !vazio(r.valores.qtd));
      if (!linhas.length) return { texto: hoje ? 'Nada adicionado hoje' : 'Nada adicionado neste dia' };
      return { texto: `${contar(linhas.length, 'adição', 'adições')}. Total: ${totalInsumo(linhas)}`, estado: 'feito' };
    }
    const feitas = linhasDeHora(listar(data, pid)).length;
    const h = new Date().getHours();
    // setor que ainda não começou o dia não conta como pendência (antes aparecia "falta a leitura" em setor parado)
    if (!feitas) return { texto: hoje ? 'Nenhuma leitura hoje' : 'Nenhuma leitura neste dia' };
    if (hoje && !pegar(data, pid, h)) return { texto: `Falta a leitura das ${rotuloHora(h)}. Feitas: ${feitas} de 24`, estado: 'pendente' };
    return { texto: `${feitas} de 24 leituras feitas`, estado: 'feito' };
  }
  const iconeDaPrancheta = (pid) => { const p = prancheta(pid); if (p.tipo === 'medicao') return 'regua'; if (p.tipo === 'fermentacao') return 'tanque'; return p.tipo === 'insumo' || p.tipo === 'juntas' ? 'balanca' : p.tipo === 'grade' ? 'relogio' : setorDaPrancheta(pid).icone; };

  function telaInicio() {
    const s = setorPorId(cfg.papel);
    const data = dataProducao();
    if (!pranchetasDo(s.id).length) {
      return `${topo(s.nome, 'Pranchetas do setor', false)}
        <main><div class="tela-aviso"><div class="grande-ico">${ico('ajustes')}</div>
          <h1>Sem prancheta para preencher</h1>
          <p>O escritório desligou as pranchetas deste setor no tablet chefe. Fale com o encarregado.</p></div></main>`;
    }
    return `${topo(s.nome, 'Pranchetas do setor', false)}
      <main>
        <h2>Qual prancheta você vai preencher?</h2>
        <div class="lista">${pranchetasDo(s.id).map((pid) => {
          const p = prancheta(pid); const r = resumoPrancheta(pid, data);
          return `<button class="item ${r.estado || ''}" data-a="abrir-prancheta" data-id="${pid}"><span class="desenho">${ico(iconeDaPrancheta(pid))}</span>
            <span class="texto"><b>${esc(p.nome)}</b><small>${esc(p.codigo)}</small><span class="situacao">${esc(r.texto)}</span></span><span class="seta">${ico('seta')}</span></button>`;
        }).join('')}</div>
      </main>`;
  }
