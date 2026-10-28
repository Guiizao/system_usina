# -Instalar prepara as dependencias locais a partir dos lockfiles, antes de gerar.
param([switch]$Instalar)
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    if ($Instalar) {
        foreach ($pasta in @($PSScriptRoot, (Join-Path $PSScriptRoot '..\apk'))) {
            Push-Location $pasta
            try {
                & npm.cmd ci
                if ($LASTEXITCODE -ne 0) { throw "npm ci falhou em $pasta" }
            } finally { Pop-Location }
        }
    }
    if (-not (Test-Path 'node_modules/electron/dist/electron.exe')) { throw 'Falta o Electron local. Rode gerar-windows.ps1 -Instalar com internet.' }
    if (-not (Test-Path 'node_modules/electron-builder')) { throw 'Falta o electron-builder local. Rode gerar-windows.ps1 -Instalar com internet.' }
    node construir.js
    if ($LASTEXITCODE -ne 0) { throw 'Build interrompido. Se faltou baixar uma ferramenta do electron-builder, rode este mesmo comando com internet.' }
} finally {
    Pop-Location
}
