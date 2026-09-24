/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/*
 * Função para o Base44 do escritório (o sistema onde o Lucas lança os totais do dia).
 * O servidor das pranchetas manda, quando o dia fecha (07:00), os totais de cada insumo.
 * Se alguém corrigir a folha depois, o mesmo dia chega de novo: aqui ele é atualizado, sem duplicar.
 *
 * Antes de usar:
 *   1. Crie a tabela TotalInsumoDia (arquivo entities/total-insumo-dia.jsonc).
 *   2. Cadastre o segredo PRANCHETAS_SEGREDO nos segredos do app (o mesmo que está no tablet chefe).
 *   3. Copie o endereço desta função e cadastre no tablet chefe: Usina > Totais do dia no Base44.
 *
 * O que chega (JSON):
 *   { origem, data: "2026-09-23", dataBr: "23/09/2026", enviadoEm,
 *     itens: [{ setor: "Hidrólise", insumo: "LPHERA", folha: "ins_lphera", quantidade: 100, unidade: "mL" }, ...],
 *     resumo: "texto do dia, igual ao do WhatsApp" }
 */
import { createClientFromRequest } from "npm:@base44/sdk";

Deno.serve(async (req) => {
  if (req.method !== "POST") return Response.json({ erro: "use POST" }, { status: 405 });
  const segredo = Deno.env.get("PRANCHETAS_SEGREDO");
  if (!segredo || req.headers.get("x-pranchetas-segredo") !== segredo) {
    return Response.json({ erro: "segredo errado" }, { status: 401 });
  }
  let dados;
  try { dados = await req.json(); } catch { return Response.json({ erro: "JSON inválido" }, { status: 400 }); }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dados?.data ?? "") || !Array.isArray(dados.itens)) {
    return Response.json({ erro: "dados inválidos" }, { status: 400 });
  }
  try {
    const base44 = createClientFromRequest(req);
    const Totais = base44.asServiceRole.entities.TotalInsumoDia;
    // atualiza o que já existe do dia, cria o que falta e tira o que não veio mais
    const chave = (x) => `${x.folha}|${x.unidade}`;
    const existentes = await Totais.filter({ data: dados.data }, null, 1000);
    const antes = new Map(existentes.map((e) => [chave(e), e]));
    const vieram = new Set();
    for (const item of dados.itens) {
      const linha = {
        data: dados.data,
        setor: String(item.setor ?? ""),
        insumo: String(item.insumo ?? ""),
        folha: String(item.folha ?? ""),
        quantidade: Number(item.quantidade) || 0,
        unidade: String(item.unidade ?? ""),
      };
      vieram.add(chave(linha));
      const ja = antes.get(chave(linha));
      if (ja) await Totais.update(ja.id, linha);
      else await Totais.create(linha);
    }
    for (const [k, e] of antes) if (!vieram.has(k)) await Totais.delete(e.id);
    return Response.json({ ok: true, gravados: dados.itens.length });
  } catch (e) {
    return Response.json({ erro: String(e?.message ?? e) }, { status: 500 });
  }
});
