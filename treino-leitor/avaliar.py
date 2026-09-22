# Pranchetas Digitais - (c) 2026 Guilherme. Todos os direitos reservados. Uso somente com autorizacao do autor (veja LICENCA.txt).
import numpy as np, torch, sys, os, time
import treino as TR, sintetico as S, restrito as R

def normal(texto, coluna):
    tipo = R.COLUNAS[coluna][0]
    if texto in ('-', ''): return ''
    if tipo == 'hora':
        d = texto.replace(':', '').replace('.', '')
        return f"{int(d[:-2]):02d}:{d[-2:]}"
    if tipo == 'inteiro': return str(int(texto))
    return texto.upper()

def main(pesos='leitor.pt'):
    casos = TR.carregar_reais()
    m = TR.Leitor(); m.load_state_dict(torch.load(pesos, map_location='cpu')); m.eval()
    X = torch.from_numpy(np.stack([S.preparar(c) for c, _, _ in casos])).unsqueeze(1).float()
    with torch.no_grad(): lp = m(X).log_softmax(1).permute(0, 2, 1).numpy()  # N,T,C
    certos = 0; alta = 0; alta_certos = 0; erros = []
    t0 = time.time()
    for (cel, texto, col), l in zip(casos, lp):
        v, p = R.ler(l, col)
        ok = v == normal(texto, col)
        certos += ok
        if p >= 0.8: alta += 1; alta_certos += ok
        if not ok: erros.append((col, texto, v, round(p, 2)))
    n = len(casos)
    print(f'acerto {certos}/{n} = {certos / n:.3f} | confiança alta: {alta}/{n} células, acerto nelas {alta_certos / max(alta, 1):.3f} | {time.time() - t0:.1f}s')
    por_col = {}
    for col, t, v, p in erros: por_col.setdefault(col, []).append((t, v, p))
    for col, es in por_col.items(): print('  ', col, len(es), es[:8])

if __name__ == '__main__':
    main(*(sys.argv[1:]))
