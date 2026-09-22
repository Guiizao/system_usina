# Pranchetas Digitais - (c) 2026 Guilherme. Todos os direitos reservados. Uso somente com autorizacao do autor (veja LICENCA.txt).
import cv2, numpy as np, sys, os
from grade import carregar
from verticais import mascaras
from pente import angulo, girar

def cruzamentos(hor, ver):
    d = np.ones((7, 7), np.uint8)
    inter = cv2.bitwise_and(cv2.dilate(hor, d), cv2.dilate(ver, d))
    n, _, st, cen = cv2.connectedComponentsWithStats(inter)
    return np.array([cen[i] for i in range(1, n) if st[i][4] >= 6])

def fileiras(pts, tol):
    o = pts[np.argsort(pts[:, 1])]
    grupos = []
    for p in o:
        if grupos and abs(p[1] - np.mean([q[1] for q in grupos[-1]])) < tol: grupos[-1].append(p)
        else: grupos.append([p])
    return [np.array(sorted(g, key=lambda q: q[0])) for g in grupos]

def tabela(pts, n_linhas):
    """encadeia n_linhas+1 fileiras de cruzamentos, deixando o espaçamento mudar aos poucos (perspectiva)"""
    if len(pts) < 10: return None
    fil = [f for f in fileiras(pts, 8) if len(f) >= 3]
    if len(fil) < 3: return None
    ys = np.array([f[:, 1].mean() for f in fil]); cont = np.array([len(f) for f in fil])
    cap = max(3, float(np.percentile(cont, 75)))
    melhor = None
    for i in range(len(fil)):
        for j in range(i + 1, min(i + 3, len(fil))):
            s = ys[j] - ys[i]
            if s < 12: continue
            usados = [i, j]; posic = [ys[i], ys[j]]; total = min(cont[i], cap) + min(cont[j], cap); faltas = 0
            for m in range(2, n_linhas + 1):
                alvo = posic[-1] + s
                d = np.abs(ys - alvo); c = int(np.argmin(d))
                if d[c] < s * 0.3 and c not in usados:
                    s = 0.7 * s + 0.3 * (ys[c] - posic[-1]); usados.append(c); posic.append(ys[c]); total += min(cont[c], cap)
                else:
                    usados.append(None); posic.append(alvo); faltas += 1
                    if faltas > n_linhas * 0.25: break
            if len(usados) < n_linhas + 1: continue
            passos = np.diff(posic); med = np.median(passos)
            irregular = float(np.sum(np.abs(passos - med)) / med)
            nota = total - faltas * cap * 1.5 - irregular * cap
            if melhor is None or nota > melhor[0]: melhor = (nota, usados, posic)
    if not melhor: return None
    _, usados, posic = melhor
    return [fil[u] if u is not None else None for u in usados], posic[0], (posic[-1] - posic[0]) / n_linhas

def colunas(fils, s):
    """liga os cruzamentos de fileira em fileira: cada coluna vira uma reta x = a*y + b"""
    cadeias = []
    for fl in fils:
        if fl is None: continue
        for p in fl:
            melhor = None
            for c in cadeias:
                ult = c[-1]
                if abs(p[1] - ult[1]) < s * 0.5: continue
                d = abs(p[0] - ult[0])
                if d < s * 0.6 and (melhor is None or d < melhor[0]): melhor = (d, c)
            if melhor: melhor[1].append(p)
            else: cadeias.append([p])
    retas = []
    for c in cadeias:
        if len(c) < max(3, len([f for f in fils if f is not None]) * 0.3): continue
        arr = np.array(c)
        a, b = np.polyfit(arr[:, 1], arr[:, 0], 1) if len(arr) > 2 else (0.0, arr[:, 0].mean())
        retas.append({'a': float(a), 'b': float(b), 'n': len(c)})
    return retas

if __name__ == '__main__':
    n = int(sys.argv[1])
    for f in sys.argv[2:]:
        g = carregar(f)
        norm, tinta, hor, ver = mascaras(g)
        k = max(g.shape)
        a = angulo(hor, k)
        hor2, ver2, norm2 = girar(hor, a), girar(ver, a), girar(norm, a, 255)
        pts = cruzamentos(hor2, ver2)
        r = tabela(pts, n)
        vis = cv2.cvtColor(norm2, cv2.COLOR_GRAY2BGR)
        for p in pts: cv2.circle(vis, (int(p[0]), int(p[1])), 5, (0, 160, 0), -1)
        nome = os.path.splitext(os.path.basename(f))[0].replace(' ', '_')
        if r:
            fils, y0, s = r
            for fl in fils:
                if fl is None: continue
                for p in fl: cv2.circle(vis, (int(p[0]), int(p[1])), 9, (0, 0, 255), 3)
            print(nome, 'angulo', round(a, 2), 'y0', int(y0), 's', round(s, 1), 'pontos por fileira', [0 if fl is None else len(fl) for fl in fils])
            cols = colunas(fils, s)
            ymeio = y0 + s * n / 2
            xs = sorted(c['a'] * ymeio + c['b'] for c in cols)
            if len(xs) > 1:
                print('   colunas', len(xs), 'proporcoes', [round((x - xs[0]) / (xs[-1] - xs[0]), 3) for x in xs])
            for c in cols:
                y1, y2 = y0, y0 + s * n
                cv2.line(vis, (int(c['a'] * y1 + c['b']), int(y1)), (int(c['a'] * y2 + c['b']), int(y2)), (255, 0, 0), 3)
        else: print(nome, 'sem tabela')
        cv2.imwrite(f'out_{nome}_rede.jpg', cv2.resize(vis, None, fx=0.45, fy=0.45))
