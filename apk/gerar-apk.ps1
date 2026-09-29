# Pranchetas Digitais - (c) 2026 Guilherme. Todos os direitos reservados. Uso somente com autorizacao do autor (veja LICENCA.txt).
# Gera o APK Android das Pranchetas (precisa ter rodado instalar-ferramentas.ps1 antes)
# Resultado: app\apk\saida\pranchetas.apk  (a Central já oferece ele em /baixar)
$ErrorActionPreference = 'Stop'
$aqui = $PSScriptRoot
$ferr = Join-Path $env:USERPROFILE 'android-build'
$env:JAVA_HOME = "$ferr\jdk"
$env:ANDROID_HOME = "$ferr\sdk"
$env:ANDROID_SDK_ROOT = "$ferr\sdk"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
function Log($m) { Write-Output ("[{0:HH:mm:ss}] {1}" -f (Get-Date), $m) }
Set-Location $aqui

Log 'Copiando o app para dentro do APK...'
if (Test-Path www) { Remove-Item www -Recurse -Force }
Copy-Item ..\public www -Recurse
# baixar.html fica: o tablet chefe mostra essa página para quem lê o QR code
Remove-Item www\sw.js, www\moldura.html, www\testes.js, www\teste-*.jpg -ErrorAction SilentlyContinue

