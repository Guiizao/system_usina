# Pranchetas Digitais - (c) 2026 Guilherme. Todos os direitos reservados. Uso somente com autorizacao do autor (veja LICENCA.txt).
# Publica a Nuvem das Pranchetas no Cloudflare (plano gratis, sem cartao).
# Antes, uma vez: crie a conta gratis em https://dash.cloudflare.com/sign-up (so e-mail e senha).
# Para rodar: botao direito no arquivo > Executar com o PowerShell
# (ou: powershell -ExecutionPolicy Bypass -File publicar.ps1)
# Pode rodar de novo quando quiser: na segunda vez ele so manda o que mudou (e a versao nova do aplicativo).
$ErrorActionPreference = 'Stop'
$aqui = $PSScriptRoot
Set-Location $aqui
function Log($m) { Write-Output ("[{0:HH:mm:ss}] {1}" -f (Get-Date), $m) }
$env:WRANGLER_SEND_METRICS = 'false'
$wjs = Join-Path $aqui 'node_modules\wrangler\bin\wrangler.js'

# tudo que aparece fica em publicar-log.txt; com erro, a janela espera o Enter (antes ela fechava sem dar para ler)
$arquivoLog = Join-Path $aqui 'publicar-log.txt'
try { Start-Transcript -Path $arquivoLog -Force | Out-Null } catch { }
trap {
  Write-Output ''
  Write-Output ('ERRO: ' + $_.Exception.Message)
  Write-Output "As mensagens ficaram no arquivo $arquivoLog (mande esse arquivo se precisar de ajuda)."
  try { Stop-Transcript | Out-Null } catch { }
  Read-Host 'Aperte Enter para fechar'
  exit 1
}

if (-not (Test-Path $wjs)) {
  Log 'Instalando o wrangler (o programa do Cloudflare). Demora uns minutos na primeira vez...'
  & cmd /c "npm install --no-audit --no-fund" | Select-Object -Last 3
  if (-not (Test-Path $wjs)) { throw 'Nao consegui instalar o wrangler. Confira se o Node.js esta instalado e se tem internet.' }
}

Log 'Conferindo a sua conta do Cloudflare...'
$ErrorActionPreference = 'Continue'
$quem = & node $wjs whoami 2>&1 | Out-String
if ($quem -notmatch '@') {
  Log 'Vai abrir o navegador: entre na sua conta do Cloudflare e toque em Allow (Permitir).'
  & node $wjs login
}
$ErrorActionPreference = 'Stop'

