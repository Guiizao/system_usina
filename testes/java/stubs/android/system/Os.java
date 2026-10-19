package android.system;

import java.nio.file.Files;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;

/** Somente nos testes de computador: substituição atômica, como o rename do Android. */
public class Os {
  public static void rename(String origem, String destino) throws ErrnoException {
    try { Files.move(Paths.get(origem), Paths.get(destino), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING); }
    catch (Exception e) { throw new ErrnoException("rename", e); }
  }
}
