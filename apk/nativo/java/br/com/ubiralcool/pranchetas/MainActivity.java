/* Pranchetas Digitais - (c) 2026 Guilherme. Todos os direitos reservados. Uso somente com autorizacao do autor (veja LICENCA.txt). */
package br.com.ubiralcool.pranchetas;

import android.content.Context;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

  private static final String PREFERENCIAS = "pranchetas";
  private static final int GRAFITE = 0xFF2E3431; // mesma cor do topo do aplicativo

  private boolean telaCheia = false;

  @Override
  public void onCreate(Bundle estadoSalvo) {
    // servidor da usina, pastas, envio para o escritório e tela cheia
    registerPlugin(CentralPlugin.class);
    super.onCreate(estadoSalvo);

    // totem: a tela não apaga enquanto o aplicativo está aberto
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    telaCheia = getSharedPreferences(PREFERENCIAS, Context.MODE_PRIVATE).getBoolean("telaCheia", false);

    // O aplicativo cuida sozinho do espaço das barras do Android, igual em todas as versões:
    // com a tela cheia desligada, nada fica embaixo da barra de bateria e hora nem da barra de botões.
    if (getBridge() == null || getBridge().getWebView() == null) return; // aparelho sem WebView: o Capacitor já mostra o aviso
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    pintarBarras();

    View web = getBridge().getWebView();
    ViewCompat.setOnApplyWindowInsetsListener(web, (v, insetos) -> {
      Insets barras = telaCheia
          ? insetos.getInsets(WindowInsetsCompat.Type.displayCutout())
          : insetos.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
      Insets teclado = insetos.getInsets(WindowInsetsCompat.Type.ime());
      ViewGroup.MarginLayoutParams margens = (ViewGroup.MarginLayoutParams) v.getLayoutParams();
      margens.leftMargin = barras.left;
      margens.topMargin = barras.top;
      margens.rightMargin = barras.right;
      margens.bottomMargin = Math.max(barras.bottom, teclado.bottom);
      v.setLayoutParams(margens);
      return WindowInsetsCompat.CONSUMED;
    });
    aplicarTelaCheia();
  }

  @SuppressWarnings("deprecation")
  private void pintarBarras() {
    // barras transparentes sobre o fundo grafite, com ícones claros
    getWindow().setStatusBarColor(Color.TRANSPARENT);
    getWindow().setNavigationBarColor(Color.TRANSPARENT);
    getWindow().getDecorView().setBackgroundColor(GRAFITE);
    WindowInsetsControllerCompat barras = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
    barras.setAppearanceLightStatusBars(false);
    barras.setAppearanceLightNavigationBars(false);
  }

  /** Chamado pela tela de ajustes do aparelho. Fica guardado mesmo fechando o aplicativo. */
  public void definirTelaCheia(boolean ligar) {
    telaCheia = ligar;
    getSharedPreferences(PREFERENCIAS, Context.MODE_PRIVATE).edit().putBoolean("telaCheia", ligar).apply();
    runOnUiThread(this::aplicarTelaCheia);
  }

  public boolean estaEmTelaCheia() { return telaCheia; }

  private void aplicarTelaCheia() {
    WindowInsetsControllerCompat barras = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
    if (telaCheia) {
      // as barras aparecem por um instante ao arrastar o dedo da borda
      barras.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
      barras.hide(WindowInsetsCompat.Type.systemBars());
    } else {
      barras.show(WindowInsetsCompat.Type.systemBars());
    }
    if (getBridge() != null && getBridge().getWebView() != null) ViewCompat.requestApplyInsets(getBridge().getWebView());
  }

  @Override
  public void onWindowFocusChanged(boolean temFoco) {
    super.onWindowFocusChanged(temFoco);
    if (temFoco && telaCheia) aplicarTelaCheia();
  }
}
