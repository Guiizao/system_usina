# Usa somente as dependencias locais. Nao executa npm install nem npx.
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    if (-not (Test-Path 'node_modules/electron/dist/electron.exe')) { throw 'Falta o Electron local em windows/node_modules/electron/dist.' }
    if (-not (Test-Path 'node_modules/electron-builder')) { throw 'Falta o electron-builder local em windows/node_modules.' }
    node construir.js
    if ($LASTEXITCODE -ne 0) { throw 'Build interrompido. Se faltou baixar uma ferramenta do electron-builder, rode este mesmo comando com internet. Nenhum pacote foi instalado.' }
} finally {
    Pop-Location
}
