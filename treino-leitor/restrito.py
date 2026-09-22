# Pranchetas Digitais - (c) 2026 Guilherme. Todos os direitos reservados. Uso somente com autorizacao do autor (veja LICENCA.txt).
"""Leitura restrita: a rede diz as probabilidades e a coluna diz o que é possível (hora, pH, número, MASSA/FINI...).
Escolhe o valor possível mais provável e dá uma confiança. É o mesmo que o aplicativo faz em JavaScript."""
import numpy as np
from treino import ALFABETO, IDX

NEG = -1e9

def ctc_scores(logp, cands):
    """logp: T x C (log). cands: lista de strings. Devolve log p(string) pelo algoritmo forward do CTC."""
    T = logp.shape[0]
    out = np.full(len(cands), NEG)
    grupos = {}
    for i, c in enumerate(cands): grupos.setdefault(len(c), []).append(i)
    for L, ids in grupos.items():
        lab = np.array([[IDX[ch] for ch in cands[i]] for i in ids]) if L else np.zeros((len(ids), 0), int)
        N = len(ids); S = 2 * L + 1
        ext = np.zeros((N, S), int)
        if L: ext[:, 1::2] = lab
        pode_pular = np.zeros((N, S), bool)
        if L > 1: pode_pular[:, 3::2] = lab[:, 1:] != lab[:, :-1]
        a = np.full((N, S), NEG)
        a[:, 0] = logp[0, 0]
        if L: a[:, 1] = logp[0, ext[:, 1]]
        for t in range(1, T):
            ant1 = np.concatenate([np.full((N, 1), NEG), a[:, :-1]], 1)
            ant2 = np.concatenate([np.full((N, 2), NEG), a[:, :-2]], 1)
            ant2 = np.where(pode_pular, ant2, NEG)
            a = np.logaddexp(np.logaddexp(a, ant1), ant2) + logp[t, ext]
        fim = a[:, -1] if S == 1 else np.logaddexp(a[:, -1], a[:, -2])
        out[ids] = fim
    return out

def candidatos(tipo, info=None):
    """lista de (texto escrito possível, valor normalizado)"""
    c = []
    if tipo == 'hora':
        for h in range(24):
            for m in range(60):
                v = f"{h:02d}:{m:02d}"
                for s in {f"{h}:{m:02d}", f"{h:02d}:{m:02d}", f"{h}{m:02d}", f"{h:02d}{m:02d}", f"{h}.{m:02d}", f"{h:02d}.{m:02d}"}:
                    c.append((s, v))
        c.append(('', ''))
    elif tipo == 'decimal':
        lo, hi = info
        for i in range(int(lo * 10), int(hi * 10) + 1):
            a, b = divmod(i, 10); v = f"{a},{b}"
            for s in {f"{a},{b}", f"{a}.{b}", f"{a}{b}"}: c.append((s, v))
        c.append(('-', '')); c.append(('', ''))
    elif tipo == 'inteiro':
        lo, hi = info
        for n in range(lo, hi + 1):
            c.append((str(n), str(n)))
            if n < 10: c.append((f"0{n}", str(n)))
        c.append(('-', '')); c.append(('', ''))
    elif tipo == 'opcoes':
        for o in info: c.append((o.upper(), o.upper()))
        c.append(('-', '')); c.append(('', ''))
    return c

COLUNAS = {
    'horario': ('hora', None), 'inicio': ('hora', None), 'fim': ('hora', None),
    'phf': ('decimal', (2.0, 9.9)), 'phf2': ('decimal', (2.0, 9.9)),
    'sac': ('inteiro', (1, 9)), 'bhx': ('inteiro', (1, 45)), 'brix': ('inteiro', (1, 45)),
    'enz': ('inteiro', (0, 300)), 'anti': ('inteiro', (0, 300)), 'enzi': ('inteiro', (0, 300)),
    'cal': ('inteiro', (0, 30)), 'produto': ('opcoes', ['MASSA', 'FINI', 'OUTRO']),
}

PADRAO = {'sac': '4', 'enz': '100', 'anti': '100', 'enzi': '70'}
_cache = {}
def ler(logp, coluna, prior=None):
    tipo, info = COLUNAS[coluna]
    chave = (tipo, str(info))
    if chave not in _cache: _cache[chave] = candidatos(tipo, info)
    cands = _cache[chave]
    sc = ctc_scores(logp, [s for s, _ in cands])
    # soma as formas de escrever o mesmo valor
    por = {}
    for (s, v), x in zip(cands, sc): por[v] = np.logaddexp(por.get(v, NEG), x)
    vals = list(por.keys()); arr = np.array([por[v] for v in vals])
    for i, v in enumerate(vals):
        if PADRAO.get(coluna) == v: arr[i] += np.log(6)
        if prior:
            f = prior(v); arr[i] += np.log(f) if f > 0 else NEG
    p = np.exp(arr - np.logaddexp.reduce(arr))
    k = int(np.argmax(p))
    return vals[k], float(p[k])
