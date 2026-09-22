package android.os;

public class Build {
  public static class VERSION {
    // não é final: assim o valor não fica fixo dentro do ServidorCentral compilado
    public static int SDK_INT = Integer.getInteger("sdk", 34);
  }
}
