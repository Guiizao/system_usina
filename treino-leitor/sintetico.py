# Pranchetas Digitais - (c) 2026 Guilherme. Todos os direitos reservados. Uso somente com autorizacao do autor (veja LICENCA.txt).
"""Gera células de tabela "escritas à mão" para treinar o leitor.

Duas fontes de letra:
  - EMNIST (letras e números escritos por ~3.600 pessoas)
  - fontes de mão e cursivas do Google Fonts
Depois suja a imagem para parecer foto de caneta no papel (borda da célula, borrão, sombra, tinta fraca).
"""
import os, random, gzip, struct
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont

AQUI = os.path.dirname(os.path.abspath(__file__))
ALFABETO = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ:,.-/"
H, W = 32, 160

NOMES = """ALBERTO ANDRE ANTONIO BRUNO CARLINDO CARLOS CLEBER DANIEL DIEGO EDSON EDUARDO FABIO FELIPE FERNANDO GABRIEL GILMAR GUILHERME
JAIR JOAO JONATAS JOSE JULIO LEANDRO LUCAS LUIZ MARCELO MARCOS MATEUS MATHEUS PAULO PEDRO RAFAEL RENATO RICARDO RODRIGO ROMANGUERA
SERGIO THIAGO VAGNER VALDIR VITOR WESLEY WILLIAN ADRIANO CLAUDIO DOUGLAS EVERTON GERSON HUGO IVAN JEFERSON LEONARDO NELSON OSVALDO
ROBERTO SAMUEL TIAGO VALMIR ZE SILVA SOUZA SANTOS OLIVEIRA LIMA PEREIRA COSTA ROCHA""".split()
PALAVRAS = ["MASSA", "FINI", "OUTRO", "EMBALAGENS", "OK", "LPHERA", "CAL", "SACZYME", "ALCOLINA", "LACTROL", "UREIA", "TOTAL", "FORNECEDOR"]

# ---------------- EMNIST ----------------
_emnist = None
def emnist():
    global _emnist
    if _emnist is not None: return _emnist
    raw = os.path.join(AQUI, 'dados', 'EMNIST', 'raw')
    def ler(nome):
        caminho = os.path.join(raw, nome)
        with open(caminho, 'rb') as f: cab = f.read(16)
        if nome.endswith('images-idx3-ubyte'):
            n, r, c = struct.unpack('>III', cab[4:16])
            # memmap: os processos em paralelo dividem a mesma memória
            return np.memmap(caminho, np.uint8, 'r', offset=16, shape=(n, r, c)).transpose(0, 2, 1)
        return np.fromfile(caminho, np.uint8, offset=8)
    imgs = ler('emnist-byclass-train-images-idx3-ubyte'); labs = ler('emnist-byclass-train-labels-idx1-ubyte')
    mapa = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    por = {}
    for ch in "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ": por[ch] = []
    for i, l in enumerate(labs):
        ch = mapa[l].upper()
        por[ch].append(i)
    _emnist = (imgs, {k: np.array(v) for k, v in por.items()})
    return _emnist

# ---------------- fontes ----------------
_fontes = None
def fontes():
    global _fontes
    if _fontes is None:
        nomes = open(os.path.join(AQUI, 'fontes_boas.txt')).read().split()
        _fontes = [os.path.join(AQUI, 'fontes', n) for n in nomes]
    return _fontes

# ---------------- textos parecidos com os das folhas ----------------
def texto_aleatorio():
    t = random.random()
    if t < 0.22:  # horário
        h = random.randint(0, 23); m = random.randint(0, 59)
        hs = str(h) if (h < 10 and random.random() < 0.5) else f"{h:02d}"
        sep = random.choices([':', '.', '', ',', ';'], [70, 8, 14, 5, 3])[0]
        sep = ':' if sep == ';' else sep
        return f"{hs}{sep}{m:02d}"
    if t < 0.40:  # decimal (pH, INPM, temperatura)
        a = random.choice([random.randint(2, 9), random.randint(2, 9), random.randint(10, 120)])
        b = random.randint(0, 9)
        sep = random.choices([',', '.', ''], [78, 10, 12])[0]
        return f"{a}{sep}{b}"
    if t < 0.47: return random.choice(['100', '100', '70', '70', '4', '04', '10', '17', '07', '1', '11', '14'])
    if t < 0.62:  # inteiro
        n = random.choice([random.randint(0, 9), random.randint(10, 40), random.choice([70, 100, 100, 70, 150, 180]), random.randint(100, 999)])
        s = str(n)
        if n < 10 and random.random() < 0.5: s = '0' + s
        return s
    if t < 0.66: return random.choice(['-', '-', '--', '/'])
    if t < 0.72: return random.choice(['OK', '6K', '7K', '8K', f"{random.randint(1, 9)}K"])
    if t < 0.84: return random.choice(PALAVRAS)
    if t < 0.95: return random.choice(NOMES)[:random.randint(4, 11)]
    n = random.randint(1, 8)
    return ''.join(random.choice(ALFABETO[:36]) for _ in range(n))

