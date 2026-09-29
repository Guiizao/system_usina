/* Somente para os testes: a versão do aplicativo "instalado" vem de -Dpranchetas.versao (ou 2.7.0). */
package android.content.pm;

public class PackageManager {
  public static class NameNotFoundException extends Exception { }
  public PackageInfo getPackageInfo(String pacote, int flags) throws NameNotFoundException {
    PackageInfo p = new PackageInfo();
    p.packageName = pacote;
    p.versionName = System.getProperty("pranchetas.versao", "2.7.0");
    return p;
  }
}
