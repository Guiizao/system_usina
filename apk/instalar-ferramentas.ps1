# Pranchetas Digitais - (c) 2026 Guilherme. Todos os direitos reservados. Uso somente com autorizacao do autor (veja LICENCA.txt).
# Instala Java 21 + Android SDK em C:\Users\<voce>\android-build (só precisa rodar uma vez)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$raiz = Join-Path $env:USERPROFILE 'android-build'
New-Item -ItemType Directory -Force $raiz | Out-Null
Set-Location $raiz

function Log($m) { Write-Output ("[{0:HH:mm:ss}] {1}" -f (Get-Date), $m) }

# 1) Java 21 (Eclipse Temurin / Adoptium)
if (-not (Test-Path "$raiz\jdk\bin\java.exe")) {
  Log 'Baixando Java 21 (Adoptium)...'
  Invoke-WebRequest 'https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse' -OutFile jdk.zip
  Expand-Archive jdk.zip -DestinationPath jdk-tmp -Force
  Move-Item (Get-ChildItem jdk-tmp | Select-Object -First 1).FullName "$raiz\jdk"
  Remove-Item jdk.zip, jdk-tmp -Recurse -Force
}
$env:JAVA_HOME = "$raiz\jdk"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
Log ('Java instalado em ' + $env:JAVA_HOME)

# 2) Android command-line tools (Google)
$sdk = "$raiz\sdk"
if (-not (Test-Path "$sdk\cmdline-tools\latest\bin\sdkmanager.bat")) {
  Log 'Baixando Android command-line tools...'
  Invoke-WebRequest 'https://dl.google.com/android/repository/commandlinetools-win-13114758_latest.zip' -OutFile cmdtools.zip
  Expand-Archive cmdtools.zip -DestinationPath cmd-tmp -Force
  New-Item -ItemType Directory -Force "$sdk\cmdline-tools" | Out-Null
  Move-Item "cmd-tmp\cmdline-tools" "$sdk\cmdline-tools\latest"
  Remove-Item cmdtools.zip, cmd-tmp -Recurse -Force
}
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk

# 3) Pacotes do SDK (aceita as licenças do Android SDK)
Log 'Aceitando licenças e instalando plataforma Android 35...'
$yes = ('y' + [Environment]::NewLine) * 30
$yes | & "$sdk\cmdline-tools\latest\bin\sdkmanager.bat" --sdk_root=$sdk --licenses | Out-Null
& "$sdk\cmdline-tools\latest\bin\sdkmanager.bat" --sdk_root=$sdk 'platform-tools' 'platforms;android-35' 'build-tools;35.0.0' | Select-Object -Last 3

Log 'PRONTO: ferramentas instaladas.'
