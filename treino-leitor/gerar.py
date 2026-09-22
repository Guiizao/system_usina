# Pranchetas Digitais - (c) 2026 Guilherme. Todos os direitos reservados. Uso somente com autorizacao do autor (veja LICENCA.txt).
import numpy as np, random, os, sys, time
from multiprocessing import Pool
import sintetico as S

def lote(args):
    semente, n = args
    random.seed(semente); np.random.seed(semente % (2**32 - 1))
    X = np.zeros((n, S.H, S.W), np.uint8); T = []
    for i in range(n):
        x, t = S.exemplo()
        X[i] = (x * 255).astype(np.uint8); T.append(t)
    return X, T

if __name__ == '__main__':
    total = int(sys.argv[1]); nome = sys.argv[2]
    por = 2000; tarefas = [(1000 + i + hash(nome) % 100000, por) for i in range(total // por)]
    t0 = time.time()
    with Pool(18) as pool:
        partes = pool.map(lote, tarefas)
    X = np.concatenate([p[0] for p in partes]); T = sum([p[1] for p in partes], [])
    np.save(f'{nome}_X.npy', X)
    open(f'{nome}_T.txt', 'w', encoding='utf-8').write('\n'.join(T))
    print(nome, X.shape, round(time.time() - t0, 1), 's')
