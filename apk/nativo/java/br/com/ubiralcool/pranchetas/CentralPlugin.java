/* Pranchetas Digitais - (c) 2026 Guilherme. Todos os direitos reservados. Uso somente com autorizacao do autor (veja LICENCA.txt). */
package br.com.ubiralcool.pranchetas;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Base64;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PermissionState;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Locale;

/**
 * Ponte entre a tela (app.js) e o Android:
 * - liga o servidor da usina dentro do tablet chefe e mantém ligado com a tela apagada;
 * - cria as pastas ServidorUsina, RelatoriosUsina e BackupUsina;
 * - envia a folha direto para o WhatsApp ou e-mail do escritório;
 * - baixa a versão nova do aplicativo e abre o instalador do Android (versão 2.7);
 * - atualização rápida: troca as telas sem instalar APK, e volta sozinho se a versão nova não abrir (versão 2.8).
 */
@CapacitorPlugin(name = "Central", permissions = {
    // Android 17: permissão "Rede local". Android 16 (alguns aparelhos, como Motorola, já bloqueiam): "Dispositivos por perto".
    @Permission(alias = "redeLocal", strings = { "android.permission.ACCESS_LOCAL_NETWORK" }),
    @Permission(alias = "dispositivos", strings = { "android.permission.NEARBY_WIFI_DEVICES" })
})
public class CentralPlugin extends Plugin {

  private static final int PORTA_PADRAO = 8080;
  private static final String REDE_LOCAL = "android.permission.ACCESS_LOCAL_NETWORK";

  /** Qual permissão libera a rede local neste Android (ou null se ele não bloqueia). */
  private String aliasDaRede() {
    try {
      getContext().getPackageManager().getPermissionInfo(REDE_LOCAL, 0);
      return "redeLocal"; // o sistema conhece a permissão nova
    } catch (PackageManager.NameNotFoundException e) {
      return Build.VERSION.SDK_INT >= 36 ? "dispositivos" : null;
    }
  }

  /**
   * Confere (e, com pedir=true, pede) a permissão para falar com os outros tablets no Wi-Fi.
   * Responde estado: livre (este Android não bloqueia), concedida, negada ou bloqueada (a pessoa marcou para não perguntar mais).
   */
  @PluginMethod
  public void permissaoRede(PluginCall chamada) {
    String alias = aliasDaRede();
    if (alias == null) { chamada.resolve(new JSObject().put("estado", "livre")); return; }
    if (getPermissionState(alias) == PermissionState.GRANTED) { chamada.resolve(new JSObject().put("estado", "concedida")); return; }
    if (!Boolean.TRUE.equals(chamada.getBoolean("pedir", false))) { chamada.resolve(new JSObject().put("estado", "negada")); return; }
    requestPermissionForAlias(alias, chamada, "voltouPermissaoRede");
  }

  @PermissionCallback
  private void voltouPermissaoRede(PluginCall chamada) {
    String alias = aliasDaRede();
    boolean ok = alias == null || getPermissionState(alias) == PermissionState.GRANTED;
    boolean podePerguntar = getActivity() != null && alias != null
        && ActivityCompat.shouldShowRequestPermissionRationale(getActivity(), "redeLocal".equals(alias) ? REDE_LOCAL : Manifest.permission.NEARBY_WIFI_DEVICES);
    chamada.resolve(new JSObject().put("estado", ok ? "concedida" : podePerguntar ? "negada" : "bloqueada"));
  }

  /** Abre a tela do aplicativo nos ajustes do Android (para liberar uma permissão na mão). */
  @PluginMethod
  public void abrirAjustesDoApp(PluginCall chamada) {
    try {
      Intent tela = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
      tela.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      getContext().startActivity(tela);
      chamada.resolve(new JSObject().put("aberto", true));
    } catch (Exception e) {
      chamada.reject("Não consegui abrir os ajustes: " + e.getMessage());
    }
  }

