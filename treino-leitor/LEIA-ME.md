# Treino do leitor de folhas escritas à mão

O aplicativo usa `public/lib/leitor.onnx`. Estes arquivos servem para treinar de novo, por exemplo quando houver mais fotos de folhas preenchidas.

Precisa: Python 3, `pip install torch torchvision opencv-python pillow numpy fonttools onnx onnxscript` (com placa de vídeo NVIDIA, use o PyTorch com CUDA).

1. **Fontes de mão:** baixe as fontes listadas em `fontes_boas.txt` do Google Fonts para a pasta `fontes/`.
2. **Base EMNIST:** baixada sozinha pelo `torchvision` na primeira vez (pasta `dados/`, ~560 MB).
3. **Gerar exemplos:** `python gerar.py 500000 treino2` e `python gerar.py 12000 valid2`.
4. **Treinar:** `DADOS=treino2 VALID=valid2 SAIDA=leitor3.pt EPOCAS=20 python treino.py`.
5. **Ajustar com folhas reais e medir:** `python ajuste.py leitor3_ultimo.pt` mede treinando com uma folha e testando na outra. Com um segundo argumento (`python ajuste.py base.pt final.pt`) salva o modelo ajustado com todas as folhas.
6. **Levar para o app:** `python exportar.py final.pt ../public/lib/leitor.onnx` e gere o APK de novo.

Folhas reais com gabarito ficam em `gabarito.py` (o que está escrito de verdade em cada célula). Quanto mais folhas reais anotadas ali, melhor o leitor fica. As fotos usadas estão em `Downloads/Phone Link`.

`leitor.pt` é o modelo que está no aplicativo hoje: base da rodada 1, ajustado com as folhas de Hidrólise e Sacarificação. Na medição com folha nunca vista, acertou de 77% a 89% das células, e de 89% a 95% das que marcou como confiantes.
