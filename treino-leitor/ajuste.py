# Pranchetas Digitais - (c) 2026 Guilherme. Todos os direitos reservados. Uso somente com autorizacao do autor (veja LICENCA.txt).
"""Ajuste fino com células reais das folhas da usina.
Validação cruzada: treina com uma folha e mede na outra (a folha de teste nunca entra no treino).
Uso: python ajuste.py base.pt [saida.pt] [treinar_com: sac|hid|ambas]"""
import os, sys, random, time
import numpy as np, cv2, torch, torch.nn as nn
import treino as TR, sintetico as S, restrito as R, gabarito as G
from avaliar import normal

AQUI = os.path.dirname(os.path.abspath(__file__))

def celulas_da_folha(qual):
    if qual == 'sac':
        cols = ['horario', 'sac', 'phf', 'bhx', 'enz', 'anti']
        cels = TR.celulas_reais(r"C:\Users\guilh\Downloads\Phone Link\Hidro Exem.jpg", 'anexo2', cols)
        tab = G.SACARIFICACAO
    else:
        cols = ['inicio', 'fim', 'phf', 'cal', 'brix', 'phf2', 'enzi', 'bhx', 'produto']
        cels = TR.celulas_reais(r"C:\Users\guilh\Downloads\Phone Link\Hidrolise 1.jpg", 'anexo1', cols)
        tab = G.HIDROLISE
    out = []
    for m, linha in enumerate(tab):
        for c, texto in enumerate(linha):
            if texto != '?': out.append((S.preparar(cels[m][c]), texto, cols[c]))
    return out

def aumentar(x):
    """x: 32x160 float (tinta clara). Pequenas mudanças de posição, tamanho, inclinação e espessura."""
    h, w = x.shape
    nz = np.nonzero(x.max(0) > 0.1)[0]
    larg = (nz.max() + 3) if len(nz) else w
    esc = random.uniform(0.85, 1.12); cis = random.uniform(-0.15, 0.15)
    M = np.float32([[esc, cis, random.uniform(-3, 10)], [0, esc * random.uniform(0.92, 1.08), random.uniform(-2, 2) + (1 - esc) * h / 2]])
    y = cv2.warpAffine(x, M, (w, h))
    r = random.random()
    if r < 0.2: y = cv2.dilate(y, np.ones((2, 2), np.uint8))
    elif r < 0.3: y = cv2.erode(y, np.ones((2, 1), np.uint8))
    if random.random() < 0.4: y = cv2.GaussianBlur(y, (3, 3), random.uniform(0.3, 0.8))
    y = y * random.uniform(0.75, 1.2) + np.random.normal(0, 0.03, y.shape) * (random.random() < 0.5)
    return np.clip(y, 0, 1).astype(np.float32)

def medir(modelo, casos, dev):
    X = torch.from_numpy(np.stack([c[0] for c in casos])).unsqueeze(1).to(dev)
    with torch.no_grad(): lp = modelo(X).log_softmax(1).permute(0, 2, 1).cpu().numpy()
    certos = alta = alta_ok = 0
    anterior = {}
    def minutos(t): h, m = map(int, t.split(':')); return ((h * 60 + m) - 420) % 1440
    for (x, texto, col), l in zip(casos, lp):
        prior = None
        if R.COLUNAS[col][0] == 'hora':
            ref = anterior.get('inicio') if col == 'fim' else anterior.get('hora')
            def prior(v, ref=ref, col=col):
                if not v or not ref: return 1
                dt = minutos(v) - minutos(ref)
                if dt < -5: return 0.12
                if dt > (180 if col == 'fim' else 300): return 0.35
                return 1
        v, p = R.ler(l, col, prior)
        if R.COLUNAS[col][0] == 'hora' and v:
            anterior['hora'] = v
            if col in ('inicio', 'horario'): anterior['inicio'] = v
        ok = v == normal(texto, col)
        certos += ok
        if p >= 0.8: alta += 1; alta_ok += ok
    n = len(casos)
    return certos / n, alta / n, alta_ok / max(alta, 1)

def ajustar(base, treinar, testar, passos=2500, dev='cuda'):
    modelo = TR.Leitor().to(dev); modelo.load_state_dict(torch.load(base, map_location=dev))
    X = np.load(os.path.join(AQUI, 'treino2_X.npy'), mmap_mode='r')
    T = open(os.path.join(AQUI, 'treino2_T.txt'), encoding='utf-8').read().split('\n')
    opt = torch.optim.AdamW(modelo.parameters(), lr=4e-4, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, passos)
    ctc = nn.CTCLoss(blank=0, zero_infinity=True)
    antes = medir(modelo.eval(), testar, dev) if testar else None
    for passo in range(passos):
        modelo.train()
        nr = 48; ns = 96
        reais = [random.choice(treinar) for _ in range(nr)]
        xs = [aumentar(r[0]) for r in reais]; ts = [r[1] for r in reais]
        ids = np.random.randint(0, len(X), ns)
        xs += [X[i].astype(np.float32) / 255 for i in ids]; ts += [T[i] for i in ids]
        xb = torch.from_numpy(np.stack(xs)).unsqueeze(1).to(dev)
        ys = [torch.tensor([TR.IDX[c] for c in t if c in TR.IDX] or [TR.IDX['-']]) for t in ts]
        tgt = torch.cat(ys).to(dev); tl = torch.tensor([len(y) for y in ys], device=dev)
        out = modelo(xb).log_softmax(1).permute(2, 0, 1)
        il = torch.full((xb.size(0),), out.size(0), dtype=torch.long, device=dev)
        perda = ctc(out, tgt, il, tl)
        opt.zero_grad(); perda.backward(); torch.nn.utils.clip_grad_norm_(modelo.parameters(), 5); opt.step(); sched.step()
    depois = medir(modelo.eval(), testar, dev) if testar else None
    return modelo, antes, depois

if __name__ == '__main__':
    base = sys.argv[1]
    sac = celulas_da_folha('sac'); hid = celulas_da_folha('hid')
    print('células: sacarificação', len(sac), 'hidrólise', len(hid))
    testes = [] if os.environ.get('SO_FINAL') else [('treina hidrólise, testa sacarificação', hid, sac), ('treina sacarificação, testa hidrólise', sac, hid)]
    for nome, tr, te in testes:
        t0 = time.time()
        _, a, d = ajustar(base, tr, te)
        print(f'{nome}: antes acerto {a[0]:.3f} (confiantes {a[1]:.2f}, acerto neles {a[2]:.3f}) -> depois acerto {d[0]:.3f} (confiantes {d[1]:.2f}, acerto neles {d[2]:.3f})  {time.time() - t0:.0f}s', flush=True)
    if len(sys.argv) > 2:
        modelo, _, _ = ajustar(base, sac + hid, None)
        torch.save(modelo.state_dict(), sys.argv[2]); print('salvo', sys.argv[2])
