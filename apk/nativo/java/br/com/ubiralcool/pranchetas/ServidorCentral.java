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
  private String configGravada = "{}";
  private final List<String> recuperacoes = new ArrayList<>();
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
    String mime = nome.endsWith(".xml") ? "text/xml" : nome.endsWith(".pdf") ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
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
    for (String texto : recuperacoes) registrar("sistema", texto, "", "", null);
    if (!recuperacoes.isEmpty() && !salvarRegistros()) throw new IOException("Não foi possível registrar a recuperação da central");
    recuperacoes.clear();
    arquivarDiasAntigos();
    socketServidor = new ServerSocket();
    socketServidor.setReuseAddress(true);
    // "pranchetas.ip" só existe nos testes no computador (liga só no próprio computador); no tablet fica em todas as redes
    String ipFixo = System.getProperty("pranchetas.ip");
    socketServidor.bind(ipFixo != null ? new java.net.InetSocketAddress(ipFixo, porta) : new java.net.InetSocketAddress(porta));
    trabalhadores = Executors.newFixedThreadPool(8);
    rodando = true;
    new Thread(this::aceitarConexoes, "servidor-usina").start();
    iniciarNuvem();
  }

  public synchronized void parar() {
    rodando = false;
    try { if (socketServidor != null) socketServidor.close(); } catch (IOException ignorado) { }
    if (trabalhadores != null) trabalhadores.shutdownNow();
    if (relogioNuvem != null) { relogioNuvem.shutdownNow(); relogioNuvem = null; }
  }

  public boolean estaRodando() { return rodando; }

  public synchronized String getChave() { return config == null ? "" : config.optString("chave", ""); }

  public synchronized String getCodigo() { return config == null ? "" : config.optString("codigo", ""); }

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
  public synchronized String novoCodigo() {
    try {
      JSONObject nova = new JSONObject(config.toString());
      nova.put("codigo", sorteiaCodigo()).put("chave", sorteiaChave());
      nova.remove("codigoTrocado"); nova.remove("codigoAnterior"); nova.remove("chaveAnterior");
      salvarArquivo(new File(pastaServidor, "config.json"), nova.toString().getBytes(StandardCharsets.UTF_8));
      config = nova;
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

  private JSONObject lerCentral(File arquivo, byte[] dados) throws Exception {
    JSONObject valor = new JSONObject(new String(dados, StandardCharsets.UTF_8));
    if ("config.json".equals(arquivo.getName())) {
      if (!(valor.opt("chave") instanceof String) || valor.optString("chave").isEmpty()) throw new IOException("Arquivo da central inválido");
    } else {
      Object numero = valor.opt("seq");
      if (!(numero instanceof Number) || ((Number) numero).doubleValue() < 0
          || ((Number) numero).doubleValue() != ((Number) numero).longValue()
          || valor.optJSONObject("registros") == null) throw new IOException("Arquivo da central inválido");
    }
    return valor;
  }

  private JSONObject carregarCentral(File arquivo) throws Exception {
    if (!arquivo.exists()) return null;
    try { return lerCentral(arquivo, lerArquivo(arquivo)); } catch (Exception e) { /* tenta a cópia anterior */ }
    File bak = new File(arquivo.getPath() + ".bak");
    JSONObject copia = null;
    try { copia = lerCentral(arquivo, lerArquivo(bak)); } catch (Exception e) { /* preserva os ilegíveis */ }
    String sufixo = ".ilegivel-" + System.currentTimeMillis() + "-" + sorteiaChave().substring(0, 8);
    // Sem conseguir preservar o original, interrompe a partida em vez de sobrescrevê-lo.
    if (!arquivo.renameTo(new File(arquivo.getPath() + sufixo))) throw new IOException("Não foi possível preservar o arquivo ilegível");
    if (copia != null) salvarArquivo(arquivo, copia.toString().getBytes(StandardCharsets.UTF_8));
    else if (bak.exists() && !bak.renameTo(new File(bak.getPath() + sufixo))) throw new IOException("Não foi possível preservar a cópia ilegível");
    recuperacoes.add(arquivo.getName() + (copia != null ? " recuperado da cópia .bak; original ilegível preservado." : " sem cópia legível; ilegível preservado e arquivo reiniciado."));
    return copia;
  }

  private void carregarConfig() throws Exception {
    File arquivo = new File(pastaServidor, "config.json");
    config = carregarCentral(arquivo);
    if (config == null) {
      config = new JSONObject().put("chave", sorteiaChave()).put("codigo", sorteiaCodigo());
      salvarArquivo(arquivo, config.toString().getBytes(StandardCharsets.UTF_8));
    }
    configGravada = config.toString();
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
    // versão 2.12: o dono e os níveis do tablet chefe
    try { migrarParaNiveis(); } catch (Exception e) { /* segue sem migrar */ }
    // bloqueio guardado antes da revisão existir: ganha uma agora (a nuvem e o aparelho ignoram revisão zero)
    try {
      JSONObject todos = config.optJSONObject("bloqueios");
      boolean migrou = false;
      if (todos != null) for (Iterator<String> it = todos.keys(); it.hasNext(); ) {
        JSONObject b = todos.optJSONObject(it.next());
        if (b != null && b.optLong("rev", 0L) <= 0) { b.put("rev", novaRevisaoDeBloqueio()); migrou = true; }
      }
      if (migrou) salvarConfig();
    } catch (Exception e) { /* segue sem migrar */ }
  }

  private synchronized void salvarConfig() throws Exception {
    try { salvarArquivo(new File(pastaServidor, "config.json"), config.toString().getBytes(StandardCharsets.UTF_8)); }
    catch (Exception e) {
      config = new JSONObject(configGravada);
      throw new IOException("Não foi possível gravar a configuração", e);
    }
  }

  private void carregarRegistros() throws Exception {
    JSONObject salvo = carregarCentral(new File(pastaServidor, "registros.json"));
    seq = salvo == null ? 0 : salvo.getLong("seq");
    registros = salvo == null ? new JSONObject() : salvo.getJSONObject("registros");
  }

  private synchronized boolean salvarRegistros() {
    try {
      JSONObject tudo = new JSONObject();
      tudo.put("seq", seq);
      tudo.put("registros", registros);
      salvarArquivo(new File(pastaServidor, "registros.json"), tudo.toString().getBytes(StandardCharsets.UTF_8));
      return true;
    } catch (Exception e) { return false; }
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
    File arquivo = new File(pastaBackup, data + ".json");
    if (!arquivo.exists()) return new JSONArray();
    try { return new JSONArray(new String(lerArquivo(arquivo), StandardCharsets.UTF_8)); }
    catch (Exception e) { throw new IllegalStateException("Não foi possível ler o dia arquivado", e); }
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
    boolean central = arquivo.equals(new File(pastaServidor, "config.json")) || arquivo.equals(new File(pastaServidor, "registros.json"));
    // a versão anterior vira a .bak sem ser conferida: um arquivo ruim no disco não impede gravar o que está na memória
    if (central && arquivo.exists()) salvarArquivo(new File(arquivo.getPath() + ".bak"), lerArquivo(arquivo));
    // rename do Android substitui o destino sem apagar antes; disponível desde a API 21.
    try { android.system.Os.rename(tmp.getPath(), arquivo.getPath()); }
    catch (android.system.ErrnoException e) { throw new IOException("Não foi possível gravar o arquivo", e); }
    if (central && "config.json".equals(arquivo.getName())) configGravada = new String(dados, StandardCharsets.UTF_8);
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
    try (InputStream entrada = abrirDoApp("/novidades.js")) {
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
      // atualização rápida (versão 2.8): o pacote das telas que este tablet usa (pacote.json, assinatura e arquivos)
      if (caminho.startsWith("/telas/")) { enviarAsset(saida, caminho.substring("/telas".length()), soCabecalho); return; }

      if ("/apk/pranchetas.apk".equals(caminho)) {
        // entrega o próprio aplicativo instalado neste tablet: é exatamente o mesmo app
        File apk = new File(contexto.getPackageCodePath());
        enviarArquivo(saida, apk, "application/vnd.android.package-archive", "pranchetas-ubiralcool.apk", soCabecalho);
        return;
      }

      if (("/relatorios".equals(caminho) || caminho.startsWith("/relatorios/")) && !autorizarRelatorios(cabecalhos, saida)) return;
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
        if ("/api/sync".equals(caminho) && "POST".equals(metodo)) { apiSync(corpo, ip, aparelho, saida); return; }
        if ("/api/registros".equals(caminho)) { apiRegistros(consulta, saida); return; }
        if ("/api/status".equals(caminho)) { apiStatus(saida); return; }
        if ("/api/relatorios".equals(caminho)) { apiRelatorios(saida); return; }
        if ("/api/erros".equals(caminho)) { apiErros(saida); return; }
        if ("/api/zerar".equals(caminho) && "POST".equals(metodo)) {
          if (!podeNoAparelho(aparelho, "ajustes")) { negar(saida, "ajustes"); return; }
          String geracaoAntes = getGeracao();
          apiZerar(corpo, aparelho, saida);
          if (!geracaoAntes.equals(getGeracao())) {
            JSONObject quemZerou = pessoaDoAparelho(aparelho);
            String nomeQuem = quemZerou == null ? "" : quemZerou.optString("nome");
            registrar("configuracao", (nomeQuem.isEmpty() ? "Alguém" : nomeQuem) + " apagou todas as anotações do sistema. A cópia ficou no BackupUsina.", nomeQuem, nomeDoAparelho(aparelho), null);
          }
          return;
        }
        // quem trocou recebe a chave nova dele (a resposta vai embaralhada com a chave antiga)
        if (("/api/novo-codigo".equals(caminho) || "/api/codigo-trocado".equals(caminho)) && "POST".equals(metodo)) {
          apiCodigo(caminho, corpo, aparelho, saida); return;
        }
        if ("/api/base44".equals(caminho) && "POST".equals(metodo)) {
          String acaoBase44 = acaoDoPedido(corpo);
          if ("configurar".equals(acaoBase44) && !podeNoAparelho(aparelho, "integracoes")) { negar(saida, "integracoes"); return; }
          // Envio automático e manual exigem a função da sessão atual.
          if ("enviar".equals(acaoBase44) && !podeNoAparelho(aparelho, "integracoes") && !podeAparelhoSozinho(aparelho, "integracoes")) { negar(saida, "integracoes"); return; }
          apiBase44(corpo, saida);
          return;
        }
        if ("/api/nuvem".equals(caminho) && "POST".equals(metodo)) {
          String acaoNuvem = acaoDoPedido(corpo);
          if (("configurar".equals(acaoNuvem) || "enviar".equals(acaoNuvem)) && !podeNoAparelho(aparelho, "integracoes")) { negar(saida, "integracoes"); return; }
          apiNuvem(corpo, nivelDoAparelho(aparelho) > 0, saida);
          return;
        }
        if ("/api/chefes".equals(caminho) && "POST".equals(metodo)) { apiChefes(corpo, aparelho, saida); return; }
        if ("/api/pessoas".equals(caminho) && "POST".equals(metodo)) { apiPessoas(corpo, aparelho, saida); return; }
        if ("/api/liberar".equals(caminho) && "POST".equals(metodo)) { apiLiberar(corpo, aparelho, saida); return; }
        if ("/api/aparelhos".equals(caminho) && "POST".equals(metodo)) { apiAparelhos(corpo, aparelho, saida); return; }
        if ("/api/registro".equals(caminho)) {
          if (!podeNoAparelho(aparelho, "registro")) { negar(saida, "registro"); return; }
          apiRegistro(consulta, saida);
          return;
        }
        if ("/api/relatorio".equals(caminho) && "POST".equals(metodo)) {
          // Também às 07:05: sem pessoa com Relatórios, aguarda nova tentativa.
          if (!podeNoAparelho(aparelho, "relatorios") && !podeAparelhoSozinho(aparelho, "relatorios")) { negar(saida, "relatorios"); return; }
          apiRelatorio(corpo, saida);
          return;
        }
        if ("/api/relatorio-apagar".equals(caminho) && "POST".equals(metodo)) {
          // apagar relatório: quem tem relatórios, num tablet chefe nível 2 ou 3 (o nível 1 vê, corrige e envia)
          if (!podeNoAparelho(aparelho, "relatorios") || nivelDoAparelho(aparelho) < 2) { negar(saida, "relatorios"); return; }
          apiRelatorioApagar(corpo, saida);
          return;
        }
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

  /** Troca e decisão usam o mesmo bloqueio: dois pedidos não podem substituir a pendência do dono. */
  private synchronized void apiCodigo(String caminho, byte[] corpo, String aparelho, OutputStream saida) throws Exception {
    boolean troca = "/api/novo-codigo".equals(caminho);
    if (troca ? !podeNoAparelho(aparelho, "conexao") : nivelDoAparelho(aparelho) != 3 || !podeNoAparelho(aparelho, "sistema")) {
      negar(saida, troca ? "conexao" : "sistema"); return;
    }
    String quem = pessoaDoAparelho(aparelho).optString("nome");
    String nome = nomeDoAparelho(aparelho);
    JSONObject nova = new JSONObject(config.toString());
    nova.remove("codigoTrocado"); nova.remove("codigoAnterior"); nova.remove("chaveAnterior");
    String texto;
    if (troca) {
      boolean protegido = nivelDoAparelho(aparelho) != 3 && temAparelhoNivel3();
      if (protegido && config.has("codigoTrocado")) { enviarJson(saida, 409, new JSONObject().put("erro", "O dono precisa resolver a troca de código pendente")); return; }
      nova.put("codigo", sorteiaCodigo()).put("chave", sorteiaChave());
      if (protegido) {
        nova.put("codigoAnterior", getCodigo()).put("chaveAnterior", getChave());
        nova.put("codigoTrocado", new JSONObject().put("id", sorteiaChave().substring(0, 24)).put("em", System.currentTimeMillis()).put("quem", quem).put("aparelho", nome));
      }
      texto = quem + " trocou o código de conexão." + (protegido ? " Aguarda a decisão do dono; os aparelhos nível 3 continuam conectados." : " Os outros aparelhos precisam conectar de novo.");
    } else {
      JSONObject pedido = new JSONObject(new String(corpo, StandardCharsets.UTF_8));
      String acao = pedido.optString("acao");
      if (!(pedido.opt("id") instanceof String) || !("manter".equals(acao) || "voltar".equals(acao))) { enviarJson(saida, 400, new JSONObject().put("erro", "ação inválida")); return; }
      JSONObject pendente = config.optJSONObject("codigoTrocado");
      if (pendente == null || !pedido.optString("id").equals(pendente.optString("id"))) { enviarJson(saida, 409, new JSONObject().put("erro", "Troca de código não está mais pendente")); return; }
      if ("voltar".equals(acao)) nova.put("codigo", config.getString("codigoAnterior")).put("chave", config.getString("chaveAnterior"));
      texto = quem + ("manter".equals(acao) ? " manteve o novo código de conexão." : " restaurou o código de conexão anterior.");
    }
    // Só passa a usar a chave depois de gravar; falha de disco não confirma a troca.
    salvarArquivo(new File(pastaServidor, "config.json"), nova.toString().getBytes(StandardCharsets.UTF_8));
    config = nova;
    registrar("configuracao", texto, quem, nome, null);
    boolean registroPendente = !salvarRegistros();
    JSONObject resposta = new JSONObject().put("chave", hex(chaveDoAparelho(aparelho)));
    // A chave já foi gravada: mesmo se o registro falhar, o aparelho precisa recebê-la.
    if (registroPendente) resposta.put("registroPendente", true);
    if (troca) resposta.put("codigo", getCodigo());
    enviarJson(saida, 200, resposta);
  }

  private void apiSync(byte[] corpo, String ip, String idCifrado, OutputStream saida) throws Exception {
    JSONObject resultado = sincronizar(new JSONObject(new String(corpo, StandardCharsets.UTF_8)), ip, idCifrado);
    resultado.put("atualizacao", atualizacaoDisponivel());
    enviarJson(saida, "bloqueado".equals(resultado.optString("erro")) ? 423 : 200, resultado);
  }

  /** O sync local e a fila usam a mesma autorização, revisão e gravação. */
  private synchronized JSONObject sincronizar(JSONObject pedido, String ip, String idCifrado) throws Exception {
    JSONObject bloqueio = bloqueios().optJSONObject(idCifrado);
    if (bloqueio != null) return new JSONObject().put("erro", "bloqueado").put("bloqueio", bloqueioPublico(bloqueio)).put("geracao", getGeracao());
    guardarSetor(idCifrado, pedido.optString("papel"));
    String aparelho = pedido.optString("aparelho").isEmpty() ? "" : idCifrado;
    JSONObject antesDoAparelho = aparelho.isEmpty() ? null : aparelhos.get(aparelho);
    if (!aparelho.isEmpty()) {
      String nomeDele = pedido.optString("nome");
      aparelhos.put(aparelho, new JSONObject()
          .put("papel", pedido.optString("papel"))
          .put("nome", nomeDele.length() > 60 ? nomeDele.substring(0, 60) : nomeDele)
          .put("operador", pedido.optString("operador"))
          .put("versao", pedido.optString("versao"))
          .put("vistoEm", System.currentTimeMillis())
          .put("ip", ip));
      JSONObject info = infoLimpa(pedido.optJSONObject("info"));
      if (info != null) aparelhos.get(aparelho).put("info", info);
    }
    if (!aparelho.isEmpty()) eventosDoAparelho(aparelho, antesDoAparelho, pedido);
    guardarErros(aparelho, pedido.optJSONArray("erros"), ip);
    String geracaoDele = pedido.optString("geracao", "");
    if (!geracaoDele.isEmpty() && !geracaoDele.equals(getGeracao())) {
      // aparelho com anotações de antes de zerar: não aceita, manda ele limpar.
      // Aparelho que acabou de conectar numa central nova (tablet chefe trocado ou reinstalado): aceita o que ele tem.
      if (geracaoZerada(geracaoDele) || !pedido.optBoolean("novaConexao")) {
        return new JSONObject().put("ok", false).put("zerar", true).put("geracao", getGeracao()).put("seq", seq).put("agora", System.currentTimeMillis())
            .put("codigoTrocado", nivelDoAparelho(idCifrado) == 3 ? config.optJSONObject("codigoTrocado") : null);
      }
    }
    if (System.currentTimeMillis() - ultimoArquivamento > 3600000L) arquivarDiasAntigos();
    JSONArray chegaram = pedido.optJSONArray("registros");
    int aceitos = 0;
    // o que a central não aceitou (versão 2.12): o aparelho não marca como enviado e mostra o motivo
    JSONArray recusados = new JSONArray();
    JSONObject revs = new JSONObject();
    int nivelAqui = nivelDoAparelho(idCifrado);
    List<String> dias = new ArrayList<>();
    Map<String, List<JSONObject>> antigos = new HashMap<>();
    Map<String, Map<String, JSONObject>> lidosDoArquivo = new HashMap<>();
    if (chegaram != null) {
      for (int i = 0; i < chegaram.length(); i++) {
        JSONObject r = chegaram.optJSONObject(i);
        if (r == null || r.optString("id").isEmpty() || !r.has("atualizadoEm")) continue;
        String data = r.optString("data");
        String prancheta = r.optString("prancheta");
        // o id diz o que a anotação é (dia|folha|linha): com outro id, uma anotação poderia passar por configuração
        if (!r.optString("id").equals(data + "|" + prancheta + "|" + r.optString("chave")) || !("config".equals(data) || ehDia(data))) {
          recusados.put(new JSONObject().put("id", r.optString("id")).put("motivo", "invalido"));
          continue;
        }
        boolean doArquivo = arquivado(data);
        // a anotação guardada: na memória ou, de dia antigo, no BackupUsina
        JSONObject atual = registros.optJSONObject(r.getString("id"));
        if (atual == null && doArquivo) atual = guardadaNoArquivo(lidosDoArquivo, data, r.getString("id"));
        if ("config".equals(data)) {
          // configuração da usina: confere quem pode mudar cada parte, e o conflito
          Object[] d = decidirConfig(atual, r, idCifrado);
          if (!(Boolean) d[0]) { recusados.put(new JSONObject().put("id", r.optString("id")).put("motivo", d[2]).put("atual", atual == null ? JSONObject.NULL : atual)); continue; }
          r = (JSONObject) d[1];
          revs.put(r.optString("id"), r.optLong("rev"));
        } else if ("rastreamento".equals(prancheta)) {
          Set<String> f = nivelAqui > 0 ? funcoesNoAparelho(idCifrado) : funcoesNoSetor(idCifrado);
          if (!f.contains("escritorio")) { recusados.put(new JSONObject().put("id", r.optString("id")).put("motivo", "sem_permissao")); continue; }
        } else if (nivelAqui > 0 && !"registro".equals(prancheta) && !"avisos-recibo".equals(prancheta)) {
          // tablet chefe: a função de quem está dentro (a mesma que a tela pede)
          String motivo = motivoNoChefe(idCifrado, prancheta);
          if (!motivo.isEmpty()) { recusados.put(new JSONObject().put("id", r.optString("id")).put("motivo", motivo)); continue; }
        } else if ("avisos".equals(prancheta)) {
          // aviso só sai do tablet chefe
          recusados.put(new JSONObject().put("id", r.optString("id")).put("motivo", "sem_permissao"));
          continue;
        }
        if (nivelAqui == 0 && !"config".equals(data) && !podeFolhaNoSetor(idCifrado, r)) {
          recusados.put(new JSONObject().put("id", r.optString("id")).put("motivo", "sem_permissao")); continue;
        }
        // tablet de setor não muda os campos que são só do escritório (NF, lote, validade...), nem de dia antigo
        if (nivelAqui == 0 && r.optJSONObject("valores") != null) {
          List<String> soEscritorio = camposSoDoEscritorio(prancheta);
          if (!soEscritorio.isEmpty()) {
            JSONObject valores = r.optJSONObject("valores");
            JSONObject guardados = atual == null ? null : atual.optJSONObject("valores");
            for (String c : soEscritorio) { if (guardados != null && guardados.has(c)) valores.put(c, guardados.opt(c)); else valores.remove(c); }
          }
        }
        // dia que só está no BackupUsina: junta lá (depois de conferido como os outros)
        if ("rastreamento".equals(prancheta) && nivelAqui == 0 && liberadosNoSetor.containsKey(idCifrado)) liberadosNoSetor.get(idCifrado)[1] = System.currentTimeMillis() + LIBERADO_NO_SETOR_MS;
        if (doArquivo) {
          r.remove("sincronizado");
          r.put("recebidoEm", System.currentTimeMillis());
          List<JSONObject> lista = antigos.get(data);
          if (lista == null) { lista = new ArrayList<>(); antigos.put(data, lista); }
          lista.add(r);
          continue;
        }
        JSONObject entrada = !"config".equals(data) && criadasSemSaber(atual, r) ? juntarLinhas(atual, r) : r;
        // a configuração já foi conferida pela revisão (o relógio do aparelho não decide)
        if (atual == null || entrada != r || r.optLong("atualizadoEm") >= atual.optLong("atualizadoEm") || "config".equals(r.optString("data"))) {
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
      if (n < 0) throw new IOException("Não foi possível gravar o dia arquivado");
      if (n > 0) aceitos += n;
    }
    if (aceitos > 0) {
      if (!salvarRegistros()) throw new IOException("Não foi possível gravar as anotações na central");
      for (String dia : dias) backupDoDia(dia);
      agendarNuvem();
    }
    // o endereço da nuvem vai junto: longe da usina, o aparelho pergunta lá se foi bloqueado
    // bloqueiosRev: "não está bloqueado até esta revisão" (resposta atrasada da nuvem com bloqueio mais velho não trava).
    // Confere o bloqueio junto com a revisão (apiSync é synchronized): bloqueado no meio do caminho responde como bloqueado.
    JSONObject blq = idCifrado == null || idCifrado.isEmpty() ? null : bloqueios().optJSONObject(idCifrado);
    if (blq != null) return new JSONObject().put("erro", "bloqueado").put("bloqueio", bloqueioPublico(blq)).put("geracao", getGeracao());
    long bloqueiosRev = config.optLong("bloqueiosRev", 0L);
    return new JSONObject().put("ok", true).put("aceitos", aceitos).put("recusados", recusados).put("revs", revs).put("seq", seq).put("agora", System.currentTimeMillis()).put("geracao", getGeracao())
        .put("nuvem", nuvem().optString("url")).put("nuvemToken", tokenNuvem(idCifrado)).put("bloqueiosRev", bloqueiosRev)
        .put("codigoTrocado", nivelAqui == 3 ? config.optJSONObject("codigoTrocado") : null);
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
      JSONArray semRegistro = new JSONArray();
      for (int i = 0; i < lista.length(); i++) { JSONObject r = lista.optJSONObject(i); if (r != null && !"registro".equals(r.optString("prancheta"))) semRegistro.put(r); }
      enviarJson(saida, 200, new JSONObject().put("seq", seq).put("geracao", getGeracao()).put("registros", semRegistro));
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
      // o registro do sistema não vai (o tablet chefe pede o dia quando abre o registro)
      if ("registro".equals(pr)) continue;
      if (!filtrar || !ehDia(d) || d.compareTo(aPartirDe) >= 0 || "avisos".equals(pr) || "avisos-recibo".equals(pr) || "fermentacao".equals(pr)) lista.put(r);
    }
    enviarJson(saida, 200, new JSONObject().put("seq", seq).put("geracao", getGeracao()).put("registros", lista));
  }

  private synchronized void apiStatus(OutputStream saida) throws Exception {
    JSONArray lista = listaDeAparelhos();
    JSONArray ends = new JSONArray();
    for (String e : enderecos()) ends.put(e);
    String docs = Build.VERSION.SDK_INT >= 29 ? "Documentos/Usina/" : "";
    enviarJson(saida, 200, new JSONObject()
        .put("seq", seq).put("total", registros.length())
        .put("codigo", getCodigo()).put("enderecos", ends).put("apk", true).put("base44", estadoBase44(false)).put("nuvem", estadoNuvem())
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
  // O escritório usa o login cifrado já existente. O cookie só dá leitura por 30 minutos.
  private static final String COOKIE_RELATORIOS = "usina_relatorios";
  private synchronized String cookieRelatorios(String aparelho, String acao) throws Exception {
    if (!Arrays.asList("entrar", "quem", "sair").contains(acao)) return "";
    JSONObject s = objetoDaConfig("sessoes").optJSONObject(aparelho);
    boolean permitido = !"sair".equals(acao) && podeNoAparelho(aparelho, "relatorios");
    String payload = permitido ? hex(new JSONObject().put("aparelho", aparelho).put("pessoaId", s.getString("pessoaId")).put("em", s.getLong("em"))
        .put("ate", System.currentTimeMillis() + 30 * 60000L).toString().getBytes(StandardCharsets.UTF_8)) : "";
    String token = permitido ? payload + "." + hex(hmac(getChave().getBytes(StandardCharsets.UTF_8), "relatorios|" + payload)) : "";
    return COOKIE_RELATORIOS + "=" + token + "; Path=/relatorios; HttpOnly; SameSite=Strict; Max-Age=" + (permitido ? 1800 : 0);
  }

  private synchronized boolean autorizarRelatorios(Map<String, String> cabecalhos, OutputStream saida) throws Exception {
    String token = "";
    for (String parte : cabecalhos.getOrDefault("cookie", "").split(";")) {
      if (parte.trim().startsWith(COOKIE_RELATORIOS + "=")) { token = parte.trim().substring(COOKIE_RELATORIOS.length() + 1); break; }
    }
    if (token.matches("[a-f0-9]{2,2048}\\.[a-f0-9]{64}")) {
      String[] partes = token.split("\\.");
      if (MessageDigest.isEqual(hmac(getChave().getBytes(StandardCharsets.UTF_8), "relatorios|" + partes[0]), deHex(partes[1]))) {
        try {
          JSONObject t = new JSONObject(new String(deHex(partes[0]), StandardCharsets.UTF_8));
          String aparelho = t.optString("aparelho");
          JSONObject s = objetoDaConfig("sessoes").optJSONObject(aparelho);
          if (t.optLong("ate") > System.currentTimeMillis() && s != null && s.optString("pessoaId").equals(t.optString("pessoaId")) && s.optLong("em") == t.optLong("em")
              && !bloqueios().has(aparelho) && podeNoAparelho(aparelho, "relatorios")) return true;
        } catch (Exception ignorado) { /* cookie inválido */ }
      }
    }
    enviarTexto(saida, 401, "Abra / neste navegador, conecte este computador como tablet chefe e entre com a senha de quem tem Relatórios. Depois volte a /relatorios.");
    return false;
  }

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

  /** Zera as anotações de teste: guarda uma cópia em BackupUsina e apaga tudo, menos a configuração da usina.
      A senha (conta demorada de propósito) é conferida antes de travar a central. */
  private void apiZerar(byte[] corpo, String aparelho, OutputStream saida) throws Exception {
    JSONObject pedido = new JSONObject(new String(corpo, StandardCharsets.UTF_8));
    if (!"ZERAR".equals(pedido.optString("confirmar"))) { enviarJson(saida, 400, new JSONObject().put("erro", "faltou confirmar")); return; }
    if (!podeTentarProgramador(aparelho)) { enviarJson(saida, 429, new JSONObject().put("erro", "Muitas senhas erradas. Espere um minuto.")); return; }
    if (!senhaDoProgramador(pedido.optString("senha"))) { errouProgramador(aparelho); enviarJson(saida, 403, new JSONObject().put("erro", "senha do programador errada")); return; }
    zerarAgora(saida);
  }

  private synchronized void zerarAgora(OutputStream saida) throws Exception {
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

  /** Só a senha do programador apaga todos os dados do sistema. Fica guardado só o resumo dela, com PBKDF2 (600 mil
      voltas e sal, versão 2.12): quem abre o APK não descobre a senha testando todas as combinações. */
  private static final String HASH_PROGRAMADOR = System.getProperty("pranchetas.senhaProgramadorHash", "pbkdf2$600000$d31d016c4915ed1a459748361e6a081e$0041ccba04c2a9ff6534039b939944d9c111263af11791b1a2fab519ed3f6e2c");

  private static boolean senhaDoProgramador(String senha) {
    try {
      String[] p = HASH_PROGRAMADOR.split("\\$");
      if (p.length != 4 || !"pbkdf2".equals(p[0]) || senha == null || senha.isEmpty()) return false;
      return MessageDigest.isEqual(pbkdf2Sha256(senha, deHex(p[2]), Integer.parseInt(p[1])), deHex(p[3]));
    } catch (Exception e) {
      return false;
    }
  }

  /** PBKDF2-HMAC-SHA256 com 32 bytes de saída (um bloco), feito com Mac: funciona em qualquer Android. */
  private static byte[] pbkdf2Sha256(String senha, byte[] sal, int voltas) throws Exception {
    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec(senha.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
    mac.update(sal);
    mac.update(new byte[] { 0, 0, 0, 1 });
    byte[] u = mac.doFinal();
    byte[] t = u.clone();
    for (int i = 1; i < voltas; i++) {
      u = mac.doFinal(u);
      for (int j = 0; j < t.length; j++) t[j] ^= u[j];
    }
    return t;
  }

  /** Cinco senhas do programador erradas em um minuto, por aparelho: espera um minuto. */
  private final Map<String, List<Long>> tentativasProgramador = new HashMap<>();

  private boolean podeTentarProgramador(String aparelho) {
    synchronized (tentativasProgramador) {
      List<Long> t = tentativasProgramador.get(aparelho);
      if (t == null) return true;
      long agora = System.currentTimeMillis();
      Iterator<Long> it = t.iterator();
      while (it.hasNext()) if (agora - it.next() >= 60000L) it.remove();
      return t.size() < 5;
    }
  }

  private void errouProgramador(String aparelho) {
    synchronized (tentativasProgramador) {
      List<Long> t = tentativasProgramador.get(aparelho);
      if (t == null) { t = new ArrayList<>(); tentativasProgramador.put(aparelho, t); }
      t.add(System.currentTimeMillis());
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

  /** As telas que este tablet usa: as da última atualização rápida (se forem deste APK) ou as que vieram no APK. */
  private File telasAtivas() {
    try {
      String apk = contexto.getPackageManager().getPackageInfo(contexto.getPackageName(), 0).versionName;
      return AtualizadorDeTelas.pastaAtiva(new File(contexto.getFilesDir(), "telas"), apk);
    } catch (Exception e) {
      return null;
    }
  }

  private JSONObject infoDasTelas(JSONObject p) throws Exception {
    String formato = "\\d{1,2}\\.\\d{1,2}(\\.\\d{1,2})?";
    if (p == null || !(p.opt("versao") instanceof String) || !(p.opt("apkMinimo") instanceof String) || !p.optString("versao").matches(formato) || !p.optString("apkMinimo").matches(formato)) return null;
    return new JSONObject().put("versao", p.getString("versao")).put("apkMinimo", p.getString("apkMinimo"));
  }

  private synchronized Object atualizacaoDisponivel() throws Exception {
    JSONObject local = null;
    try (InputStream entrada = abrirDoApp("/pacote.json")) {
      local = infoDasTelas(new JSONObject(new String(lerTudo(entrada), StandardCharsets.UTF_8)));
    } catch (Exception ignorado) { }
    JSONObject online = infoDasTelas(nuvem().optJSONObject("telas"));
    if (online != null && (local == null || AtualizadorDeTelas.numero(online.optString("versao")) > AtualizadorDeTelas.numero(local.optString("versao")))) return online;
    return local == null ? JSONObject.NULL : local;
  }

  /** Um arquivo das telas (rel começa com /). */
  private InputStream abrirDoApp(String rel) throws IOException {
    File pasta = telasAtivas();
    if (pasta != null) {
      File f = new File(pasta, rel.substring(1));
      if (f.isFile() && f.getCanonicalPath().startsWith(pasta.getCanonicalPath())) return new FileInputStream(f);
    }
    return contexto.getAssets().open("public" + rel);
  }

  private void enviarAsset(OutputStream saida, String caminho, boolean soCabecalho) throws IOException {
    String rel = caminho;
    if (rel.equals("/") || rel.isEmpty()) rel = "/index.html";
    if (rel.equals("/baixar")) rel = "/baixar.html";
    rel = rel.replace("..", "");
    try (InputStream entrada = abrirDoApp(rel)) {
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
      synchronized (this) {
        if (nivelDoAparelho(quem) != 3 || !config.has("codigoTrocado") || config.optString("chaveAnterior").isEmpty()) {
          enviarJson(saida, 401, new JSONObject().put("erro", "Aparelho não conectado à central")); return;
        }
        chave = hmac(config.optString("chaveAnterior").getBytes(StandardCharsets.UTF_8), "aparelho|" + quem);
      }
      try { texto = new String(abrir(chave, pacote, ("pedido|" + quem).getBytes(StandardCharsets.UTF_8)), StandardCharsets.UTF_8); } catch (Exception anterior) {
        enviarJson(saida, 401, new JSONObject().put("erro", "Aparelho não conectado à central")); return;
      }
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
    JSONObject bloqueio;
    synchronized (this) { bloqueio = bloqueios().optJSONObject(quem); }
    if (bloqueio != null && !c.matches("api/liberar(\\?.*)?")) {
      // aparelho bloqueado pelo administrador: só consegue tentar se liberar com a senha
      avisarBloqueado(quem);
      // com a geração: se o aparelho acabou de trocar de central, ele sabe que a revisão dos bloqueios recomeçou
      enviarJson(captura, 423, new JSONObject().put("erro", "bloqueado").put("bloqueio", bloqueioPublico(bloqueio)).put("geracao", getGeracao()));
    } else {
      responder("POST".equals(cab.optString("m")) ? "POST" : "GET", "/" + c, new HashMap<>(), texto.substring(nl + 1).getBytes(StandardCharsets.UTF_8), ip, captura, false, true, quem);
    }
    // a resposta gravada: situação na primeira linha, corpo depois da linha em branco
    byte[] bruto = captura.toByteArray();
    int fimLinha = 0, fimCab = 0;
    while (fimLinha < bruto.length && bruto[fimLinha] != '\r') fimLinha++;
    for (int i = 0; i + 3 < bruto.length; i++) if (bruto[i] == '\r' && bruto[i + 1] == '\n' && bruto[i + 2] == '\r' && bruto[i + 3] == '\n') { fimCab = i + 4; break; }
    String situacao = new String(bruto, 0, fimLinha, StandardCharsets.UTF_8).split(" ")[1];
    byte[] plano = juntar((situacao + "\n").getBytes(StandardCharsets.UTF_8), Arrays.copyOfRange(bruto, fimCab, bruto.length));
    String cookie = "200".equals(situacao) && "api/pessoas".equals(c.split("\\?")[0])
        ? cookieRelatorios(quem, new JSONObject(texto.substring(nl + 1)).optString("acao")) : "";
    byte[] resposta = selar(chave, plano, juntar("resposta|".getBytes(StandardCharsets.UTF_8), iv));
    String cabResposta = cabecalho(200, "application/octet-stream", resposta.length, null).toString();
    if (!cookie.isEmpty()) cabResposta = cabResposta.replace("Connection: close", "Set-Cookie: " + cookie + "\r\nConnection: close");
    saida.write(cabResposta.getBytes(StandardCharsets.UTF_8)); saida.write(resposta); saida.flush();
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
  /* ------------------------------------------------------------------ */
  /* Nuvem das Pranchetas (versão 2.8): uma cópia das anotações na       */
  /* internet. A central manda o que mudou de minuto em minuto. Lá ficam */
  /* a API de leitura do escritório e as atualizações do aplicativo.     */
  /* A usina continua funcionando sem internet: a nuvem é só uma cópia.  */
  /* ------------------------------------------------------------------ */

  private static final int NUVEM_LOTE = 150; // o plano grátis da nuvem dá 10 ms de processamento por pedido
  private final java.util.concurrent.atomic.AtomicBoolean enviandoNuvem = new java.util.concurrent.atomic.AtomicBoolean(false);
  private java.util.concurrent.ScheduledExecutorService relogioNuvem;

  private synchronized JSONObject nuvem() throws Exception {
    JSONObject n = config.optJSONObject("nuvem");
    if (n == null) { n = new JSONObject().put("url", "").put("segredo", "").put("seq", 0L); config.put("nuvem", n); }
    return n;
  }

  private synchronized JSONObject estadoNuvem() throws Exception {
    JSONObject n = nuvem();
    boolean ligada = !n.optString("url").isEmpty() && !n.optString("segredo").isEmpty();
    return new JSONObject().put("ligada", ligada).put("url", n.optString("url")).put("temSegredo", !n.optString("segredo").isEmpty())
        .put("ultimoEnvio", n.optLong("ultimoEnvio")).put("erro", n.optString("erro")).put("faltam", n.optLong("faltam"));
  }

  private void iniciarNuvem() {
    if (relogioNuvem != null) return;
    relogioNuvem = java.util.concurrent.Executors.newSingleThreadScheduledExecutor();
    relogioNuvem.scheduleWithFixedDelay(this::enviarParaNuvem, Long.getLong("pranchetas.nuvemEspera", 15000L), 60000L, java.util.concurrent.TimeUnit.MILLISECONDS);
    // registro: aparelho que parou de falar com a central
    long passo = Math.min(15000L, SEM_SINAL_MS / 2);
    relogioNuvem.scheduleWithFixedDelay(this::conferirSemSinal, passo, passo, java.util.concurrent.TimeUnit.MILLISECONDS);
  }

  /** Chegou anotação nova: manda para a nuvem daqui a pouco. */
  private void agendarNuvem() {
    try { if (relogioNuvem != null) relogioNuvem.schedule(this::enviarParaNuvem, 5, java.util.concurrent.TimeUnit.SECONDS); } catch (Exception ignorado) { }
  }

  private static boolean publica(JSONObject r) {
    String p = r.optString("prancheta");
    return ehDia(r.optString("data")) && !"avisos".equals(p) && !"avisos-recibo".equals(p) && !"registro".equals(p); // igual ao api-leitura.js: o registro do sistema fica só na central
  }

  private static void juntarPendente(Map<String, JSONObject> mapa, JSONObject r, long desde) {
    if (r == null || !ehDia(r.optString("data")) || "registro".equals(r.optString("prancheta")) || r.optLong("seq") <= desde) return;
    JSONObject a = mapa.get(r.optString("id"));
    if (a == null || r.optLong("seq") > a.optLong("seq")) mapa.put(r.optString("id"), r);
  }

  /** O que falta mandar, em ordem (na primeira vez, também os dias do BackupUsina). */
  private synchronized List<JSONObject> pendentesNuvem(JSONObject n) {
    long desde = n.optLong("seq");
    Map<String, JSONObject> mapa = new HashMap<>();
    if (!n.optBoolean("arquivosEnviados")) {
      File[] arquivos = pastaBackup.listFiles();
      if (arquivos != null) for (File f : arquivos) {
        String nome = f.getName();
        if (!nome.matches("\\d{4}-\\d{2}-\\d{2}\\.json") || !arquivado(nome.substring(0, 10))) continue;
        JSONArray doDia = lerDiaArquivado(nome.substring(0, 10));
        for (int i = 0; i < doDia.length(); i++) juntarPendente(mapa, doDia.optJSONObject(i), desde);
      }
    }
    for (Iterator<String> it = registros.keys(); it.hasNext(); ) juntarPendente(mapa, registros.optJSONObject(it.next()), desde);
    List<JSONObject> lista = new ArrayList<>(mapa.values());
    Collections.sort(lista, (a, b) -> Long.compare(a.optLong("seq"), b.optLong("seq")));
    return lista;
  }

  /** As medidas das dornas trocadas pelo escritório (ou nada: valem as da planilha). */
  private synchronized Object medidasDoEscritorio() {
    JSONObject c = registros.optJSONObject("config|sistema|geral");
    JSONObject v = c == null || c.optBoolean("apagado") ? null : c.optJSONObject("valores");
    JSONObject m = v == null ? null : v.optJSONObject("medicao");
    return m == null ? JSONObject.NULL : m;
  }

  private static String resumo(String texto) {
    try { return hex(MessageDigest.getInstance("SHA-256").digest(texto.getBytes(StandardCharsets.UTF_8))).substring(0, 16); }
    catch (Exception e) { return ""; }
  }

  /** Pedido para a nuvem: devolve o código da resposta (0 = sem conexão) e o texto. */
  private static Object[] pedirNuvem(String url, String segredo, String caminho, JSONObject corpo) {
    try {
      HttpURLConnection con = (HttpURLConnection) new URL(url.replaceAll("/+$", "") + "/" + caminho).openConnection();
      con.setConnectTimeout(15000); con.setReadTimeout(30000);
      con.setRequestProperty("Authorization", "Bearer " + segredo);
      if (corpo != null) {
        con.setRequestMethod("POST"); con.setDoOutput(true);
        con.setRequestProperty("Content-Type", "application/json");
        try (OutputStream o = con.getOutputStream()) { o.write(corpo.toString().getBytes(StandardCharsets.UTF_8)); }
      }
      int status = con.getResponseCode();
      InputStream resp = status >= 400 ? con.getErrorStream() : con.getInputStream();
      String texto = "";
      if (resp != null) { texto = new String(lerTudo(resp), StandardCharsets.UTF_8); resp.close(); }
      con.disconnect();
      return new Object[] { status, texto };
    } catch (java.net.UnknownHostException | java.net.ConnectException e) {
      return new Object[] { 0, "Sem internet na central (ou endereço errado)" };
    } catch (java.net.SocketTimeoutException e) {
      return new Object[] { 0, "A nuvem não respondeu em 30 segundos" };
    } catch (Exception e) {
      return new Object[] { 0, String.valueOf(e.getMessage()) };
    }
  }

  private static String erroDaNuvem(Object[] r) {
    int status = (Integer) r[0];
    String texto = (String) r[1];
    if (status == 0) return texto;
    if (status == 401) return "A nuvem recusou a senha da central";
    String e = texto;
    try { e = new JSONObject(texto).optString("erro", texto); } catch (Exception ignorado) { }
    return "A nuvem respondeu " + status + ": " + (e.length() > 200 ? e.substring(0, 200) : e);
  }

  private synchronized String tokenNuvem(String aparelho) throws Exception {
    JSONObject n = nuvem();
    return n.optString("url").isEmpty() || n.optString("segredo").isEmpty() ? "" : hex(hmac(n.optString("segredo").getBytes(StandardCharsets.UTF_8), "aparelho|" + aparelho));
  }

  /** Desfaz a versão recusada, com horário maior para corrigir quem já a baixou. */
  private synchronized void corrigirRecusaNuvem(JSONObject r) throws Exception {
    String data = r.optString("data"), id = r.optString("id");
    if (!ehDia(data) || "registro".equals(r.optString("prancheta"))) return;
    JSONObject atual = registros.optJSONObject(id);
    if (atual == null && arquivado(data)) {
      JSONArray dia = lerDiaArquivado(data);
      for (int i = 0; i < dia.length(); i++) {
        JSONObject salvo = dia.optJSONObject(i);
        if (salvo != null && id.equals(salvo.optString("id"))) { atual = salvo; break; }
      }
    }
    JSONObject correcao = atual == null
      ? new JSONObject().put("id", id).put("data", data).put("prancheta", r.optString("prancheta")).put("chave", r.optString("chave")).put("valores", new JSONObject()).put("apagado", true)
      : new JSONObject(atual.toString());
    correcao.put("atualizadoEm", Math.max(System.currentTimeMillis(), Math.max(correcao.optLong("atualizadoEm"), r.optLong("atualizadoEm"))) + 1)
      .put("seq", ++seq).put("recebidoEm", System.currentTimeMillis());
    correcao.remove("sincronizado");
    registros.put(id, correcao);
    if (arquivado(data)) {
      if (juntarNoArquivo(data, Collections.singletonList(correcao)) < 0) throw new IOException("Não foi possível gravar a correção arquivada");
      nuvem().put("arquivosEnviados", false);
    } else backupDoDia(data);
  }

  /** Confirma só a versão lida, sem apagar um envio mais novo que chegou no meio. */
  private void puxarFilaNuvem(String url, String segredo) throws Exception {
    Object[] r = pedirNuvem(url, segredo, "fila", null);
    if ((Integer) r[0] != 200) throw new Exception(erroDaNuvem(r));
    JSONArray fila = new JSONObject((String) r[1]).getJSONArray("itens");
    JSONArray itens = new JSONArray();
    for (int i = 0; i < fila.length(); i++) {
      JSONObject item = fila.optJSONObject(i), registro = item.getJSONObject("registro");
      String aparelho = item.getString("aparelho");
      // sincronizar altera o JSONObject aceito; guarde a versão original para confirmar.
      long atualizadoEm = registro.optLong("atualizadoEm");
      JSONObject resultado = sincronizar(new JSONObject().put("registros", new JSONArray().put(registro)).put("geracao", item.optString("geracao")), "nuvem", aparelho);
      JSONArray recusas = resultado.optJSONArray("recusados");
      if (recusas == null) recusas = new JSONArray();
      if (resultado.has("erro") || resultado.optBoolean("zerar")) recusas.put(new JSONObject().put("id", registro.optString("id")).put("motivo", resultado.optString("erro", "geracao")));
      for (int k = 0; k < recusas.length(); k++) {
        JSONObject recusa = recusas.optJSONObject(k);
        registrar("nuvem", "Fila recusada: " + recusa.optString("id") + " (" + recusa.optString("motivo") + ")", "", nomeDoAparelho(aparelho), null);
      }
      if (recusas.length() > 0) corrigirRecusaNuvem(registro);
      itens.put(new JSONObject().put("aparelho", aparelho).put("id", registro.optString("id")).put("atualizadoEm", atualizadoEm));
    }
    if (itens.length() > 0) {
      if (!salvarRegistros()) throw new IOException("Não foi possível gravar a fila na central");
      Object[] c = pedirNuvem(url, segredo, "fila/confirmar", new JSONObject().put("itens", itens));
      if ((Integer) c[0] != 200) throw new Exception(erroDaNuvem(c));
    }
  }

  /** Manda para a nuvem o que mudou depois do último envio. */
  void enviarParaNuvem() {
    if (!enviandoNuvem.compareAndSet(false, true)) return;
    try {
      JSONObject n;
      String url, segredo;
      synchronized (this) { n = nuvem(); url = n.optString("url"); segredo = n.optString("segredo"); }
      if (url.isEmpty() || segredo.isEmpty()) return;
      try {
        puxarFilaNuvem(url, segredo);
        if (!n.optBoolean("conferida")) {
          // na primeira vez (ou se a nuvem foi trocada ou zerada), confere até onde ela tem
          Object[] e = pedirNuvem(url, segredo, "central/estado", null);
          if ((Integer) e[0] != 200) throw new Exception(erroDaNuvem(e));
          JSONObject j = new JSONObject((String) e[1]);
          synchronized (this) {
            if (!getGeracao().equals(j.optString("geracao")) || j.optLong("registros") == 0) {
              n.put("seq", 0L).put("arquivosEnviados", false).put("formsHash", "").put("medidasHash", "").put("bloqueiosHash", "");
            }
            n.put("conferida", true);
          }
        }
        // as folhas (forms.js) vêm do aplicativo do tablet chefe, que manda ao abrir
        JSONObject forms;
        synchronized (this) { forms = config.optJSONObject("nuvemForms"); }
        if (forms != null) { forms = new JSONObject(forms.toString()); forms.remove("pinAdmin"); } // senha não vai para a nuvem
        String formsHash = forms == null ? "" : resumo(forms.toString());
        // aparelhos bloqueados: longe da usina, o aparelho pergunta na nuvem (versão 2.11)
        JSONObject fotoBloqueios = bloqueiosParaNuvem();
        JSONArray bloqueados = fotoBloqueios.getJSONArray("lista");
        long bloqueiosRev = fotoBloqueios.optLong("rev", 0L);
        String bloqueiosHash = resumo(fotoBloqueios.toString());
        // a nuvem guarda até 500: mais que isso não vai (a lista cortada deixaria aparelho bloqueado de fora), e as anotações seguem
        boolean bloqueiosDemais = bloqueados.length() > 500;
        Object medidas = medidasDoEscritorio();
        String medidasHash = resumo(String.valueOf(medidas));
        // Um envio vazio por ciclo também consulta a versão, mesmo sem novas anotações.
        for (int vez = 0; vez < 40; vez++) {
          List<JSONObject> pend = pendentesNuvem(n);
          List<JSONObject> lote = pend.subList(0, Math.min(NUVEM_LOTE, pend.size()));
          boolean formsMudou = forms != null && !formsHash.equals(n.optString("formsHash"));
          boolean bloqueiosMudaram = !bloqueiosDemais && !bloqueiosHash.equals(n.optString("bloqueiosHash"));
          if (vez > 0 && lote.isEmpty() && !formsMudou && !bloqueiosMudaram && medidasHash.equals(n.optString("medidasHash"))) {
            synchronized (this) { n.put("arquivosEnviados", true).put("faltam", 0L); }
            break;
          }
          JSONArray regs = new JSONArray();
          for (JSONObject r : lote) regs.put(r);
          JSONObject corpo = new JSONObject().put("geracao", getGeracao()).put("medidas", medidas).put("registros", regs);
          if (formsMudou) corpo.put("forms", forms);
          // com a revisão: o aparelho só aceita a resposta da nuvem se ela for mais nova que o bloqueio que ele já tem
          if (bloqueiosMudaram) corpo.put("bloqueios", bloqueados).put("bloqueiosRev", bloqueiosRev);
          Object[] r = pedirNuvem(url, segredo, "central/enviar", corpo);
          if ((Integer) r[0] != 200) throw new Exception(erroDaNuvem(r));
          synchronized (this) {
            JSONObject telas = infoDasTelas(new JSONObject((String) r[1]).optJSONObject("telas"));
            JSONObject anterior = infoDasTelas(n.optJSONObject("telas"));
            if (telas != null && (anterior == null || AtualizadorDeTelas.numero(telas.optString("versao")) >= AtualizadorDeTelas.numero(anterior.optString("versao")))) n.put("telas", telas);
            if (!lote.isEmpty()) n.put("seq", lote.get(lote.size() - 1).optLong("seq"));
            if (forms != null) n.put("formsHash", formsHash);
            n.put("medidasHash", medidasHash).put("ultimoEnvio", System.currentTimeMillis()).put("faltam", (long) Math.max(0, pend.size() - lote.size()));
            if (!bloqueiosDemais) n.put("bloqueiosHash", bloqueiosHash);
            n.put("erro", bloqueiosDemais ? "Mais de 500 aparelhos bloqueados: a lista não vai para a nuvem" : "");
          }
        }
        if (bloqueiosDemais) synchronized (this) { n.put("erro", "Mais de 500 aparelhos bloqueados: a lista não vai para a nuvem"); }
      } catch (Exception e) {
        synchronized (this) { try { n.put("erro", String.valueOf(e.getMessage())).put("conferida", false); } catch (Exception ignorado) { } }
      }
      synchronized (this) { salvarConfig(); }
    } catch (Exception ignorado) {
      // sem configuração: tenta de novo no próximo minuto
    } finally {
      enviandoNuvem.set(false);
    }
  }

  private void apiNuvem(byte[] corpo, boolean deChefe, OutputStream saida) throws Exception {
    JSONObject pedido = new JSONObject(new String(corpo, StandardCharsets.UTF_8));
    String acao = pedido.optString("acao");
    JSONObject n = nuvem();
    // o aplicativo do tablet chefe manda as folhas (forms.js): a nuvem monta a API com elas.
    // Só vale vindo de um tablet chefe liberado (versão 2.12): as permissões também saem delas.
    JSONObject forms = pedido.optJSONObject("forms");
    if (forms != null && deChefe) synchronized (this) { config.put("nuvemForms", forms); salvarConfig(); }
    if ("estado".equals(acao) || "forms".equals(acao)) { enviarJson(saida, 200, estadoNuvem()); return; }
    if ("configurar".equals(acao)) {
      String endereco = pedido.optString("url").trim().replaceAll("/+$", "");
      if (!endereco.isEmpty() && !endereco.matches("(?i)https://[^\\s/]+\\.[^\\s]+") && !endereco.matches("http://127\\.0\\.0\\.1:\\d+")) {
        enviarJson(saida, 400, new JSONObject().put("erro", "Endereço inválido. Ele começa com https://"));
        return;
      }
      synchronized (this) {
        if (!endereco.equals(n.optString("url"))) {
          n.put("url", endereco).put("seq", 0L).put("arquivosEnviados", false).put("conferida", false).put("formsHash", "").put("medidasHash", "")
           .put("erro", "").put("ultimoEnvio", 0L).put("faltam", 0L);
        }
        if (pedido.opt("segredo") instanceof String) {
          String s = pedido.optString("segredo").trim();
          n.put("segredo", s.length() > 200 ? s.substring(0, 200) : s).put("conferida", false).put("erro", "");
        }
        salvarConfig();
      }
      try {
        if (relogioNuvem != null) {
          relogioNuvem.schedule(this::enviarParaNuvem, 500, java.util.concurrent.TimeUnit.MILLISECONDS);
        }
      } catch (Exception ignorado) { }
      enviarJson(saida, 200, estadoNuvem());
      return;
    }
    if ("enviar".equals(acao)) {
      if (n.optString("url").isEmpty() || n.optString("segredo").isEmpty()) {
        enviarJson(saida, 400, new JSONObject().put("erro", "Cadastre o endereço e a senha da nuvem"));
        return;
      }
      enviarParaNuvem();
      enviarJson(saida, 200, estadoNuvem());
      return;
    }
    enviarJson(saida, 400, new JSONObject().put("erro", "ação desconhecida"));
  }
  /* ------------------------------------------------------------------ */
  /* Pessoas do escritório (versão 2.9): cada uma com nome, nível e a    */
  /* sua senha (só a senha diz quem é). A senha fica só aqui, embaralhada */
  /* com sal. Quem entra num tablet chefe fica como responsável dele.    */
  /* Só o administrador cadastra pessoas e mexe nas permissões.          */
  /* ------------------------------------------------------------------ */

  private final Map<String, List<Long>> tentativasSenha = new HashMap<>();

  private static String resumoDaSenha(String pin, String sal) throws Exception {
    byte[] h = MessageDigest.getInstance("SHA-256").digest((sal + ":" + pin).getBytes(StandardCharsets.UTF_8));
    for (int i = 0; i < 20000; i++) h = hmac(h, pin);
    return hex(h);
  }

  private JSONObject guardarSenha(JSONObject p, String pin) throws Exception {
    String sal = sorteiaChave().substring(0, 32);
    return p.put("sal", sal).put("resumo", resumoDaSenha(pin, sal));
  }

  private static boolean ativa(JSONObject p) { return !p.has("ativo") || p.optBoolean("ativo"); }

  /** As pessoas. Na primeira vez, o administrador é o Guilherme, com a senha que já era a do encarregado. */
  private synchronized JSONArray pessoas() throws Exception {
    JSONArray l = config.optJSONArray("pessoas");
    if (l == null) {
      JSONObject forms = config.optJSONObject("nuvemForms");
      String pin = forms != null && !forms.optString("pinAdmin").isEmpty() ? forms.optString("pinAdmin") : "159357";
      JSONObject p = new JSONObject().put("id", "p" + sorteiaChave().substring(0, 8)).put("nome", "Guilherme").put("nivel", "administrador")
          .put("extras", new JSONObject()).put("ativo", true).put("criadoEm", System.currentTimeMillis());
      l = new JSONArray().put(guardarSenha(p, pin));
      config.put("pessoas", l);
      salvarConfig();
    }
    return l;
  }

  private synchronized JSONObject objetoDaConfig(String nome) throws Exception {
    JSONObject o = config.optJSONObject(nome);
    if (o == null) { o = new JSONObject(); config.put(nome, o); }
    return o;
  }

  private static JSONObject pessoaPublica(JSONObject p) throws Exception {
    JSONObject extras = p.optJSONObject("extras");
    return new JSONObject().put("id", p.optString("id")).put("nome", p.optString("nome")).put("nivel", p.optString("nivel"))
        .put("extras", extras != null ? extras : new JSONObject()).put("ativo", ativa(p)).put("temSenha", !p.optString("resumo").isEmpty());
  }

  private synchronized JSONObject pessoaDaSenha(String pin) throws Exception {
    JSONArray l = pessoas();
    for (int i = 0; i < l.length(); i++) {
      JSONObject p = l.optJSONObject(i);
      if (p == null || !ativa(p) || p.optString("resumo").isEmpty()) continue;
      if (MessageDigest.isEqual(resumoDaSenha(pin, p.optString("sal")).getBytes(StandardCharsets.UTF_8), p.optString("resumo").getBytes(StandardCharsets.UTF_8))) return p;
    }
    return null;
  }

  private synchronized JSONObject pessoaPorId(String id) throws Exception {
    JSONArray l = pessoas();
    for (int i = 0; i < l.length(); i++) { JSONObject p = l.optJSONObject(i); if (p != null && id.equals(p.optString("id"))) return p; }
    return null;
  }

  private synchronized JSONObject pessoaDoAparelho(String aparelho) throws Exception {
    JSONObject s = objetoDaConfig("sessoes").optJSONObject(aparelho);
    if (s == null) return null;
    JSONObject p = pessoaPorId(s.optString("pessoaId"));
    return p != null && ativa(p) ? p : null;
  }

  private synchronized Object tetoDoAparelho(String aparelho) throws Exception {
    JSONObject a = objetoDaConfig("aparelhosChefe").optJSONObject(aparelho);
    JSONArray t = a == null ? null : a.optJSONArray("teto");
    return t == null ? JSONObject.NULL : t;
  }

  /** Nome do aparelho para o registro e a lista: o que o administrador deu, ou a função dele. */
  private synchronized String nomeDoAparelho(String id) {
    try {
      JSONObject a = objetoDaConfig("aparelhosChefe").optJSONObject(id);
      if (a != null && !a.optString("nome").isEmpty()) return a.optString("nome");
      JSONObject visto = aparelhos.get(id);
      if (visto == null) visto = objetoDaConfig("aparelhosVistos").optJSONObject(id);
      // o nome que o próprio aparelho mandou (Tablet da Hidrólise, Tablet chefe...)
      if (visto != null && !visto.optString("nome").isEmpty()) return visto.optString("nome");
      JSONObject vistoAntes = objetoDaConfig("aparelhosVistos").optJSONObject(id);
      if (vistoAntes != null && !vistoAntes.optString("nome").isEmpty()) return vistoAntes.optString("nome");
      String papel = visto == null ? "" : visto.optString("papel");
      if ("central".equals(papel)) return "Tablet chefe";
      if ("escritorio".equals(papel)) return "Escritório";
      JSONObject forms = config.optJSONObject("nuvemForms");
      JSONArray setores = forms == null ? null : forms.optJSONArray("setores");
      if (setores != null) for (int i = 0; i < setores.length(); i++) {
        JSONObject s = setores.optJSONObject(i);
        if (s != null && papel.equals(s.optString("id"))) return "Tablet da " + s.optString("nome");
      }
    } catch (Exception ignorado) { }
    return "Aparelho " + (id.length() > 6 ? id.substring(id.length() - 6) : id);
  }

  /* ------------------------------------------------------------------ */
  /* Registro do sistema (versão 2.9): cada linha é uma anotação da folha */
  /* "registro". O aplicativo escreve o que a pessoa fez (ele sabe o     */
  /* antes e o depois); a central escreve o que só ela vê: entradas,     */
  /* aparelho novo, sem sinal ou atualizado, código trocado e pessoas.   */
  /* Não vai para os tablets dos setores, nem para a API e a nuvem.      */
  /* ------------------------------------------------------------------ */

  private String diaDaUsina(long em) {
    JSONObject forms = config.optJSONObject("nuvemForms");
    long inicio = forms != null && forms.has("inicioDoDia") ? forms.optLong("inicioDoDia") : 7;
    return new java.text.SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new java.util.Date(em - inicio * 3600000L));
  }

  private synchronized void registrar(String tipo, String texto, String quem, String aparelhoNome, JSONObject extra) {
    try {
      long em = System.currentTimeMillis();
      String data = diaDaUsina(em);
      String chave = Long.toString(em, 36) + "-" + sorteiaChave().substring(0, 6);
      String id = data + "|registro|" + chave;
      seq++;
      JSONObject v = new JSONObject().put("em", em).put("tipo", tipo).put("quem", quem).put("aparelho", aparelhoNome).put("texto", texto);
      if (extra != null) for (Iterator<String> it = extra.keys(); it.hasNext(); ) { String k = it.next(); v.put(k, extra.opt(k)); }
      registros.put(id, new JSONObject().put("id", id).put("data", data).put("prancheta", "registro").put("setor", "central").put("chave", chave)
          .put("valores", v).put("criadoEm", em).put("atualizadoEm", em).put("aparelho", "central").put("operador", quem)
          .put("apagado", false).put("seq", seq).put("recebidoEm", em));
      salvarRegistros();
    } catch (Exception ignorado) {
      // o registro nunca pode atrapalhar a anotação
    }
  }

  /** O que mudou num aparelho que falou com a central: novo, outra versão, outra função, voltou do sem sinal. */
  private synchronized void eventosDoAparelho(String id, JSONObject antes, JSONObject pedido) {
    try {
      JSONObject vistos = objetoDaConfig("aparelhosVistos");
      JSONObject visto = vistos.optJSONObject(id);
      String nome = nomeDoAparelho(id);
      String versao = pedido.optString("versao"), papel = pedido.optString("papel");
      if (visto == null) {
        JSONObject novo = new JSONObject().put("papel", papel).put("nome", pedido.optString("nome")).put("versao", versao)
            .put("desde", System.currentTimeMillis()).put("vistoEm", System.currentTimeMillis());
        JSONObject info = infoLimpa(pedido.optJSONObject("info"));
        if (info != null) novo.put("info", info);
        JSONObject agoraAqui = aparelhos.get(id);
        if (agoraAqui != null && !agoraAqui.optString("ip").isEmpty()) novo.put("ip", agoraAqui.optString("ip"));
        vistos.put(id, novo);
        salvarConfig();
        registrar("aparelho", nome + " conectou na central pela primeira vez", "", nome, null);
        return;
      }
      boolean mudou = false;
      if (!versao.isEmpty() && !visto.optString("versao").isEmpty() && !versao.equals(visto.optString("versao"))) {
        registrar("aparelho", nome + " atualizou da versão " + visto.optString("versao") + " para a " + versao, "", nome,
            new JSONObject().put("antes", visto.optString("versao")).put("depois", versao));
        mudou = true;
      }
      if (!papel.isEmpty() && !visto.optString("papel").isEmpty() && !papel.equals(visto.optString("papel"))) {
        registrar("aparelho", nome + " mudou de função", "", nome, new JSONObject().put("antes", visto.optString("papel")).put("depois", papel));
        mudou = true;
      }
      String nomeDele = pedido.optString("nome");
      if (mudou || (!versao.isEmpty() && visto.optString("versao").isEmpty()) || (!papel.isEmpty() && visto.optString("papel").isEmpty()) || (!nomeDele.isEmpty() && !nomeDele.equals(visto.optString("nome")))) {
        if (!versao.isEmpty()) visto.put("versao", versao);
        if (!papel.isEmpty()) visto.put("papel", papel);
        if (!nomeDele.isEmpty()) visto.put("nome", nomeDele);
        salvarConfig();
      }
      // nome no Android, modelo e endereço: guardados quando mudam; a hora em que foi visto, de 10 em 10 minutos
      JSONObject info = infoLimpa(pedido.optJSONObject("info"));
      JSONObject agoraAqui = aparelhos.get(id);
      String ip = agoraAqui == null ? "" : agoraAqui.optString("ip");
      if ((info != null && !mesmaInfo(info, visto.optJSONObject("info"))) || (!ip.isEmpty() && !ip.equals(visto.optString("ip")))
          || System.currentTimeMillis() - visto.optLong("vistoEm") > 600000L) {
        if (info != null) visto.put("info", info);
        if (!ip.isEmpty()) visto.put("ip", ip);
        visto.put("vistoEm", System.currentTimeMillis());
        salvarConfig();
      }
      if (antes != null && antes.optBoolean("semSinal")) {
        long min = Math.max(1, Math.round((System.currentTimeMillis() - antes.optLong("vistoEm")) / 60000.0));
        registrar("aparelho", nome + " voltou a falar com a central (ficou " + min + " min sem sinal)", "", nome, null);
      }
    } catch (Exception ignorado) { }
  }

  private static final long SEM_SINAL_MS = Long.getLong("pranchetas.semSinal", 120000L);

  /** Aparelho que parou de falar com a central: fica no registro uma vez. */
  synchronized void conferirSemSinal() {
    long agora = System.currentTimeMillis();
    for (Map.Entry<String, JSONObject> e : aparelhos.entrySet()) {
      JSONObject a = e.getValue();
      try {
        if (!a.optBoolean("semSinal") && agora - a.optLong("vistoEm") > SEM_SINAL_MS) {
          a.put("semSinal", true);
          String nome = nomeDoAparelho(e.getKey());
          registrar("aparelho", nome + " ficou sem sinal", "", nome, null);
        }
      } catch (Exception ignorado) { }
    }
  }

  private void apiRegistro(String consulta, OutputStream saida) throws Exception {
    String dia = null;
    for (String par : consulta.split("&")) if (par.startsWith("dia=")) dia = par.substring(4);
    if (!ehDia(dia)) { enviarJson(saida, 400, new JSONObject().put("erro", "dia inválido")); return; }
    List<JSONObject> lista = new ArrayList<>();
    synchronized (this) {
      if (arquivado(dia)) {
        JSONArray a = lerDiaArquivado(dia);
        for (int i = 0; i < a.length(); i++) { JSONObject r = a.optJSONObject(i); if (r != null) lista.add(r); }
      } else for (Iterator<String> it = registros.keys(); it.hasNext(); ) { JSONObject r = registros.optJSONObject(it.next()); if (r != null && dia.equals(r.optString("data"))) lista.add(r); }
    }
    JSONArray saidaLista = new JSONArray();
    List<JSONObject> doRegistro = new ArrayList<>();
    for (JSONObject r : lista) if ("registro".equals(r.optString("prancheta")) && !r.optBoolean("apagado")) doRegistro.add(r);
    Collections.sort(doRegistro, (a, b) -> {
      JSONObject va = a.optJSONObject("valores"), vb = b.optJSONObject("valores");
      return Long.compare(va == null ? 0 : va.optLong("em"), vb == null ? 0 : vb.optLong("em"));
    });
    for (JSONObject r : doRegistro) saidaLista.put(r);
    enviarJson(saida, 200, new JSONObject().put("registros", saidaLista));
  }

  private void apiPessoas(byte[] corpo, String aparelho, OutputStream saida) throws Exception {
    JSONObject pedido = new JSONObject(new String(corpo, StandardCharsets.UTF_8));
    String acao = pedido.optString("acao");
    JSONObject quem = pessoaDoAparelho(aparelho);
    String aqui = nomeDoAparelho(aparelho);
    if ("entrar".equals(acao) || "verificar".equals(acao)) {
      long agora = System.currentTimeMillis();
      List<Long> t;
      synchronized (tentativasSenha) {
        t = tentativasSenha.get(aparelho);
        if (t == null) { t = new ArrayList<>(); tentativasSenha.put(aparelho, t); }
        Iterator<Long> it = t.iterator();
        while (it.hasNext()) if (agora - it.next() >= 60000) it.remove();
        if (t.size() >= 5) { enviarJson(saida, 429, new JSONObject().put("erro", "Muitas senhas erradas. Espere um minuto.")); return; }
      }
      String pin = pedido.optString("pin");
      JSONObject pessoa = pin.matches("\\d{4,8}") ? pessoaDaSenha(pin) : null;
      if (pessoa == null) {
        synchronized (tentativasSenha) { t.add(agora); }
        registrar("entrada", "Senha errada no " + aqui, "", aqui, null);
        enviarJson(saida, 403, new JSONObject().put("erro", "Senha errada"));
        return;
      }
      if ("entrar".equals(acao)) {
        // só entra pessoa em tablet chefe liberado; no nível 3, só o dono (versão 2.12)
        int nivel = nivelDoAparelho(aparelho);
        if (nivel == 0) { enviarJson(saida, 403, new JSONObject().put("erro", "Este aparelho ainda não foi liberado como tablet chefe").put("naoLiberado", true)); return; }
        if (nivel == 3 && !ehDono(pessoa)) { enviarJson(saida, 403, new JSONObject().put("erro", "Este tablet é só do dono do sistema")); return; }
        synchronized (this) {
          JSONObject antes = pessoaDoAparelho(aparelho);
          objetoDaConfig("sessoes").put(aparelho, new JSONObject().put("pessoaId", pessoa.optString("id")).put("em", agora));
          salvarConfig();
          if (antes == null || !antes.optString("id").equals(pessoa.optString("id"))) {
            registrar("entrada", pessoa.optString("nome") + " entrou no " + aqui, pessoa.optString("nome"), aqui, null);
          }
        }
      }
      // tablet de setor: quem conferiu a senha fica liberado por 10 minutos para mudar os ajustes (operadores)
      if ("verificar".equals(acao) && nivelDoAparelho(aparelho) == 0) synchronized (this) { liberadosNoSetor.put(aparelho, new Object[] { pessoa.optString("id"), agora + LIBERADO_NO_SETOR_MS }); }
      JSONObject resposta = permissoesDoAparelho(aparelho, "entrar".equals(acao) ? null : pessoa);
      enviarJson(saida, 200, resposta.put("pessoa", pessoaPublica(pessoa)).put("teto", tetoDoAparelho(aparelho)));
      return;
    }
    if ("sair".equals(acao)) {
      if (quem != null) {
        synchronized (this) { objetoDaConfig("sessoes").remove(aparelho); salvarConfig(); }
        String motivo = pedido.optString("motivo");
        registrar("entrada", quem.optString("nome") + " saiu do " + aqui + (motivo.isEmpty() ? "" : " (" + (motivo.length() > 60 ? motivo.substring(0, 60) : motivo) + ")"), quem.optString("nome"), aqui, null);
      }
      enviarJson(saida, 200, new JSONObject().put("ok", true));
      return;
    }
    if ("quem".equals(acao)) {
      enviarJson(saida, 200, permissoesDoAparelho(aparelho, null).put("pessoa", quem == null ? JSONObject.NULL : pessoaPublica(quem)).put("teto", tetoDoAparelho(aparelho)));
      return;
    }
    // daqui para baixo, só o administrador (ou o dono), num tablet chefe nível 2 ou 3
    if (quem == null || !podeNoAparelho(aparelho, "pessoas")) {
      enviarJson(saida, 403, new JSONObject().put("erro", "Só o administrador mexe nas pessoas e permissões"));
      return;
    }
    if ("lista".equals(acao)) { enviarJson(saida, 200, listaDePessoas()); return; }
    if ("salvar".equals(acao)) {
      JSONObject d = pedido.optJSONObject("pessoa");
      if (d == null) d = new JSONObject();
      String nome = d.optString("nome").trim();
      if (nome.length() > 40) nome = nome.substring(0, 40);
      String nivel = d.optString("nivel");
      if (nome.isEmpty()) { enviarJson(saida, 400, new JSONObject().put("erro", "Falta o nome")); return; }
      if (!Arrays.asList("administrador", "encarregado", "consulta").contains(nivel)) { enviarJson(saida, 400, new JSONObject().put("erro", "Nível inválido")); return; }
      String pin = d.has("pin") && d.opt("pin") != JSONObject.NULL ? d.optString("pin") : "";
      boolean ativo = !d.has("ativo") || d.optBoolean("ativo");
      synchronized (this) {
        JSONArray l = pessoas();
        JSONObject existente = d.optString("id").isEmpty() ? null : pessoaPorId(d.optString("id"));
        if (!d.optString("id").isEmpty() && existente == null) { enviarJson(saida, 404, new JSONObject().put("erro", "Pessoa não encontrada")); return; }
        // o dono só o próprio dono muda; e ele continua administrador e ativo (versão 2.12)
        if (ehDono(existente) && !ehDono(quem)) { enviarJson(saida, 403, new JSONObject().put("erro", "Só o dono do sistema muda os dados dele")); return; }
        if (ehDono(existente) && (!"administrador".equals(nivel) || !ativo)) { enviarJson(saida, 400, new JSONObject().put("erro", "O dono do sistema continua administrador e ativo")); return; }
        int admins = 0;
        for (int i = 0; i < l.length(); i++) {
          JSONObject x = l.optJSONObject(i);
          if (x == null || x == existente) continue;
          if (x.optString("nome").equalsIgnoreCase(nome)) { enviarJson(saida, 400, new JSONObject().put("erro", "Já tem uma pessoa com esse nome")); return; }
          if ("administrador".equals(x.optString("nivel")) && ativa(x)) admins++;
        }
        if (!pin.isEmpty() && !pin.matches("\\d{4,8}")) { enviarJson(saida, 400, new JSONObject().put("erro", "A senha tem de 4 a 8 números")); return; }
        if (existente == null && pin.isEmpty()) { enviarJson(saida, 400, new JSONObject().put("erro", "Falta a senha")); return; }
        if (!pin.isEmpty()) for (int i = 0; i < l.length(); i++) {
          JSONObject x = l.optJSONObject(i);
          if (x == null || x == existente || x.optString("resumo").isEmpty()) continue;
          if (resumoDaSenha(pin, x.optString("sal")).equals(x.optString("resumo"))) { enviarJson(saida, 400, new JSONObject().put("erro", "Essa senha já é de outra pessoa. Escolha outra.")); return; }
        }
        if (existente != null && "administrador".equals(existente.optString("nivel")) && (!"administrador".equals(nivel) || !ativo) && admins == 0) {
          enviarJson(saida, 400, new JSONObject().put("erro", "Precisa ficar pelo menos um administrador"));
          return;
        }
        JSONObject extras = new JSONObject();
        JSONObject vindos = d.optJSONObject("extras");
        if (vindos != null) for (Iterator<String> it = vindos.keys(); it.hasNext(); ) {
          String k = it.next();
          Object v = vindos.opt(k);
          if (k.matches("[a-z_]{2,30}") && v instanceof Boolean) extras.put(k, v);
        }
        String antesNome = existente == null ? "" : existente.optString("nome"), antesNivel = existente == null ? "" : existente.optString("nivel");
        boolean antesAtivo = existente == null || ativa(existente);
        String antesExtras = existente == null || existente.optJSONObject("extras") == null ? "{}" : existente.optJSONObject("extras").toString();
        JSONObject p = existente != null ? existente : new JSONObject().put("id", "p" + sorteiaChave().substring(0, 8)).put("criadoEm", System.currentTimeMillis());
        p.put("nome", nome).put("nivel", nivel).put("extras", extras).put("ativo", ativo);
        if (!pin.isEmpty()) guardarSenha(p, pin);
        if (existente == null) l.put(p);
        if (!ativo) {
          JSONObject sessoes = objetoDaConfig("sessoes");
          List<String> tirar = new ArrayList<>();
          for (Iterator<String> it = sessoes.keys(); it.hasNext(); ) { String k = it.next(); JSONObject s = sessoes.optJSONObject(k); if (s != null && p.optString("id").equals(s.optString("pessoaId"))) tirar.add(k); }
          for (String k : tirar) sessoes.remove(k);
        }
        salvarConfig();
        Map<String, String> nomeNivel = new HashMap<>();
        nomeNivel.put("administrador", "Administrador"); nomeNivel.put("encarregado", "Encarregado"); nomeNivel.put("consulta", "Consulta");
        List<String> partes = new ArrayList<>();
        if (existente == null) partes.add("cadastrou " + nome + " (" + nomeNivel.get(nivel) + ")");
        else {
          if (!antesNome.equals(nome)) partes.add("mudou o nome de " + antesNome + " para " + nome);
          if (!antesNivel.equals(nivel)) partes.add("mudou " + nome + " de " + nomeNivel.get(antesNivel) + " para " + nomeNivel.get(nivel));
          if (antesAtivo != ativo) partes.add((ativo ? "reativou " : "desativou ") + nome);
          if (!antesExtras.equals(extras.toString())) partes.add("mudou as funções de " + nome);
          if (!pin.isEmpty()) partes.add("trocou a senha de " + nome);
        }
        if (!partes.isEmpty()) registrar("configuracao", quem.optString("nome") + " " + String.join(", ", partes), quem.optString("nome"), aqui, null);
      }
      enviarJson(saida, 200, listaDePessoas());
      return;
    }
    if ("aparelho".equals(acao)) {
      String id = pedido.optString("id");
      if (id.isEmpty() || id.length() > 80) { enviarJson(saida, 400, new JSONObject().put("erro", "Falta o aparelho")); return; }
      synchronized (this) {
        String nomeAntes = nomeDoAparelho(id);
        JSONObject todos = objetoDaConfig("aparelhosChefe");
        JSONObject guardado = todos.optJSONObject(id);
        JSONObject a = guardado == null ? new JSONObject() : new JSONObject(guardado.toString());
        if (pedido.opt("nome") instanceof String) { String n = pedido.optString("nome").trim(); a.put("nome", n.length() > 40 ? n.substring(0, 40) : n); }
        if (pedido.has("teto")) {
          JSONArray t = pedido.optJSONArray("teto");
          if (t == null) a.remove("teto");
          else {
            JSONArray limpo = new JSONArray();
            for (int i = 0; i < t.length(); i++) if (t.optString(i).matches("[a-z_]{2,30}")) limpo.put(t.optString(i));
            a.put("teto", limpo);
          }
        }
        String mudancaDeNivel = "";
        // nível (versão 2.12): quem libera tablets chefe muda entre 1 e 2; o nível 3 (e tirar do 3) só o dono;
        // o próprio aparelho só o dono muda. Quem estava dentro sai (a regra nova vale na hora).
        if (pedido.has("nivel")) {
          int novoNivel = pedido.optInt("nivel", -1);
          int nivelAntes = nivelDoAparelho(id);
          if (novoNivel < 0 || novoNivel > 3) { enviarJson(saida, 400, new JSONObject().put("erro", "Nível inválido")); return; }
          if (!podeNoAparelho(aparelho, "chefes")) { enviarJson(saida, 403, new JSONObject().put("erro", "Quem está neste aparelho não libera tablets chefe").put("semPermissao", "chefes")); return; }
          if ((novoNivel == 3 || nivelAntes == 3 || id.equals(aparelho)) && !ehDono(quem)) { enviarJson(saida, 403, new JSONObject().put("erro", "Só o dono do sistema muda este nível")); return; }
          if (novoNivel != nivelAntes) {
            if (novoNivel > 0) a.put("nivel", novoNivel); else a.remove("nivel");
            objetoDaConfig("sessoes").remove(id);
            mudancaDeNivel = quem.optString("nome") + " mudou o " + nomeAntes + " de " + nomeDoNivel(nivelAntes) + " para " + nomeDoNivel(novoNivel);
          }
        }
        todos.put(id, a);
        salvarConfig();
        if (!mudancaDeNivel.isEmpty()) registrar("configuracao", mudancaDeNivel, quem.optString("nome"), aqui, null);
        String novoNome = a.optString("nome");
        registrar("configuracao", quem.optString("nome") + " mudou o que o " + nomeAntes + " pode fazer" + (!novoNome.isEmpty() && !novoNome.equals(nomeAntes) ? " (agora se chama " + novoNome + ")" : ""), quem.optString("nome"), aqui, null);
      }
      enviarJson(saida, 200, listaDePessoas());
      return;
    }
    enviarJson(saida, 400, new JSONObject().put("erro", "ação desconhecida"));
  }

  /* ------------------------------------------------------------------ */
  /* Níveis do tablet chefe e o dono (versão 2.12). Igual ao server.js:  */
  /* 1 = vê, corrige e envia; 2 = tudo e libera outros tablets chefe;   */
  /* 3 = tudo mais as configurações do sistema, só o dono entra.        */
  /* O que a pessoa faz no aparelho = funções dela ∩ nível ∩ limite     */
  /* (o nível 3 continua sem teto). A identidade do aparelho é a        */
  /* da conexão cifrada, nunca o que vem no pedido.                     */
  /* ------------------------------------------------------------------ */

  private static final List<String> FUNCOES_PADRAO = Arrays.asList("anotar", "corrigir", "avisos", "relatorios", "ler_folha", "usina", "folhas", "conexao", "integracoes", "ajustes", "registro", "chefes", "escritorio");
  private static final List<String> FUNCOES_DO_NIVEL_1 = Arrays.asList("corrigir", "relatorios", "escritorio");
  private static final List<String> FUNCOES_NO_SETOR = Arrays.asList("ajustes", "usina", "escritorio");
  /** Folhas que só o tablet chefe anota (Vinho e Fermentação, iguais ao forms.js; os testes conferem). */
  private static final List<String> PRANCHETAS_SO_DO_CHEFE = Arrays.asList("med_dornas", "fermentacao");
  private static final List<String> FOLHAS_SISTEMA = Arrays.asList("dec", "oculto", "_operador", "_novos");
  private static final long LIBERADO_NO_SETOR_MS = 10 * 60000L;
  /** Tablet de setor: quem digitou a senha nos ajustes fica liberado por 10 minutos (aparelho -> {pessoaId, até}). */
  private final Map<String, Object[]> liberadosNoSetor = new HashMap<>();

  /** As funções que existem, iguais às do forms.js (os testes conferem). Não saem das folhas que o aplicativo manda:
      o que cada um pode fazer não pode depender do que chega de um aparelho. */
  private List<String> funcoesDoForms() { return new ArrayList<>(FUNCOES_PADRAO); }

  /** As funções de um nível de pessoa (Encarregado, Consulta), iguais às do forms.js (os testes conferem). */
  private static List<String> funcoesDoNivelDePessoa(String nivel) {
    if ("encarregado".equals(nivel)) return Arrays.asList("anotar", "corrigir", "avisos", "relatorios", "ler_folha", "usina", "conexao", "ajustes");
    if ("consulta".equals(nivel)) return Arrays.asList("relatorios");
    return new ArrayList<>();
  }

  /** Na primeira vez da 2.12: o dono é o administrador mais antigo (o da migração da 2.9), e o que a central já
      conhecia como tablet chefe vira nível 2 (nada muda para quem já usa). */
  private synchronized void migrarParaNiveis() throws Exception {
    boolean mudou = false;
    if (config.optString("donoId").isEmpty()) {
      JSONArray l = pessoas();
      JSONObject dono = null, qualquer = null;
      for (int i = 0; i < l.length(); i++) {
        JSONObject p = l.optJSONObject(i);
        if (p == null || !"administrador".equals(p.optString("nivel"))) continue;
        if (qualquer == null) qualquer = p;
        if (dono == null && ativa(p)) dono = p;
      }
      if (dono == null) dono = qualquer;
      if (dono != null) { config.put("donoId", dono.optString("id")); mudou = true; }
    }
    if (!config.has("niveisMigrados")) {
      JSONObject chefes = objetoDaConfig("aparelhosChefe");
      JSONObject vistos = objetoDaConfig("aparelhosVistos");
      Set<String> ids = new HashSet<>();
      for (Iterator<String> it = chefes.keys(); it.hasNext(); ) ids.add(it.next());
      for (Iterator<String> it = vistos.keys(); it.hasNext(); ) {
        String id = it.next();
        JSONObject v = vistos.optJSONObject(id);
        if (v != null && "central".equals(v.optString("papel"))) ids.add(id);
      }
      for (String id : ids) {
        JSONObject a = chefes.optJSONObject(id);
        if (a == null) { a = new JSONObject(); chefes.put(id, a); }
        int n = a.optInt("nivel", 0);
        if (n < 1 || n > 3) a.put("nivel", 2);
      }
      config.put("niveisMigrados", System.currentTimeMillis());
      mudou = true;
    }
    if (mudou) salvarConfig();
  }

  /** Sem nenhum aparelho nível 3 não há dono para decidir a troca de código: ela vale como antes. */
  private synchronized boolean temAparelhoNivel3() throws Exception {
    JSONObject todos = objetoDaConfig("aparelhosChefe");
    for (java.util.Iterator<String> i = todos.keys(); i.hasNext(); ) { JSONObject a = todos.optJSONObject(i.next()); if (a != null && a.optInt("nivel") == 3) return true; }
    return false;
  }
  private synchronized int nivelDoAparelho(String id) {
    try {
      JSONObject a = objetoDaConfig("aparelhosChefe").optJSONObject(id);
      int n = a == null ? 0 : a.optInt("nivel", 0);
      return n >= 1 && n <= 3 ? n : 0;
    } catch (Exception e) { return 0; }
  }

  private synchronized boolean ehDono(JSONObject p) {
    String dono = config.optString("donoId");
    return p != null && !dono.isEmpty() && dono.equals(p.optString("id"));
  }

  /** As funções da pessoa, sem olhar o aparelho. "sistema" e "pessoas" não se dão por ajuste. */
  private synchronized Set<String> funcoesDaPessoa(JSONObject p) {
    Set<String> s = new HashSet<>();
    if (p == null) return s;
    List<String> todas = funcoesDoForms();
    if (ehDono(p)) { s.addAll(todas); s.add("pessoas"); s.add("chefes"); s.add("sistema"); return s; }
    if ("administrador".equals(p.optString("nivel"))) { s.addAll(todas); s.add("pessoas"); return s; }
    s.addAll(funcoesDoNivelDePessoa(p.optString("nivel")));
    JSONObject extras = p.optJSONObject("extras");
    if (extras != null) for (Iterator<String> it = extras.keys(); it.hasNext(); ) {
      String f = it.next();
      if ("sistema".equals(f) || "pessoas".equals(f)) continue;
      if (extras.optBoolean(f)) s.add(f); else s.remove(f);
    }
    return s;
  }

  /** O que quem está no aparelho pode fazer nele: a pessoa, o nível do aparelho e o limite dele. */
  private synchronized Set<String> funcoesNoAparelho(String aparelho) throws Exception {
    JSONObject p = pessoaDoAparelho(aparelho);
    int nivel = nivelDoAparelho(aparelho);
    if (p == null || nivel == 0 || (nivel == 3 && !ehDono(p))) return new HashSet<>();
    Set<String> s = funcoesDaPessoa(p);
    if (nivel != 3) {
      JSONObject cfg = registros.optJSONObject("config|sistema|geral");
      JSONObject valores = cfg == null || cfg.optBoolean("apagado") ? null : cfg.optJSONObject("valores");
      JSONObject niveis = valores == null ? null : valores.optJSONObject("niveisChefe");
      JSONArray permitidas = niveis == null ? null : niveis.optJSONArray(String.valueOf(nivel));
      if (permitidas != null) {
        Set<String> deixa = new HashSet<>();
        for (int i = 0; i < permitidas.length(); i++) deixa.add(permitidas.optString(i));
        s.retainAll(deixa);
      } else if (nivel == 1) s.retainAll(FUNCOES_DO_NIVEL_1);
      else s.remove("conexao");
      s.remove("sistema");
    }
    Object teto = tetoDoAparelho(aparelho);
    if (teto instanceof JSONArray && nivel != 3) {
      JSONArray t = (JSONArray) teto;
      Set<String> deixa = new HashSet<>();
      for (int i = 0; i < t.length(); i++) deixa.add(t.optString(i));
      s.retainAll(deixa);
    }
    return s;
  }

  private boolean podeNoAparelho(String aparelho, String funcao) throws Exception { return funcoesNoAparelho(aparelho).contains(funcao); }

  /** O que o tablet chefe faz sozinho, sem depender de quem está dentro (o relatório das 07:05 e os totais do Base44):
      o que o nível e o limite do próprio aparelho deixam. Às 07:05 o turno virou e normalmente não há ninguém dentro. */
  private synchronized boolean podeAparelhoSozinho(String aparelho, String f) throws Exception {
    int nivel = nivelDoAparelho(aparelho);
    if (nivel == 0) return false;
    if (nivel == 3) return true;
    JSONObject cfg = registros.optJSONObject("config|sistema|geral");
    JSONObject valores = cfg == null || cfg.optBoolean("apagado") ? null : cfg.optJSONObject("valores");
    JSONObject niveis = valores == null ? null : valores.optJSONObject("niveisChefe");
    JSONArray permitidas = niveis == null ? null : niveis.optJSONArray(String.valueOf(nivel));
    boolean deixa = false;
    if (permitidas != null) { for (int i = 0; i < permitidas.length(); i++) if (f.equals(permitidas.optString(i))) deixa = true; }
    else deixa = nivel == 1 ? FUNCOES_DO_NIVEL_1.contains(f) : FUNCOES_PADRAO.contains(f) && !"conexao".equals(f);
    if (!deixa) return false;
    Object teto = tetoDoAparelho(aparelho);
    if (!(teto instanceof JSONArray)) return true;
    JSONArray t = (JSONArray) teto;
    for (int i = 0; i < t.length(); i++) if (f.equals(t.optString(i))) return true;
    return false;
  }

  private void negar(OutputStream saida, String funcao) throws Exception {
    enviarJson(saida, 403, new JSONObject().put("erro", "Quem está neste aparelho não pode fazer isso").put("semPermissao", funcao));
  }

  private synchronized Set<String> funcoesNoSetor(String aparelho) throws Exception {
    Object[] l = liberadosNoSetor.get(aparelho);
    if (l == null || System.currentTimeMillis() > (Long) l[1]) return new HashSet<>();
    JSONObject p = pessoaPorId((String) l[0]);
    // no tablet de setor a senha só abre os ajustes dele (os operadores), seja de quem for: o resto é do tablet chefe
    Set<String> s = p != null && ativa(p) ? funcoesDaPessoa(p) : new HashSet<>();
    s.retainAll(FUNCOES_NO_SETOR);
    return s;
  }

  /** Mapa de autorização fixo, como as folhas só do chefe; nuvemForms vem de aparelhos e não dá permissão. */
  private static String setorDaFolha(String folha) {
    if ("caldeira".equals(folha)) return "caldeira";
    if ("ins_materia_prima".equals(folha)) return "ralo";
    if (Arrays.asList("hid_anexo1", "hid_anexo2", "juntas_lphera_cal", "juntas_saczyme_alcolina").contains(folha)) return "hidrolise";
    if (Arrays.asList("destilaria", "ins_lactrol", "ins_ureia").contains(folha)) return "destilaria";
    if ("nova_destilaria".equals(folha)) return "nova_destilaria";
    return "";
  }

  /** Setor vem da conexão, nunca de r.setor. O histórico permite escoar a fila anterior à troca. */
  private void guardarSetor(String aparelho, String papel) throws Exception {
    if (nivelDoAparelho(aparelho) > 0) return;
    JSONObject mapa = objetoDaConfig("setoresAparelhos"), salvo = mapa.optJSONObject(aparelho);
    JSONObject visto = objetoDaConfig("aparelhosVistos").optJSONObject(aparelho);
    String declarado = papel.isEmpty() && salvo == null && visto != null ? visto.optString("papel") : papel;
    if (!Arrays.asList("caldeira", "ralo", "hidrolise", "destilaria", "nova_destilaria").contains(declarado) || (salvo != null && declarado.equals(salvo.optString("atual")))) return;
    Set<String> f = funcoesNoSetor(aparelho);
    if (salvo != null && !f.contains("ajustes") && !f.contains("usina")) return;
    JSONObject anteriores = salvo == null ? new JSONObject() : new JSONObject(salvo.getJSONObject("anteriores").toString());
    if (salvo != null) anteriores.put(salvo.getString("atual"), System.currentTimeMillis());
    mapa.put(aparelho, new JSONObject().put("atual", declarado).put("anteriores", anteriores));
    salvarConfig();
  }

  private boolean podeFolhaNoSetor(String aparelho, JSONObject r) throws Exception {
    String setor = setorDaFolha(r.optString("prancheta"));
    if (setor.isEmpty()) return true;
    JSONObject salvo = objetoDaConfig("setoresAparelhos").optJSONObject(aparelho);
    Object em = r.opt("atualizadoEm");
    double atualizado = em instanceof Number ? ((Number) em).doubleValue() : 0;
    return salvo != null && (setor.equals(salvo.optString("atual")) || (atualizado > 0 && atualizado <= salvo.getJSONObject("anteriores").optLong(setor, 0)));
  }

  private static String nomeDoNivel(int n) {
    return n == 1 ? "nível 1 (vê, corrige e envia)" : n == 2 ? "nível 2" : n == 3 ? "nível 3 (do dono)" : "sem nível";
  }

  /** Para o aplicativo mostrar só o que pode: o nível do aparelho, se é o dono e as funções que valem aqui. */
  private synchronized JSONObject permissoesDoAparelho(String aparelho, JSONObject pessoaVerificada) throws Exception {
    int nivel = nivelDoAparelho(aparelho);
    JSONObject p = pessoaVerificada != null ? pessoaVerificada : pessoaDoAparelho(aparelho);
    Set<String> f = pessoaVerificada != null && nivel == 0 ? funcoesDaPessoa(pessoaVerificada) : funcoesNoAparelho(aparelho);
    JSONArray lista = new JSONArray();
    List<String> ordem = new ArrayList<>(f);
    Collections.sort(ordem);
    for (String x : ordem) lista.put(x);
    return new JSONObject().put("nivel", nivel).put("dono", ehDono(p)).put("funcoes", lista);
  }

  /* O que a central aceita pela sincronização (igual ao server.js): configuração por parte e por função, com
     conflito pela revisão; nas folhas, as propriedades do sistema só o dono num nível 3, e quem não pode não as apaga. */

  /** Compara dois valores do JSON sem depender da ordem das chaves. */
  private static boolean mesmoJson(Object a, Object b) {
    if (a == null || a == JSONObject.NULL) return b == null || b == JSONObject.NULL;
    if (b == null || b == JSONObject.NULL) return false;
    if (a instanceof JSONObject && b instanceof JSONObject) {
      JSONObject x = (JSONObject) a, y = (JSONObject) b;
      Set<String> ks = new HashSet<>();
      for (Iterator<String> it = x.keys(); it.hasNext(); ) ks.add(it.next());
      Set<String> ky = new HashSet<>();
      for (Iterator<String> it = y.keys(); it.hasNext(); ) ky.add(it.next());
      if (!ks.equals(ky)) return false;
      for (String k : ks) if (!mesmoJson(x.opt(k), y.opt(k))) return false;
      return true;
    }
    if (a instanceof JSONArray && b instanceof JSONArray) {
      JSONArray x = (JSONArray) a, y = (JSONArray) b;
      if (x.length() != y.length()) return false;
      for (int i = 0; i < x.length(); i++) if (!mesmoJson(x.opt(i), y.opt(i))) return false;
      return true;
    }
    if (a instanceof Number && b instanceof Number) return ((Number) a).doubleValue() == ((Number) b).doubleValue();
    return a.equals(b);
  }

  private static Set<String> chaves(JSONObject a, JSONObject b) {
    Set<String> s = new HashSet<>();
    if (a != null) for (Iterator<String> it = a.keys(); it.hasNext(); ) s.add(it.next());
    if (b != null) for (Iterator<String> it = b.keys(); it.hasNext(); ) s.add(it.next());
    return s;
  }

  /** Folhas: põe de volta as propriedades do sistema que vieram faltando e diz se mexeu nelas e nas outras.
      Devolve {folhas, mexeuSistema, mexeuComum}. */
  private static Object[] conferirFolhas(JSONObject antes, JSONObject depois, boolean podeSistema) throws Exception {
    JSONObject a = antes == null ? new JSONObject() : antes;
    JSONObject b = depois == null ? new JSONObject() : new JSONObject(depois.toString());
    boolean mexeuSistema = false, mexeuComum = false;
    for (String pid : chaves(a, b)) {
      JSONObject fa = a.optJSONObject(pid);
      if (fa == null) fa = new JSONObject();
      JSONObject fb = b.optJSONObject(pid);
      if (fb == null) { fb = new JSONObject(); b.put(pid, fb); }
      for (String k : chaves(fa, fb)) {
        if (FOLHAS_SISTEMA.contains(k)) {
          if (!podeSistema) { if (fa.has(k)) fb.put(k, fa.opt(k)); else fb.remove(k); }
          else if (!mesmoJson(fa.opt(k), fb.opt(k))) mexeuSistema = true;
          continue;
        }
        if (k.startsWith("_")) { if (!mesmoJson(fa.opt(k), fb.opt(k))) mexeuComum = true; continue; }
        JSONObject ca = fa.optJSONObject(k);
        if (ca == null) ca = new JSONObject();
        JSONObject cb = fb.optJSONObject(k);
        if (cb == null) { cb = new JSONObject(); fb.put(k, cb); }
        for (String prop : chaves(ca, cb)) {
          if (FOLHAS_SISTEMA.contains(prop)) {
            if (!podeSistema) { if (ca.has(prop)) cb.put(prop, ca.opt(prop)); else cb.remove(prop); }
            else if (!mesmoJson(ca.opt(prop), cb.opt(prop))) mexeuSistema = true;
          } else if (!mesmoJson(ca.opt(prop), cb.opt(prop))) mexeuComum = true;
        }
        if (cb.length() == 0) fb.remove(k);
      }
      if (fb.length() == 0) b.remove(pid);
    }
    return new Object[] { b, mexeuSistema, mexeuComum };
  }

  /** Decide uma anotação de configuração que chegou: devolve {aceita (Boolean), entrada, motivo}.
      Aplicativo de antes da 2.12 (manda sem "base"): ele não conhece a recusa e marcaria como enviado. Então vale o que
      ele podia mudar, o resto fica como está, e a configuração volta para ele na próxima sincronização (sai com um
      horário mais novo que o dele, e o aparelho troca a cópia). */
  private synchronized Object[] decidirConfig(JSONObject atual, JSONObject r, String aparelho) throws Exception {
    boolean chefe = nivelDoAparelho(aparelho) > 0;
    Set<String> funcoes = chefe ? funcoesNoAparelho(aparelho) : funcoesNoSetor(aparelho);
    JSONObject vivo = atual != null && !atual.optBoolean("apagado") ? atual : null;
    boolean antigo = !r.has("base");
    // conflito: alguém mudou a configuração depois da cópia que este aparelho editou
    if (!antigo && vivo != null && r.optLong("base", 0L) != vivo.optLong("rev", 0L)) return new Object[] { false, null, "conflito" };
    long horaDele = r.optLong("atualizadoEm");
    long horaGuardada = vivo == null ? 0L : vivo.optLong("atualizadoEm");
    // a configuração da usina não se apaga pela sincronização (o aplicativo nunca apaga): o aparelho antigo recebe ela de volta
    if (r.optBoolean("apagado")) {
      if (!antigo || vivo == null) return new Object[] { false, null, "sem_permissao" };
      JSONObject deVolta = new JSONObject(vivo.toString()).put("atualizadoEm", Math.max(horaDele, horaGuardada) + 1).put("rev", vivo.optLong("rev", 0L) + 1);
      return new Object[] { true, deVolta, "" };
    }
    JSONObject entrada = new JSONObject(r.toString());
    entrada.remove("base");
    JSONObject vn = entrada.optJSONObject("valores");
    if (vn == null) { vn = new JSONObject(); entrada.put("valores", vn); }
    JSONObject va = vivo == null ? null : vivo.optJSONObject("valores");
    if (vn.has("folhas") || (va != null && va.has("folhas"))) {
      Object[] f = conferirFolhas(va == null ? null : va.optJSONObject("folhas"), vn.optJSONObject("folhas"), funcoes.contains("sistema"));
      boolean mexeuSistema = (Boolean) f[1], mexeuComum = (Boolean) f[2];
      // folhas só no tablet chefe: as do sistema com "sistema" (o dono no nível 3), as outras com "folhas"
      boolean pode = chefe && (!mexeuSistema || funcoes.contains("sistema")) && (!mexeuComum || funcoes.contains("folhas") || funcoes.contains("sistema"));
      if ((mexeuSistema || mexeuComum) && !pode) {
        if (!antigo) return new Object[] { false, null, "sem_permissao" };
        comoEstava(vn, va, "folhas");
      } else {
        JSONObject folhas = (JSONObject) f[0];
        if (folhas.length() == 0) vn.remove("folhas"); else vn.put("folhas", folhas);
      }
    }
    for (String k : chaves(va, vn)) {
      if ("folhas".equals(k)) continue;
      if (mesmoJson(va == null ? null : va.opt(k), vn.opt(k))) continue;
      // no tablet de setor só os operadores (ajustes); no tablet chefe, o resto da usina
      boolean pode = "niveisChefe".equals(k) ? funcoes.contains("sistema") : chefe ? funcoes.contains("usina") : "operadores".equals(k) && (funcoes.contains("ajustes") || funcoes.contains("usina"));
      if (pode) continue;
      if (!antigo) return new Object[] { false, null, "sem_permissao" };
      comoEstava(vn, va, k);
    }
    if (vn.has("niveisChefe")) {
      JSONObject n = vn.optJSONObject("niveisChefe");
      if (n == null || n.length() != 2) return new Object[] { false, null, "invalido" };
      Set<String> validas = new HashSet<>(funcoesDoForms()); validas.add("pessoas"); validas.add("chefes");
      for (String k : Arrays.asList("1", "2")) {
        JSONArray lista = n.optJSONArray(k);
        if (lista == null) return new Object[] { false, null, "invalido" };
        Set<String> vistas = new HashSet<>();
        for (int i = 0; i < lista.length(); i++) {
          Object f = lista.opt(i);
          if (!(f instanceof String) || !validas.contains((String) f) || !vistas.add((String) f)) return new Object[] { false, null, "invalido" };
        }
      }
    }
    entrada.put("rev", (vivo == null ? 0L : vivo.optLong("rev", 0L)) + 1);
    // a central guardou diferente do que veio (do antigo, ou as do sistema que voltaram): vai de volta para o aparelho
    JSONObject veio = r.optJSONObject("valores");
    if (!mesmoJson(vn, veio == null ? new JSONObject() : veio)) entrada.put("atualizadoEm", Math.max(horaDele, horaGuardada) + 1);
    return new Object[] { true, entrada, "" };
  }

  /** Do aplicativo antigo, a parte que ele não podia mudar fica como estava. */
  private static void comoEstava(JSONObject vn, JSONObject va, String k) throws Exception {
    if (va != null && va.has(k)) vn.put(k, va.opt(k)); else vn.remove(k);
  }

  /** Anotação que chegou de um tablet chefe: a mesma função que a tela pede, de quem está dentro dele (aviso: avisos;
      Vinho e Fermentação: anotar; folhas dos setores: corrigir). Sem ninguém dentro: "sem_sessao" (o
      aparelho guarda a anotação e manda de novo quando alguém entrar). */
  private synchronized String motivoNoChefe(String aparelho, String prancheta) throws Exception {
    if (pessoaDoAparelho(aparelho) == null) return "sem_sessao";
    Set<String> f = funcoesNoAparelho(aparelho);
    if ("avisos".equals(prancheta)) return f.contains("avisos") ? "" : "sem_permissao";
    if (PRANCHETAS_SO_DO_CHEFE.contains(prancheta)) return f.contains("anotar") ? "" : "sem_permissao";
    return f.contains("corrigir") ? "" : "sem_permissao";
  }

  /** A anotação guardada de um dia antigo, no BackupUsina (cada dia lido uma vez por sincronização). */
  private JSONObject guardadaNoArquivo(Map<String, Map<String, JSONObject>> lidos, String data, String id) {
    Map<String, JSONObject> dia = lidos.get(data);
    if (dia == null) {
      dia = new HashMap<>();
      JSONArray a = lerDiaArquivado(data);
      for (int i = 0; i < a.length(); i++) { JSONObject x = a.optJSONObject(i); if (x != null) dia.put(x.optString("id"), x); }
      lidos.put(data, dia);
    }
    return dia.get(id);
  }

  /** Campos do escritório de cada folha de insumo que o operador não preenche (o tablet do setor não muda). */
  private synchronized List<String> camposSoDoEscritorio(String pid) {
    List<String> l = new ArrayList<>();
    JSONObject forms = config.optJSONObject("nuvemForms");
    JSONObject ps = forms == null ? null : forms.optJSONObject("pranchetas");
    JSONObject p = ps == null ? null : ps.optJSONObject(pid);
    if (p == null || !"insumo".equals(p.optString("tipo"))) return l;
    Set<String> liberados = new HashSet<>();
    JSONArray op = p.optJSONArray("camposOperador");
    if (op != null) for (int i = 0; i < op.length(); i++) { JSONObject c = op.optJSONObject(i); if (c != null) liberados.add(c.optString("id")); }
    JSONObject cs = registros.optJSONObject("config|sistema|geral");
    JSONObject folhas = cs == null || cs.optBoolean("apagado") || cs.optJSONObject("valores") == null ? null : cs.optJSONObject("valores").optJSONObject("folhas");
    JSONObject daFolha = folhas == null ? null : folhas.optJSONObject(pid);
    JSONArray abertos = daFolha == null ? null : daFolha.optJSONArray("_operador");
    if (abertos != null) for (int i = 0; i < abertos.length(); i++) liberados.add(abertos.optString(i));
    JSONArray esc = p.optJSONArray("camposEscritorio");
    if (esc != null) for (int i = 0; i < esc.length(); i++) { JSONObject c = esc.optJSONObject(i); if (c != null && !liberados.contains(c.optString("id"))) l.add(c.optString("id")); }
    return l;
  }

  /** Liberar este aparelho como tablet chefe, e recuperar o dono com a senha do programador. */
  private static String acaoDoPedido(byte[] corpo) {
    try { return new JSONObject(new String(corpo, StandardCharsets.UTF_8)).optString("acao"); } catch (Exception e) { return ""; }
  }

  private void apiChefes(byte[] corpo, String aparelho, OutputStream saida) throws Exception {
    JSONObject pedido = new JSONObject(new String(corpo, StandardCharsets.UTF_8));
    String acao = pedido.optString("acao");
    String aqui = nomeDoAparelho(aparelho);
    if ("estado".equals(acao)) { enviarJson(saida, 200, new JSONObject().put("nivel", nivelDoAparelho(aparelho))); return; }
    if ("liberar".equals(acao)) {
      long agora = System.currentTimeMillis();
      List<Long> t;
      synchronized (tentativasSenha) {
        t = tentativasSenha.get(aparelho);
        if (t == null) { t = new ArrayList<>(); tentativasSenha.put(aparelho, t); }
        Iterator<Long> it = t.iterator();
        while (it.hasNext()) if (agora - it.next() >= 60000) it.remove();
        if (t.size() >= 5) { enviarJson(saida, 429, new JSONObject().put("erro", "Muitas senhas erradas. Espere um minuto.")); return; }
      }
      String pin = pedido.optString("pin");
      JSONObject pessoa = pin.matches("\\d{4,8}") ? pessoaDaSenha(pin) : null;
      if (pessoa == null) {
        synchronized (tentativasSenha) { t.add(agora); }
        registrar("entrada", "Senha errada ao liberar o " + aqui + " como tablet chefe", "", aqui, null);
        enviarJson(saida, 403, new JSONObject().put("erro", "Senha errada"));
        return;
      }
      int nivel = pedido.optInt("nivel", 0);
      if (nivel < 1 || nivel > 3) { enviarJson(saida, 400, new JSONObject().put("erro", "Nível inválido")); return; }
      // nível 3 só o dono; 1 ou 2, quem libera tablets chefe (administrador, ou quem ganhou a função) ou o dono
      if (nivel == 3 ? !ehDono(pessoa) : !funcoesDaPessoa(pessoa).contains("chefes")) {
        enviarJson(saida, 403, new JSONObject().put("erro", nivel == 3 ? "Só o dono do sistema libera o nível 3" : pessoa.optString("nome") + " não pode liberar tablet chefe"));
        return;
      }
      int antes;
      synchronized (this) {
        antes = nivelDoAparelho(aparelho);
        JSONObject todos = objetoDaConfig("aparelhosChefe");
        JSONObject a = todos.optJSONObject(aparelho);
        if (a == null) { a = new JSONObject(); todos.put(aparelho, a); }
        a.put("nivel", nivel).put("liberadoPor", pessoa.optString("nome")).put("liberadoEm", agora);
        objetoDaConfig("sessoes").remove(aparelho);
        salvarConfig();
      }
      registrar("configuracao", pessoa.optString("nome") + " liberou o " + aqui + " como tablet chefe " + nomeDoNivel(nivel) + (antes > 0 ? " (antes: " + nomeDoNivel(antes) + ")" : ""), pessoa.optString("nome"), aqui, null);
      enviarJson(saida, 200, new JSONObject().put("ok", true).put("nivel", nivel));
      return;
    }
    if ("recuperar".equals(acao)) {
      // o dono esqueceu a senha ou perdeu o tablet nível 3: com a senha do programador, este aparelho vira o do dono
      if (!podeTentarProgramador(aparelho)) { enviarJson(saida, 429, new JSONObject().put("erro", "Muitas senhas erradas. Espere um minuto.")); return; }
      if (!senhaDoProgramador(pedido.optString("senha"))) {
        errouProgramador(aparelho);
        registrar("entrada", "Senha do programador errada no " + aqui, "", aqui, null);
        enviarJson(saida, 403, new JSONObject().put("erro", "Senha do programador errada"));
        return;
      }
      String nova = pedido.has("novaSenha") && pedido.opt("novaSenha") != JSONObject.NULL ? pedido.optString("novaSenha") : "";
      synchronized (this) {
        JSONObject dono = pessoaPorId(config.optString("donoId"));
        if (dono == null) { enviarJson(saida, 409, new JSONObject().put("erro", "O sistema não tem dono cadastrado")); return; }
        if (!nova.isEmpty()) {
          if (!nova.matches("\\d{4,8}")) { enviarJson(saida, 400, new JSONObject().put("erro", "A senha tem de 4 a 8 números")); return; }
          JSONArray l = pessoas();
          for (int i = 0; i < l.length(); i++) {
            JSONObject x = l.optJSONObject(i);
            if (x == null || x == dono || x.optString("resumo").isEmpty()) continue;
            if (resumoDaSenha(nova, x.optString("sal")).equals(x.optString("resumo"))) { enviarJson(saida, 400, new JSONObject().put("erro", "Essa senha já é de outra pessoa. Escolha outra.")); return; }
          }
          guardarSenha(dono, nova);
        }
        dono.put("nivel", "administrador").put("ativo", true);
        JSONObject sessoes = objetoDaConfig("sessoes");
        List<String> tirar = new ArrayList<>();
        for (Iterator<String> it = sessoes.keys(); it.hasNext(); ) { String k = it.next(); JSONObject s = sessoes.optJSONObject(k); if (s != null && dono.optString("id").equals(s.optString("pessoaId"))) tirar.add(k); }
        for (String k : tirar) sessoes.remove(k);
        JSONObject todos = objetoDaConfig("aparelhosChefe");
        JSONObject a = todos.optJSONObject(aparelho);
        if (a == null) { a = new JSONObject(); todos.put(aparelho, a); }
        a.put("nivel", 3).put("liberadoPor", "senha do programador").put("liberadoEm", System.currentTimeMillis());
        sessoes.remove(aparelho);
        salvarConfig();
      }
      registrar("configuracao", "Com a senha do programador, o " + aqui + " virou o tablet do dono (nível 3)" + (nova.isEmpty() ? "" : " e a senha do dono foi trocada"), "", aqui, null);
      enviarJson(saida, 200, new JSONObject().put("ok", true).put("nivel", 3));
      return;
    }
    enviarJson(saida, 400, new JSONObject().put("erro", "ação desconhecida"));
  }

  private synchronized JSONObject listaDePessoas() throws Exception {
    JSONArray l = pessoas();
    JSONArray publicas = new JSONArray();
    for (int i = 0; i < l.length(); i++) { JSONObject p = l.optJSONObject(i); if (p != null) publicas.put(pessoaPublica(p)); }
    return new JSONObject().put("pessoas", publicas).put("aparelhos", objetoDaConfig("aparelhosChefe")).put("donoId", config.optString("donoId"));
  }

  /* ------------------------------------------------------------------ */
  /* Aparelhos bloqueados (versão 2.11). O administrador bloqueia um     */
  /* aparelho pelo tablet chefe. "Pede senha": ele só volta com a senha  */
  /* de desbloqueio (o próprio aparelho confere, até longe da usina).    */
  /* "Trava de vez": só o administrador desbloqueia. Com "apagar", o     */
  /* aparelho apaga as anotações que guarda. A lista vai para a nuvem.   */
  /* ------------------------------------------------------------------ */

  private final Map<String, Long> avisouBloqueado = new HashMap<>();

  private synchronized JSONObject bloqueios() throws Exception { return objetoDaConfig("bloqueios"); }

  /** Número de revisão dos bloqueios: sobe a cada bloquear, desbloquear ou liberar e fica gravado. Cada bloqueio leva
      o seu. O aparelho compara por ele (e não pelo relógio, que pode voltar para trás, nem pela hora, que pode repetir). */
  private synchronized long novaRevisaoDeBloqueio() throws Exception {
    long rev = config.optLong("bloqueiosRev", 0L) + 1;
    config.put("bloqueiosRev", rev);
    return rev;
  }

  private static JSONObject bloqueioPublico(JSONObject b) throws Exception {
    return new JSONObject().put("em", b.optLong("em")).put("rev", b.optLong("rev", 0L)).put("modo", b.optString("modo")).put("apagar", b.optBoolean("apagar"))
        .put("sal", b.optString("sal")).put("resumo", b.optString("resumo"));
  }

  /** Os bloqueios como vão para a nuvem (com o id do aparelho). A senha de desbloqueio (sal e resumo) não sobe:
      a rota da nuvem é aberta e daria para testar senhas fora do aparelho. */
  private synchronized JSONObject bloqueiosParaNuvem() throws Exception {
    JSONObject todos = bloqueios();
    List<String> ids = new ArrayList<>();
    for (Iterator<String> it = todos.keys(); it.hasNext(); ) ids.add(it.next());
    Collections.sort(ids);
    JSONArray lista = new JSONArray();
    for (String id : ids) {
      JSONObject b = todos.optJSONObject(id);
      if (b != null) lista.put(new JSONObject().put("id", id).put("em", b.optLong("em")).put("rev", b.optLong("rev", 0L)).put("modo", b.optString("modo")).put("apagar", b.optBoolean("apagar")));
    }
    // a lista e a revisão saem juntas: a revisão diz até onde a lista está certa
    return new JSONObject().put("lista", lista).put("rev", config.optLong("bloqueiosRev", 0L));
  }

  private synchronized void avisarBloqueado(String aparelho) {
    Long antes = avisouBloqueado.get(aparelho);
    if (antes != null && System.currentTimeMillis() - antes < 3600000L) return;
    avisouBloqueado.put(aparelho, System.currentTimeMillis());
    String nome = nomeDoAparelho(aparelho);
    registrar("aparelho", nome + " está bloqueado e tentou falar com a central", "", nome, null);
  }

  /** As informações que o aparelho manda dele (nome no Android, fabricante, modelo, versão do Android). */
  private static JSONObject infoLimpa(JSONObject info) throws Exception {
    if (info == null) return null;
    JSONObject limpo = new JSONObject();
    for (String k : new String[] { "nome", "fabricante", "modelo", "android", "navegador" }) {
      Object v = info.opt(k);
      if (v instanceof String && !((String) v).trim().isEmpty()) { String s = ((String) v).trim(); limpo.put(k, s.length() > 60 ? s.substring(0, 60) : s); }
    }
    return limpo.length() == 0 ? null : limpo;
  }

  private static boolean mesmaInfo(JSONObject a, JSONObject b) {
    if (a == null || b == null) return a == b;
    for (String k : new String[] { "nome", "fabricante", "modelo", "android", "navegador" }) if (!a.optString(k).equals(b.optString(k))) return false;
    return true;
  }

  /** Todos os aparelhos que já falaram com esta central: os ligados primeiro. */
  private synchronized JSONArray listaDeAparelhos() throws Exception {
    long agora = System.currentTimeMillis();
    JSONObject vistos = objetoDaConfig("aparelhosVistos");
    List<String> ids = new ArrayList<>(aparelhos.keySet());
    for (Iterator<String> it = vistos.keys(); it.hasNext(); ) { String id = it.next(); if (!ids.contains(id)) ids.add(id); }
    List<JSONObject> lista = new ArrayList<>();
    for (String id : ids) {
      JSONObject a = aparelhos.get(id);
      JSONObject v = vistos.optJSONObject(id);
      if (v == null) v = new JSONObject();
      long visto = a != null ? a.optLong("vistoEm") : v.optLong("vistoEm");
      String papel = a != null && !a.optString("papel").isEmpty() ? a.optString("papel") : v.optString("papel");
      JSONObject b = bloqueios().optJSONObject(id);
      JSONObject pessoa = "central".equals(papel) ? pessoaDoAparelho(id) : null;
      JSONObject info = a != null && a.optJSONObject("info") != null ? a.optJSONObject("info") : v.optJSONObject("info");
      String ip = a != null && !a.optString("ip").isEmpty() ? a.optString("ip") : v.optString("ip");
      String versao = a != null && !a.optString("versao").isEmpty() ? a.optString("versao") : v.optString("versao");
      lista.add(new JSONObject()
          .put("id", id).put("papel", papel).put("operador", a != null ? a.optString("operador") : "").put("ip", ip).put("versao", versao)
          .put("nome", nomeDoAparelho(id)).put("pessoa", pessoa != null ? pessoa.optString("nome") : "").put("teto", tetoDoAparelho(id))
          .put("info", info != null ? info : JSONObject.NULL).put("desde", v.has("desde") ? (Object) v.optLong("desde") : JSONObject.NULL)
          .put("online", a != null && agora - visto < 30000)
          .put("minutos", visto > 0 ? (Object) Math.round((agora - visto) / 60000.0) : JSONObject.NULL)
          .put("bloqueio", b == null ? JSONObject.NULL : new JSONObject().put("em", b.optLong("em")).put("modo", b.optString("modo")).put("apagar", b.optBoolean("apagar")).put("por", b.optString("por"))));
    }
    Collections.sort(lista, (x, y) -> {
      if (x.optBoolean("online") != y.optBoolean("online")) return x.optBoolean("online") ? -1 : 1;
      long mx = x.opt("minutos") instanceof Number ? x.optLong("minutos") : Long.MAX_VALUE, my = y.opt("minutos") instanceof Number ? y.optLong("minutos") : Long.MAX_VALUE;
      return Long.compare(mx, my);
    });
    JSONArray saida = new JSONArray();
    for (JSONObject o : lista) saida.put(o);
    return saida;
  }

  /** Aparelho bloqueado que pede senha: a senha de desbloqueio libera. */
  private void apiLiberar(byte[] corpo, String aparelho, OutputStream saida) throws Exception {
    JSONObject pedido = new JSONObject(new String(corpo, StandardCharsets.UTF_8));
    JSONObject b;
    synchronized (this) { b = bloqueios().optJSONObject(aparelho); }
    if (b == null) { enviarJson(saida, 200, new JSONObject().put("ok", true)); return; }
    // a liberação vale só para o bloqueio em que a senha foi digitada: um bloqueio mais novo (mesmo com a mesma senha) continua
    final long rev = b.optLong("rev", 0L);
    // e só desta central (geração): a revisão é um contador de cada central
    if (!"senha".equals(b.optString("modo")) || pedido.optLong("rev", -1L) != rev || !getGeracao().equals(pedido.optString("geracao"))) { enviarJson(saida, 423, new JSONObject().put("erro", "bloqueado").put("bloqueio", bloqueioPublico(b)).put("geracao", getGeracao())); return; }
    long agora = System.currentTimeMillis();
    List<Long> t;
    synchronized (tentativasSenha) {
      t = tentativasSenha.get("liberar|" + aparelho);
      if (t == null) { t = new ArrayList<>(); tentativasSenha.put("liberar|" + aparelho, t); }
      Iterator<Long> it = t.iterator();
      while (it.hasNext()) if (agora - it.next() >= 60000L) it.remove();
      if (t.size() >= 5) { enviarJson(saida, 429, new JSONObject().put("erro", "Muitas senhas erradas. Espere um minuto.")); return; }
    }
    String codigo = pedido.optString("codigo");
    boolean certa = codigo.matches("\\d{4,8}") && MessageDigest.isEqual(resumoDaSenha(codigo, b.optString("sal")).getBytes(StandardCharsets.UTF_8), b.optString("resumo").getBytes(StandardCharsets.UTF_8));
    if (!certa) {
      synchronized (tentativasSenha) { t.add(agora); }
      enviarJson(saida, 403, new JSONObject().put("erro", "Senha errada").put("bloqueio", bloqueioPublico(b)).put("geracao", getGeracao()));
      return;
    }
    JSONObject atual;
    synchronized (this) {
      // confere de novo junto com a remoção: o administrador pode ter trocado o bloqueio enquanto a senha era conferida
      atual = bloqueios().optJSONObject(aparelho);
      if (atual != null && atual.optLong("rev", 0L) == rev) { bloqueios().remove(aparelho); novaRevisaoDeBloqueio(); salvarConfig(); }
    }
    if (atual != null && atual.optLong("rev", 0L) != rev) { enviarJson(saida, 423, new JSONObject().put("erro", "bloqueado").put("bloqueio", bloqueioPublico(atual)).put("geracao", getGeracao())); return; }
    String nome = nomeDoAparelho(aparelho);
    registrar("aparelho", nome + " foi liberado com a senha de desbloqueio", "", nome, null);
    agendarNuvem();
    enviarJson(saida, 200, new JSONObject().put("ok", true));
  }

  /** Bloquear e desbloquear um aparelho: só o administrador. */
  private void apiAparelhos(byte[] corpo, String aparelho, OutputStream saida) throws Exception {
    JSONObject pedido = new JSONObject(new String(corpo, StandardCharsets.UTF_8));
    JSONObject quem = pessoaDoAparelho(aparelho);
    if (quem == null || !podeNoAparelho(aparelho, "pessoas")) { enviarJson(saida, 403, new JSONObject().put("erro", "Só o administrador bloqueia e desbloqueia aparelhos")); return; }
    String id = pedido.optString("id");
    if (id.length() > 80) id = id.substring(0, 80);
    if (id.isEmpty() || (!aparelhos.containsKey(id) && !objetoDaConfig("aparelhosVistos").has(id))) { enviarJson(saida, 404, new JSONObject().put("erro", "Aparelho não encontrado")); return; }
    String nome = nomeDoAparelho(id), aqui = nomeDoAparelho(aparelho), nomeQuem = quem.optString("nome");
    String acao = pedido.optString("acao");
    if ("bloquear".equals(acao)) {
      if (id.equals(aparelho)) { enviarJson(saida, 400, new JSONObject().put("erro", "Não dá para bloquear o aparelho que você está usando")); return; }
      String modo = "senha".equals(pedido.optString("modo")) ? "senha" : "trava";
      JSONObject b = new JSONObject().put("em", System.currentTimeMillis()).put("modo", modo).put("apagar", pedido.optBoolean("apagar")).put("por", nomeQuem);
      if ("senha".equals(modo)) {
        String codigo = pedido.optString("codigo");
        if (!codigo.matches("\\d{4,8}")) { enviarJson(saida, 400, new JSONObject().put("erro", "A senha de desbloqueio tem de 4 a 8 números")); return; }
        guardarSenha(b, codigo);
      }
      synchronized (this) { b.put("rev", novaRevisaoDeBloqueio()); bloqueios().put(id, b); objetoDaConfig("sessoes").remove(id); salvarConfig(); }
      registrar("configuracao", nomeQuem + " bloqueou o " + nome + " (" + ("senha".equals(modo) ? "pede a senha de desbloqueio" : "travado de vez")
          + (b.optBoolean("apagar") ? ", apagando as anotações guardadas nele" : "") + ")", nomeQuem, aqui, null);
      agendarNuvem();
      enviarJson(saida, 200, new JSONObject().put("ok", true).put("aparelhos", listaDeAparelhos()));
      return;
    }
    if ("desbloquear".equals(acao)) {
      boolean tinha;
      synchronized (this) { tinha = bloqueios().has(id); if (tinha) { bloqueios().remove(id); novaRevisaoDeBloqueio(); salvarConfig(); } }
      if (tinha) { registrar("configuracao", nomeQuem + " desbloqueou o " + nome, nomeQuem, aqui, null); agendarNuvem(); }
      enviarJson(saida, 200, new JSONObject().put("ok", true).put("aparelhos", listaDeAparelhos()));
      return;
    }
    enviarJson(saida, 400, new JSONObject().put("erro", "ação desconhecida"));
  }
}
