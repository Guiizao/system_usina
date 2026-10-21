; Mesma regra de liberar-firewall.ps1: TCP 8080, qualquer perfil, somente rede local.
!macro customInstall
  nsExec::ExecToLog '"$SYSDIR\netsh.exe" advfirewall firewall delete rule name="Pranchetas Usina (porta 8080)"'
  Pop $0
  nsExec::ExecToLog '"$SYSDIR\netsh.exe" advfirewall firewall add rule name="Pranchetas Usina (porta 8080)" dir=in action=allow protocol=TCP localport=8080 remoteip=localsubnet profile=any'
  Pop $0
  ${If} $0 != 0
    MessageBox MB_OK|MB_ICONEXCLAMATION "Nao foi possivel liberar a porta 8080 no firewall. Execute liberar-firewall.ps1 como administrador para conectar os tablets."
  ${EndIf}
!macroend

!macro customUnInstall
  nsExec::ExecToLog '"$SYSDIR\netsh.exe" advfirewall firewall delete rule name="Pranchetas Usina (porta 8080)"'
  Pop $0
!macroend
