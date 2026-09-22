package android.net;

public class Uri {
  private final String s;
  public Uri(String s) { this.s = s; }
  public static Uri withAppendedPath(Uri base, String parte) { return new Uri(base.s + "/" + parte); }
  @Override public String toString() { return s; }
}
