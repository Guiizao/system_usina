/* Pranchetas Digitais - (c) 2026 Guilherme. Testa o AtualizadorDeTelas (atualização rápida) no computador.
 * Uso: java TestarTelas <base> <versao> <chave publica> <versao do APK> <pasta das telas> <pasta das telas de agora> */
import br.com.ubiralcool.pranchetas.AtualizadorDeTelas;
import org.json.JSONObject;
import java.io.File;
import java.io.FileInputStream;

public class TestarTelas {
  public static void main(String[] a) throws Exception {
    File atual = new File(a[5]);
    JSONObject saida = new JSONObject();
    try {
      JSONObject r = AtualizadorDeTelas.baixar(a[0], a[1], a[2], a[3], new File(a[4]), (c) -> new FileInputStream(new File(atual, c)), null);
      saida.put("ok", true).put("pasta", r.optString("pasta")).put("baixados", r.optLong("baixados")).put("copiados", r.optLong("copiados"));
    } catch (Exception e) {
      saida.put("ok", false).put("erro", String.valueOf(e.getMessage()));
    }
    System.out.println(saida);
  }
}
