/* Pranchetas Digitais - (c) 2026 Guilherme. Somente para os testes: imita o org.json do Android no computador. */
package org.json;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;

public class JSONObject {
  final LinkedHashMap<String, Object> m = new LinkedHashMap<>();
  public static final Object NULL = new Object() { @Override public String toString() { return "null"; } };

  public JSONObject() { }

  public JSONObject(String texto) throws JSONException {
    Object v = new Leitor(texto).tudo();
    if (!(v instanceof JSONObject)) throw new JSONException("não é um objeto JSON");
    m.putAll(((JSONObject) v).m);
  }

  public JSONObject put(String k, Object v) throws JSONException {
    if (k == null) throw new JSONException("chave nula");
    if (v == null) { m.remove(k); return this; }
    if (v instanceof Double && (((Double) v).isNaN() || ((Double) v).isInfinite())) throw new JSONException("número inválido");
    m.put(k, v);
    return this;
  }
  public JSONObject put(String k, long v) throws JSONException { return put(k, (Object) Long.valueOf(v)); }
  public JSONObject put(String k, int v) throws JSONException { return put(k, (Object) Integer.valueOf(v)); }
  public JSONObject put(String k, double v) throws JSONException { return put(k, (Object) Double.valueOf(v)); }
  public JSONObject put(String k, boolean v) throws JSONException { return put(k, (Object) Boolean.valueOf(v)); }

  public Object opt(String k) { return m.get(k); }
  public boolean has(String k) { return m.containsKey(k); }
  public Object remove(String k) { return m.remove(k); }
  public int length() { return m.size(); }
  public Iterator<String> keys() { return new ArrayList<>(m.keySet()).iterator(); }

  public String optString(String k) { return optString(k, ""); }
  public String optString(String k, String padrao) {
    Object v = m.get(k);
    if (v == null || v == NULL) return padrao;
    return v instanceof Number ? numero((Number) v) : String.valueOf(v);
  }
  public long optLong(String k) { return optLong(k, 0L); }
  public long optLong(String k, long padrao) {
    Object v = m.get(k);
    if (v instanceof Number) return ((Number) v).longValue();
    if (v instanceof String) { try { return (long) Double.parseDouble((String) v); } catch (NumberFormatException e) { return padrao; } }
    return padrao;
  }
  public int optInt(String k) { return (int) optLong(k, 0L); }
  public boolean optBoolean(String k) { Object v = m.get(k); return v instanceof Boolean ? (Boolean) v : "true".equalsIgnoreCase(String.valueOf(v)); }
  public JSONObject optJSONObject(String k) { Object v = m.get(k); return v instanceof JSONObject ? (JSONObject) v : null; }
  public JSONArray optJSONArray(String k) { Object v = m.get(k); return v instanceof JSONArray ? (JSONArray) v : null; }
  public JSONObject getJSONObject(String k) throws JSONException { JSONObject o = optJSONObject(k); if (o == null) throw new JSONException("sem objeto " + k); return o; }
  public JSONArray getJSONArray(String k) throws JSONException { JSONArray o = optJSONArray(k); if (o == null) throw new JSONException("sem lista " + k); return o; }
  public String getString(String k) throws JSONException { if (!m.containsKey(k)) throw new JSONException("sem " + k); return optString(k); }
  public long getLong(String k) throws JSONException { if (!m.containsKey(k)) throw new JSONException("sem " + k); return optLong(k); }

  @Override public String toString() { StringBuilder sb = new StringBuilder(); escrever(sb, this); return sb.toString(); }

  static String numero(Number n) {
    if (n instanceof Double || n instanceof Float) {
      double d = n.doubleValue();
      if (d == Math.rint(d) && Math.abs(d) < 1e15) return String.valueOf((long) d);
      return String.valueOf(d);
    }
    return n.toString();
  }

  static void escrever(StringBuilder sb, Object v) {
    if (v == null || v == NULL) { sb.append("null"); return; }
    if (v instanceof JSONObject) {
      sb.append('{');
      boolean primeiro = true;
      for (java.util.Map.Entry<String, Object> e : ((JSONObject) v).m.entrySet()) {
        if (!primeiro) sb.append(',');
        primeiro = false;
        texto(sb, e.getKey()); sb.append(':'); escrever(sb, e.getValue());
      }
      sb.append('}');
    } else if (v instanceof JSONArray) {
      sb.append('[');
      ArrayList<Object> l = ((JSONArray) v).l;
      for (int i = 0; i < l.size(); i++) { if (i > 0) sb.append(','); escrever(sb, l.get(i)); }
      sb.append(']');
    } else if (v instanceof Number) sb.append(numero((Number) v));
    else if (v instanceof Boolean) sb.append(v.toString());
    else texto(sb, v.toString());
  }

