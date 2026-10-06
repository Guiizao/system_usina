/* Pranchetas Digitais - (c) 2026 Guilherme. Todos os direitos reservados. Uso somente com autorizacao do autor (veja LICENCA.txt). */
package br.com.ubiralcool.pranchetas;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.os.Build;

import java.security.MessageDigest;

/**
 * Proteção contra cópia alterada (versão 2.11): o aplicativo confere a assinatura do próprio APK.
 * Quem abrir o APK, mexer e montar de novo precisa assinar com outra chave (a do Guilherme fica só no computador
 * dele). Aí o aplicativo não abre e a central não liga. O valor certo (Assinatura.ESPERADA) é escrito pelo
 * gerar-apk.ps1, que também confere o APK pronto antes de entregar.
 * Se o Android não deixar ler a assinatura (não deveria acontecer), o aplicativo abre: é melhor do que travar a usina.
 * Valor esperado vazio não abre: o gerar-apk.ps1 sempre grava (e para com erro se não conseguir), então vazio é cópia mexida.
 * Isto atrapalha quem altera o APK, mas quem sabe mexer no código consegue tirar a conferência: o que protege os
 * dados é a central (código de conexão e bloqueio de aparelho).
 */
final class Protecao {

  private static Boolean resultado;

  private Protecao() { }

  static synchronized boolean assinaturaConfere(Context contexto) {
    if (resultado != null) return resultado;
    String esperada = Assinatura.ESPERADA;
    if (esperada == null || esperada.isEmpty()) { resultado = false; return false; } // o gerar-apk.ps1 sempre grava: vazio é cópia mexida
    try {
      Signature[] assinaturas = assinaturasDoApk(contexto);
      if (assinaturas == null || assinaturas.length == 0) { resultado = true; return true; }
      boolean confere = false;
      for (Signature s : assinaturas) {
        if (hex(MessageDigest.getInstance("SHA-256").digest(s.toByteArray())).equalsIgnoreCase(esperada)) confere = true;
      }
      resultado = confere;
    } catch (Exception e) {
      resultado = true;
    }
    return resultado;
  }

  @SuppressWarnings("deprecation")
  private static Signature[] assinaturasDoApk(Context contexto) throws Exception {
    PackageManager pm = contexto.getPackageManager();
    String pacote = contexto.getPackageName();
    if (Build.VERSION.SDK_INT >= 28) {
      PackageInfo info = pm.getPackageInfo(pacote, PackageManager.GET_SIGNING_CERTIFICATES);
      if (info.signingInfo == null) return null;
      return info.signingInfo.hasMultipleSigners() ? info.signingInfo.getApkContentsSigners() : info.signingInfo.getSigningCertificateHistory();
    }
    return pm.getPackageInfo(pacote, PackageManager.GET_SIGNATURES).signatures;
  }

  private static String hex(byte[] b) {
    StringBuilder s = new StringBuilder();
    for (byte x : b) s.append(String.format("%02x", x));
    return s.toString();
  }
}
