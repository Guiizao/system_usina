# Pranchetas Digitais - (c) 2026 Guilherme. Todos os direitos reservados. Uso somente com autorizacao do autor (veja LICENCA.txt).
import cv2, numpy as np, sys, os
from grade import carregar

def mascaras(cinza):
    # normaliza a luz (sombra e brilho) antes de separar a tinta
    fundo = cv2.medianBlur(cinza, 51)
    norm = cv2.divide(cinza, fundo, scale=255)
    tinta = cv2.adaptiveThreshold(norm, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 25, 10)
    h, w = tinta.shape
    k = max(w, h)
    ver = cv2.morphologyEx(tinta, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, k // 70)))
    hor = cv2.morphologyEx(tinta, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (k // 70, 1)))
    return norm, tinta, hor, ver

def linhas_longas(masc, vertical, k):
    segs = cv2.HoughLinesP(masc, 1, np.pi / 720, threshold=60, minLineLength=k // 25, maxLineGap=k // 60)
    if segs is None: return []
    out = []
    for x1, y1, x2, y2 in segs[:, 0]:
        if vertical:
            if abs(x2 - x1) > abs(y2 - y1) * 0.15: continue
            if y1 > y2: x1, y1, x2, y2 = x2, y2, x1, y1
        else:
            if abs(y2 - y1) > abs(x2 - x1) * 0.15: continue
            if x1 > x2: x1, y1, x2, y2 = x2, y2, x1, y1
        out.append([x1, y1, x2, y2])
    # junta segmentos da mesma linha
    out.sort(key=lambda s: ((s[0] + s[2]) / 2) if vertical else ((s[1] + s[3]) / 2))
    grupos = []
    for s in out:
        pos = (s[0] + s[2]) / 2 if vertical else (s[1] + s[3]) / 2
        if grupos and abs(grupos[-1]['pos'] - pos) < k / 150:
            g = grupos[-1]; g['segs'].append(s); g['pos'] = np.mean([((t[0] + t[2]) / 2) if vertical else ((t[1] + t[3]) / 2) for t in g['segs']])
        else:
            grupos.append({'pos': pos, 'segs': [s]})
    linhas = []
    for g in grupos:
        pts = np.array([[s[0], s[1]] for s in g['segs']] + [[s[2], s[3]] for s in g['segs']], np.float32)
        if vertical:
            ini, fim = pts[:, 1].min(), pts[:, 1].max()
            comp = sum(abs(s[3] - s[1]) for s in g['segs'])
        else:
            ini, fim = pts[:, 0].min(), pts[:, 0].max()
            comp = sum(abs(s[2] - s[0]) for s in g['segs'])
        # reta ajustada: x = a*y + b (vertical) ou y = a*x + b
        if vertical: a, b = np.polyfit(pts[:, 1], pts[:, 0], 1)
        else: a, b = np.polyfit(pts[:, 0], pts[:, 1], 1)
        linhas.append({'pos': g['pos'], 'ini': float(ini), 'fim': float(fim), 'comp': float(comp), 'a': float(a), 'b': float(b)})
    return linhas

if __name__ == '__main__':
    for f in sys.argv[1:]:
        g = carregar(f)
        norm, tinta, hor, ver = mascaras(g)
        k = max(g.shape)
        vs = linhas_longas(ver, True, k)
        hs = linhas_longas(hor, False, k)
        vis = cv2.cvtColor(norm, cv2.COLOR_GRAY2BGR)
        for l in vs:
            y1, y2 = l['ini'], l['fim']
            cv2.line(vis, (int(l['a'] * y1 + l['b']), int(y1)), (int(l['a'] * y2 + l['b']), int(y2)), (0, 0, 255), 4)
        for l in hs:
            x1, x2 = l['ini'], l['fim']
            cv2.line(vis, (int(x1), int(l['a'] * x1 + l['b'])), (int(x2), int(l['a'] * x2 + l['b'])), (0, 180, 0), 3)
        nome = os.path.splitext(os.path.basename(f))[0].replace(' ', '_')
        cv2.imwrite(f'out_{nome}_linhas.jpg', cv2.resize(vis, None, fx=0.45, fy=0.45))
        print(nome, 'verticais', len(vs), [(int(l['pos']), int(l['ini']), int(l['fim'])) for l in vs])
        print('   horizontais', len(hs))
