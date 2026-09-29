/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
// Service worker: deixa o app abrir mesmo sem Wi-Fi (quando aberto pelo navegador).
const CACHE = 'pranchetas-v17';
const ARQUIVOS = ['./', 'index.html', 'styles.css', 'forms.js', 'xlsx.js', 'modelos.js', 'leitor.js', 'qrcode.js', 'cifra.js', 'novidades.js', 'app.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/logo.png', 'fonts/atkinson-hyperlegible-400.woff2', 'fonts/atkinson-hyperlegible-700.woff2'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.includes('/api/') || url.pathname.includes('/apk/')) return;
  // Rede primeiro (pega atualizações), cache se estiver sem conexão
  e.respondWith(
    fetch(e.request)
      .then((resp) => {
        if (resp.ok && url.origin === location.origin) {
          const copia = resp.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copia));
        }
        return resp;
      })
      // sem rede: usa o que estiver guardado; se não tiver, avisa em vez de devolver vazio
      .catch(async () => (await caches.match(e.request, { ignoreSearch: true }))
        || new Response('Sem conexão com a central', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }))
  );
});
