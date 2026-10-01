/* Pranchetas Digitais - (c) 2026 Guilherme. Todos os direitos reservados. Uso somente com autorizacao do autor (veja LICENCA.txt). */
package br.com.ubiralcool.pranchetas;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;

import java.util.Iterator;
import java.util.Locale;

/**
 * Atualização rápida (versão 2.8): troca as telas (a pasta public: HTML, CSS e JavaScript) sem instalar APK.
 *
 * 1. Baixa o pacote.json (versão, apkMinimo e a lista dos arquivos com tamanho e SHA-256) e a assinatura dele.
 * 2. Confere a assinatura com a chave pública que veio dentro do APK (só o computador do Guilherme assina).
 * 3. Arquivo que não mudou é copiado das telas de agora; o que mudou é baixado e conferido pelo SHA-256.
 * 4. Tudo certo: a pasta nova fica pronta em telas/<versão>. Quem troca a tela é o CentralPlugin.
 *
 * Não usa nada do Android: roda igual no tablet e nos testes do computador.
 */
public final class AtualizadorDeTelas {

  /** Os arquivos das telas de agora (a pasta da última atualização rápida, ou as que vieram no APK). */
  public interface Atual { InputStream abrir(String caminho) throws IOException; }

  public interface Progresso { void avisar(long feito, long total); }

  private AtualizadorDeTelas() { }

  /** "2.8.1" vira 20801, para comparar versões. */
  public static long numero(String v) {
    String[] p = (v == null ? "" : v).split("\\.");
    long n = 0;
    for (int i = 0; i < 3; i++) {
      long x = 0;
      try { if (i < p.length) x = Long.parseLong(p[i].replaceAll("\\D", "")); } catch (NumberFormatException e) { x = 0; }
      n = n * 100 + x;
    }
    return n;
  }

  /**
   * Baixa e confere o pacote. Devolve o pacote.json lido (com "pasta": onde ficaram as telas novas).
   * @param base endereço da pasta das telas (http://central:8080/telas/ ou https://nuvem/telas/)
   * @param versaoEsperada a versão que a tela mostrou para a pessoa (o pacote tem de ser essa)
   * @param chavePublica a chave pública (SPKI em base64) que veio dentro do APK
   * @param versaoNativa a versão do APK instalado (o pacote não pode pedir APK mais novo)
   */
  public static JSONObject baixar(String base, String versaoEsperada, String chavePublica, String versaoNativa,
                                  File pastaTelas, Atual atual, Progresso progresso) throws Exception {
    if (!base.endsWith("/")) base = base + "/";
    byte[] pacote = baixarTudo(base + "pacote.json", 2 * 1024 * 1024);
    String assinatura = new String(baixarTudo(base + "pacote.sig", 4096), StandardCharsets.UTF_8).trim();
    if (!assinaturaConfere(pacote, assinatura, chavePublica)) throw new Exception("o pacote das telas não tem a assinatura certa");
    JSONObject p = new JSONObject(new String(pacote, StandardCharsets.UTF_8));
    String versao = p.optString("versao");
    if (!versao.equals(versaoEsperada)) throw new Exception("a versão mudou no meio do caminho (" + versao + "): procure de novo");
    if (numero(p.optString("apkMinimo")) > numero(versaoNativa)) throw new Exception("esta versão precisa do APK novo");
    JSONObject arquivos = p.optJSONObject("arquivos");
    if (arquivos == null || !arquivos.has("index.html")) throw new Exception("pacote das telas sem a página inicial");

    long total = 0, feito = 0, copiados = 0, baixados = 0;
    for (Iterator<String> it = arquivos.keys(); it.hasNext(); ) total += arquivos.optJSONObject(it.next()).optLong("tamanho");
    File tmp = new File(pastaTelas, versao + ".baixando");
    apagar(tmp);
    if (!tmp.mkdirs()) throw new IOException("não consegui criar a pasta das telas");
    for (Iterator<String> it = arquivos.keys(); it.hasNext(); ) {
      String caminho = it.next();
      if (caminho.isEmpty() || caminho.startsWith("/") || caminho.contains("..") || caminho.contains("\\")) throw new Exception("caminho estranho no pacote: " + caminho);
      JSONObject a = arquivos.optJSONObject(caminho);
      String sha = a.optString("sha256").toLowerCase(Locale.ROOT);
      File destino = new File(tmp, caminho);
      File pai = destino.getParentFile();
      if (pai != null && !pai.isDirectory() && !pai.mkdirs()) throw new IOException("não consegui criar " + pai);
      // o mesmo arquivo de agora: copia, sem baixar de novo
      boolean copiou = false;
      try (InputStream e = atual.abrir(caminho)) {
        if (e != null && sha.equals(gravarComResumo(e, destino))) { copiou = true; copiados++; }
      } catch (IOException naoTem) { /* arquivo novo */ }
      if (!copiou) {
        HttpURLConnection con = abrir(base + codificar(caminho));
        try (InputStream e = con.getInputStream()) {
          if (!sha.equals(gravarComResumo(e, destino))) throw new Exception("o arquivo " + caminho + " chegou com defeito");
          baixados++;
        } finally { con.disconnect(); }
      }
      if (destino.length() != a.optLong("tamanho")) throw new Exception("o arquivo " + caminho + " chegou com outro tamanho");
      feito += a.optLong("tamanho");
      if (progresso != null) progresso.avisar(feito, total);
    }
    try (OutputStream o = new FileOutputStream(new File(tmp, "pacote.json"))) { o.write(pacote); }
    try (OutputStream o = new FileOutputStream(new File(tmp, "pacote.sig"))) { o.write(assinatura.getBytes(StandardCharsets.UTF_8)); }
    File pronta = new File(pastaTelas, versao);
    apagar(pronta);
    if (!tmp.renameTo(pronta)) throw new IOException("não consegui deixar a pasta das telas pronta");
    return p.put("pasta", pronta.getAbsolutePath()).put("copiados", copiados).put("baixados", baixados);
  }

