package android.system;

/** Somente nos testes de computador: a exceção do rename do Android. */
public class ErrnoException extends Exception {
  public ErrnoException(String operacao, Throwable causa) { super(operacao, causa); }
}
