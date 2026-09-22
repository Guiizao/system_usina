package android.database;

public interface Cursor extends java.io.Closeable {
  boolean moveToFirst();
  long getLong(int coluna);
  void close();
}
