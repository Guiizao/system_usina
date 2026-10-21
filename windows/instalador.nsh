; 2.16: o programa do Windows é só o painel pela nuvem (sem central no computador): não abre porta no firewall.
; Tira a regra que a primeira versão do instalador criou (porta 8080), se ela existir.
!macro customInstall
  nsExec::ExecToLog '"$SYSDIR\netsh.exe" advfirewall firewall delete rule name="Pranchetas Usina (porta 8080)"'
  Pop $0
!macroend

!macro customUnInstall
  nsExec::ExecToLog '"$SYSDIR\netsh.exe" advfirewall firewall delete rule name="Pranchetas Usina (porta 8080)"'
  Pop $0
!macroend
