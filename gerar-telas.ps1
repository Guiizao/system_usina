# Pranchetas Digitais - (c) 2026 Guilherme. Todos os direitos reservados. Uso somente com autorizacao do autor (veja LICENCA.txt).
# Gera imagens das telas para apresentação (precisa do "node server.js" rodando)
$dir = Join-Path $PSScriptRoot "..\telas"
Remove-Item -Recurse -Force $dir -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $dir | Out-Null
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$b = "http://localhost:8080/?demo"
function U($s) { [uri]::EscapeDataString($s) }
$telas = @(
  @("01-conectar-na-rede", "&tela=conectar&campo=codigo&teclas=5|0|4", 1280, 800),
  @("02-escolher-setor", "", 1280, 800),
  @("03-quem-esta-trabalhando", "&papel=hidrolise&tela=operador", 1280, 800),
  @("04-hidrolise-inicio", "&papel=hidrolise&op=Guilherme", 1280, 800),
  @("05-dorna-teclado-lateral", "&papel=hidrolise&op=Guilherme&tela=prancheta&pid=hid_anexo1&campo=brix&teclas=1|8", 1280, 800),
  @("06-dorna-ph-baixo-aviso-cal", "&papel=hidrolise&op=Guilherme&tela=prancheta&pid=hid_anexo1&campo=phf&teclas=4|,|6", 1280, 800),
  @("07-dorna-brix-alto-aviso", "&papel=hidrolise&op=Guilherme&tela=prancheta&pid=hid_anexo1&campo=brix&teclas=2|7", 1280, 800),
  @("08-sacarificacao", "&papel=hidrolise&op=Guilherme&tela=prancheta&pid=hid_anexo2", 1280, 800),
  @("09-lphera-e-cal", "&papel=hidrolise&op=Guilherme&tela=prancheta&pid=juntas_lphera_cal", 1280, 800),
  @("10-saczyme-e-alcolina", "&papel=hidrolise&op=Guilherme&tela=prancheta&pid=juntas_saczyme_alcolina&chave=9", 1280, 800),
  @("11-ralo-pesagem", "&papel=ralo&op=Jair&tela=prancheta&pid=ins_materia_prima&campo=qtd&teclas=5|0|0", 1280, 800),
  @("12-caldeira-leitura", "&papel=caldeira&op=Alberto&tela=prancheta&pid=caldeira&chave=10&campo=pressao", 1280, 800),
  @("13-destilaria", "&papel=destilaria&op=Mateus&tela=prancheta&pid=destilaria&chave=13", 1280, 800),
  @("14-tablet-chefe-painel", "&papel=central", 1280, 800),
  @("15-tablet-chefe-escolher-excel-ou-xml", "&papel=central&modal=formato", 1280, 800),
  @("16-tablet-chefe-relatorios", "&papel=central&tela=relatorios", 1280, 800),
  @("17-configuracoes-da-usina", "&papel=central&tela=config", 1280, 800),
  @("18-escolher-funcao-do-aparelho", "&papel=central&tela=admin", 1280, 800),
  @("19-preparando-o-servidor", "&tela=preparando", 1280, 800),
  @("20-servidor-pronto", "&tela=preparando&fim=1", 1280, 800),
  @("21-monitoramento", "&papel=hidrolise&op=Guilherme&tela=prancheta&pid=hid_anexo1&monitor=1", 1280, 800),
  @("22-tela-escura-turno-da-noite", "&tema=escuro&papel=hidrolise&op=Guilherme&tela=prancheta&pid=hid_anexo1&campo=brix&teclas=1|8", 1280, 800),
  @("23-tablet-em-pe", "&papel=hidrolise&op=Guilherme&tela=prancheta&pid=hid_anexo1&campo=brix&teclas=2|1", 800, 1280),
  @("24-tablet-pequeno-8-polegadas", "&papel=hidrolise&op=Guilherme&tela=prancheta&pid=hid_anexo1&campo=brix&teclas=2|1", 1005, 600)
)
foreach ($t in $telas) {
  $perfil = Join-Path $env:TEMP ("pranchetas-" + $t[0])
  Remove-Item -Recurse -Force $perfil -ErrorAction SilentlyContinue
  & $chrome --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$perfil" --window-size="$($t[2]),$($t[3])" --virtual-time-budget=5000 --screenshot="$(Join-Path $dir ($t[0] + '.png'))" ($b + $t[1]) 2>$null | Out-Null
}
# Celular (dentro de uma moldura, para ficar com a largura real de um celular)
$cel = @(
  @("25-celular-inicio-e-prancheta", ($b + "&papel=hidrolise&op=Guilherme"), "Tela inicial", ($b + "&papel=hidrolise&op=Guilherme&tela=prancheta&pid=hid_anexo1"), "Prancheta"),
  @("26-celular-teclado", ($b + "&papel=hidrolise&op=Guilherme&tela=prancheta&pid=hid_anexo1&campo=phf&teclas=4|,|8"), "Teclado com - e +", ($b + "&papel=caldeira&op=Alberto&tela=prancheta&pid=caldeira&chave=10&campo=obs&teclas=O|K"), "Letras")
)
foreach ($c in $cel) {
  $perfil = Join-Path $env:TEMP ("pranchetas-" + $c[0])
  Remove-Item -Recurse -Force $perfil -ErrorAction SilentlyContinue
  $url = "http://localhost:8080/moldura.html?a=" + (U $c[1]) + "&la=" + (U $c[2]) + "&b=" + (U $c[3]) + "&lb=" + (U $c[4])
  & $chrome --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$perfil" --window-size="1100,1000" --virtual-time-budget=7000 --screenshot="$(Join-Path $dir ($c[0] + '.png'))" $url 2>$null | Out-Null
}
# Página de download
$perfil = Join-Path $env:TEMP "pranchetas-baixar"
& $chrome --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$perfil" --window-size="800,1280" --virtual-time-budget=4000 --screenshot="$(Join-Path $dir '27-pagina-baixar-app.png')" "http://localhost:8080/baixar" 2>$null | Out-Null
Get-ChildItem $dir | Select-Object Name
