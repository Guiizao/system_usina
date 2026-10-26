# 2.17: contorna o U da logo da Ubirálcool (sem o texto) e grava logo-u.svg, icon-192.png e icon-512.png.
# Uso (na pasta app): python testes/gerar-icones.py public/icons   (precisa de numpy, opencv e Pillow)
import cv2, numpy as np, sys
from PIL import Image
ICONS = sys.argv[1]
im = np.array(Image.open(ICONS + '/logo.png').convert('RGBA')).astype(np.float32)
r, g, b, a = im[..., 0], im[..., 1], im[..., 2], im[..., 3]
# quanto do pixel é o verde da marca (0 a 1): a fita branca de dentro e o fundo ficam de fora
verde = np.clip(((g - np.maximum(r, b)) / 60.0), 0, 1) * (a / 255.0)
y0, y1, x0, x1 = 0, 192, 70, 231  # só o U (o texto começa abaixo da linha 192)
mask = verde[y0:y1, x0:x1]
cor = np.median(im[y0:y1, x0:x1][mask > 0.9][:, :3], axis=0).astype(int)
ESC = 10
grande = cv2.resize(mask, None, fx=ESC, fy=ESC, interpolation=cv2.INTER_CUBIC)
grande = cv2.GaussianBlur(grande, (0, 0), ESC * 0.45)
bin_ = (grande > 0.5).astype(np.uint8) * 255
conts, hier = cv2.findContours(bin_, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
ys, xs = np.nonzero(bin_)
bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max(), ys.max()
lado = max(bx1 - bx0, by1 - by0)
# viewBox 0 0 100 100 com o U no meio
def ponto(p):
    x = (p[0] - bx0 - (bx1 - bx0) / 2) / lado * 100 + 50
    y = (p[1] - by0 - (by1 - by0) / 2) / lado * 100 + 50
    return f'{x:.2f} {y:.2f}'
partes = []
for c in conts:
    if cv2.contourArea(c) < 50 * ESC: continue
    c = cv2.approxPolyDP(c, 0.6, True)[:, 0, :]
    partes.append('M' + ' L'.join(ponto(p) for p in c) + 'Z')
hexcor = '#%02x%02x%02x' % tuple(cor)
svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="Ubirálcool"><path fill="{hexcor}" fill-rule="evenodd" d="{" ".join(partes)}"/></svg>\n'
open(ICONS + '/logo-u.svg', 'w', encoding='utf-8', newline='\n').write(svg)
print('svg', len(svg), 'bytes,', len(partes), 'contornos, cor', hexcor)
# ícones: o U sobre branco, com folga (zona segura do ícone do Android)
recorte = (grande[by0:by1 + 1, bx0:bx1 + 1] > 0.5).astype(np.float32)
recorte = cv2.GaussianBlur(grande[by0:by1 + 1, bx0:bx1 + 1], (0, 0), 1.0)
for tam in (192, 512):
    alto = int(tam * 0.62)
    h0, w0 = recorte.shape
    alfa = cv2.resize(np.clip((recorte - 0.5) * 6 + 0.5, 0, 1), (max(1, round(w0 * alto / h0)), alto), interpolation=cv2.INTER_AREA)
    fundo = np.full((tam, tam, 3), 255, np.float32)
    oy, ox = (tam - alfa.shape[0]) // 2, (tam - alfa.shape[1]) // 2
    reg = fundo[oy:oy + alfa.shape[0], ox:ox + alfa.shape[1]]
    reg[:] = reg * (1 - alfa[..., None]) + np.array(cor, np.float32) * alfa[..., None]
    Image.fromarray(fundo.astype(np.uint8)).convert('RGBA').save(f'{ICONS}/icon-{tam}.png')
    print('icon', tam)
