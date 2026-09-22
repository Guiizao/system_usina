# Pranchetas Digitais - (c) 2026 Guilherme. Todos os direitos reservados. Uso somente com autorizacao do autor (veja LICENCA.txt).
import sys, torch, os
import treino as TR
pesos = sys.argv[1]; destino = sys.argv[2]
m = TR.Leitor(); m.load_state_dict(torch.load(pesos, map_location='cpu')); m.eval()
x = torch.zeros(1, 1, 32, 160)
torch.onnx.export(m, x, destino, input_names=['entrada'], output_names=['saida'], opset_version=11, dynamo=False, do_constant_folding=True)
print('ok', os.path.getsize(destino) // 1024, 'KB')