# Proteção (versão 2.4): o código vai para o APK embaralhado (nomes trocados, sem comentários nem espaços).
# Quem abrir o APK não lê o código do jeito que ele foi escrito. O mapa para entender os erros fica só em saida\mapas.
Log 'Embaralhando o código do aplicativo...'
New-Item -ItemType Directory -Force saida\mapas | Out-Null
# (o qrcode.js é uma biblioteca aberta, licença MIT: vai como está, com o aviso do autor dela)
foreach ($js in 'app.js', 'forms.js', 'modelos.js', 'xlsx.js', 'leitor.js', 'cifra.js') {
  $arquivo = "www\$js"
  & cmd /c "npx terser `"$arquivo`" --compress --mangle --comments `"/Guilherme/`" --source-map `"filename='$js'`" -o `"$arquivo`"" 2>&1 | Select-Object -Last 2
  if ($LASTEXITCODE -ne 0) { throw "Não consegui embaralhar $js" }
  if (Test-Path "$arquivo.map") { Move-Item "$arquivo.map" "saida\mapas\$js.map" -Force }
}

if (-not (Test-Path android)) {
  Log 'Criando projeto Android (primeira vez)...'
  cmd /c "npx cap add android" 2>&1 | Select-Object -Last 5
}
Log 'Sincronizando arquivos...'
cmd /c "npx cap sync android" 2>&1 | Select-Object -Last 3

# Código nativo da central que roda no tablet chefe
Log 'Copiando o código da central...'
Copy-Item (Join-Path $aqui 'nativo\java\*') (Join-Path $aqui 'android\app\src\main\java') -Recurse -Force

# Permissões do servidor (aviso fixo, Wi-Fi ligado, bateria) e acesso ao WhatsApp
Log 'Ajustando o AndroidManifest...'
$manifesto = Join-Path $aqui 'android\app\src\main\AndroidManifest.xml'
$xml = Get-Content $manifesto -Raw -Encoding utf8
if ($xml -notmatch 'ServicoCentral') {
  $permissoes = @(
    'android.permission.ACCESS_NETWORK_STATE', 'android.permission.ACCESS_WIFI_STATE', 'android.permission.WAKE_LOCK',
    'android.permission.FOREGROUND_SERVICE', 'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
    'android.permission.POST_NOTIFICATIONS', 'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS'
  ) | ForEach-Object { "    <uses-permission android:name=`"$_`" />" }
  $extras = ($permissoes -join "`n") + @"

    <queries>
        <package android:name="com.whatsapp" />
        <package android:name="com.whatsapp.w4b" />
        <intent><action android:name="android.intent.action.SENDTO" /><data android:scheme="mailto" /></intent>
        <intent><action android:name="android.intent.action.SEND" /><data android:mimeType="*/*" /></intent>
    </queries>
"@
  $servico = @"
        <service
            android:name=".ServicoCentral"
            android:exported="false"
            android:foregroundServiceType="specialUse">
            <property
                android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
                android:value="Servidor local da rede da usina que recebe as pranchetas dos outros tablets" />
        </service>
"@
  $xml = $xml -replace '</application>', ($servico + '    </application>')
  $xml = $xml -replace '</manifest>', ($extras + '</manifest>')
  [System.IO.File]::WriteAllText($manifesto, $xml, (New-Object System.Text.UTF8Encoding $false))
}
# Vibrar quando chega um aviso do escritório (versão 2.1). Separado, para entrar também em projetos já ajustados.
$xml = Get-Content $manifesto -Raw -Encoding utf8
if ($xml -notmatch 'android.permission.VIBRATE') {
  $xml = $xml -replace '</manifest>', "    <uses-permission android:name=`"android.permission.VIBRATE`" />`n</manifest>"
  [System.IO.File]::WriteAllText($manifesto, $xml, (New-Object System.Text.UTF8Encoding $false))
}
# Rede local (versão 2.2): Android 17 pede "Rede local"; alguns Android 16 (Motorola) bloqueiam pelo "Dispositivos por perto"
$xml = Get-Content $manifesto -Raw -Encoding utf8
if ($xml -notmatch 'ACCESS_LOCAL_NETWORK') {
  $rede = "    <uses-permission android:name=`"android.permission.ACCESS_LOCAL_NETWORK`" />`n" +
          "    <uses-permission android:name=`"android.permission.NEARBY_WIFI_DEVICES`" android:usesPermissionFlags=`"neverForLocation`" />`n"
  $xml = $xml -replace '</manifest>', ($rede + '</manifest>')
  [System.IO.File]::WriteAllText($manifesto, $xml, (New-Object System.Text.UTF8Encoding $false))
}
# Tablet chefe religou ou o aplicativo foi atualizado: o servidor liga sozinho (versão 2.3)
$xml = Get-Content $manifesto -Raw -Encoding utf8
if ($xml -notmatch 'LigarAoIniciar') {
  $receptor = @"
        <receiver android:name=".LigarAoIniciar" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
            </intent-filter>
        </receiver>
"@
  $xml = $xml -replace '</application>', ($receptor + '    </application>')
  $xml = $xml -replace '</manifest>', "    <uses-permission android:name=`"android.permission.RECEIVE_BOOT_COMPLETED`" />`n</manifest>"
  [System.IO.File]::WriteAllText($manifesto, $xml, (New-Object System.Text.UTF8Encoding $false))
}

# Atualização pelo próprio aplicativo (versão 2.7): pode abrir o instalador do Android
$xml = Get-Content $manifesto -Raw -Encoding utf8
if ($xml -notmatch 'REQUEST_INSTALL_PACKAGES') {
  $xml = $xml -replace '</manifest>', "    <uses-permission android:name=`"android.permission.REQUEST_INSTALL_PACKAGES`" />`n</manifest>"
  [System.IO.File]::WriteAllText($manifesto, $xml, (New-Object System.Text.UTF8Encoding $false))
}

# Número da versão do APK (versão 2.7): vem do VERSAO do app.js. O Android só atualiza por cima se for maior.
& node (Join-Path $aqui 'versao-do-apk.js') gradle
if ($LASTEXITCODE -ne 0) { throw 'Não consegui pôr a versão no build.gradle' }

# SDK para o Gradle
Set-Content -Path android\local.properties -Value ("sdk.dir=" + ($env:ANDROID_HOME -replace '\\', '\\')) -Encoding ascii

# Ícone da Ubirálcool
Log 'Aplicando ícone...'
Add-Type -AssemblyName System.Drawing
$logo = [System.Drawing.Image]::FromFile((Resolve-Path ..\public\icons\logo.png).Path)
$tamanhos = @{ 'mdpi' = 48; 'hdpi' = 72; 'xhdpi' = 96; 'xxhdpi' = 144; 'xxxhdpi' = 192 }
foreach ($d in $tamanhos.Keys) {
  $pasta = Join-Path $aqui "android\app\src\main\res\mipmap-$d"
  if (-not (Test-Path $pasta)) { continue }
  foreach ($nome in 'ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png') {
    $s = if ($nome -eq 'ic_launcher_foreground.png') { [int]($tamanhos[$d] * 2.25) } else { $tamanhos[$d] }
    $bmp = New-Object System.Drawing.Bitmap $s, $s
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = 'HighQualityBicubic'; $g.Clear([System.Drawing.Color]::White)
    $pad = if ($nome -eq 'ic_launcher_foreground.png') { [int]($s * 0.28) } else { [int]($s * 0.12) }
    $g.DrawImage($logo, $pad, $pad, $s - 2 * $pad, $s - 2 * $pad)
    $bmp.Save((Join-Path $pasta $nome), [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
  }
}
$logo.Dispose()
$fundo = 'android\app\src\main\res\values\ic_launcher_background.xml'
if (Test-Path $fundo) { Set-Content $fundo '<?xml version="1.0" encoding="utf-8"?><resources><color name="ic_launcher_background">#FFFFFF</color></resources>' -Encoding utf8 }

Log 'Compilando o APK (a primeira vez demora, baixa o Gradle)...'
$ErrorActionPreference = 'Continue'
& cmd /c "$aqui\android\gradlew.bat" -p "$aqui\android" assembleDebug --no-daemon 2>&1 | Select-Object -Last 6
$ErrorActionPreference = 'Stop'
Set-Location $aqui

$apk = 'android\app\build\outputs\apk\debug\app-debug.apk'
if (-not (Test-Path $apk)) { throw 'APK não foi gerado. Veja as mensagens acima.' }
New-Item -ItemType Directory -Force saida | Out-Null
Copy-Item $apk saida\pranchetas.apk -Force
# versao.json do lado do APK: a central usa para oferecer a atualização aos tablets (e vai junto para a nuvem)
& node (Join-Path $aqui 'versao-do-apk.js') json
if ($LASTEXITCODE -ne 0) { throw 'Não consegui escrever o versao.json' }
Log ("PRONTO: saida\pranchetas.apk (" + [math]::Round((Get-Item saida\pranchetas.apk).Length / 1MB, 1) + ' MB)')