# banco de dados (D1): cria na primeira vez e anota o numero dele no wrangler.toml
$toml = [IO.File]::ReadAllText("$aqui\wrangler.toml")
if ($toml -match 'database_id = "00000000-') {
  Log 'Criando o banco de dados na nuvem...'
  $ErrorActionPreference = 'Continue'
  $saida = & node $wjs d1 create pranchetas 2>&1 | Out-String
  $id = [regex]::Match($saida, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}').Value
  if (-not $id) {
    # ja existia: pega o numero na lista
    $lista = & node $wjs d1 list --json 2>$null | Out-String
    try { $id = (($lista | ConvertFrom-Json) | Where-Object { $_.name -eq 'pranchetas' } | Select-Object -First 1).uuid } catch { $id = '' }
  }
  $ErrorActionPreference = 'Stop'
  if (-not $id) { throw "Nao consegui criar o banco de dados: $saida" }
  $toml = $toml -replace 'database_id = "[^"]*"', "database_id = `"$id`""
  [IO.File]::WriteAllText("$aqui\wrangler.toml", $toml, (New-Object Text.UTF8Encoding $false))
}
Log 'Preparando as tabelas do banco...'
& node $wjs d1 execute pranchetas --remote --file schema.sql --yes | Select-Object -Last 2

# atualizacao do aplicativo: o APK e o versao.json que o gerar-apk.ps1 deixou em apk\saida
$saidaApk = Join-Path $aqui '..\apk\saida'
if ((Test-Path "$saidaApk\versao.json") -and (Test-Path "$saidaApk\pranchetas.apk")) {
  Copy-Item "$saidaApk\pranchetas.apk", "$saidaApk\versao.json" "$aqui\publico\atualizacao" -Force
  $v = (Get-Content "$saidaApk\versao.json" -Raw | ConvertFrom-Json).versao
  Log "A versao $v do aplicativo vai junto (os tablets atualizam por ela)."
}

# atualizacao rapida: o pacote das telas (assinado) que o gerar-apk.ps1 deixou em apk\saida\telas
if (Test-Path "$saidaApk\telas\pacote.json") {
  if (Test-Path "$aqui\publico\telas") { Remove-Item "$aqui\publico\telas" -Recurse -Force }
  Copy-Item "$saidaApk\telas" "$aqui\publico\telas" -Recurse
  Log 'O pacote das telas vai junto (atualizacao rapida, sem instalar APK).'
}

Log 'Publicando a nuvem...'
function Publicar {
  $ErrorActionPreference = 'Continue'
  $saida = & node $wjs deploy 2>&1 | Out-String
  $ErrorActionPreference = 'Stop'
  return $saida
}
$publicou = Publicar
$url = [regex]::Match($publicou, 'https://[^\s]+\.workers\.dev').Value
if (-not $url) {
  # conta nova: falta escolher o endereco workers.dev. O Cloudflare so pergunta com a janela livre, entao roda de novo assim.
  Write-Output ''
  Write-Output 'Sua conta ainda nao tem o endereco workers.dev. O Cloudflare vai perguntar agora, nesta janela:'
  Write-Output '  - se perguntar se quer registrar (register), responda y e aperte Enter;'
  Write-Output '  - no nome, digite um nome curto, sem espaco nem acento (exemplo: ubiralcool) e aperte Enter.'
  Write-Output ''
  $ErrorActionPreference = 'Continue'
  & node $wjs deploy
  $ErrorActionPreference = 'Stop'
  Log 'Conferindo o endereco...'
  $publicou = Publicar
  $url = [regex]::Match($publicou, 'https://[^\s]+\.workers\.dev').Value
}
if (-not $url) {
  Write-Output (($publicou -split "`n") | Select-Object -Last 15)
  throw 'A publicacao nao deu certo. Veja as mensagens acima. Se falar de subdomain, abra dash.cloudflare.com > Workers & Pages e escolha o endereco workers.dev (Your subdomain), depois rode este arquivo de novo.'
}
Log "Publicado em $url"

# senhas: na primeira vez cria as duas e guarda em segredos.txt (fica so neste computador, nao vai para o Git)
function NovaSenha {
  $letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  $b = New-Object byte[] 24
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  $s = -join ($b | ForEach-Object { $letras[$_ % $letras.Length] })
  return ($s -replace '(.{6})(?=.)', '$1-')
}
$arquivoSenhas = Join-Path $aqui 'segredos.txt'
if (-not (Test-Path $arquivoSenhas)) {
  $central = NovaSenha
  $leitura = NovaSenha
  Log 'Guardando as senhas na nuvem...'
  $central | & node $wjs secret put SEGREDO_CENTRAL | Select-Object -Last 1
  $leitura | & node $wjs secret put TOKEN_LEITURA | Select-Object -Last 1
  $texto = "Nuvem das Pranchetas`r`nEndereco: $url`r`n`r`nSenha da central (vai no tablet chefe, em Usina > Nuvem):`r`n$central`r`n`r`nSenha de leitura da API (vai para o sistema do escritorio):`r`n$leitura`r`n"
  [IO.File]::WriteAllText($arquivoSenhas, $texto, (New-Object Text.UTF8Encoding $true))
}

Write-Output ''
Write-Output '=============================================================='
Write-Output " PRONTO. A nuvem esta no ar em: $url"
Write-Output ''
Write-Output ' No tablet chefe: Usina > Nuvem (internet)'
Write-Output "   Endereco: $url"
Write-Output '   Senha da central: esta no arquivo segredos.txt, nesta pasta'
Write-Output ''
Write-Output " API do escritorio: $url/api/v1/  (senha de leitura no segredos.txt)"
Write-Output '=============================================================='
Write-Output ''
try { Stop-Transcript | Out-Null } catch { }
Read-Host 'Aperte Enter para fechar'
