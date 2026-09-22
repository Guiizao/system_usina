/* Somente para os testes: o mínimo do Context do Android que o ServidorCentral usa. */
package android.content;

import android.content.res.AssetManager;
import java.io.File;

public class Context {
  private final File arquivos;
  private final AssetManager assets;
  private final String apk;
  public Context(File arquivos, File pastaAssets, String apk) { this.arquivos = arquivos; this.assets = new AssetManager(pastaAssets); this.apk = apk; }
  public Context getApplicationContext() { return this; }
  public File getFilesDir() { return arquivos; }
  public ContentResolver getContentResolver() { return new ContentResolver(); }
  public AssetManager getAssets() { return assets; }
  public String getPackageCodePath() { return apk; }
}
