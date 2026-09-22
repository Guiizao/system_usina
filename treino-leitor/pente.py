# Pranchetas Digitais - (c) 2026 Guilherme. Todos os direitos reservados. Uso somente com autorizacao do autor (veja LICENCA.txt).
import cv2, numpy as np, sys, os
from grade import carregar
from verticais import mascaras

def angulo(hor, k):
    segs = cv2.HoughLinesP(hor, 1, np.pi / 1440, threshold=80, minLineLength=k // 20, maxLineGap=k // 80)
    if segs is None: return 0.0
    ang, pes = [], []
    for x1, y1, x2, y2 in segs[:, 0]:
        if abs(y2 - y1) > abs(x2 - x1) * 0.2: continue
        ang.append(np.degrees(np.arctan2(y2 - y1, x2 - x1))); pes.append(np.hypot(x2 - x1, y2 - y1))
    if not ang: return 0.0
    o = np.argsort(ang); a = np.array(ang)[o]; p = np.array(pes)[o]
    return float(a[np.searchsorted(np.cumsum(p), p.sum() / 2)])

def girar(img, graus, borda=0):
    h, w = img.shape[:2]
    M = cv2.getRotationMatrix2D((w / 2, h / 2), graus, 1.0)
    return cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_LINEAR, borderValue=borda)

def suavizar(v, r=2):
    k = np.ones(2 * r + 1) / (2 * r + 1)
    return np.convolve(v, k, mode='same')

def melhor_pente(perfil, n, smin, smax):
    """acha y0 e s com n+1 linhas igualmente espaçadas que somam mais tinta"""
    L = len(perfil)
    pm = np.maximum.accumulate  # não usado
    # máximo numa janela de +-2 para tolerar erro
    jan = np.maximum.reduce([np.roll(perfil, d) for d in range(-2, 3)])
    melhor = (-1, 0, 0)
    for s10 in range(int(smin * 10), int(smax * 10) + 1, 2):
        s = s10 / 10.0
        span = s * n
        if span >= L: break
        idx = (np.arange(n + 1) * s)
        for y0 in range(0, int(L - span)):
            pos = (y0 + idx).astype(int)
            v = jan[pos].sum()
            if v > melhor[0]: melhor = (v, y0, s)
    return melhor

if __name__ == '__main__':
    n = int(sys.argv[1])
    for f in sys.argv[2:]:
        g = carregar(f)
        norm, tinta, hor, ver = mascaras(g)
        k = max(g.shape)
        a = angulo(hor, k)
        hor2 = girar(hor, a); ver2 = girar(ver, a); norm2 = girar(norm, a, 255)
        H, W = hor2.shape
        perfil = suavizar(hor2.sum(axis=1).astype(float) / 255.0)
        v, y0, s = melhor_pente(perfil, n, H / 90, H / 12)
        # colunas dentro da faixa da tabela
        pc = suavizar(ver2[int(y0):int(y0 + n * s), :].sum(axis=0).astype(float) / 255.0, 1)
        lim = pc.max() * 0.35
        picos = [x for x in range(2, W - 2) if pc[x] >= lim and pc[x] == pc[x - 3:x + 4].max()]
        vis = cv2.cvtColor(norm2, cv2.COLOR_GRAY2BGR)
        for i in range(n + 1):
            y = int(y0 + i * s); cv2.line(vis, (0, y), (W, y), (0, 0, 255), 2)
        for x in picos: cv2.line(vis, (x, int(y0)), (x, int(y0 + n * s)), (255, 0, 0), 2)
        nome = os.path.splitext(os.path.basename(f))[0].replace(' ', '_')
        cv2.imwrite(f'out_{nome}_pente.jpg', cv2.resize(vis, None, fx=0.45, fy=0.45))
        print(nome, 'angulo', round(a, 2), 'y0', y0, 's', s, 'colunas', picos)
