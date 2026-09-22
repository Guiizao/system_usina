# Pranchetas Digitais - (c) 2026 Guilherme. Todos os direitos reservados. Uso somente com autorizacao do autor (veja LICENCA.txt).
"""Treina o leitor de letra de mão (rede convolucional com CTC) e mede o acerto nas fotos reais."""
import os, sys, time, math, random
import numpy as np
import cv2
import torch
import torch.nn as nn
import torch.nn.functional as F

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import sintetico as S

ALFABETO = S.ALFABETO
CLASSES = len(ALFABETO) + 1  # 0 = branco do CTC
IDX = {c: i + 1 for i, c in enumerate(ALFABETO)}

def bloco(ci, co, k=3, p=1):
    return nn.Sequential(nn.Conv2d(ci, co, k, padding=p, bias=False), nn.BatchNorm2d(co), nn.ReLU(inplace=True))

class Leitor(nn.Module):
    def __init__(self):
        super().__init__()
        self.c1 = bloco(1, 24)            # 32x160
        self.c2 = bloco(24, 48)           # 16x80
        self.c3 = bloco(48, 96)           # 8x40
        self.c4 = bloco(96, 96)
        self.c5 = bloco(96, 128)          # 4x40
        self.c6 = bloco(128, 128, (2, 1), 0)  # 2x40 -> 1x40
        self.c7 = bloco(128, 128, (1, 3), (0, 1))
        self.c8 = bloco(128, 128, (1, 3), (0, 1))
        self.saida = nn.Conv2d(128, CLASSES, 1)

    def forward(self, x):
        x = F.max_pool2d(self.c1(x), 2)
        x = F.max_pool2d(self.c2(x), 2)
        x = self.c4(self.c3(x))
        x = F.max_pool2d(x, (2, 1))
        x = F.max_pool2d(self.c5(x), (2, 1))
        x = self.c6(x)
        x = self.c8(self.c7(x))
        return self.saida(x).squeeze(2)  # N, C, T

def decodificar(logp):
    """greedy: junta repetidos e tira brancos"""
    idx = logp.argmax(1).cpu().numpy()
    out = []
    for seq in idx:
        s, ant = [], 0
        for k in seq:
            if k != ant and k != 0: s.append(ALFABETO[k - 1])
            ant = k
        out.append(''.join(s))
    return out

# ---------------- células reais ----------------
def limpar_celula(cel):
    """tira as bordas impressas que sobram no recorte"""
    g = cel.copy()
    h, w = g.shape
    fundo = cv2.GaussianBlur(g.astype(np.float32), (0, 0), 10) + 1
    tinta = ((1 - np.clip(g / fundo, 0, 1)) > 0.25).astype(np.uint8) * 255
    hor = cv2.morphologyEx(tinta, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (max(10, int(w * 0.45)), 1)))
    ver = cv2.morphologyEx(tinta, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, int(h * 0.7))))
    linhas = cv2.dilate(cv2.bitwise_or(hor, ver), np.ones((3, 3), np.uint8))
    # só apaga linha perto da borda (não apaga traço de letra no meio)
    borda = np.zeros_like(linhas)
    m = max(4, int(h * 0.18))
    borda[:m, :] = 1; borda[-m:, :] = 1; borda[:, :max(4, int(h * 0.15))] = 1; borda[:, -max(4, int(h * 0.15)):] = 1
    apagar = (linhas > 0) & (borda > 0)
    g = g.copy(); g[apagar] = 255
    # risco de borda a borda (linha vertical riscando a coluna) não é número
    n, lab, st, _ = cv2.connectedComponentsWithStats(ver)
    for k in range(1, n):
        if st[k][3] >= h * 0.9 and st[k][1] <= h * 0.06:
            g[cv2.dilate((lab == k).astype(np.uint8), np.ones((1, 5), np.uint8)) > 0] = 255
    return g[2:-2, 2:-2]

def celulas_reais(foto, molde, colunas):
    import recorte
    r = recorte.ler_grade(foto, recorte.MOLDES[molde])
    img, P, _, _ = r
    nomes = recorte.MOLDES[molde]['nomes']
    out = []
    for m in range(recorte.MOLDES[molde]['linhas']):
        linha = []
        for nome in colunas:
            c = nomes.index(nome)
            linha.append(limpar_celula(recorte.celula(img, P, m, c, 64)))
        out.append(linha)
    return out

def carregar_reais():
    import gabarito as G
    casos = []
    foto = r"C:\Users\guilh\Downloads\Phone Link\Hidro Exem.jpg"
    cels = celulas_reais(foto, 'anexo2', ['horario', 'sac', 'phf', 'bhx', 'enz', 'anti'])
    for m, linha in enumerate(G.SACARIFICACAO):
        for c, texto in enumerate(linha): casos.append((cels[m][c], texto, ['horario', 'sac', 'phf', 'bhx', 'enz', 'anti'][c]))
    foto = r"C:\Users\guilh\Downloads\Phone Link\Hidrolise 1.jpg"
    cols = ['inicio', 'fim', 'phf', 'cal', 'brix', 'phf2', 'enzi', 'bhx', 'produto']
    cels = celulas_reais(foto, 'anexo1', cols)
    for m, linha in enumerate(G.HIDROLISE):
        for c, texto in enumerate(linha):
            if texto != '?': casos.append((cels[m][c], texto, cols[c]))
    return casos

