# Pranchetas Digitais - (c) 2026 Guilherme. Confere o Excel e o XML gerados (só com a biblioteca padrão do Python).
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

xlsx, xml = sys.argv[1], sys.argv[2]
r = {'ok': True}
try:
    with zipfile.ZipFile(xlsx) as z:
        nomes = z.namelist()
        for obrigatorio in ['[Content_Types].xml', 'xl/workbook.xml', 'xl/styles.xml']:
            if obrigatorio not in nomes:
                raise Exception('faltou ' + obrigatorio + ' no Excel')
        for n in nomes:
            if n.endswith('.xml') or n.endswith('.rels'):
                ET.fromstring(z.read(n))  # quebra se o XML interno estiver mal formado
        wb = ET.fromstring(z.read('xl/workbook.xml'))
        ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        folhas = wb.findall('.//m:sheet', ns)
        r['folhas'] = len(folhas)
        r['nomesFolhas'] = [f.get('name') for f in folhas]
        if any(len(f.get('name')) > 31 for f in folhas):
            raise Exception('nome de folha com mais de 31 letras (o Excel não abre)')
        tudo = ''.join(z.read(n).decode('utf8') for n in nomes if n.startswith('xl/worksheets/') or n == 'xl/sharedStrings.xml')
        r['temValor46'] = bool(re.search(r'<v>4\.6</v>|>4,6<', tudo))
    arvore = ET.parse(xml).getroot()
    r['xmlItens'] = len(list(arvore.iter()))
    r['xmlTem46'] = any((e.text or '').strip() in ('4.6', '4,6') for e in arvore.iter()) or any(v in ('4.6', '4,6') for e in arvore.iter() for v in e.attrib.values())
except Exception as e:
    r = {'ok': False, 'erro': str(e)}
print(json.dumps(r))
