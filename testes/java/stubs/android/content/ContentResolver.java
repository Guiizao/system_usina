/* Somente para os testes: a pasta Documentos do Android não existe no computador. */
package android.content;

import android.database.Cursor;
import android.net.Uri;
import java.io.OutputStream;

public class ContentResolver {
  public Cursor query(Uri u, String[] p, String s, String[] a, String o) { return null; }
  public Uri insert(Uri u, ContentValues v) { return null; }
  public OutputStream openOutputStream(Uri u, String modo) { return null; }
}
