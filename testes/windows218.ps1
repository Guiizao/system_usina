# Testa o script real num clone temporario. npm e node sao simulados: nada e instalado ou compilado.
$ErrorActionPreference = 'Stop'
$temporario = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$clone = Join-Path $temporario ('windows218-' + [guid]::NewGuid())
$windows = Join-Path $clone 'windows'
$arquivo = Join-Path $windows 'gerar-windows.ps1'
$global:windows218Teste = @{ falharNpm = $false; chamadas = @() }
function npm.cmd {
    if (($args -join ' ') -ne 'ci') { throw 'Nao usou npm ci' }
    $global:windows218Teste.chamadas += 'npm:' + (Split-Path (Get-Location).Path -Leaf)
    if ($global:windows218Teste.falharNpm) { $global:LASTEXITCODE = 7; return }
    New-Item -ItemType Directory -Force node_modules/electron/dist, node_modules/electron-builder | Out-Null
    New-Item -ItemType File -Force node_modules/electron/dist/electron.exe | Out-Null
    $global:LASTEXITCODE = 0
}
function node {
    if (($args -join ' ') -ne 'construir.js') { throw 'Comando inesperado' }
    $global:windows218Teste.chamadas += 'build-simulado'
    $global:LASTEXITCODE = 0
}
function Igual($esperado) {
    if (($global:windows218Teste.chamadas -join ',') -ne $esperado) { throw ('Chamadas inesperadas: ' + ($global:windows218Teste.chamadas -join ',')) }
}
try {
    New-Item -ItemType Directory -Force $windows, (Join-Path $clone 'apk') | Out-Null
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot '../windows/gerar-windows.ps1') -Destination $arquivo
    $origem = (Get-Location).Path
    $recusou = $false
    try { & $arquivo } catch { $recusou = $_.Exception.Message -like '*Falta o Electron*' }
    if (-not $recusou) { throw 'Clone vazio sem -Instalar deveria parar' }; Igual ''
    Write-Output 'ok 1: clone vazio pede -Instalar, sem tentar build'
    $global:windows218Teste.falharNpm = $true; $recusou = $false
    try { & $arquivo -Instalar } catch { $motivo = $_.Exception.Message; $recusou = $motivo -like '*npm ci falhou*' }
    if (-not $recusou -or (Get-Location).Path -ne $origem) { throw ('Falha do npm nao interrompeu/restaurou a pasta: ' + $motivo) }
    Igual 'npm:windows'
    Write-Output 'ok 2: falha do npm interrompe antes do build e restaura a pasta'
    $global:windows218Teste.falharNpm = $false; $global:windows218Teste.chamadas = @()
    & $arquivo -Instalar
    Igual 'npm:windows,npm:apk,build-simulado'
    Write-Output 'ok 3: -Instalar roda npm ci nas duas pastas antes do build simulado'
    $global:windows218Teste.chamadas = @()
    & $arquivo
    Igual 'build-simulado'
    Write-Output 'ok 4: dependencias prontas dispensam instalacao'
    Write-Output 'Windows 2.18 PowerShell: 4/4 passaram (0 instalacoes, 0 builds reais).'
} finally {
    # Apenas o clone temporario criado neste teste; nunca um caminho vindo do script testado.
    $resolvido = [IO.Path]::GetFullPath($clone)
    if ([IO.Path]::GetDirectoryName($resolvido).TrimEnd('\') -ne $temporario.TrimEnd('\')) { throw 'Pasta temporaria fora do esperado' }
    Remove-Item -LiteralPath $resolvido -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Variable -Name windows218Teste -Scope Global -ErrorAction SilentlyContinue
}
