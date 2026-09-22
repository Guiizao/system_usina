# Pranchetas Digitais - (c) 2026 Guilherme. Todos os direitos reservados. Uso somente com autorizacao do autor (veja LICENCA.txt).
"""Números desenhados com traço de caneta, no jeito brasileiro de escrever (1 com gancho, 7 cortado, 4 aberto...)."""
import random, math
import numpy as np, cv2

def arco(cx, cy, rx, ry, a0, a1, n=14):
    return [(cx + rx * math.cos(math.radians(a)), cy + ry * math.sin(math.radians(a))) for a in np.linspace(a0, a1, n)]

def estilos(d):
    r = random.random
    if d == '0':
        v = [[*arco(0.5, 0.5, 0.38, 0.5, -90 + random.uniform(-20, 20), 270 + random.uniform(-10, 25), 24)]]
        return v
    if d == '1':
        s = random.choice(['reto', 'gancho', 'gancho', 'gancho_base', 'j', 'j_baixo', 'j_baixo'])
        if s == 'reto': return [[(0.55, 0.0), (0.5, 1.0)]]
        if s == 'j_baixo': return [[(0.35, 0.12), (0.62, 0.0), (0.62, 0.8), *arco(0.38, 0.8, 0.24, 0.2, 0, 150, 7)]]
        if s == 'gancho': return [[(0.15, 0.3), (0.6, 0.0), (0.55, 1.0)]]
        if s == 'gancho_base': return [[(0.15, 0.3), (0.6, 0.0), (0.55, 1.0)], [(0.25, 1.0), (0.85, 1.0)]]
        return [[(0.05, 0.25), *arco(0.35, 0.18, 0.25, 0.18, 200, 330, 6), (0.62, 0.05), (0.55, 1.0)]]
    if d == '2':
        base = [*arco(0.5, 0.3, 0.38, 0.3, 190, 360 + 40, 12), (0.1, 1.0)]
        if r() < 0.4: base += [*arco(0.22, 0.9, 0.12, 0.1, 270, 90 + 360, 8)]
        return [base + [(0.95, 1.0)]]
    if d == '3':
        return [[*arco(0.45, 0.27, 0.4, 0.27, 200, 450, 12), *arco(0.45, 0.74, 0.45, 0.26, 270, 500, 12)]]
    if d == '4':
        s = random.choice(['aberto', 'fechado', 'ch'])
        if s == 'aberto': return [[(0.45, 0.0), (0.05, 0.65), (0.95, 0.65)], [(0.7, 0.25), (0.7, 1.0)]]
        if s == 'fechado': return [[(0.7, 1.0), (0.7, 0.0), (0.05, 0.65), (0.95, 0.65)]]
        return [[(0.1, 0.0), (0.12, 0.55), (0.85, 0.55)], [(0.8, 0.0), (0.8, 1.0)]]
    if d == '5':
        return [[(0.85, 0.0), (0.25, 0.0), (0.2, 0.42), *arco(0.5, 0.68, 0.38, 0.32, 230, 490, 14)]]
    if d == '6':
        return [[(0.75, 0.0), *arco(0.5, 0.65, 0.38, 0.35, 230, 180 + 360, 18)]]
    if d == '7':
        v = [[(0.08, 0.05), (0.92, 0.0), (0.4, 1.0)]]
        if r() < 0.55: v.append([(0.35, 0.5), (0.85, 0.48)])
        if r() < 0.25: v[0].insert(0, (0.05, 0.25))
        return v
    if d == '8':
        return [[*arco(0.5, 0.26, 0.3, 0.26, 90, 450, 16), *arco(0.5, 0.73, 0.38, 0.27, -90, 270, 16)]]
    if d == '9':
        cauda = [(0.82, 1.0)] if r() < 0.6 else [*arco(0.5, 0.85, 0.3, 0.15, 0, 140, 6)]
        return [[*arco(0.48, 0.3, 0.34, 0.3, 0, 360, 16), (0.82, 0.3), *cauda]]
    return None

def desenhar(d, alt):
    tracos = estilos(d)
    if tracos is None: return None
    larg = int(alt * random.uniform(0.45, 0.75)) if d != '1' else int(alt * random.uniform(0.3, 0.6))
    tela = np.zeros((alt + 8, larg + 8), np.uint8)
    esp = random.randint(2, max(2, alt // 10))
    for t in tracos:
        pts = np.array([[4 + (x + random.gauss(0, 0.035)) * larg, 4 + (y + random.gauss(0, 0.03)) * alt] for x, y in t], np.int32)
        cv2.polylines(tela, [pts], False, 255, esp, cv2.LINE_AA)
    return tela
