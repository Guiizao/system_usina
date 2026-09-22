/* Pranchetas Digitais - (c) 2026 Guilherme. Liga o servidor do tablet chefe (ServidorCentral.java) no computador, para os testes.
 * Uso: java RodarServidorJava <porta> <pasta de dados> <pasta app> */
import android.content.Context;
import br.com.ubiralcool.pranchetas.ServidorCentral;
import java.io.File;

public class RodarServidorJava {
  public static void main(String[] args) throws Exception {
    int porta = Integer.parseInt(args[0]);
    File dados = new File(args[1]);
    dados.mkdirs();
    File app = new File(args[2]);
    Context ctx = new Context(dados, app, new File(app, "apk/saida/pranchetas.apk").getPath());
    ServidorCentral s = ServidorCentral.pegar(ctx, porta);
    s.iniciar();
    System.out.println("PRONTO porta=" + porta + " codigo=" + s.getCodigo() + " chave=" + s.getChave());
    System.out.flush();
    Thread.currentThread().join();
  }
}
