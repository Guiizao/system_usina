# Pranchetas Digitais - (c) 2026 Guilherme. Todos os direitos reservados. Uso somente com autorizacao do autor (veja LICENCA.txt).
# Libera a porta da central no Firewall do Windows, para os tablets conseguirem
# baixar o aplicativo e enviar as anotações para este computador.
# Rode uma vez, clicando com o botão direito > "Executar com o PowerShell" como administrador.
$porta = 8080
$nome = "Pranchetas Usina (porta $porta)"

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {
  Write-Host "Precisa abrir como administrador. Abrindo de novo..." -ForegroundColor Yellow
  Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
  exit
}

Get-NetFirewallRule -DisplayName $nome -ErrorAction SilentlyContinue | Remove-NetFirewallRule
# Vale mesmo se o Windows marcou a rede como "Pública", mas só para aparelhos da mesma rede local
New-NetFirewallRule -DisplayName $nome -Direction Inbound -Protocol TCP -LocalPort $porta -Action Allow -Profile Any -RemoteAddress LocalSubnet | Out-Null
Write-Host "Pronto: a porta $porta está liberada para os aparelhos da rede local." -ForegroundColor Green
Read-Host "Aperte Enter para fechar"
