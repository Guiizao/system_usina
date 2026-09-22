# Pranchetas Digitais - (c) 2026 Guilherme. Todos os direitos reservados. Uso somente com autorizacao do autor (veja LICENCA.txt).
import cv2, numpy as np, sys, os, json
from grade import carregar
from verticais import mascaras
from pente import angulo, girar
from rede import cruzamentos, tabela, colunas

MOLDES = {
    'anexo1': {'linhas': 25, 'colunas': [0, .049, .148, .251, .315, .381, .445, .517, .597, .675, .754, .876, 1],
               'nomes': ['n', 'inicio', 'fim', 'phf', 'cal', 'brix', 'phf2', 'anti', 'enzi', 'bhx', 'produto', 'responsavel']},
    'anexo2': {'linhas': 25, 'colunas': [0, .075, .205, .34, .459, .58, .70, .824, 1],
               'nomes': ['n', 'horario', 'sac', 'phf', 'bhx', 'enz', 'anti', 'responsavel']},
    'pop03': {'linhas': 24, 'colunas': [0, .227, .315, .403, .591, .744, .858, 1],
              'nomes': ['fornecedor', 'nf', 'lote', 'validade', 'qtd', 'hora', 'operador']},
}

def casar_colunas(xs, molde, tol=0.022):
    melhor = None
    for i in range(len(xs)):
        for j in range(len(xs) - 1, i, -1):
            L, R = xs[i], xs[j]
            if R - L < 50: continue
            achou, pos = 0, []
            for r in molde:
                alvo = L + r * (R - L)
                d = [abs(x - alvo) for x in xs]
                k = int(np.argmin(d))
                if d[k] < tol * (R - L): achou += 1; pos.append(xs[k])
                else: pos.append(alvo)
            if melhor is None or achou > melhor[0]: melhor = (achou, pos)
    return melhor

def ler_grade(caminho, molde):
    g = carregar(caminho, 2200)
    norm, tinta, hor, ver = mascaras(g)
    k = max(g.shape)
    a = angulo(hor, k)
    hor2, ver2, norm2 = girar(hor, a), girar(ver, a), girar(norm, a, 255)
    pts = cruzamentos(hor2, ver2)
    r = tabela(pts, molde['linhas'])
    if not r: return None
    fils, y0, s = r
    cols = colunas(fils, s)
    # retas das fileiras: y = a*x + b (as que faltam, interpola)
    retas_f = []
    for m, fl in enumerate(fils):
        if fl is not None and len(fl) >= 3:
            aa, bb = np.polyfit(fl[:, 0], fl[:, 1], 1); retas_f.append((aa, bb))
        else: retas_f.append(None)
    idx = [i for i, rf in enumerate(retas_f) if rf is not None]
    for i in range(len(retas_f)):
        if retas_f[i] is None:
            ant = max([j for j in idx if j < i], default=None); prox = min([j for j in idx if j > i], default=None)
            if ant is not None and prox is not None:
                t = (i - ant) / (prox - ant)
                retas_f[i] = tuple(np.array(retas_f[ant]) * (1 - t) + np.array(retas_f[prox]) * t)
            else:
                base = retas_f[ant if ant is not None else prox]; retas_f[i] = (base[0], base[1] + (i - (ant if ant is not None else prox)) * s)
    ymeio = y0 + s * molde['linhas'] / 2
    ordem = sorted(cols, key=lambda c: c['a'] * ymeio + c['b'])
    xs = [c['a'] * ymeio + c['b'] for c in ordem]
    casado = casar_colunas(xs, molde['colunas'])
    if not casado: return None
    # para cada coluna do molde usa a reta detectada mais próxima ou uma reta interpolada
    retas_c = []
    for alvo in casado[1]:
        d = [abs(x - alvo) for x in xs]; kk = int(np.argmin(d))
        if d[kk] < 2: retas_c.append((ordem[kk]['a'], ordem[kk]['b']))
        else: retas_c.append(None)
    for i in range(len(retas_c)):
        if retas_c[i] is None:
            vivos = [j for j in range(len(retas_c)) if retas_c[j] is not None]
            ant = max([j for j in vivos if j < i]); prox = min([j for j in vivos if j > i])
            t = (molde['colunas'][i] - molde['colunas'][ant]) / (molde['colunas'][prox] - molde['colunas'][ant])
            retas_c[i] = tuple(np.array(retas_c[ant]) * (1 - t) + np.array(retas_c[prox]) * t)
    def cruza(rf, rc):
        # y = a1 x + b1 ; x = a2 y + b2
        a1, b1 = rf; a2, b2 = rc
        y = (a1 * b2 + b1) / (1 - a1 * a2); return (a2 * y + b2, y)
    P = [[cruza(rf, rc) for rc in retas_c] for rf in retas_f]
    return norm2, P, casado[0], len(molde['colunas'])

def celula(img, P, m, c, alt=64):
    q = np.array([P[m][c], P[m][c + 1], P[m + 1][c + 1], P[m + 1][c]], np.float32)
    w = np.linalg.norm(q[1] - q[0]); h = np.linalg.norm(q[3] - q[0])
    W = max(8, int(alt * w / max(h, 1)))
    M = cv2.getPerspectiveTransform(q, np.array([[0, 0], [W, 0], [W, alt], [0, alt]], np.float32))
    return cv2.warpPerspective(img, M, (W, alt), flags=cv2.INTER_AREA, borderValue=255)

if __name__ == '__main__':
    nome_molde = sys.argv[1]
    molde = MOLDES[nome_molde]
    for f in sys.argv[2:]:
        r = ler_grade(f, molde)
        nome = os.path.splitext(os.path.basename(f))[0].replace(' ', '_')
        if not r: print(nome, 'falhou'); continue
        img, P, achadas, total = r
        linhas = []
        for m in range(molde['linhas']):
            cel = [celula(img, P, m, c) for c in range(len(molde['colunas']) - 1)]
            linhas.append(np.hstack([np.pad(x, ((2, 2), (2, 2)), constant_values=120) for x in cel]))
        larg = max(l.shape[1] for l in linhas)
        mos = np.vstack([np.pad(l, ((0, 0), (0, larg - l.shape[1])), constant_values=200) for l in linhas])
        cv2.imwrite(f'out_{nome}_celulas.png', cv2.resize(mos, None, fx=0.6, fy=0.6))
        print(nome, 'colunas achadas', achadas, 'de', total)
