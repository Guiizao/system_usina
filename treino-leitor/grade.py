# Pranchetas Digitais - (c) 2026 Guilherme. Todos os direitos reservados. Uso somente com autorizacao do autor (veja LICENCA.txt).
import cv2, numpy as np, sys, os
from PIL import Image, ImageOps

def carregar(caminho, lado=2000):
    im = ImageOps.exif_transpose(Image.open(caminho)).convert('RGB')
    im.thumbnail((lado, lado))
    return cv2.cvtColor(np.array(im), cv2.COLOR_RGB2GRAY)

def mascara_linhas(cinza):
    tinta = cv2.adaptiveThreshold(cinza, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 31, 12)
    h, w = tinta.shape
    hor = cv2.morphologyEx(tinta, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (w // 25, 1)))
    ver = cv2.morphologyEx(tinta, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, h // 35)))
    return tinta, hor, ver

def maior_tabela(hor, ver):
    grade = cv2.dilate(cv2.bitwise_or(hor, ver), np.ones((5, 5), np.uint8))
    cont, _ = cv2.findContours(grade, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    c = max(cont, key=cv2.contourArea)
    peri = cv2.arcLength(c, True)
    ap = cv2.approxPolyDP(c, 0.02 * peri, True)
    if len(ap) != 4:
        x, y, w, h = cv2.boundingRect(c)
        ap = np.array([[x, y], [x + w, y], [x + w, y + h], [x, y + h]])
    pts = ap.reshape(4, 2).astype(np.float32)
    s = pts.sum(1); d = np.diff(pts, axis=1).ravel()
    return np.array([pts[np.argmin(s)], pts[np.argmin(d)], pts[np.argmax(s)], pts[np.argmax(d)]], np.float32)

if __name__ == '__main__':
    for f in sys.argv[1:]:
        g = carregar(f)
        tinta, hor, ver = mascara_linhas(g)
        q = maior_tabela(hor, ver)
        vis = cv2.cvtColor(g, cv2.COLOR_GRAY2BGR)
        cv2.polylines(vis, [q.astype(int)], True, (0, 0, 255), 6)
        nome = os.path.splitext(os.path.basename(f))[0].replace(' ', '_')
        cv2.imwrite(f'out_{nome}_tabela.jpg', cv2.resize(vis, None, fx=0.4, fy=0.4))
        print(nome, g.shape, q.astype(int).tolist())
