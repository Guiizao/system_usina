/* Pranchetas Digitais - (c) 2026 Guilherme. Todos os direitos reservados. Uso somente com autorizacao do autor (veja LICENCA.txt). */
package br.com.ubiralcool.pranchetas;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

/**
 * Mantém o servidor da usina ligado mesmo com a tela apagada ou com o app em segundo plano.
 * Mostra um aviso fixo na barra de notificações ("Servidor da usina ligado").
 */
public class ServicoCentral extends Service {

  private static final String CANAL = "servidor-usina";
  private static final int AVISO = 8080;

  private PowerManager.WakeLock travaCpu;
  private WifiManager.WifiLock travaWifi;

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    ServicoCompat.mostrarAviso(this);
    if (!Protecao.assinaturaConfere(this)) { stopSelf(); return START_NOT_STICKY; } // cópia alterada: a central não liga
    try {
      ServidorCentral.pegar(this, 8080).iniciar(); // se o Android reiniciar o serviço, o servidor volta sozinho
    } catch (Exception ignorado) { /* a tela tenta de novo quando abrir */ }
    segurarCpuEWifi();
    return START_STICKY;
  }

  private void segurarCpuEWifi() {
    try {
      if (travaCpu == null) {
        PowerManager energia = (PowerManager) getSystemService(Context.POWER_SERVICE);
        travaCpu = energia.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "pranchetas:servidor");
        travaCpu.setReferenceCounted(false);
        travaCpu.acquire();
      }
      if (travaWifi == null) {
        WifiManager wifi = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        @SuppressWarnings("deprecation")
        int modo = WifiManager.WIFI_MODE_FULL_HIGH_PERF;
        travaWifi = wifi.createWifiLock(modo, "pranchetas:servidor");
        travaWifi.setReferenceCounted(false);
        travaWifi.acquire();
      }
    } catch (Exception ignorado) { /* sem trava o servidor funciona, só pode dormir com a tela apagada */ }
  }

  @Override
  public void onDestroy() {
    try { if (travaCpu != null && travaCpu.isHeld()) travaCpu.release(); } catch (Exception ignorado) { }
    try { if (travaWifi != null && travaWifi.isHeld()) travaWifi.release(); } catch (Exception ignorado) { }
    super.onDestroy();
  }

  @Override
  public IBinder onBind(Intent intent) { return null; }

  /** Separado para ficar fácil de ler. */
  static class ServicoCompat {
    static void mostrarAviso(Service servico) {
      NotificationManager gerente = (NotificationManager) servico.getSystemService(Context.NOTIFICATION_SERVICE);
      if (Build.VERSION.SDK_INT >= 26 && gerente != null) {
        NotificationChannel canal = new NotificationChannel(CANAL, "Servidor da usina", NotificationManager.IMPORTANCE_LOW);
        canal.setDescription("Mostra que o tablet chefe está recebendo as pranchetas");
        gerente.createNotificationChannel(canal);
      }
      Intent abrirApp = new Intent(servico, MainActivity.class);
      abrirApp.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
      PendingIntent aoTocar = PendingIntent.getActivity(servico, 0, abrirApp,
          PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));

      Notification aviso = new NotificationCompat.Builder(servico, CANAL)
          .setContentTitle("Servidor da usina ligado")
          .setContentText("Este tablet está recebendo as pranchetas dos setores")
          .setSmallIcon(android.R.drawable.stat_sys_upload_done)
          .setOngoing(true)
          .setContentIntent(aoTocar)
          .setPriority(NotificationCompat.PRIORITY_LOW)
          .build();

      int tipo = Build.VERSION.SDK_INT >= 34 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE : 0;
      ServiceCompat.startForeground(servico, AVISO, aviso, tipo);
    }
  }
}
