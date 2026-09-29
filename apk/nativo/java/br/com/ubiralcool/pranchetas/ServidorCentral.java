/* Pranchetas Digitais - (c) 2026 Guilherme. Todos os direitos reservados. Uso somente com autorizacao do autor (veja LICENCA.txt). */
package br.com.ubiralcool.pranchetas;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.res.AssetManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.security.SecureRandom;
import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Servidor da usina rodando dentro do próprio tablet chefe.
 * Faz o mesmo que o server.js do computador: guarda os registros, entrega o app para os outros
 * tablets, guarda os relatórios e controla o código de conexão.
 *
 * Pastas (todas com final "Usina"):
 *   ServidorUsina   -> config.json e registros.json (dentro do aplicativo, protegido)
 *   RelatoriosUsina -> Excel e XML de cada dia
 *   BackupUsina     -> um arquivo por dia com tudo que foi anotado
 * Relatórios e backups também são copiados para Documentos/Usina, para aparecerem no gerenciador de arquivos.
 */
public class ServidorCentral {

  private static ServidorCentral instancia;

  public static synchronized ServidorCentral pegar(Context contexto, int porta) {
    if (instancia == null) instancia = new ServidorCentral(contexto.getApplicationContext(), porta);
    return instancia;
  }

  private final Context contexto;
  private final int porta;
  private final File raiz;
  private final File pastaServidor;
  private final File pastaRelatorios;
  private final File pastaBackup;
  private ServerSocket socketServidor;
  private ExecutorService trabalhadores;
  private volatile boolean rodando = false;

  private JSONObject config;
  private JSONObject registros = new JSONObject();
  private long seq = 0;
  private final Map<String, JSONObject> aparelhos = new HashMap<>();
  private final Map<String, List<Long>> tentativas = new HashMap<>();
  private final List<Long> tentativasTodas = new ArrayList<>();
  private final Map<String, Long> ultimoEspelho = new HashMap<>();

  private ServidorCentral(Context contexto, int porta) {
    this.contexto = contexto;
    this.porta = porta;
    this.raiz = contexto.getFilesDir();
    this.pastaServidor = new File(raiz, "ServidorUsina");
    this.pastaRelatorios = new File(raiz, "RelatoriosUsina");
    this.pastaBackup = new File(raiz, "BackupUsina");
  }

  /* ------------------------------------------------------------------ */
  /* Pastas                                                              */
  /* ------------------------------------------------------------------ */

  /** Cria as pastas. Devolve o caminho interno e, se der, o caminho em Documentos. */
  public synchronized JSONObject criarPastas() throws Exception {
    for (File p : new File[] { pastaServidor, pastaRelatorios, pastaBackup }) {
      if (!p.exists() && !p.mkdirs()) throw new IOException("Não consegui criar a pasta " + p.getName());
    }
    // versão antiga guardava em "dados": muda para as pastas novas
    File antiga = new File(raiz, "dados");
    if (antiga.exists()) {
      moverSeExistir(new File(antiga, "config.json"), new File(pastaServidor, "config.json"));
      moverSeExistir(new File(antiga, "registros.json"), new File(pastaServidor, "registros.json"));
    }
    JSONObject r = new JSONObject();
    r.put("pasta", raiz.getAbsolutePath());
    r.put("documentos", Build.VERSION.SDK_INT >= 29 ? "Documentos/Usina" : "");
    if (Build.VERSION.SDK_INT >= 29) {
      espelhar("BackupUsina", "LEIA-ME.txt",
          "Pastas criadas pelo tablet chefe das Pranchetas Ubirálcool.\nRelatoriosUsina: Excel e XML de cada dia.\nBackupUsina: tudo que foi anotado, um arquivo por dia.\n".getBytes(StandardCharsets.UTF_8),
          "text/plain");
    }
    return r;
  }

  private void moverSeExistir(File de, File para) {
    if (de.exists() && !para.exists()) de.renameTo(para);
  }

  /** Copia um arquivo para Documentos/Usina/<subpasta>, onde a pessoa consegue ver no gerenciador de arquivos. */
  private void espelhar(String subpasta, String nome, byte[] dados, String mime) {
    if (Build.VERSION.SDK_INT < 29) return;
    try {
      ContentResolver resolver = contexto.getContentResolver();
      Uri colecao = MediaStore.Files.getContentUri("external");
      String caminho = Environment.DIRECTORY_DOCUMENTS + "/Usina/" + subpasta + "/";
      Uri existente = null;
      try (Cursor c = resolver.query(colecao, new String[] { MediaStore.MediaColumns._ID },
          MediaStore.MediaColumns.RELATIVE_PATH + "=? AND " + MediaStore.MediaColumns.DISPLAY_NAME + "=?",
          new String[] { caminho, nome }, null)) {
        if (c != null && c.moveToFirst()) existente = Uri.withAppendedPath(colecao, String.valueOf(c.getLong(0)));
      }
      Uri alvo = existente;
      if (alvo == null) {
        ContentValues valores = new ContentValues();
        valores.put(MediaStore.MediaColumns.DISPLAY_NAME, nome);
        valores.put(MediaStore.MediaColumns.MIME_TYPE, mime);
        valores.put(MediaStore.MediaColumns.RELATIVE_PATH, caminho);
        alvo = resolver.insert(colecao, valores);
      }
      if (alvo == null) return;
      try (OutputStream saida = resolver.openOutputStream(alvo, "wt")) {
        if (saida != null) saida.write(dados);
      }
    } catch (Exception e) {
      // a cópia em Documentos é um extra; o arquivo continua guardado dentro do aplicativo
    }
  }

  /** Guarda um relatório na pasta RelatoriosUsina e em Documentos. Devolve onde ficou. */
  public String guardarRelatorio(String data, String nome, byte[] dados) throws IOException {
    File pasta = new File(pastaRelatorios, data);
    if (!pasta.exists()) pasta.mkdirs();
    salvarArquivo(new File(pasta, nome), dados);
    String mime = nome.endsWith(".xml") ? "text/xml" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    espelhar("RelatoriosUsina/" + data, nome, dados, mime);
    return Build.VERSION.SDK_INT >= 29 ? "Documentos/Usina/RelatoriosUsina/" + data : pasta.getAbsolutePath();
  }

  /* ------------------------------------------------------------------ */
  /* Início e parada                                                     */
  /* ------------------------------------------------------------------ */

  public synchronized void iniciar() throws Exception {
    if (rodando) return;
    criarPastas();
    carregarConfig();
    carregarRegistros();
    arquivarDiasAntigos();
    socketServidor = new ServerSocket();
    socketServidor.setReuseAddress(true);
    // "pranchetas.ip" só existe nos testes no computador (liga só no próprio computador); no tablet fica em todas as redes
    String ipFixo = System.getProperty("pranchetas.ip");
    socketServidor.bind(ipFixo != null ? new java.net.InetSocketAddress(ipFixo, porta) : new java.net.InetSocketAddress(porta));
    trabalhadores = Executors.newFixedThreadPool(8);
    rodando = true;
    new Thread(this::aceitarConexoes, "servidor-usina").start();
  }

  public synchronized void parar() {
    rodando = false;
    try { if (socketServidor != null) socketServidor.close(); } catch (IOException ignorado) { }
    if (trabalhadores != null) trabalhadores.shutdownNow();
  }

  public boolean estaRodando() { return rodando; }

  public String getChave() { return config == null ? "" : config.optString("chave", ""); }

  public String getCodigo() { return config == null ? "" : config.optString("codigo", ""); }

  /** Muda quando o escritório zera as anotações de teste; os tablets veem e limpam o que têm. */
  public String getGeracao() {
    try {
      if (config.optString("geracao", "").isEmpty()) {
        config.put("geracao", sorteiaChave().substring(0, 12));
        salvarArquivo(new File(pastaServidor, "config.json"), config.toString().getBytes(StandardCharsets.UTF_8));
      }
    } catch (Exception e) { /* segue com a da memória */ }
    return config.optString("geracao", "");
  }

  /** Troca o código e a chave: todos os outros aparelhos são desconectados (aparelho perdido ou roubado). */
  public String novoCodigo() {
    try {
      config.put("codigo", sorteiaCodigo());
      config.put("chave", sorteiaChave());
      salvarArquivo(new File(pastaServidor, "config.json"), config.toString().getBytes(StandardCharsets.UTF_8));
    } catch (Exception e) { /* mantém o código antigo */ }
    return getCodigo();
  }

