/* Pranchetas Digitais - (c) 2026 Guilherme. Somente para os testes: imita o org.json do Android no computador. */
package org.json;

import java.util.ArrayList;

public class JSONArray {
  final ArrayList<Object> l = new ArrayList<>();

  public JSONArray() { }

  public JSONArray(String texto) throws JSONException {
    Object v = new JSONObject.Leitor(texto).tudo();
    if (!(v instanceof JSONArray)) throw new JSONException("não é uma lista JSON");
    l.addAll(((JSONArray) v).l);
  }

  public JSONArray put(Object v) { l.add(v == null ? JSONObject.NULL : v); return this; }
  public JSONArray put(long v) { l.add(v); return this; }
  public JSONArray put(int v) { l.add(v); return this; }
  public JSONArray put(boolean v) { l.add(v); return this; }
  public int length() { return l.size(); }
  public Object opt(int i) { return i >= 0 && i < l.size() ? l.get(i) : null; }
  public JSONObject optJSONObject(int i) { Object v = opt(i); return v instanceof JSONObject ? (JSONObject) v : null; }
  public String optString(int i) { Object v = opt(i); return v == null || v == JSONObject.NULL ? "" : v instanceof Number ? JSONObject.numero((Number) v) : String.valueOf(v); }
  @Override public String toString() { StringBuilder sb = new StringBuilder(); JSONObject.escrever(sb, this); return sb.toString(); }
}
