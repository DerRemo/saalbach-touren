// PRODUCTION SERVICE WORKER — offline support for use in the mountains.
// Strategy: network-first for the app shell (HTML/CSS/JS/JSON) so an online
// reload always shows the latest version, with the cache as an offline
// fallback. Route-map images never change, so they are precached and served
// cache-first for speed and full offline availability.

const CACHE_NAME = "saalbach-tours-v12";

const APP_SHELL_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./tours_db.json",
  "./fonts/fonts.css",
  "./maps/overview.json"
];

// Bundled fonts and icons — local copies so the app works fully offline on
// the very first launch (no CDN round-trip for fonts.gstatic.com / icons8).
const STATIC_ASSETS = [
  "./fonts/QGYvz_MVcBeNP4NJtEtqUYLknw.woff2",
  "./fonts/QGYvz_MVcBeNP4NJuktqUYLkn8BJ.woff2",
  "./fonts/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7W0Q5nw.woff2",
  "./fonts/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa25L7W0Q5n-wU.woff2",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

const MAP_ASSETS = [
  "./maps/13900648.webp",
  "./maps/1487865.webp",
  "./maps/1497398.webp",
  "./maps/1508235.webp",
  "./maps/1519240.webp",
  "./maps/1534967.webp",
  "./maps/1534981.webp",
  "./maps/1539231.webp",
  "./maps/1540048.webp",
  "./maps/1545397.webp",
  "./maps/1550348.webp",
  "./maps/1560037.webp",
  "./maps/34026610.webp",
  "./maps/36701838.webp",
  "./maps/36702247.webp",
  "./maps/36702584.webp",
  "./maps/36922983.webp",
  "./maps/36923450.webp",
  "./maps/36951462.webp",
  "./maps/37104791.webp",
  "./maps/44826573.webp",
  "./maps/45618165.webp",
  "./maps/52320991.webp",
  "./maps/52492667.webp",
  "./maps/52517610.webp",
  "./maps/52825190.webp",
  "./maps/54477732.webp",
  "./maps/54482142.webp",
  "./maps/54482967.webp",
  "./maps/54951850.webp",
  "./maps/60210849.webp",
  "./maps/62042866.webp",
  "./maps/6234167.webp",
  "./maps/63530911.webp",
  "./maps/63832877.webp",
  "./maps/66420734.webp",
  "./maps/7827971.webp",
  "./maps/7851080.webp",
  "./maps/7851182.webp",
  "./maps/7851373.webp",
  "./maps/7851464.webp",
  "./maps/800002949.webp",
  "./maps/800954872.webp",
  "./maps/802401162.webp",
  "./maps/802756911.webp",
  "./maps/803199570.webp",
  "./maps/803214053.webp",
  "./maps/803256111.webp",
  "./maps/803284359.webp",
  "./maps/804640770.webp",
  "./maps/804652214.webp",
  "./maps/806658770.webp",
  "./maps/806658978.webp",
  "./maps/810804243.webp",
  "./maps/810804249.webp",
  "./maps/810804253.webp",
  "./maps/810804255.webp",
  "./maps/810806199.webp",
  "./maps/9787014.webp",
  "./maps/9801383.webp",
  "./maps/9801710.webp",
  "./maps/9802107.webp",
  "./maps/9802279.webp",
  "./maps/9890525.webp",
  "./maps/overview.webp"
];

const APP_SHELL = /\.(html|css|js|json)$/;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(APP_SHELL_ASSETS);
      // Best-effort precache of fonts, icons and route maps
      // (a single failure must not abort the whole install).
      await Promise.all(
        [...STATIC_ASSETS, ...MAP_ASSETS].map((url) => cache.add(url).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // GPX downloads / foreign hosts: let the browser handle them directly.
  if (url.hostname.includes("api-oa.com") || url.pathname.includes("download.tour.gpx")) {
    return;
  }

  const isAppShell =
    e.request.mode === "navigate" ||
    (url.origin === self.location.origin && APP_SHELL.test(url.pathname));

  if (isAppShell) {
    // Network-first: fresh when online, cached copy when offline.
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(e.request).then((c) => c || caches.match("./index.html")))
    );
    return;
  }

  // Maps, icons, everything else: cache-first with background refresh.
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) {
        fetch(e.request).then((net) => {
          if (net.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, net));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(e.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
        return response;
      });
    })
  );
});