  /** Endereços que os outros tablets devem usar. O do Wi-Fi vem primeiro. */
  public List<String> enderecos() {
    List<String> wifi = new ArrayList<>();
    List<String> outros = new ArrayList<>();
    try {
      for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
        if (ni.isLoopback() || !ni.isUp()) continue;
        String nome = ni.getName().toLowerCase(Locale.US);
        for (InetAddress end : Collections.list(ni.getInetAddresses())) {
          if (!(end instanceof Inet4Address) || end.isLoopbackAddress()) continue;
          String url = "http://" + end.getHostAddress() + ":" + porta;
          if (nome.startsWith("wlan") || nome.startsWith("eth") || nome.startsWith("ap")) wifi.add(url);
          else if (!nome.startsWith("rmnet") && !nome.startsWith("tun") && !nome.startsWith("dummy")) outros.add(url);
        }
      }
    } catch (Exception e) { /* sem rede */ }
    wifi.addAll(outros);
    return wifi;
  }

  private void aceitarConexoes() {
    while (rodando) {
      try {
        final Socket cliente = socketServidor.accept();
        trabalhadores.execute(() -> atender(cliente));
      } catch (IOException e) {
        if (rodando) dormir(200);
      }
    }
  }

  private void dormir(long ms) { try { Thread.sleep(ms); } catch (InterruptedException ignorado) { } }

  /* ------------------------------------------------------------------ */
  /* Guardar e ler do disco                                              */
  /* ------------------------------------------------------------------ */

  private void carregarConfig() {
    File arquivo = new File(pastaServidor, "config.json");
    try {
      config = new JSONObject(new String(lerArquivo(arquivo), StandardCharsets.UTF_8));
      if (config.optString("chave", "").isEmpty()) throw new IOException("sem chave");
    } catch (Exception e) {
      config = new JSONObject();
      try {
        config.put("chave", sorteiaChave());
        config.put("codigo", sorteiaCodigo());
        salvarArquivo(arquivo, config.toString().getBytes(StandardCharsets.UTF_8));
      } catch (Exception erro) { /* segue com a config em memória */ }
    }
    // par de chaves da central: o aparelho que conecta combina com ela um segredo que quem espia o Wi-Fi não calcula
    try {
      if (!config.optString("par", "").matches("[0-9a-f]{64}")) {
        byte[] novo = new byte[32];
        ALEATORIO.nextBytes(novo);
        config.put("par", hex(novo));
        salvarConfig();
      }
      pubPar = hex(x25519(deHex(config.optString("par")), BASE));
    } catch (Exception e) { pubPar = ""; }
  }

  private synchronized void salvarConfig() {
    try { salvarArquivo(new File(pastaServidor, "config.json"), config.toString().getBytes(StandardCharsets.UTF_8)); } catch (Exception e) { /* fica na memória */ }
  }

  private void carregarRegistros() {
    try {
      JSONObject salvo = new JSONObject(new String(lerArquivo(new File(pastaServidor, "registros.json")), StandardCharsets.UTF_8));
      seq = salvo.optLong("seq", 0);
      registros = salvo.optJSONObject("registros") != null ? salvo.getJSONObject("registros") : new JSONObject();
    } catch (Exception e) {
      seq = 0;
      registros = new JSONObject();
    }
  }

  private synchronized void salvarRegistros() {
    try {
      JSONObject tudo = new JSONObject();
      tudo.put("seq", seq);
      tudo.put("registros", registros);
      salvarArquivo(new File(pastaServidor, "registros.json"), tudo.toString().getBytes(StandardCharsets.UTF_8));
    } catch (Exception e) { /* tenta de novo na próxima gravação */ }
  }

  /* A central guarda na memória os últimos 60 dias. Os mais antigos ficam só no BackupUsina (um arquivo por dia)
     e são lidos de lá quando o tablet chefe abre um dia antigo. Assim o tablet chefe não fica mais lento com o tempo. */
  private static final int DIAS_NA_CENTRAL = Integer.getInteger("pranchetas.diasNaCentral", 60);
  private long ultimoArquivamento = 0;

  private static boolean ehDia(String d) { return d != null && d.matches("\\d{4}-\\d{2}-\\d{2}"); }

  private static String diasAtras(int n) {
    java.util.Calendar c = java.util.Calendar.getInstance();
    c.add(java.util.Calendar.DAY_OF_MONTH, -n);
    return new java.text.SimpleDateFormat("yyyy-MM-dd", Locale.US).format(c.getTime());
  }

  private static String corteCalculado = "";
  private static long corteQuando = 0;

  /** Primeiro dia que fica na memória (recalculado no máximo uma vez por minuto). */
  private static synchronized String corteDoArquivo() {
    long agora = System.currentTimeMillis();
    if (agora - corteQuando > 60000) { corteCalculado = diasAtras(DIAS_NA_CENTRAL); corteQuando = agora; }
    return corteCalculado;
  }

  private static boolean arquivado(String data) { return ehDia(data) && data.compareTo(corteDoArquivo()) < 0; }

  private JSONArray lerDiaArquivado(String data) {
    try { return new JSONArray(new String(lerArquivo(new File(pastaBackup, data + ".json")), StandardCharsets.UTF_8)); }
    catch (Exception e) { return new JSONArray(); }
  }

  /** Junta anotações num dia que só está no BackupUsina. Devolve quantas entraram, ou -1 se não conseguiu gravar. */
  private int juntarNoArquivo(String data, List<JSONObject> novos) {
    try {
      JSONArray antes = lerDiaArquivado(data);
      Map<String, JSONObject> mapa = new java.util.LinkedHashMap<>();
      for (int i = 0; i < antes.length(); i++) {
        JSONObject r = antes.optJSONObject(i);
        if (r != null) mapa.put(r.optString("id"), r);
      }
      int n = 0;
      for (JSONObject r : novos) {
        JSONObject a = mapa.get(r.optString("id"));
        if (a == null || r.optLong("atualizadoEm") >= a.optLong("atualizadoEm")) { mapa.put(r.optString("id"), r); n++; }
      }
      JSONArray tudo = new JSONArray();
      for (JSONObject r : mapa.values()) tudo.put(r);
      byte[] bytes = tudo.toString().getBytes(StandardCharsets.UTF_8);
      salvarArquivo(new File(pastaBackup, data + ".json"), bytes);
      espelhar("BackupUsina", data + ".json", bytes, "application/json");
      return n;
    } catch (Exception e) {
      return -1;
    }
  }

  /** Tira da memória os dias antigos (eles continuam no BackupUsina). Só tira depois de gravar o arquivo do dia. */
  synchronized int arquivarDiasAntigos() {
    ultimoArquivamento = System.currentTimeMillis();
    Map<String, List<JSONObject>> porDia = new HashMap<>();
    for (Iterator<String> it = registros.keys(); it.hasNext(); ) {
      JSONObject r = registros.optJSONObject(it.next());
      if (r == null || !arquivado(r.optString("data"))) continue;
      List<JSONObject> lista = porDia.get(r.optString("data"));
      if (lista == null) { lista = new ArrayList<>(); porDia.put(r.optString("data"), lista); }
      lista.add(r);
    }
    int dias = 0;
    for (Map.Entry<String, List<JSONObject>> e : porDia.entrySet()) {
      if (juntarNoArquivo(e.getKey(), e.getValue()) < 0) continue;
      for (JSONObject r : e.getValue()) registros.remove(r.optString("id"));
      dias++;
    }
    if (dias > 0) salvarRegistros();
    return dias;
  }

  private boolean geracaoZerada(String geracao) {
    JSONArray zeradas = config.optJSONArray("geracoesZeradas");
    if (zeradas == null) return false;
    for (int i = 0; i < zeradas.length(); i++) if (geracao.equals(zeradas.optString(i))) return true;
    return false;
  }

  /** Um arquivo por dia de produção, para nunca perder a folha. */
  private void backupDoDia(String data) {
    if (!ehDia(data) || arquivado(data)) return;
    try {
      JSONArray doDia = new JSONArray();
      for (Iterator<String> it = registros.keys(); it.hasNext(); ) {
        JSONObject r = registros.optJSONObject(it.next());
        if (r != null && data.equals(r.optString("data"))) doDia.put(r);
      }
      byte[] bytes = doDia.toString().getBytes(StandardCharsets.UTF_8);
      salvarArquivo(new File(pastaBackup, data + ".json"), bytes);
      long agora = System.currentTimeMillis();
      Long ultimo = ultimoEspelho.get(data);
      if (ultimo == null || agora - ultimo > 60000) { // copia para Documentos no máximo uma vez por minuto
        ultimoEspelho.put(data, agora);
        espelhar("BackupUsina", data + ".json", bytes, "application/json");
      }
    } catch (Exception e) { /* backup é melhor esforço */ }
  }

  private byte[] lerArquivo(File arquivo) throws IOException {
    try (FileInputStream entrada = new FileInputStream(arquivo)) { return lerTudo(entrada); }
  }

  private void salvarArquivo(File arquivo, byte[] dados) throws IOException {
    File tmp = new File(arquivo.getPath() + ".tmp");
    try (FileOutputStream saida = new FileOutputStream(tmp)) { saida.write(dados); }
    if (arquivo.exists() && !arquivo.delete()) throw new IOException("não consegui trocar " + arquivo);
    if (!tmp.renameTo(arquivo)) throw new IOException("não consegui salvar " + arquivo);
  }

  private String shaDoApk = null;
  private long apkMedidoEm = -1;

  /**
   * O que este tablet entrega para os outros se atualizarem (versão 2.7): a versão do aplicativo instalado,
   * o tamanho e o SHA-256 do APK dele e as novidades (public/novidades.js, que vai dentro do APK).
   */
  private synchronized JSONObject versaoDoApk() throws Exception {
    File apk = new File(contexto.getPackageCodePath());
    String versao = contexto.getPackageManager().getPackageInfo(contexto.getPackageName(), 0).versionName;
    if (shaDoApk == null || apkMedidoEm != apk.lastModified()) {
      MessageDigest resumo = MessageDigest.getInstance("SHA-256");
      try (InputStream entrada = new FileInputStream(apk)) {
        byte[] buf = new byte[64 * 1024];
        int n;
        while ((n = entrada.read(buf)) > 0) resumo.update(buf, 0, n);
      }
      shaDoApk = hex(resumo.digest());
      apkMedidoEm = apk.lastModified();
    }
    JSONObject r = new JSONObject().put("versao", versao).put("tamanho", apk.length()).put("sha256", shaDoApk).put("url", "/apk/pranchetas.apk");
    try (InputStream entrada = contexto.getAssets().open("public/novidades.js")) {
      String texto = new String(lerTudo(entrada), StandardCharsets.UTF_8);
      int ini = texto.indexOf('[', texto.indexOf("NOVIDADES")), fim = texto.lastIndexOf(']');
      if (ini >= 0 && fim > ini) r.put("novidades", new JSONArray(texto.substring(ini, fim + 1)));
    } catch (Exception e) { /* sem as novidades, o tablet mostra só a versão */ }
    return r;
  }

  private static byte[] lerTudo(InputStream entrada) throws IOException {
    ByteArrayOutputStream saida = new ByteArrayOutputStream();
    byte[] buffer = new byte[16384];
    int lidos;
    while ((lidos = entrada.read(buffer)) != -1) saida.write(buffer, 0, lidos);
    return saida.toByteArray();
  }

  private String sorteiaChave() {
    StringBuilder sb = new StringBuilder();
    Random r = new java.security.SecureRandom();
    for (int i = 0; i < 36; i++) sb.append("0123456789abcdef".charAt(r.nextInt(16)));
    return sb.toString();
  }

  private String sorteiaCodigo() {
    return String.format(Locale.US, "%06d", new java.security.SecureRandom().nextInt(1000000));
  }

  /* ------------------------------------------------------------------ */
  /* Atender um pedido HTTP                                              */
  /* ------------------------------------------------------------------ */

  private void atender(Socket cliente) {
    try (Socket socket = cliente) {
      socket.setSoTimeout(20000);
      InputStream entrada = socket.getInputStream();
      OutputStream saida = socket.getOutputStream();

      String linha = lerLinha(entrada);
      if (linha == null || linha.isEmpty()) return;
      String[] partes = linha.split(" ");
      if (partes.length < 2) return;
      String metodo = partes[0];
      String caminho = partes[1];

      Map<String, String> cabecalhos = new HashMap<>();
      String h;
      while ((h = lerLinha(entrada)) != null && !h.isEmpty()) {
        int dp = h.indexOf(':');
        if (dp > 0) cabecalhos.put(h.substring(0, dp).trim().toLowerCase(Locale.US), h.substring(dp + 1).trim());
      }

      int tamanho = 0;
      try { tamanho = Integer.parseInt(cabecalhos.getOrDefault("content-length", "0")); } catch (NumberFormatException ignorado) { }
      byte[] corpo = new byte[0];
      if (tamanho > 0 && tamanho <= 40 * 1024 * 1024) {
        corpo = new byte[tamanho];
        int lidos = 0;
        while (lidos < tamanho) {
          int n = entrada.read(corpo, lidos, tamanho - lidos);
          if (n < 0) break;
          lidos += n;
        }
      }

      String ip = socket.getInetAddress() != null ? socket.getInetAddress().getHostAddress() : "";
      responder(metodo, caminho, cabecalhos, corpo, ip, saida, "HEAD".equals(metodo));
    } catch (Exception e) { /* conexão caiu */ }
  }

  private String lerLinha(InputStream entrada) throws IOException {
    ByteArrayOutputStream buffer = new ByteArrayOutputStream();
    int c;
    while ((c = entrada.read()) != -1) {
      if (c == '\n') break;
      if (c != '\r') buffer.write(c);
    }
    if (c == -1 && buffer.size() == 0) return null;
    return buffer.toString("UTF-8");
  }

  private void responder(String metodo, String caminhoCompleto, Map<String, String> cabecalhos,
                         byte[] corpo, String ip, OutputStream saida, boolean soCabecalho) throws IOException {
    responder(metodo, caminhoCompleto, cabecalhos, corpo, ip, saida, soCabecalho, false, "");
  }

  /** autenticado: o pedido chegou embaralhado com a chave do aparelho (e já foi aberto). */
  private void responder(String metodo, String caminhoCompleto, Map<String, String> cabecalhos,
                         byte[] corpo, String ip, OutputStream saida, boolean soCabecalho, boolean autenticado, String aparelho) throws IOException {
    String caminho = caminhoCompleto;
    String consulta = "";
    int interrogacao = caminhoCompleto.indexOf('?');
    if (interrogacao >= 0) {
      caminho = caminhoCompleto.substring(0, interrogacao);
      consulta = caminhoCompleto.substring(interrogacao + 1);
    }
    caminho = URLDecoder.decode(caminho, "UTF-8");

    if ("OPTIONS".equals(metodo)) { enviar(saida, 204, "text/plain", new byte[0], null, false); return; }
    if (!redeInterna(ip)) { enviarTexto(saida, 403, "Acesso permitido só pela rede da usina."); return; }

    try {
      if (!autenticado && "/api/ping".equals(caminho)) {
        enviarJson(saida, 200, new JSONObject().put("app", "pranchetas").put("rede", "Tablet chefe").put("apk", true)
            .put("cifra", 1).put("pub", pubPar).put("agora", System.currentTimeMillis()));
        return;
      }

      // conectar: o código de 6 números não passa aberto; a chave deste aparelho volta embaralhada
      if (!autenticado && "/api/parear".equals(caminho) && "POST".equals(metodo)) {
        if (chutesDemais(ip)) { enviarJson(saida, 429, new JSONObject().put("erro", "Muitas tentativas. Espere um minuto.")); return; }
        JSONObject pedido = new JSONObject(new String(corpo, StandardCharsets.UTF_8));
        String quem = pedido.optString("aparelho"), pub = pedido.optString("pub"), prova = pedido.optString("prova");
        if (!pub.matches("[0-9a-f]{64}") || !prova.matches("[0-9a-f]{64}") || quem.isEmpty() || quem.length() > 80) {
          enviarJson(saida, 400, new JSONObject().put("erro", pedido.has("codigo") ? ATUALIZE : "Pedido de conexão inválido"));
          return;
        }
        byte[] comum = x25519(deHex(config.optString("par")), deHex(pub));
        boolean zero = true;
        for (byte b : comum) if (b != 0) zero = false;
        byte[] chavePar = hmac(comum, "parear|" + quem + "|" + pub);
        if (zero || !MessageDigest.isEqual(hmac(chavePar, "codigo|" + getCodigo()), deHex(prova))) {
          enviarJson(saida, 403, new JSONObject().put("erro", "Código errado"));
          return;
        }
        byte[] pacote = selar(chavePar, new JSONObject().put("chave", hex(chaveDoAparelho(quem))).toString().getBytes(StandardCharsets.UTF_8),
            ("parear|" + quem).getBytes(StandardCharsets.UTF_8));
        enviarJson(saida, 200, new JSONObject().put("rede", "Tablet chefe").put("cifrado", base64(pacote)));
        return;
      }

      // rotas com os dados: só por pedido embaralhado com a chave do aparelho
      if (!autenticado && "/api/c".equals(caminho) && "POST".equals(metodo)) { apiCifrada(consulta, corpo, ip, saida); return; }

      // atualização (versão 2.7): os outros tablets perguntam qual versão este tablet entrega
      if ("/api/versao".equals(caminho)) { enviarJson(saida, 200, versaoDoApk()); return; }

      if ("/apk/pranchetas.apk".equals(caminho)) {
        // entrega o próprio aplicativo instalado neste tablet: é exatamente o mesmo app
        File apk = new File(contexto.getPackageCodePath());
        enviarArquivo(saida, apk, "application/vnd.android.package-archive", "pranchetas-ubiralcool.apk", soCabecalho);
        return;
      }

      if ("/relatorios".equals(caminho) || "/relatorios/".equals(caminho)) { paginaRelatorios(saida); return; }

      if (caminho.startsWith("/relatorios/")) {
        String[] pedaco = caminho.substring("/relatorios/".length()).split("/");
        if (pedaco.length == 2 && pedaco[0].matches("\\d{4}-\\d{2}-\\d{2}") && !pedaco[1].contains("..")) {
          File arquivo = new File(new File(pastaRelatorios, pedaco[0]), pedaco[1]);
          String mime = pedaco[1].endsWith(".xml") ? "application/xml" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          enviarArquivo(saida, arquivo, mime, pedaco[1], soCabecalho);
          return;
        }
      }

      if (caminho.startsWith("/api/")) {
        // aparelho com o aplicativo antigo (chave aberta no Wi-Fi): não recebe nada até atualizar
        if (!autenticado) { enviarJson(saida, 426, new JSONObject().put("erro", ATUALIZE)); return; }
        if ("/api/sync".equals(caminho) && "POST".equals(metodo)) { apiSync(corpo, ip, saida); return; }
        if ("/api/registros".equals(caminho)) { apiRegistros(consulta, saida); return; }
        if ("/api/status".equals(caminho)) { apiStatus(saida); return; }
        if ("/api/relatorios".equals(caminho)) { apiRelatorios(saida); return; }
        if ("/api/erros".equals(caminho)) { apiErros(saida); return; }
        if ("/api/zerar".equals(caminho) && "POST".equals(metodo)) { apiZerar(corpo, saida); return; }
        // quem trocou recebe a chave nova dele (a resposta vai embaralhada com a chave antiga)
        if ("/api/novo-codigo".equals(caminho) && "POST".equals(metodo)) { String codigo = novoCodigo(); enviarJson(saida, 200, new JSONObject().put("codigo", codigo).put("chave", hex(chaveDoAparelho(aparelho)))); return; }
        if ("/api/base44".equals(caminho) && "POST".equals(metodo)) { apiBase44(corpo, saida); return; }
        if ("/api/relatorio".equals(caminho) && "POST".equals(metodo)) { apiRelatorio(corpo, saida); return; }
        if ("/api/relatorio-apagar".equals(caminho) && "POST".equals(metodo)) { apiRelatorioApagar(corpo, saida); return; }
        enviarJson(saida, 404, new JSONObject().put("erro", "rota desconhecida"));
        return;
      }

      enviarAsset(saida, caminho, soCabecalho);
    } catch (Exception e) {
      enviarTexto(saida, 400, "Erro: " + e.getMessage());
    }
  }

  /* ------------------------------------------------------------------ */
  /* Rotas                                                               */
  /* ------------------------------------------------------------------ */

  private synchronized void apiSync(byte[] corpo, String ip, OutputStream saida) throws Exception {
    JSONObject pedido = new JSONObject(new String(corpo, StandardCharsets.UTF_8));
    String aparelho = pedido.optString("aparelho");
    if (!aparelho.isEmpty()) {
      aparelhos.put(aparelho, new JSONObject()
          .put("papel", pedido.optString("papel"))
          .put("operador", pedido.optString("operador"))
          .put("versao", pedido.optString("versao"))
          .put("vistoEm", System.currentTimeMillis())
          .put("ip", ip));
    }
    guardarErros(aparelho, pedido.optJSONArray("erros"), ip);
    String geracaoDele = pedido.optString("geracao", "");
    if (!geracaoDele.isEmpty() && !geracaoDele.equals(getGeracao())) {
      // aparelho com anotações de antes de zerar: não aceita, manda ele limpar.
      // Aparelho que acabou de conectar numa central nova (tablet chefe trocado ou reinstalado): aceita o que ele tem.
      if (geracaoZerada(geracaoDele) || !pedido.optBoolean("novaConexao")) {
        enviarJson(saida, 200, new JSONObject().put("ok", false).put("zerar", true).put("geracao", getGeracao()).put("seq", seq).put("agora", System.currentTimeMillis()));
        return;
      }
    }
    if (System.currentTimeMillis() - ultimoArquivamento > 3600000L) arquivarDiasAntigos();
    JSONArray chegaram = pedido.optJSONArray("registros");
    int aceitos = 0;
    List<String> dias = new ArrayList<>();
    Map<String, List<JSONObject>> antigos = new HashMap<>();
    if (chegaram != null) {
      for (int i = 0; i < chegaram.length(); i++) {
        JSONObject r = chegaram.optJSONObject(i);
        if (r == null || r.optString("id").isEmpty() || !r.has("atualizadoEm")) continue;
        if (arquivado(r.optString("data"))) {
          r.remove("sincronizado");
          r.put("recebidoEm", System.currentTimeMillis());
          List<JSONObject> lista = antigos.get(r.optString("data"));
          if (lista == null) { lista = new ArrayList<>(); antigos.put(r.optString("data"), lista); }
          lista.add(r);
          continue;
        }
        JSONObject atual = registros.optJSONObject(r.getString("id"));
        JSONObject entrada = criadasSemSaber(atual, r) ? juntarLinhas(atual, r) : r;
        if (atual == null || entrada != r || r.optLong("atualizadoEm") >= atual.optLong("atualizadoEm")) {
          seq++;
          entrada.put("seq", seq).put("recebidoEm", System.currentTimeMillis());
          entrada.remove("sincronizado");
          registros.put(r.getString("id"), entrada);
          if (!dias.contains(r.optString("data"))) dias.add(r.optString("data"));
          aceitos++;
        }
      }
    }
    for (Map.Entry<String, List<JSONObject>> e : antigos.entrySet()) {
      int n = juntarNoArquivo(e.getKey(), e.getValue());
      if (n > 0) aceitos += n;
    }
    if (aceitos > 0) {
      salvarRegistros();
      for (String dia : dias) backupDoDia(dia);
    }
    enviarJson(saida, 200, new JSONObject().put("ok", true).put("aceitos", aceitos).put("seq", seq).put("agora", System.currentTimeMillis()).put("geracao", getGeracao()));
  }

  /* Dois aparelhos criaram a mesma linha sem um saber do outro (ex.: o tablet chefe corrigiu uma dorna nos segundos
     antes de recebê-la): em vez de a última apagar a primeira, os valores se juntam. O mais novo vale nos quadros que
     ele preencheu; o resto continua. A linha junta ganha um horário novo, para chegar de novo nos dois aparelhos. */
  private static boolean criadasSemSaber(JSONObject atual, JSONObject r) {
    // só entre aparelhos diferentes: o mesmo aparelho mudando a própria linha vale a versão mais nova, como sempre
    return atual != null && !atual.optBoolean("apagado") && !r.optBoolean("apagado")
        && atual.optJSONObject("valores") != null && r.optJSONObject("valores") != null
        && !r.optString("aparelho").isEmpty() && !r.optString("aparelho").equals(atual.optString("aparelho"))
        && r.optLong("criadoEm") != 0 && atual.optLong("criadoEm") != 0 && r.optLong("criadoEm") != atual.optLong("criadoEm");
  }

  private static JSONObject juntarLinhas(JSONObject a, JSONObject b) throws Exception {
    boolean bMaisNovo = b.optLong("atualizadoEm") >= a.optLong("atualizadoEm");
    JSONObject velho = bMaisNovo ? a : b, novo = bMaisNovo ? b : a;
    JSONObject junta = new JSONObject(velho.toString());
    for (Iterator<String> it = novo.keys(); it.hasNext(); ) { String k = it.next(); junta.put(k, novo.opt(k)); }
    JSONObject valores = new JSONObject(velho.getJSONObject("valores").toString());
    JSONObject dele = novo.getJSONObject("valores");
    for (Iterator<String> it = dele.keys(); it.hasNext(); ) {
      String k = it.next();
      Object x = dele.opt(k);
      if (x != null && x != JSONObject.NULL && !"".equals(String.valueOf(x))) valores.put(k, x);
    }
    junta.put("valores", valores);
    junta.put("operador", novo.optString("operador").isEmpty() ? velho.optString("operador") : novo.optString("operador"));
    junta.put("criadoEm", Math.min(a.optLong("criadoEm"), b.optLong("criadoEm")));
    junta.put("atualizadoEm", Math.max(a.optLong("atualizadoEm"), b.optLong("atualizadoEm")) + 1);
    return junta;
  }

  /** Erros que os aparelhos mandam: uma linha JSON por erro em ServidorUsina/erros.log (passou de 2 MB, começa outro). */
  private synchronized void guardarErros(String aparelho, JSONArray lista, String ip) {
    if (lista == null || lista.length() == 0) return;
    try {
      File arquivo = new File(pastaServidor, "erros.log");
      if (arquivo.exists() && arquivo.length() > 2L * 1024 * 1024) {
        File antigo = new File(pastaServidor, "erros-antigo.log");
        if (antigo.exists()) antigo.delete();
        arquivo.renameTo(antigo);
      }
      StringBuilder sb = new StringBuilder();
      for (int i = 0; i < Math.min(lista.length(), 50); i++) {
        JSONObject e = lista.optJSONObject(i);
        if (e == null) continue;
        sb.append(new JSONObject()
            .put("recebidoEm", System.currentTimeMillis()).put("aparelho", cortar(aparelho, 40)).put("ip", ip)
            .put("quando", e.optLong("quando")).put("versao", cortar(e.optString("versao"), 20))
            .put("papel", cortar(e.optString("papel"), 40)).put("tela", cortar(e.optString("tela"), 40))
            .put("msg", cortar(e.optString("msg"), 300)).put("detalhe", cortar(e.optString("detalhe"), 900)).toString()).append('\n');
      }
      try (FileOutputStream saida = new FileOutputStream(arquivo, true)) { saida.write(sb.toString().getBytes(StandardCharsets.UTF_8)); }
    } catch (Exception erro) { /* registro de erro é melhor esforço */ }
  }

  private static String cortar(String texto, int tamanho) {
    if (texto == null) return "";
    return texto.length() > tamanho ? texto.substring(0, tamanho) : texto;
  }

  private void apiErros(OutputStream saida) throws Exception {
    JSONArray lista = new JSONArray();
    File arquivo = new File(pastaServidor, "erros.log");
    if (arquivo.exists()) {
      String[] linhas = new String(lerArquivo(arquivo), StandardCharsets.UTF_8).trim().split("\n");
      for (int i = Math.max(0, linhas.length - 100); i < linhas.length; i++) {
        try { if (!linhas[i].trim().isEmpty()) lista.put(new JSONObject(linhas[i])); } catch (Exception ignorado) { }
      }
    }
    enviarJson(saida, 200, new JSONObject().put("erros", lista));
  }

  private synchronized void apiRegistros(String consulta, OutputStream saida) throws Exception {
    long desde = 0;
    String dia = null, aPartirDe = null;
    for (String par : consulta.split("&")) {
      if (par.startsWith("desde=")) {
        try { desde = Long.parseLong(par.substring(6)); } catch (NumberFormatException ignorado) { }
      } else if (par.startsWith("dia=")) dia = par.substring(4);
      else if (par.startsWith("aPartirDe=")) aPartirDe = par.substring(10);
    }
    JSONArray lista = new JSONArray();
    if (dia != null) { // o tablet chefe abriu um dia que não guarda mais
      if (!ehDia(dia)) { enviarJson(saida, 400, new JSONObject().put("erro", "dia inválido")); return; }
      if (arquivado(dia)) lista = lerDiaArquivado(dia);
      else for (Iterator<String> it = registros.keys(); it.hasNext(); ) {
        JSONObject r = registros.optJSONObject(it.next());
        if (r != null && dia.equals(r.optString("data"))) lista.put(r);
      }
      enviarJson(saida, 200, new JSONObject().put("seq", seq).put("geracao", getGeracao()).put("registros", lista));
      return;
    }
    if (desde > seq) desde = 0; // o aparelho tem número maior: manda tudo
    // cada aparelho guarda só os últimos dias (a configuração da usina e os avisos vão sempre)
    boolean filtrar = ehDia(aPartirDe);
    for (Iterator<String> it = registros.keys(); it.hasNext(); ) {
      JSONObject r = registros.optJSONObject(it.next());
      if (r == null || r.optLong("seq") <= desde) continue;
      String d = r.optString("data"), pr = r.optString("prancheta");
      // os enchimentos das dornas de fermentação vão sempre (uma dorna pode passar vários dias fermentando)
      if (!filtrar || !ehDia(d) || d.compareTo(aPartirDe) >= 0 || "avisos".equals(pr) || "avisos-recibo".equals(pr) || "fermentacao".equals(pr)) lista.put(r);
    }
    enviarJson(saida, 200, new JSONObject().put("seq", seq).put("geracao", getGeracao()).put("registros", lista));
  }

  private synchronized void apiStatus(OutputStream saida) throws Exception {
    JSONArray lista = new JSONArray();
    long agora = System.currentTimeMillis();
    for (Map.Entry<String, JSONObject> e : aparelhos.entrySet()) {
      JSONObject a = e.getValue();
      long visto = a.optLong("vistoEm");
      lista.put(new JSONObject()
          .put("id", e.getKey())
          .put("papel", a.optString("papel"))
          .put("operador", a.optString("operador"))
          .put("versao", a.optString("versao"))
          .put("ip", a.optString("ip"))
          .put("online", agora - visto < 30000)
          .put("minutos", Math.round((agora - visto) / 60000.0)));
    }
    JSONArray ends = new JSONArray();
    for (String e : enderecos()) ends.put(e);
    String docs = Build.VERSION.SDK_INT >= 29 ? "Documentos/Usina/" : "";
    enviarJson(saida, 200, new JSONObject()
        .put("seq", seq).put("total", registros.length())
        .put("codigo", getCodigo()).put("enderecos", ends).put("apk", true).put("base44", estadoBase44(false))
        .put("pastas", new JSONObject()
            .put("servidor", "ServidorUsina (dentro do aplicativo)")
            .put("relatorios", docs.isEmpty() ? pastaRelatorios.getAbsolutePath() : docs + "RelatoriosUsina")
            .put("backup", docs.isEmpty() ? pastaBackup.getAbsolutePath() : docs + "BackupUsina"))
        .put("aparelhos", lista));
  }

  private void apiRelatorios(OutputStream saida) throws Exception {
    JSONArray dias = new JSONArray();
    File[] pastas = pastaRelatorios.listFiles();
    if (pastas != null) {
      Arrays.sort(pastas, (a, b) -> b.getName().compareTo(a.getName()));
      for (File dia : pastas) {
        if (!dia.isDirectory() || !dia.getName().matches("\\d{4}-\\d{2}-\\d{2}")) continue;
        File[] arquivos = dia.listFiles();
        JSONArray lista = new JSONArray();
        if (arquivos != null) {
          Arrays.sort(arquivos, (a, b) -> a.getName().compareTo(b.getName()));
          for (File a : arquivos) {
            if (a.getName().endsWith(".tmp")) continue;
            lista.put(new JSONObject().put("nome", a.getName()).put("tamanho", a.length()));
          }
        }
        dias.put(new JSONObject().put("data", dia.getName()).put("arquivos", lista));
      }
    }
    // dias com anotações (na memória e no BackupUsina): o tablet chefe vê, corrige e envia os dias anteriores
    java.util.TreeSet<String> comDados = new java.util.TreeSet<>(Collections.reverseOrder());
    synchronized (this) {
      for (Iterator<String> it = registros.keys(); it.hasNext(); ) {
        JSONObject r = registros.optJSONObject(it.next());
        if (r != null && ehDia(r.optString("data"))) comDados.add(r.optString("data"));
      }
    }
    File[] copias = pastaBackup.listFiles();
    if (copias != null) for (File f : copias) {
      if (f.isFile() && f.getName().matches("\\d{4}-\\d{2}-\\d{2}\\.json")) comDados.add(f.getName().substring(0, 10));
    }
    JSONArray listaDias = new JSONArray();
    for (String d : comDados) listaDias.put(d);
    enviarJson(saida, 200, new JSONObject().put("pasta", "RelatoriosUsina").put("dias", dias).put("diasComDados", listaDias));
  }

  /** Apaga o Excel e o XML guardados de um dia (as anotações continuam). */
  private void apiRelatorioApagar(byte[] corpo, OutputStream saida) throws Exception {
    String data = new JSONObject(new String(corpo, StandardCharsets.UTF_8)).optString("data");
    if (!ehDia(data)) { enviarJson(saida, 400, new JSONObject().put("erro", "data inválida")); return; }
    File pasta = new File(pastaRelatorios, data);
    File[] arquivos = pasta.listFiles();
    if (arquivos != null) for (File f : arquivos) f.delete();
    pasta.delete();
    enviarJson(saida, 200, new JSONObject().put("ok", true));
  }

  /** Página simples para abrir no navegador do escritório: os relatórios guardados, por dia. */
  private void paginaRelatorios(OutputStream saida) throws IOException {
    StringBuilder linhas = new StringBuilder();
    File[] pastas = pastaRelatorios.listFiles();
    if (pastas != null) {
      Arrays.sort(pastas, (a, b) -> b.getName().compareTo(a.getName()));
      for (File dia : pastas) {
        if (!dia.isDirectory() || !dia.getName().matches("\\d{4}-\\d{2}-\\d{2}")) continue;
        String[] p = dia.getName().split("-");
        linhas.append("<tr><td><b>").append(p[2]).append('/').append(p[1]).append('/').append(p[0]).append("</b></td><td>");
        File[] arquivos = dia.listFiles();
        if (arquivos != null) {
          Arrays.sort(arquivos, (a, b) -> a.getName().compareTo(b.getName()));
          for (File a : arquivos) {
            if (a.getName().endsWith(".tmp")) continue;
            String nome = escHtml(a.getName());
            linhas.append("<a href=\"/relatorios/").append(dia.getName()).append('/').append(java.net.URLEncoder.encode(a.getName(), "UTF-8").replace("+", "%20"))
                .append("\">").append(nome).append("</a> &nbsp; ");
          }
        }
        linhas.append("</td></tr>");
      }
    }
    String html = "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
        + "<title>Relatórios das pranchetas</title><link rel=\"stylesheet\" href=\"/styles.css\"></head><body>"
        + "<header class=\"topo\"><img class=\"logo\" src=\"/icons/logo.png\" alt=\"Ubirálcool\"><div class=\"titulo\"><b>Relatórios das pranchetas</b><span>Arquivos guardados no tablet chefe</span></div></header>"
        + "<main><p class=\"sub\">Clique para baixar e anexar no e-mail ou no sistema da empresa.</p><div class=\"folha\"><div class=\"tabela-wrap\"><table class=\"papel\"><thead><tr><th>Dia</th><th>Arquivos</th></tr></thead><tbody>"
        + (linhas.length() > 0 ? linhas : "<tr><td colspan=\"2\" class=\"vazia\">Nenhum relatório guardado ainda.</td></tr>")
        + "</tbody></table></div></div></main></body></html>";
    enviar(saida, 200, "text/html; charset=utf-8", html.getBytes(StandardCharsets.UTF_8), null, false);
  }

  private static String escHtml(String s) {
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
  }

  private void apiRelatorio(byte[] corpo, OutputStream saida) throws Exception {
    JSONObject pedido = new JSONObject(new String(corpo, StandardCharsets.UTF_8));
    String data = pedido.optString("data");
    String nome = new File(pedido.optString("nome")).getName().replaceAll("[^\\w.\\-]", "_");
    if (!data.matches("\\d{4}-\\d{2}-\\d{2}") || !nome.matches(".+\\.(xlsx|xml|csv)")) {
      enviarJson(saida, 400, new JSONObject().put("erro", "pedido inválido"));
      return;
    }
    String onde = guardarRelatorio(data, nome, android.util.Base64.decode(pedido.optString("base64"), android.util.Base64.DEFAULT));
    enviarJson(saida, 200, new JSONObject().put("ok", true).put("caminho", onde));
  }

  /** Zera as anotações de teste: guarda uma cópia em BackupUsina e apaga tudo, menos a configuração da usina. */
  private synchronized void apiZerar(byte[] corpo, OutputStream saida) throws Exception {
    JSONObject pedido = new JSONObject(new String(corpo, StandardCharsets.UTF_8));
    if (!"ZERAR".equals(pedido.optString("confirmar"))) { enviarJson(saida, 400, new JSONObject().put("erro", "faltou confirmar")); return; }
    if (!senhaDoProgramador(pedido.optString("senha"))) { enviarJson(saida, 403, new JSONObject().put("erro", "senha do programador errada")); return; }
    String carimbo = new java.text.SimpleDateFormat("yyyyMMddHHmm", Locale.US).format(new java.util.Date());
    String nome = "antes-de-zerar-" + carimbo + ".json";
    JSONArray tudo = new JSONArray();
    List<String> apagar = new ArrayList<>();
    for (Iterator<String> it = registros.keys(); it.hasNext(); ) {
      String id = it.next();
      JSONObject r = registros.optJSONObject(id);
      if (r == null) continue;
      tudo.put(r);
      if (!"config".equals(r.optString("data"))) apagar.add(id);
    }
    byte[] copia = tudo.toString().getBytes(StandardCharsets.UTF_8);
    salvarArquivo(new File(pastaBackup, nome), copia);
    espelhar("BackupUsina", nome, copia, "application/json");
    for (String id : apagar) registros.remove(id);
    // os arquivos de cada dia (inclusive os dias antigos) vão para uma pasta, para não voltarem na folha
    File guardados = new File(pastaBackup, "antes-de-zerar-" + carimbo);
    File[] arquivosDosDias = pastaBackup.listFiles();
    if (arquivosDosDias != null) for (File f : arquivosDosDias) {
      if (f.isFile() && f.getName().matches("\\d{4}-\\d{2}-\\d{2}\\.json")) { guardados.mkdirs(); f.renameTo(new File(guardados, f.getName())); }
    }
    JSONArray zeradas = config.optJSONArray("geracoesZeradas");
    JSONArray novaLista = new JSONArray();
    if (zeradas != null) for (int i = Math.max(0, zeradas.length() - 49); i < zeradas.length(); i++) novaLista.put(zeradas.optString(i));
    novaLista.put(getGeracao());
    config.put("geracoesZeradas", novaLista);
    config.put("geracao", sorteiaChave().substring(0, 12));
    salvarArquivo(new File(pastaServidor, "config.json"), config.toString().getBytes(StandardCharsets.UTF_8));
    salvarRegistros();
    enviarJson(saida, 200, new JSONObject().put("ok", true).put("apagados", apagar.size()).put("geracao", getGeracao()).put("copia", "BackupUsina/" + nome));
  }

  /** Só a senha do programador apaga todos os dados do sistema. Fica guardado só o resumo (hash) dela. */
  private static final String HASH_PROGRAMADOR = System.getProperty("pranchetas.senhaProgramadorHash", "f3a1f608cc2b347ff635467ec7440a8e1f8171a889e3feb02137a7d642debbc1");

  private static boolean senhaDoProgramador(String senha) {
    try {
      byte[] h = java.security.MessageDigest.getInstance("SHA-256").digest(String.valueOf(senha).getBytes(StandardCharsets.UTF_8));
      StringBuilder sb = new StringBuilder();
      for (byte b : h) sb.append(String.format(Locale.US, "%02x", b));
      return sb.toString().equals(HASH_PROGRAMADOR);
    } catch (Exception e) {
      return false;
    }
  }

  private synchronized boolean chutesDemais(String ip) {
    long agora = System.currentTimeMillis();
    List<Long> lista = tentativas.get(ip);
    if (lista == null) { lista = new ArrayList<>(); tentativas.put(ip, lista); }
    lista.removeIf(t -> agora - t > 60000);
    tentativasTodas.removeIf(t -> agora - t > 60000);
    lista.add(agora);
    tentativasTodas.add(agora);
    return lista.size() > 6 || tentativasTodas.size() > 30;
  }

  private boolean redeInterna(String ip) {
    if (ip == null) return false;
    if (ip.startsWith("::ffff:")) ip = ip.substring(7);
    String minusculo = ip.toLowerCase(Locale.US);
    return ip.equals("::1") || ip.startsWith("127.") || ip.startsWith("10.") || ip.startsWith("192.168.")
        || ip.matches("^172\\.(1[6-9]|2\\d|3[01])\\..*")
        || minusculo.startsWith("fe80") || minusculo.startsWith("fc") || minusculo.startsWith("fd");
  }

  /* ------------------------------------------------------------------ */
  /* Entregar arquivos e respostas                                       */
  /* ------------------------------------------------------------------ */

  private void enviarAsset(OutputStream saida, String caminho, boolean soCabecalho) throws IOException {
    String rel = caminho;
    if (rel.equals("/") || rel.isEmpty()) rel = "/index.html";
    if (rel.equals("/baixar")) rel = "/baixar.html";
    rel = rel.replace("..", "");
    AssetManager assets = contexto.getAssets();
    try (InputStream entrada = assets.open("public" + rel)) {
      enviar(saida, 200, tipoDoArquivo(rel), lerTudo(entrada), null, soCabecalho);
    } catch (IOException e) {
      enviarTexto(saida, 404, "Não encontrado");
    }
  }

  private void enviarArquivo(OutputStream saida, File arquivo, String tipo, String nomeParaBaixar, boolean soCabecalho) throws IOException {
    if (!arquivo.exists()) { enviarTexto(saida, 404, "Não encontrado"); return; }
    String disposicao = "attachment; filename=\"" + nomeParaBaixar + "\"";
    StringBuilder cab = cabecalho(200, tipo, arquivo.length(), disposicao);
    saida.write(cab.toString().getBytes(StandardCharsets.UTF_8));
    if (!soCabecalho) {
      // manda em pedaços, sem carregar o arquivo inteiro na memória
      try (FileInputStream entrada = new FileInputStream(arquivo)) {
        byte[] buffer = new byte[65536];
        int lidos;
        while ((lidos = entrada.read(buffer)) != -1) saida.write(buffer, 0, lidos);
      }
    }
    saida.flush();
  }

  private String tipoDoArquivo(String caminho) {
    if (caminho.endsWith(".html")) return "text/html; charset=utf-8";
    if (caminho.endsWith(".js")) return "text/javascript; charset=utf-8";
    if (caminho.endsWith(".css")) return "text/css; charset=utf-8";
    if (caminho.endsWith(".png")) return "image/png";
    if (caminho.endsWith(".woff2")) return "font/woff2";
    if (caminho.endsWith(".webmanifest")) return "application/manifest+json";
    if (caminho.endsWith(".json")) return "application/json";
    return "application/octet-stream";
  }

  private void enviarJson(OutputStream saida, int codigo, JSONObject corpo) throws IOException {
    enviar(saida, codigo, "application/json; charset=utf-8", corpo.toString().getBytes(StandardCharsets.UTF_8), null, false);
  }

  private void enviarTexto(OutputStream saida, int codigo, String texto) throws IOException {
    enviar(saida, codigo, "text/plain; charset=utf-8", texto.getBytes(StandardCharsets.UTF_8), null, false);
  }

  private StringBuilder cabecalho(int codigo, String tipo, long tamanho, String disposicao) {
    StringBuilder cab = new StringBuilder();
    cab.append("HTTP/1.1 ").append(codigo).append(codigo == 200 ? " OK" : codigo == 204 ? " No Content" : " Erro").append("\r\n");
    cab.append("Content-Type: ").append(tipo).append("\r\n");
    cab.append("Content-Length: ").append(tamanho).append("\r\n");
    cab.append("Access-Control-Allow-Origin: *\r\n");
    cab.append("Access-Control-Allow-Headers: Content-Type\r\n");
    cab.append("Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n");
    cab.append("Cache-Control: no-store\r\n");
    if (disposicao != null) cab.append("Content-Disposition: ").append(disposicao).append("\r\n");
    cab.append("Connection: close\r\n\r\n");
    return cab;
  }

  private void enviar(OutputStream saida, int codigo, String tipo, byte[] corpo, String disposicao, boolean soCabecalho) throws IOException {
    saida.write(cabecalho(codigo, tipo, corpo.length, disposicao).toString().getBytes(StandardCharsets.UTF_8));
    if (!soCabecalho) saida.write(corpo);
    saida.flush();
  }

  /* ------------------------------------------------------------------ */
  /* Criptografia do Wi-Fi (a mesma do public/cifra.js e do server.js)  */
  /* ------------------------------------------------------------------ */

  private static final String ATUALIZE = "Atualize o aplicativo: a central agora usa a conexão embaralhada (versão 2.5).";
  private static final SecureRandom ALEATORIO = new SecureRandom();
  private static final long JANELA = 5 * 60000L;
  private String pubPar = "";
  private final LinkedHashMap<String, Long> pedidosVistos = new LinkedHashMap<>();

  /** Pedido embaralhado: abre, confere relógio e repetição, responde pela rota de dentro e embaralha a resposta. */
  private void apiCifrada(String consulta, byte[] pacote, String ip, OutputStream saida) throws Exception {
    String quem = "";
    for (String par : consulta.split("&")) if (par.startsWith("a=")) quem = URLDecoder.decode(par.substring(2), "UTF-8");
    if (quem.length() > 80) quem = quem.substring(0, 80);
    byte[] chave = chaveDoAparelho(quem);
    String texto;
    try { texto = new String(abrir(chave, pacote, ("pedido|" + quem).getBytes(StandardCharsets.UTF_8)), StandardCharsets.UTF_8); } catch (Exception e) {
      enviarJson(saida, 401, new JSONObject().put("erro", "Aparelho não conectado à central"));
      return;
    }
    int nl = texto.indexOf('\n');
    JSONObject cab = new JSONObject(texto.substring(0, nl));
    long agora = System.currentTimeMillis();
    // relógio do aparelho muito diferente: ele acerta com a hora da central e pede de novo
    if (Math.abs(agora - cab.optLong("t")) > JANELA) { enviarJson(saida, 409, new JSONObject().put("erro", "relogio").put("agora", agora)); return; }
    byte[] iv = Arrays.copyOfRange(pacote, 0, 12);
    if (jaVisto(hex(iv))) { enviarJson(saida, 401, new JSONObject().put("erro", "Pedido repetido")); return; }
    String c = cab.optString("c");
    if (!c.matches("api/[a-z0-9-]+(\\?.*)?") || c.matches("api/(c|ping|parear)(\\?.*)?")) { enviarJson(saida, 400, new JSONObject().put("erro", "caminho inválido")); return; }
    ByteArrayOutputStream captura = new ByteArrayOutputStream();
    responder("POST".equals(cab.optString("m")) ? "POST" : "GET", "/" + c, new HashMap<>(), texto.substring(nl + 1).getBytes(StandardCharsets.UTF_8), ip, captura, false, true, quem);
    // a resposta gravada: situação na primeira linha, corpo depois da linha em branco
    byte[] bruto = captura.toByteArray();
    int fimLinha = 0, fimCab = 0;
    while (fimLinha < bruto.length && bruto[fimLinha] != '\r') fimLinha++;
    for (int i = 0; i + 3 < bruto.length; i++) if (bruto[i] == '\r' && bruto[i + 1] == '\n' && bruto[i + 2] == '\r' && bruto[i + 3] == '\n') { fimCab = i + 4; break; }
    String situacao = new String(bruto, 0, fimLinha, StandardCharsets.UTF_8).split(" ")[1];
    byte[] plano = juntar((situacao + "\n").getBytes(StandardCharsets.UTF_8), Arrays.copyOfRange(bruto, fimCab, bruto.length));
    enviar(saida, 200, "application/octet-stream", selar(chave, plano, juntar("resposta|".getBytes(StandardCharsets.UTF_8), iv)), null, false);
  }

  /** Pedido gravado por alguém e mandado de novo é recusado: vale só por 5 minutos e cada um só uma vez. */
  private synchronized boolean jaVisto(String iv) {
    long agora = System.currentTimeMillis();
    Iterator<Map.Entry<String, Long>> it = pedidosVistos.entrySet().iterator();
    while (it.hasNext()) { if (agora - it.next().getValue() < 2 * JANELA) break; it.remove(); }
    if (pedidosVistos.containsKey(iv)) return true;
    pedidosVistos.put(iv, agora);
    return false;
  }

  /** Chave de cada aparelho: sai da chave da rede (trocar o código troca a da rede e desconecta todos). */
  private byte[] chaveDoAparelho(String aparelho) throws Exception { return hmac(getChave().getBytes(StandardCharsets.UTF_8), "aparelho|" + aparelho); }

  private static byte[] hmac(byte[] chave, String texto) throws Exception {
    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec(chave, "HmacSHA256"));
    return mac.doFinal(texto.getBytes(StandardCharsets.UTF_8));
  }

  private static byte[] selar(byte[] chave, byte[] texto, byte[] aad) throws Exception {
    byte[] iv = new byte[12];
    ALEATORIO.nextBytes(iv);
    Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
    c.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(chave, "AES"), new GCMParameterSpec(128, iv));
    c.updateAAD(aad);
    return juntar(iv, c.doFinal(texto));
  }

  private static byte[] abrir(byte[] chave, byte[] pacote, byte[] aad) throws Exception {
    if (pacote.length < 28) throw new IOException("pacote curto");
    Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
    c.init(Cipher.DECRYPT_MODE, new SecretKeySpec(chave, "AES"), new GCMParameterSpec(128, pacote, 0, 12));
    c.updateAAD(aad);
    return c.doFinal(pacote, 12, pacote.length - 12);
  }

  private static byte[] juntar(byte[] a, byte[] b) {
    byte[] r = Arrays.copyOf(a, a.length + b.length);
    System.arraycopy(b, 0, r, a.length, b.length);
    return r;
  }

  private static String hex(byte[] b) {
    StringBuilder sb = new StringBuilder();
    for (byte x : b) sb.append(String.format(Locale.US, "%02x", x & 255));
    return sb.toString();
  }

  private static byte[] deHex(String h) {
    byte[] b = new byte[h.length() / 2];
    for (int i = 0; i < b.length; i++) b[i] = (byte) Integer.parseInt(h.substring(2 * i, 2 * i + 2), 16);
    return b;
  }

  private static String base64(byte[] b) {
    String letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < b.length; i += 3) {
      int n = (b[i] & 255) << 16 | (i + 1 < b.length ? (b[i + 1] & 255) << 8 : 0) | (i + 2 < b.length ? b[i + 2] & 255 : 0);
      sb.append(letras.charAt(n >> 18 & 63)).append(letras.charAt(n >> 12 & 63));
      sb.append(i + 1 < b.length ? letras.charAt(n >> 6 & 63) : '=').append(i + 2 < b.length ? letras.charAt(n & 63) : '=');
    }
    return sb.toString();
  }

  /* X25519 (RFC 7748), escrito aqui para funcionar em qualquer Android */
  private static final BigInteger P = BigInteger.ONE.shiftLeft(255).subtract(BigInteger.valueOf(19));
  private static final BigInteger A24 = BigInteger.valueOf(121665);
  private static final byte[] BASE = new byte[32];
  static { BASE[0] = 9; }

  private static BigInteger numero(byte[] b) {
    byte[] be = new byte[b.length];
    for (int i = 0; i < b.length; i++) be[i] = b[b.length - 1 - i];
    return new BigInteger(1, be);
  }

  static byte[] x25519(byte[] escalar, byte[] u) {
    byte[] k = escalar.clone();
    k[0] &= (byte) 248; k[31] &= 127; k[31] |= 64;
    BigInteger n = numero(k);
    byte[] uu = u.clone();
    uu[31] &= 127;
    BigInteger x1 = numero(uu).mod(P);
    BigInteger x2 = BigInteger.ONE, z2 = BigInteger.ZERO, x3 = x1, z3 = BigInteger.ONE, t;
    boolean troca = false;
    for (int i = 254; i >= 0; i--) {
      boolean bit = n.testBit(i);
      if (troca ^ bit) { t = x2; x2 = x3; x3 = t; t = z2; z2 = z3; z3 = t; }
      troca = bit;
      BigInteger a = x2.add(z2).mod(P), aa = a.multiply(a).mod(P);
      BigInteger b = x2.subtract(z2).mod(P), bb = b.multiply(b).mod(P);
      BigInteger e = aa.subtract(bb).mod(P);
      BigInteger c = x3.add(z3).mod(P), d = x3.subtract(z3).mod(P);
      BigInteger da = d.multiply(a).mod(P), cb = c.multiply(b).mod(P);
      x3 = da.add(cb).mod(P); x3 = x3.multiply(x3).mod(P);
      z3 = da.subtract(cb).mod(P); z3 = x1.multiply(z3.multiply(z3)).mod(P);
      x2 = aa.multiply(bb).mod(P);
      z2 = e.multiply(aa.add(A24.multiply(e))).mod(P);
    }
    if (troca) { t = x2; x2 = x3; x3 = t; t = z2; z2 = z3; z3 = t; }
    BigInteger r = x2.multiply(z2.modPow(P.subtract(BigInteger.valueOf(2)), P)).mod(P);
    byte[] be = r.toByteArray();
    byte[] out = new byte[32];
    for (int i = 0; i < 32 && i < be.length; i++) out[i] = be[be.length - 1 - i];
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Totais do dia para o sistema do escritório (Base44)                 */
  /* O tablet chefe calcula; a central manda pela internet. O endereço e */
  /* o segredo ficam só aqui, não vão para os tablets.                   */
  /* ------------------------------------------------------------------ */

  private final Set<String> enviandoBase44 = Collections.synchronizedSet(new HashSet<>());

  private synchronized JSONObject base44() throws Exception {
    JSONObject b = config.optJSONObject("base44");
    if (b == null) { b = new JSONObject().put("url", "").put("segredo", "").put("enviados", new JSONObject()); config.put("base44", b); }
    if (b.optJSONObject("enviados") == null) b.put("enviados", new JSONObject());
    return b;
  }

  private synchronized JSONObject estadoBase44(boolean completo) throws Exception {
    JSONObject b = base44();
    JSONObject todos = b.optJSONObject("enviados");
    List<String> dias = new ArrayList<>();
    for (Iterator<String> it = todos.keys(); it.hasNext(); ) dias.add(it.next());
    Collections.sort(dias, Collections.reverseOrder());
    JSONObject enviados = new JSONObject();
    for (String d : dias.subList(0, Math.min(15, dias.size()))) {
      JSONObject e = todos.optJSONObject(d);
      if (e == null) continue;
      enviados.put(d, completo ? e : new JSONObject().put("hash", e.optString("hash")).put("ok", e.optBoolean("ok")).put("em", e.optLong("em")).put("erro", e.optString("erro")));
    }
    JSONObject r = new JSONObject().put("ligado", !b.optString("url").isEmpty()).put("temSegredo", !b.optString("segredo").isEmpty())
        .put("desde", b.optString("desde")).put("enviados", enviados);
    if (completo) r.put("url", b.optString("url"));
    return r;
  }

  private void apiBase44(byte[] corpo, OutputStream saida) throws Exception {
    JSONObject pedido = new JSONObject(new String(corpo, StandardCharsets.UTF_8));
    String acao = pedido.optString("acao");
    JSONObject b = base44();
    if ("estado".equals(acao)) { enviarJson(saida, 200, estadoBase44(true)); return; }
    if ("configurar".equals(acao)) {
      String endereco = pedido.optString("url").trim();
      if (!endereco.isEmpty() && !endereco.matches("(?i)https?://[^\\s/]+\\.[^\\s]+") && !endereco.matches("http://127\\.0\\.0\\.1:\\d+/.*")) {
        enviarJson(saida, 400, new JSONObject().put("erro", "Endereço inválido. Ele começa com https://"));
        return;
      }
      synchronized (this) {
        // só os dias depois de ligar vão sozinhos (os anteriores o escritório já lançou à mão)
        if (!endereco.isEmpty() && !endereco.equals(b.optString("url")) && ehDia(pedido.optString("desde"))) b.put("desde", pedido.optString("desde"));
        b.put("url", endereco);
        if (pedido.opt("segredo") instanceof String) { String s = pedido.optString("segredo").trim(); b.put("segredo", s.length() > 200 ? s.substring(0, 200) : s); }
        salvarConfig();
      }
      enviarJson(saida, 200, estadoBase44(true));
      return;
    }
    if ("enviar".equals(acao)) {
      String data = pedido.optString("data");
      JSONObject dados = pedido.optJSONObject("dados");
      if (b.optString("url").isEmpty()) { enviarJson(saida, 400, new JSONObject().put("erro", "O endereço do Base44 não foi cadastrado")); return; }
      if (!ehDia(data) || dados == null) { enviarJson(saida, 400, new JSONObject().put("erro", "dados inválidos")); return; }
      JSONObject antes = b.optJSONObject("enviados").optJSONObject(data);
      if (!pedido.optBoolean("forcar") && antes != null && antes.optBoolean("ok") && antes.optString("hash").equals(pedido.optString("hash"))) {
        enviarJson(saida, 200, new JSONObject().put("ok", true).put("jaEnviado", true));
        return;
      }
      if (!enviandoBase44.add(data)) { enviarJson(saida, 200, new JSONObject().put("ok", false).put("erro", "Já está enviando este dia")); return; }
      int status = 0;
      String erro = "", texto = "";
      try {
        HttpURLConnection con = (HttpURLConnection) new URL(b.optString("url")).openConnection();
        con.setConnectTimeout(15000); con.setReadTimeout(20000);
        con.setRequestMethod("POST"); con.setDoOutput(true);
        con.setRequestProperty("Content-Type", "application/json");
        con.setRequestProperty("X-Pranchetas-Segredo", b.optString("segredo"));
        try (OutputStream o = con.getOutputStream()) { o.write(dados.toString().getBytes(StandardCharsets.UTF_8)); }
        status = con.getResponseCode();
        InputStream resp = status >= 400 ? con.getErrorStream() : con.getInputStream();
        if (resp != null) { texto = new String(lerTudo(resp), StandardCharsets.UTF_8); resp.close(); }
        con.disconnect();
      } catch (java.net.UnknownHostException | java.net.ConnectException e) {
        erro = "Sem internet na central (ou endereço errado)";
      } catch (java.net.SocketTimeoutException e) {
        erro = "O Base44 não respondeu em 20 segundos";
      } catch (Exception e) {
        erro = String.valueOf(e.getMessage());
      } finally { enviandoBase44.remove(data); }
      boolean ok = status >= 200 && status < 300;
      if (!ok && erro.isEmpty()) erro = status == 401 || status == 403 ? "O Base44 recusou o segredo" : "O Base44 respondeu " + status + ": " + (texto.length() > 200 ? texto.substring(0, 200) : texto);
      synchronized (this) {
        JSONObject todos = b.optJSONObject("enviados");
        todos.put(data, new JSONObject().put("hash", pedido.optString("hash")).put("ok", ok).put("em", System.currentTimeMillis()).put("status", status).put("erro", ok ? "" : erro));
        List<String> dias = new ArrayList<>();
        for (Iterator<String> it = todos.keys(); it.hasNext(); ) dias.add(it.next());
        Collections.sort(dias);
        for (int i = 0; i < dias.size() - 60; i++) todos.remove(dias.get(i));
        salvarConfig();
      }
      enviarJson(saida, 200, new JSONObject().put("ok", ok).put("erro", ok ? "" : erro).put("status", status));
      return;
    }
    enviarJson(saida, 400, new JSONObject().put("erro", "ação desconhecida"));
  }
}