  /** ECDSA P-256 com SHA-256 (a assinatura em base64, formato DER, como o Node gera). */
  public static boolean assinaturaConfere(byte[] dados, String assinaturaB64, String chavePublicaB64) {
    try {
      PublicKey chave = KeyFactory.getInstance("EC").generatePublic(new X509EncodedKeySpec(android.util.Base64.decode(chavePublicaB64.trim(), android.util.Base64.DEFAULT)));
      Signature s = Signature.getInstance("SHA256withECDSA");
      s.initVerify(chave);
      s.update(dados);
      return s.verify(android.util.Base64.decode(assinaturaB64.trim(), android.util.Base64.DEFAULT));
    } catch (Exception e) {
      return false;
    }
  }

  private static String codificar(String caminho) throws Exception {
    StringBuilder sb = new StringBuilder();
    for (String parte : caminho.split("/")) {
      if (sb.length() > 0) sb.append('/');
      sb.append(URLEncoder.encode(parte, "UTF-8").replace("+", "%20"));
    }
    return sb.toString();
  }

  private static HttpURLConnection abrir(String endereco) throws IOException {
    HttpURLConnection con = (HttpURLConnection) new URL(endereco).openConnection();
    con.setConnectTimeout(15000);
    con.setReadTimeout(30000);
    int status = con.getResponseCode();
    if (status != 200) { con.disconnect(); throw new IOException("a central respondeu " + status + " para " + endereco); }
    return con;
  }

  private static byte[] baixarTudo(String endereco, int limite) throws IOException {
    HttpURLConnection con = abrir(endereco);
    try (InputStream e = con.getInputStream()) {
      ByteArrayOutputStream b = new ByteArrayOutputStream();
      byte[] buf = new byte[16 * 1024];
      int n;
      while ((n = e.read(buf)) > 0) {
        b.write(buf, 0, n);
        if (b.size() > limite) throw new IOException("arquivo grande demais: " + endereco);
      }
      return b.toByteArray();
    } finally { con.disconnect(); }
  }

  /** Grava o arquivo e devolve o SHA-256 dele. */
  private static String gravarComResumo(InputStream e, File destino) throws Exception {
    MessageDigest resumo = MessageDigest.getInstance("SHA-256");
    try (OutputStream o = new FileOutputStream(destino)) {
      byte[] buf = new byte[64 * 1024];
      int n;
      while ((n = e.read(buf)) > 0) { o.write(buf, 0, n); resumo.update(buf, 0, n); }
    }
    StringBuilder sb = new StringBuilder();
    for (byte x : resumo.digest()) sb.append(String.format(Locale.ROOT, "%02x", x));
    return sb.toString();
  }

  /** O pacote.json e a assinatura das telas de agora (para este aparelho também entregar as telas aos outros). */
  public static byte[] ler(InputStream e) throws IOException {
    ByteArrayOutputStream b = new ByteArrayOutputStream();
    byte[] buf = new byte[16 * 1024];
    int n;
    while ((n = e.read(buf)) > 0) b.write(buf, 0, n);
    return b.toByteArray();
  }

  public static void apagar(File f) {
    if (f == null || !f.exists()) return;
    File[] filhos = f.listFiles();
    if (filhos != null) for (File c : filhos) apagar(c);
    //noinspection ResultOfMethodCallIgnored
    f.delete();
  }

  /** Pasta das telas guardada pelo aplicativo, se ainda for deste APK (APK novo volta para as telas dele). */
  public static File pastaAtiva(File pastaTelas, String versaoDoApk) {
    try (InputStream e = new FileInputStream(new File(pastaTelas, "ativa.txt"))) {
      String[] partes = new String(ler(e), StandardCharsets.UTF_8).trim().split("\\|");
      if (partes.length != 2 || !partes[1].equals(versaoDoApk)) return null;
      File pasta = new File(pastaTelas, partes[0]);
      return new File(pasta, "index.html").isFile() ? pasta : null;
    } catch (Exception e) {
      return null;
    }
  }
}