def normal(t):
    return t.replace('.', ',').replace(':', '').replace(',', '') if False else t

def mesma_leitura(lido, certo):
    """compara ignorando só o separador escrito diferente (8:31 = 831, 5,0 = 50)"""
    tira = lambda s: s.replace(':', '').replace(',', '').replace('.', '').upper()
    return tira(lido) == tira(certo)

def main():
    dev = 'cuda'
    nome = os.environ.get('DADOS', 'treino'); nv = os.environ.get('VALID', 'valid'); saida = os.environ.get('SAIDA', 'leitor.pt')
    X = np.load(os.path.join(AQUI, f'{nome}_X.npy'), mmap_mode='r')
    T = open(os.path.join(AQUI, f'{nome}_T.txt'), encoding='utf-8').read().split('\n')
    Xv = np.load(os.path.join(AQUI, f'{nv}_X.npy')); Tv = open(os.path.join(AQUI, f'{nv}_T.txt'), encoding='utf-8').read().split('\n')
    print('treino', X.shape, 'valid', Xv.shape)
    X = torch.from_numpy(np.ascontiguousarray(X))  # cabe na memória
    reais = carregar_reais()
    Xr = torch.from_numpy(np.stack([S.preparar(c) for c, _, _ in reais])).unsqueeze(1).float()
    print('células reais', len(reais))

    modelo = Leitor().to(dev)
    print('parâmetros', sum(p.numel() for p in modelo.parameters()))
    epocas = int(os.environ.get('EPOCAS', 14)); lote = 384
    passos = epocas * (len(X) // lote)
    opt = torch.optim.AdamW(modelo.parameters(), lr=2e-3, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=2e-3, total_steps=passos, pct_start=0.15)
    ctc = nn.CTCLoss(blank=0, zero_infinity=True)
    alvo = [torch.tensor([IDX[c] for c in t if c in IDX] or [IDX['-']]) for t in T]
    melhor = -1
    for ep in range(epocas):
        modelo.train(); t0 = time.time()
        ordem = torch.randperm(len(X))
        soma = 0
        for b in range(len(X) // lote):
            ids = ordem[b * lote:(b + 1) * lote]
            xb = X[ids].to(dev, non_blocking=True).float().div_(255).unsqueeze(1)
            # aumento na placa: deslocamento, contraste e ruído
            desl = random.randint(0, 14)
            if desl: xb = torch.roll(xb, desl, dims=3)
            xb = xb * (0.7 + 0.5 * torch.rand(xb.size(0), 1, 1, 1, device=dev))
            xb = (xb + 0.04 * torch.randn_like(xb) * (torch.rand(xb.size(0), 1, 1, 1, device=dev) < 0.5)).clamp_(0, 1)
            ys = [alvo[i] for i in ids.tolist()]
            tgt = torch.cat(ys).to(dev); tl = torch.tensor([len(y) for y in ys], device=dev)
            out = modelo(xb).log_softmax(1).permute(2, 0, 1)  # T,N,C
            il = torch.full((xb.size(0),), out.size(0), dtype=torch.long, device=dev)
            perda = ctc(out, tgt, il, tl)
            opt.zero_grad(set_to_none=True); perda.backward()
            torch.nn.utils.clip_grad_norm_(modelo.parameters(), 5)
            opt.step(); sched.step(); soma += perda.item()
        modelo.eval()
        with torch.no_grad():
            pv = []
            for b in range(0, len(Xv), 1024):
                pv += decodificar(modelo(torch.from_numpy(Xv[b:b + 1024]).to(dev).float().div(255).unsqueeze(1)).log_softmax(1))
            acc_v = np.mean([a == b for a, b in zip(pv, Tv)])
            pr = decodificar(modelo(Xr.to(dev)).log_softmax(1))
            acc_r = np.mean([mesma_leitura(a, b) for a, b in zip(pr, [t for _, t, _ in reais])])
        print(f'época {ep + 1}: perda {soma / (len(X) // lote):.3f}  sintético {acc_v:.3f}  fotos reais {acc_r:.3f}  ({time.time() - t0:.0f}s)', flush=True)
        if acc_r > melhor:
            melhor = acc_r; torch.save(modelo.state_dict(), os.path.join(AQUI, saida))
    torch.save(modelo.state_dict(), os.path.join(AQUI, saida.replace('.pt', '_ultimo.pt')))
    # mostra os erros nas fotos reais
    modelo.load_state_dict(torch.load(os.path.join(AQUI, saida))); modelo.eval()
    with torch.no_grad(): pr = decodificar(modelo(Xr.to(dev)).log_softmax(1))
    erros = [(t, p, col) for p, (_, t, col) in zip(pr, reais) if not mesma_leitura(p, t)]
    print('melhor nas fotos reais', melhor, 'erros', len(erros))
    for e in erros[:60]: print('   certo', e[0], 'lido', e[1], 'coluna', e[2])

if __name__ == '__main__':
    main()