# ---------------- desenho ----------------
def pontuacao(ch, alt):
    """desenha : , . - / como traço de caneta"""
    img = np.zeros((alt, max(6, alt // 2)), np.uint8)
    esp = random.randint(2, max(2, alt // 9))
    w = img.shape[1]
    if ch == ':':
        for y in (int(alt * random.uniform(0.35, 0.5)), int(alt * random.uniform(0.75, 0.9))):
            cv2.circle(img, (w // 2 + random.randint(-1, 1), y), esp, 255, -1)
    elif ch == '.':
        cv2.circle(img, (w // 2, int(alt * random.uniform(0.8, 0.92))), esp, 255, -1)
    elif ch == ',':
        x = w // 2; y = int(alt * random.uniform(0.78, 0.9))
        cv2.line(img, (x + 1, y - esp), (x - random.randint(1, 3), y + random.randint(esp + 2, esp + 6)), 255, esp + 1)
    elif ch == '-':
        img = np.zeros((alt, max(10, int(alt * random.uniform(0.5, 1.2)))), np.uint8)
        y = int(alt * random.uniform(0.45, 0.6))
        cv2.line(img, (1, y + random.randint(-2, 2)), (img.shape[1] - 2, y + random.randint(-2, 2)), 255, esp + 1)
    elif ch == '/':
        cv2.line(img, (w - 2, 2), (1, alt - 2), 255, esp + 1)
    return img

def desenhar_emnist(texto):
    imgs, por = emnist()
    alt = random.randint(34, 44)
    partes = []
    for ch in texto:
        if ch.isdigit() and random.random() < 0.45:
            import caneta
            g = caneta.desenhar(ch, int(alt * random.uniform(0.6, 0.95)))
            col = np.zeros((alt + 10, g.shape[1]), np.uint8)
            y = random.randint(0, alt + 10 - g.shape[0]); col[y:y + g.shape[0]] = g
            partes.append(col[:alt]); continue
        if ch in por:
            g = imgs[random.choice(por[ch])]
            ys, xs = np.nonzero(g > 30)
            if len(xs) == 0: continue
            g = g[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
            ah = int(alt * random.uniform(0.6, 0.95))
            aw = max(3, int(g.shape[1] * ah / g.shape[0] * random.uniform(0.8, 1.2)))
            g = cv2.resize(g, (aw, ah))
            col = np.zeros((alt, aw), np.uint8)
            y = random.randint(0, alt - ah)
            col[y:y + ah] = g
            partes.append(col)
        elif ch == ' ':
            partes.append(np.zeros((alt, random.randint(6, 14)), np.uint8))
        else:
            partes.append(pontuacao(ch, alt))
    if not partes: partes = [np.zeros((alt, 10), np.uint8)]
    larg = sum(p.shape[1] for p in partes) + 20 * len(partes)
    tela = np.zeros((alt + 10, larg + 10), np.uint8)
    x = 5
    for p in partes:
        y = random.randint(2, 8)
        tela[y:y + alt, x:x + p.shape[1]] = np.maximum(tela[y:y + alt, x:x + p.shape[1]], p)
        x += p.shape[1] + random.randint(-4, 7)
    return tela[:, :x + 6]

def desenhar_fonte(texto):
    f = random.choice(fontes())
    tam = random.randint(30, 46)
    try: fonte = ImageFont.truetype(f, tam)
    except Exception: return desenhar_emnist(texto)
    mostrar = texto
    if random.random() < 0.45 and texto.isalpha(): mostrar = texto.capitalize() if random.random() < 0.6 else texto.lower()
    esp = random.uniform(-1, 4)
    larg = int(sum(fonte.getlength(c) + esp for c in mostrar)) + 30
    im = Image.new('L', (max(larg, 20), tam * 2), 0)
    d = ImageDraw.Draw(im)
    x = 10
    for c in mostrar:
        d.text((x, tam // 3 + random.randint(-2, 2)), c, fill=255, font=fonte)
        x += fonte.getlength(c) + esp
    a = np.array(im)
    if random.random() < 0.4: a = cv2.dilate(a, np.ones((2, 2), np.uint8))
    return a

def sujar(tinta):
    """tinta (0..255, fundo 0) -> célula em cinza como na foto (tinta escura em papel claro)"""
    ys, xs = np.nonzero(tinta > 40)
    if len(xs) == 0: tinta = np.zeros((20, 20), np.uint8)
    else: tinta = tinta[max(0, ys.min() - 2):ys.max() + 3, max(0, xs.min() - 2):xs.max() + 3]
    h, w = tinta.shape
    # inclinação e rotação da letra
    cis = random.uniform(-0.35, 0.3)
    M = np.float32([[1, cis, max(0, -cis * h)], [0, 1, 0]])
    tinta = cv2.warpAffine(tinta, M, (w + int(abs(cis) * h) + 2, h))
    ang = random.uniform(-5, 5)
    h, w = tinta.shape
    M = cv2.getRotationMatrix2D((w / 2, h / 2), ang, 1)
    tinta = cv2.warpAffine(tinta, M, (w, h))
    # espessura
    r = random.random()
    if r < 0.25: tinta = cv2.dilate(tinta, np.ones((2, 2), np.uint8))
    elif r < 0.35: tinta = cv2.erode(tinta, np.ones((2, 2), np.uint8))
    # cabe na célula: ocupa parte da altura, com folga
    ch = int(H * random.uniform(1.6, 2.4))
    cw = int(ch * random.uniform(2.5, 6.5))
    escala = min((ch * random.uniform(0.55, 0.92)) / tinta.shape[0], (cw * 0.95) / tinta.shape[1])
    t = cv2.resize(tinta, (max(2, int(tinta.shape[1] * escala)), max(2, int(tinta.shape[0] * escala))), interpolation=cv2.INTER_AREA)
    cel = np.zeros((ch, cw), np.float32)
    y = random.randint(0, max(0, ch - t.shape[0])); x = random.randint(0, max(0, cw - t.shape[1]))
    y = min(y, ch - t.shape[0]); x = min(x, cw - t.shape[1])
    cel[y:y + t.shape[0], x:x + t.shape[1]] = t / 255.0
    forca = random.uniform(0.45, 1.0)
    cel *= forca
    # restos da borda impressa da célula e tinta da célula vizinha
    if random.random() < 0.5:
        for _ in range(random.randint(1, 3)):
            lado = random.choice('tblr'); e = random.randint(1, 3); v = random.uniform(0.3, 0.9)
            if lado == 't': cel[:e, :] = np.maximum(cel[:e, :], v)
            if lado == 'b': cel[-e:, :] = np.maximum(cel[-e:, :], v)
            if lado == 'l': cel[:, :e] = np.maximum(cel[:, :e], v)
            if lado == 'r': cel[:, -e:] = np.maximum(cel[:, -e:], v)
    if random.random() < 0.15:
        yy = random.randint(0, ch - 1); cv2.line(cel, (0, yy), (random.randint(3, cw // 6), yy + random.randint(-3, 3)), random.uniform(0.4, 0.9), random.randint(1, 3))
    # papel: fundo claro com sombra e ruído
    papel = random.uniform(0.75, 1.0) - np.linspace(0, random.uniform(0, 0.25), cw)[None, :] * random.choice([1, -1])
    img = np.clip(papel - cel * random.uniform(0.55, 0.95), 0, 1)
    img += np.random.normal(0, random.uniform(0, 0.05), img.shape)
    if random.random() < 0.5: img = cv2.GaussianBlur(img, (0, 0), random.uniform(0.3, 1.1))
    img = np.clip(img, 0, 1)
    if random.random() < 0.3:
        ok, enc = cv2.imencode('.jpg', (img * 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, random.randint(35, 85)])
        img = cv2.imdecode(enc, 0) / 255.0
    return (img * 255).astype(np.uint8)

def preparar(cinza):
    """mesma preparação usada no aplicativo: tinta clara em fundo escuro, altura 32, largura até 160"""
    g = cinza.astype(np.float32)
    fundo = cv2.GaussianBlur(g, (0, 0), 8) + 1
    n = np.clip(g / fundo, 0, 1.2)
    tinta = np.clip(1.0 - n, 0, 1)
    mx = np.percentile(tinta, 99.5)
    tinta = np.clip(tinta / max(mx, 0.08), 0, 1)
    tinta[tinta < 0.18] = 0
    h, w = tinta.shape
    nw = max(4, min(W, int(round(w * H / h))))
    t = cv2.resize(tinta, (nw, H), interpolation=cv2.INTER_AREA)
    out = np.zeros((H, W), np.float32)
    out[:, :nw] = t
    return out

def exemplo():
    texto = texto_aleatorio()
    tinta = desenhar_emnist(texto) if random.random() < 0.55 else desenhar_fonte(texto)
    return preparar(sujar(tinta)), texto

if __name__ == '__main__':
    random.seed(1); np.random.seed(1)
    linhas = []
    for i in range(48):
        x, t = exemplo()
        v = (x * 255).astype(np.uint8)
        cv2.putText(v, t, (100, 30), cv2.FONT_HERSHEY_PLAIN, 1, 128, 1)
        linhas.append(np.pad(v, 2, constant_values=90))
    grade = np.vstack([np.hstack(linhas[i:i + 4]) for i in range(0, 48, 4)])
    cv2.imwrite(os.path.join(AQUI, 'out_sintetico.png'), cv2.resize(grade, None, fx=1.5, fy=1.5, interpolation=cv2.INTER_NEAREST))
    print('ok')