  static void texto(StringBuilder sb, String s) {
    sb.append('"');
    for (int i = 0; i < s.length(); i++) {
      char c = s.charAt(i);
      switch (c) {
        case '"': sb.append("\\\""); break;
        case '\\': sb.append("\\\\"); break;
        case '/': sb.append("\\/"); break;
        case '\b': sb.append("\\b"); break;
        case '\f': sb.append("\\f"); break;
        case '\n': sb.append("\\n"); break;
        case '\r': sb.append("\\r"); break;
        case '\t': sb.append("\\t"); break;
        default:
          if (c < 0x20) sb.append(String.format("\\u%04x", (int) c)); else sb.append(c);
      }
    }
    sb.append('"');
  }

  /** Leitor de JSON simples (objeto, lista, texto, número, true, false, null). */
  static final class Leitor {
    private final String s;
    private int i = 0;
    Leitor(String s) throws JSONException { if (s == null) throw new JSONException("texto nulo"); this.s = s; }
    Object tudo() throws JSONException { Object v = valor(); espacos(); if (i < s.length()) throw new JSONException("sobrou texto na posição " + i); return v; }
    private void espacos() { while (i < s.length() && Character.isWhitespace(s.charAt(i))) i++; }
    private JSONException erro(String msg) { return new JSONException(msg + " na posição " + i); }
    Object valor() throws JSONException {
      espacos();
      if (i >= s.length()) throw erro("fim inesperado");
      char c = s.charAt(i);
      if (c == '{') return objeto();
      if (c == '[') return lista();
      if (c == '"') return texto();
      if (s.startsWith("true", i)) { i += 4; return Boolean.TRUE; }
      if (s.startsWith("false", i)) { i += 5; return Boolean.FALSE; }
      if (s.startsWith("null", i)) { i += 4; return NULL; }
      return numero();
    }
    private JSONObject objeto() throws JSONException {
      JSONObject o = new JSONObject();
      i++; espacos();
      if (i < s.length() && s.charAt(i) == '}') { i++; return o; }
      while (true) {
        espacos();
        if (i >= s.length() || s.charAt(i) != '"') throw erro("esperava chave");
        String k = texto();
        espacos();
        if (i >= s.length() || s.charAt(i) != ':') throw erro("esperava :");
        i++;
        o.m.put(k, valor());
        espacos();
        if (i >= s.length()) throw erro("objeto sem fim");
        char c = s.charAt(i++);
        if (c == '}') return o;
        if (c != ',') throw erro("esperava , ou }");
      }
    }
    private JSONArray lista() throws JSONException {
      JSONArray a = new JSONArray();
      i++; espacos();
      if (i < s.length() && s.charAt(i) == ']') { i++; return a; }
      while (true) {
        a.l.add(valor());
        espacos();
        if (i >= s.length()) throw erro("lista sem fim");
        char c = s.charAt(i++);
        if (c == ']') return a;
        if (c != ',') throw erro("esperava , ou ]");
      }
    }
    private String texto() throws JSONException {
      StringBuilder sb = new StringBuilder();
      i++;
      while (i < s.length()) {
        char c = s.charAt(i++);
        if (c == '"') return sb.toString();
        if (c == '\\') {
          if (i >= s.length()) break;
          char e = s.charAt(i++);
          switch (e) {
            case 'n': sb.append('\n'); break;
            case 't': sb.append('\t'); break;
            case 'r': sb.append('\r'); break;
            case 'b': sb.append('\b'); break;
            case 'f': sb.append('\f'); break;
            case 'u':
              if (i + 4 > s.length()) throw erro("\\u incompleto");
              sb.append((char) Integer.parseInt(s.substring(i, i + 4), 16)); i += 4; break;
            default: sb.append(e);
          }
        } else sb.append(c);
      }
      throw erro("texto sem fim");
    }
    private Number numero() throws JSONException {
      int ini = i;
      while (i < s.length() && "+-0123456789.eE".indexOf(s.charAt(i)) >= 0) i++;
      String n = s.substring(ini, i);
      if (n.isEmpty()) throw erro("valor inválido");
      try {
        if (n.contains(".") || n.contains("e") || n.contains("E")) return Double.parseDouble(n);
        long v = Long.parseLong(n);
        if (v >= Integer.MIN_VALUE && v <= Integer.MAX_VALUE) return (int) v;
        return v;
      } catch (NumberFormatException e) { throw erro("número inválido " + n); }
    }
  }
}