  private ServidorCentral servidor(PluginCall chamada) {
    return ServidorCentral.pegar(getContext(), chamada.getInt("porta", PORTA_PADRAO));
  }

  @PluginMethod
  public void criarPastas(PluginCall chamada) {
    try {
      chamada.resolve(JSObject.fromJSONObject(servidor(chamada).criarPastas()));
    } catch (Exception e) {
      chamada.reject("Não consegui criar as pastas: " + e.getMessage());
    }
  }

  @PluginMethod
  public void iniciar(PluginCall chamada) {
    try {
      ServidorCentral s = servidor(chamada);
      s.iniciar();
      chamada.resolve(estadoAtual(s));
    } catch (Exception e) {
      chamada.reject("Não consegui ligar o servidor: " + e.getMessage());
    }
  }

  /** Liga o serviço com aviso fixo na barra, para o Android não desligar o servidor. */
  @PluginMethod
  public void manterLigado(PluginCall chamada) {
    Context ctx = getContext();
    boolean perguntar = chamada.getBoolean("perguntar", false); // só na tela de preparar, para não incomodar toda vez que abre
    try {
      if (perguntar && Build.VERSION.SDK_INT >= 33 && getActivity() != null
          && ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
        ActivityCompat.requestPermissions(getActivity(), new String[] { Manifest.permission.POST_NOTIFICATIONS }, 7001);
      }
      Intent servico = new Intent(ctx, ServicoCentral.class);
      if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(servico);
      else ctx.startService(servico);
      LigarAoIniciar.lembrar(ctx, true); // se o tablet religar, o servidor liga sozinho

      boolean bateriaLivre = true;
      PowerManager energia = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
      if (Build.VERSION.SDK_INT >= 23 && energia != null && !energia.isIgnoringBatteryOptimizations(ctx.getPackageName())) {
        bateriaLivre = false;
        if (perguntar) try {
          Intent pedido = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + ctx.getPackageName()));
          pedido.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
          ctx.startActivity(pedido);
        } catch (Exception ignorado) { /* alguns aparelhos não têm essa tela */ }
      }
      chamada.resolve(new JSObject().put("ligado", true).put("bateriaLivre", bateriaLivre));
    } catch (Exception e) {
      chamada.reject("Não consegui manter o servidor ligado: " + e.getMessage());
    }
  }

  /** Abre a impressão do Android com as folhas que a tela montou (também dá para salvar em PDF). */
  @PluginMethod
  public void imprimir(PluginCall chamada) {
    final String nome = chamada.getString("nome", "Pranchetas");
    getActivity().runOnUiThread(() -> {
      try {
        android.print.PrintManager impressao = (android.print.PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
        android.print.PrintDocumentAdapter adaptador = getBridge().getWebView().createPrintDocumentAdapter(nome);
        impressao.print(nome, adaptador, new android.print.PrintAttributes.Builder()
            .setMediaSize(android.print.PrintAttributes.MediaSize.ISO_A4).build());
        chamada.resolve(new JSObject().put("aberto", true));
      } catch (Exception e) {
        chamada.reject("Não consegui abrir a impressão: " + e.getMessage());
      }
    });
  }

  /** Liga ou desliga a tela cheia. Sem "ligar", só responde como está. */
  @PluginMethod
  public void telaCheia(PluginCall chamada) {
    if (!(getActivity() instanceof MainActivity)) { chamada.reject("Tela cheia indisponível"); return; }
    MainActivity atividade = (MainActivity) getActivity();
    if (chamada.hasOption("ligar")) atividade.definirTelaCheia(Boolean.TRUE.equals(chamada.getBoolean("ligar", false)));
    chamada.resolve(new JSObject().put("ligada", chamada.hasOption("ligar") ? Boolean.TRUE.equals(chamada.getBoolean("ligar", false)) : atividade.estaEmTelaCheia()));
  }

  @PluginMethod
  public void estado(PluginCall chamada) {
    chamada.resolve(estadoAtual(servidor(chamada)));
  }

  @PluginMethod
  public void parar(PluginCall chamada) {
    Context ctx = getContext();
    LigarAoIniciar.lembrar(ctx, false);
    ctx.stopService(new Intent(ctx, ServicoCentral.class));
    servidor(chamada).parar();
    chamada.resolve(new JSObject().put("rodando", false));
  }

  /** Guarda o arquivo em RelatoriosUsina (e em Documentos/Usina). */
  @PluginMethod
  public void guardarDocumento(PluginCall chamada) {
    try {
      String nome = limparNome(chamada.getString("nome", "folha.xlsx"));
      String data = chamada.getString("data", "");
      if (!data.matches("\\d{4}-\\d{2}-\\d{2}")) data = "sem-data";
      byte[] dados = Base64.decode(chamada.getString("base64", ""), Base64.DEFAULT);
      String onde = servidor(chamada).guardarRelatorio(data, nome, dados);
      chamada.resolve(new JSObject().put("caminho", onde));
    } catch (Exception e) {
      chamada.reject("Não consegui guardar o arquivo: " + e.getMessage());
    }
  }

  /**
   * destino: whatsapp | email | outros
   * numero: número do WhatsApp com DDI (5514999999999), vazio para escolher a conversa
   * email: endereço do escritório, vazio para escolher
   */
  @PluginMethod
  public void compartilhar(PluginCall chamada) {
    final Context ctx = getContext();
    final String destino = chamada.getString("destino", "outros");
    final String numero = chamada.getString("numero", "").replaceAll("\\D", "");
    final String email = chamada.getString("email", "").trim();
    final String assunto = chamada.getString("assunto", "Pranchetas Ubirálcool");
    final String texto = chamada.getString("texto", "");
    final String nome = chamada.getString("nome", "");
    final String mime = chamada.getString("mime", "text/plain");
    final String base64 = chamada.getString("base64", "");

    try {
      Uri arquivo = null;
      if (!nome.isEmpty() && !base64.isEmpty()) {
        File pasta = new File(ctx.getCacheDir(), "enviar");
        if (!pasta.exists()) pasta.mkdirs();
        File f = new File(pasta, limparNome(nome));
        try (FileOutputStream saida = new FileOutputStream(f)) { saida.write(Base64.decode(base64, Base64.DEFAULT)); }
        arquivo = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", f);
      }

      final Intent envio = new Intent(Intent.ACTION_SEND);
      envio.setType(arquivo != null ? mime : "text/plain");
      if (!texto.isEmpty()) envio.putExtra(Intent.EXTRA_TEXT, texto);
      envio.putExtra(Intent.EXTRA_SUBJECT, assunto);
      if (arquivo != null) {
        envio.putExtra(Intent.EXTRA_STREAM, arquivo);
        envio.setClipData(ClipData.newRawUri(nome, arquivo));
        envio.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
      }

      final Intent abrir;
      if ("whatsapp".equals(destino)) {
        String pacote = instalado(ctx, "com.whatsapp") ? "com.whatsapp" : instalado(ctx, "com.whatsapp.w4b") ? "com.whatsapp.w4b" : null;
        if (pacote == null) { chamada.reject("O WhatsApp não está instalado neste tablet"); return; }
        envio.setPackage(pacote);
        if (!numero.isEmpty()) envio.putExtra("jid", numero + "@s.whatsapp.net"); // abre direto a conversa do escritório
        abrir = envio;
      } else if ("email".equals(destino)) {
        if (!email.isEmpty()) envio.putExtra(Intent.EXTRA_EMAIL, new String[] { email });
        Intent soEmail = new Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:"));
        envio.setSelector(soEmail); // mostra só aplicativos de e-mail
        abrir = envio;
      } else {
        abrir = Intent.createChooser(envio, "Enviar a folha");
      }
      abrir.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

      getActivity().runOnUiThread(() -> {
        try {
          getActivity().startActivity(abrir);
          chamada.resolve(new JSObject().put("aberto", true));
        } catch (ActivityNotFoundException e) {
          try {
            // não achou o app pedido: abre a lista de aplicativos
            envio.setSelector(null);
            envio.setPackage(null);
            envio.removeExtra("jid");
            Intent lista = Intent.createChooser(envio, "Enviar a folha");
            lista.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(lista);
            chamada.resolve(new JSObject().put("aberto", true).put("lista", true));
          } catch (Exception erro) {
            chamada.reject("Nenhum aplicativo consegue enviar este arquivo");
          }
        }
      });
    } catch (Exception e) {
      chamada.reject("Não consegui preparar o envio: " + e.getMessage());
    }
  }

  /**
   * Atualização do aplicativo (versão 2.7). Baixa o APK novo (url), confere o tamanho e o SHA-256,
   * confere se é este mesmo aplicativo, com a mesma assinatura, e abre o instalador do Android.
   * Quem confirma é a pessoa, na janela do Android. As anotações guardadas continuam.
   * Se o Android ainda não deixa este aplicativo instalar, abre a tela para liberar e responde precisaPermissao.
   * Enquanto baixa, avisa a tela pelo evento progressoAtualizacao (baixado, total).
   */
  @PluginMethod
  public void atualizar(PluginCall chamada) {
    final Context ctx = getContext();
    final String endereco = chamada.getString("url", "");
    final String sha = chamada.getString("sha256", "").toLowerCase(Locale.ROOT);
    final long tamanho = chamada.getLong("tamanho", 0L);
    if (!endereco.startsWith("http://") && !endereco.startsWith("https://")) { chamada.reject("endereço da atualização inválido"); return; }
    if (Build.VERSION.SDK_INT >= 26 && !ctx.getPackageManager().canRequestPackageInstalls()) {
      try {
        Intent tela = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + ctx.getPackageName()));
        tela.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(tela);
      } catch (Exception e) { /* alguns aparelhos não têm essa tela: libera em Ajustes > Apps */ }
      chamada.resolve(new JSObject().put("precisaPermissao", true));
      return;
    }
    new Thread(() -> {
      File pasta = new File(ctx.getCacheDir(), "atualizacao");
      File apk = new File(pasta, "pranchetas.apk");
      try {
        pasta.mkdirs();
        MessageDigest resumo = MessageDigest.getInstance("SHA-256");
        HttpURLConnection conexao = (HttpURLConnection) new URL(endereco).openConnection();
        conexao.setConnectTimeout(10000);
        conexao.setReadTimeout(30000);
        long baixado = 0;
        try {
          int codigo = conexao.getResponseCode();
          if (codigo != 200) throw new IOException("a central respondeu " + codigo);
          long total = conexao.getContentLength() > 0 ? conexao.getContentLength() : tamanho;
          long avisado = 0;
          try (InputStream entrada = conexao.getInputStream(); FileOutputStream saida = new FileOutputStream(apk)) {
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = entrada.read(buf)) > 0) {
              saida.write(buf, 0, n);
              resumo.update(buf, 0, n);
              baixado += n;
              if (baixado - avisado >= 256 * 1024 || baixado == total) {
                avisado = baixado;
                notifyListeners("progressoAtualizacao", new JSObject().put("baixado", baixado).put("total", total));
              }
            }
          }
        } finally {
          conexao.disconnect();
        }
        if (tamanho > 0 && baixado != tamanho) throw new IOException("o arquivo chegou incompleto");
        if (!sha.isEmpty() && !sha.equals(hexDe(resumo.digest()))) throw new IOException("o arquivo chegou com defeito");
        PackageManager pm = ctx.getPackageManager();
        PackageInfo novo = pm.getPackageArchiveInfo(apk.getPath(), 0);
        if (novo == null || !ctx.getPackageName().equals(novo.packageName)) throw new IOException("o arquivo não é o aplicativo das pranchetas");
        if (!mesmaAssinatura(pm, ctx.getPackageName(), apk.getPath())) {
          throw new IOException("esta versão foi gerada em outro computador e o Android não deixa atualizar por cima. Instale à mão");
        }
        final Intent instalar = new Intent(Intent.ACTION_VIEW);
        instalar.setDataAndType(FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", apk), "application/vnd.android.package-archive");
        instalar.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getActivity().runOnUiThread(() -> {
          try {
            getActivity().startActivity(instalar);
            chamada.resolve(new JSObject().put("aberto", true));
          } catch (Exception e) {
            chamada.reject("não consegui abrir o instalador do Android");
          }
        });
      } catch (Exception e) {
        apk.delete();
        chamada.reject(e.getMessage() != null ? e.getMessage() : "a atualização não baixou");
      }
    }).start();
  }

  /** O APK baixado foi assinado com a mesma chave do aplicativo instalado? Sem conseguir ler, deixa o Android conferir. */
  private static boolean mesmaAssinatura(PackageManager pm, String pacote, String arquivo) {
    if (Build.VERSION.SDK_INT < 28) return true;
    try {
      PackageInfo instalado = pm.getPackageInfo(pacote, PackageManager.GET_SIGNING_CERTIFICATES);
      PackageInfo novo = pm.getPackageArchiveInfo(arquivo, PackageManager.GET_SIGNING_CERTIFICATES);
      if (novo == null || novo.signingInfo == null || instalado.signingInfo == null) return true;
      return Arrays.equals(instalado.signingInfo.getApkContentsSigners(), novo.signingInfo.getApkContentsSigners());
    } catch (Exception e) {
      return true;
    }
  }

  private static String hexDe(byte[] b) {
    StringBuilder s = new StringBuilder();
    for (byte x : b) s.append(String.format(Locale.ROOT, "%02x", x));
    return s.toString();
  }

  /* ---------------- Atualização rápida (versão 2.8): as telas sem instalar APK ---------------- */

  private static final String PREFS_TELAS = "PranchetasTelas";

  private File pastaTelas() { return new File(getContext().getFilesDir(), "telas"); }

  private String versaoDoApk() {
    try { return getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0).versionName; }
    catch (Exception e) { return ""; }
  }

  /** Telas novas que não abriram (o aplicativo não confirmou duas vezes): volta para as que vieram no APK. */
  @Override
  public void load() {
    SharedPreferences p = getContext().getSharedPreferences(PREFS_TELAS, Context.MODE_PRIVATE);
    String pendente = p.getString("pendente", "");
    if (pendente.isEmpty()) return;
    int vezes = p.getInt("tentativas", 0) + 1;
    if (vezes > 2) {
      getContext().getSharedPreferences(com.getcapacitor.plugin.WebView.WEBVIEW_PREFS_NAME, Context.MODE_PRIVATE).edit()
          .putString(com.getcapacitor.plugin.WebView.CAP_SERVER_PATH, "").apply();
      //noinspection ResultOfMethodCallIgnored
      new File(pastaTelas(), "ativa.txt").delete();
      p.edit().putString("pendente", "").putString("voltou", pendente).putInt("tentativas", 0).apply();
    } else {
      p.edit().putInt("tentativas", vezes).apply();
    }
  }

  @PluginMethod
  public void versaoInstalada(PluginCall chamada) {
    chamada.resolve(new JSObject().put("versao", versaoDoApk()));
  }

  /** A tela abriu direito com as telas novas: confirma (e conta se precisou voltar para as antigas). */
  @PluginMethod
  public void telasOk(PluginCall chamada) {
    SharedPreferences p = getContext().getSharedPreferences(PREFS_TELAS, Context.MODE_PRIVATE);
    String voltou = p.getString("voltou", "");
    p.edit().putString("pendente", "").putInt("tentativas", 0).putString("voltou", "").apply();
    chamada.resolve(new JSObject().put("voltou", voltou));
  }

  /**
   * Baixa o pacote das telas (base: .../telas/), confere a assinatura e cada arquivo, e troca as telas.
   * Enquanto baixa, avisa a tela pelo evento progressoTelas (feito, total). No fim o aplicativo recarrega sozinho.
   */
  @PluginMethod
  public void atualizarTelas(PluginCall chamada) {
    final String base = chamada.getString("base", "");
    final String versao = chamada.getString("versao", "");
    if (!base.startsWith("http://") && !base.startsWith("https://")) { chamada.reject("endereço das telas inválido"); return; }
    new Thread(() -> {
      try {
        String chave;
        try (java.io.InputStream e = getContext().getAssets().open("public/chave-telas.txt")) {
          chave = new String(AtualizadorDeTelas.ler(e), java.nio.charset.StandardCharsets.UTF_8).trim();
        }
        final String apk = versaoDoApk();
        final File pastaTelas = pastaTelas();
        if (!pastaTelas.isDirectory() && !pastaTelas.mkdirs()) throw new IOException("não consegui criar a pasta das telas");
        final File ativa = AtualizadorDeTelas.pastaAtiva(pastaTelas, apk);
        org.json.JSONObject pacote = AtualizadorDeTelas.baixar(base, versao, chave, apk, pastaTelas,
            (caminho) -> ativa != null ? new java.io.FileInputStream(new File(ativa, caminho)) : getContext().getAssets().open("public/" + caminho),
            (feito, total) -> notifyListeners("progressoTelas", new JSObject().put("feito", feito).put("total", total)));
        final String pasta = pacote.optString("pasta");
        // as telas novas valem até o APK mudar; se não abrirem, o load() volta para as do APK
        try (FileOutputStream o = new FileOutputStream(new File(pastaTelas, "ativa.txt"))) {
          o.write((versao + "|" + apk).getBytes(java.nio.charset.StandardCharsets.UTF_8));
        }
        getContext().getSharedPreferences(PREFS_TELAS, Context.MODE_PRIVATE).edit().putString("pendente", versao).putInt("tentativas", 0).apply();
        getContext().getSharedPreferences(com.getcapacitor.plugin.WebView.WEBVIEW_PREFS_NAME, Context.MODE_PRIVATE).edit()
            .putString(com.getcapacitor.plugin.WebView.CAP_SERVER_PATH, pasta).apply();
        // tira as pastas velhas (fica a nova)
        File[] velhas = pastaTelas.listFiles();
        if (velhas != null) for (File f : velhas) if (f.isDirectory() && !f.getAbsolutePath().equals(pasta)) AtualizadorDeTelas.apagar(f);
        chamada.resolve(new JSObject().put("pronto", true).put("versao", versao));
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> getBridge().setServerBasePath(pasta), 700);
      } catch (Exception e) {
        chamada.reject(e.getMessage() != null ? e.getMessage() : "as telas novas não baixaram");
      }
    }).start();
  }

  private static boolean instalado(Context ctx, String pacote) {
    try {
      ctx.getPackageManager().getPackageInfo(pacote, 0);
      return true;
    } catch (PackageManager.NameNotFoundException e) {
      return false;
    }
  }

  private static String limparNome(String nome) {
    String limpo = new File(nome).getName().replaceAll("[^\\w.\\- ]", "_").trim();
    return limpo.isEmpty() ? "folha.xlsx" : limpo;
  }

  private JSObject estadoAtual(ServidorCentral s) {
    JSObject resposta = new JSObject();
    resposta.put("rodando", s.estaRodando());
    resposta.put("chave", s.getChave());
    resposta.put("codigo", s.getCodigo());
    JSArray lista = new JSArray();
    for (String endereco : s.enderecos()) lista.put(endereco);
    resposta.put("enderecos", lista);
    return resposta;
  }
}
