/* Somente para os testes: os assets do APK são a pasta app/ (assets/public = app/public). */
package android.content.res;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;

public class AssetManager {
  private final File raiz;
  public AssetManager(File raiz) { this.raiz = raiz; }
  public InputStream open(String caminho) throws IOException {
    File f = new File(raiz, caminho);
    if (!f.getCanonicalPath().startsWith(raiz.getCanonicalPath()) || !f.isFile()) throw new IOException("não existe: " + caminho);
    return new FileInputStream(f);
  }
}
