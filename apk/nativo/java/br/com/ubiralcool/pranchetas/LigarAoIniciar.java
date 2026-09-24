/* Pranchetas Digitais - (c) 2026 Guilherme. Todos os direitos reservados. Uso somente com autorizacao do autor (veja LICENCA.txt). */
package br.com.ubiralcool.pranchetas;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/**
 * O tablet chefe religou (acabou a bateria, atualização do Android) ou o aplicativo foi atualizado:
 * liga o servidor da usina sozinho, sem ninguém precisar abrir o aplicativo.
 * Só liga se este tablet já estava ligado como tablet chefe.
 */
public class LigarAoIniciar extends BroadcastReceiver {

  static final String PREFERENCIAS = "pranchetas";
  static final String SERVIDOR_LIGADO = "servidorLigado";

  /** Guarda se este tablet é o tablet chefe (liga ao preparar, desliga ao desconectar). */
  static void lembrar(Context contexto, boolean ligado) {
    contexto.getSharedPreferences(PREFERENCIAS, Context.MODE_PRIVATE).edit().putBoolean(SERVIDOR_LIGADO, ligado).apply();
  }

  @Override
  public void onReceive(Context contexto, Intent intent) {
    String acao = intent == null ? "" : String.valueOf(intent.getAction());
    if (!Intent.ACTION_BOOT_COMPLETED.equals(acao) && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(acao)) return;
    android.content.SharedPreferences pref = contexto.getSharedPreferences(PREFERENCIAS, Context.MODE_PRIVATE);
    // quem veio da versão 2.2 ainda não tem a marca: vale ter as pastas do servidor (a tela desliga se não for mais o tablet chefe)
    boolean ligar = pref.contains(SERVIDOR_LIGADO)
        ? pref.getBoolean(SERVIDOR_LIGADO, false)
        : new java.io.File(new java.io.File(contexto.getFilesDir(), "ServidorUsina"), "config.json").exists();
    if (!ligar) return;
    try {
      Intent servico = new Intent(contexto, ServicoCentral.class);
      if (Build.VERSION.SDK_INT >= 26) contexto.startForegroundService(servico);
      else contexto.startService(servico);
    } catch (Exception e) {
      // o Android não deixou: o servidor liga quando alguém abrir o aplicativo
    }
  }
}
