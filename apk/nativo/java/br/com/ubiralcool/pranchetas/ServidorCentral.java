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
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
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

  public String novoCodigo() {
    try {
      config.put("codigo", sorteiaCodigo());
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

  /** Um arquivo por dia de produção, para nunca perder a folha. */
  private void backupDoDia(String data) {
    if (data == null || !data.matches("\\d{4}-\\d{2}-\\d{2}")) return;
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
      if ("/api/ping".equals(caminho)) {
        enviarJson(saida, 200, new JSONObject().put("app", "pranchetas").put("rede", "Tablet chefe").put("apk", true));
        return;
      }

      if ("/api/parear".equals(caminho) && "POST".equals(metodo)) {
        if (chutesDemais(ip)) { enviarJson(saida, 429, new JSONObject().put("erro", "Muitas tentativas. Espere um minuto.")); return; }
        JSONObject pedido = new JSONObject(new String(corpo, StandardCharsets.UTF_8));
        if (!getCodigo().equals(pedido.optString("codigo"))) { enviarJson(saida, 403, new JSONObject().put("erro", "Código errado")); return; }
        enviarJson(saida, 200, new JSONObject().put("chave", getChave()).put("rede", "Tablet chefe"));
        return;
      }

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
        if (!getChave().equals(cabecalhos.get("x-chave"))) {
          enviarJson(saida, 401, new JSONObject().put("erro", "Aparelho não conectado à central"));
          return;
        }
        if ("/api/sync".equals(caminho) && "POST".equals(metodo)) { apiSync(corpo, ip, saida); return; }
        if ("/api/registros".equals(caminho)) { apiRegistros(consulta, saida); return; }
        if ("/api/status".equals(caminho)) { apiStatus(saida); return; }
        if ("/api/relatorios".equals(caminho)) { apiRelatorios(saida); return; }
        if ("/api/erros".equals(caminho)) { apiErros(saida); return; }
        if ("/api/novo-codigo".equals(caminho) && "POST".equals(metodo)) { enviarJson(saida, 200, new JSONObject().put("codigo", novoCodigo())); return; }
        if ("/api/relatorio".equals(caminho) && "POST".equals(metodo)) { apiRelatorio(corpo, saida); return; }
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
    JSONArray chegaram = pedido.optJSONArray("registros");
    int aceitos = 0;
    List<String> dias = new ArrayList<>();
    if (chegaram != null) {
      for (int i = 0; i < chegaram.length(); i++) {
        JSONObject r = chegaram.optJSONObject(i);
        if (r == null || r.optString("id").isEmpty() || !r.has("atualizadoEm")) continue;
        JSONObject atual = registros.optJSONObject(r.getString("id"));
        if (atual == null || r.optLong("atualizadoEm") >= atual.optLong("atualizadoEm")) {
          seq++;
          r.put("seq", seq).put("recebidoEm", System.currentTimeMillis());
          r.remove("sincronizado");
          registros.put(r.getString("id"), r);
          if (!dias.contains(r.optString("data"))) dias.add(r.optString("data"));
          aceitos++;
        }
      }
    }
    if (aceitos > 0) {
      salvarRegistros();
      for (String dia : dias) backupDoDia(dia);
    }
    enviarJson(saida, 200, new JSONObject().put("ok", true).put("aceitos", aceitos).put("seq", seq).put("agora", System.currentTimeMillis()));
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
    for (String par : consulta.split("&")) {
      if (par.startsWith("desde=")) {
        try { desde = Long.parseLong(par.substring(6)); } catch (NumberFormatException ignorado) { }
      }
    }
    if (desde > seq) desde = 0; // o aparelho tem número maior: manda tudo
    JSONArray lista = new JSONArray();
    for (Iterator<String> it = registros.keys(); it.hasNext(); ) {
      JSONObject r = registros.optJSONObject(it.next());
      if (r != null && r.optLong("seq") > desde) lista.put(r);
    }
    enviarJson(saida, 200, new JSONObject().put("seq", seq).put("registros", lista));
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
        .put("codigo", getCodigo()).put("enderecos", ends).put("apk", true)
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
    enviarJson(saida, 200, new JSONObject().put("pasta", "RelatoriosUsina").put("dias", dias));
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

  private boolean chutesDemais(String ip) {
    long agora = System.currentTimeMillis();
    List<Long> lista = tentativas.get(ip);
    if (lista == null) { lista = new ArrayList<>(); tentativas.put(ip, lista); }
    lista.removeIf(t -> agora - t > 60000);
    lista.add(agora);
    return lista.size() > 6;
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
    cab.append("Access-Control-Allow-Headers: Content-Type, X-Chave\r\n");
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
}
