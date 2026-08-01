/* ─────────────────────────────────────────────────────────────
 * 消费记录 App — Service Worker（离线缓存）
 *
 * 背景：应用托管在 GitHub Pages（github.io），国内网络下经常
 * 被墙/极慢。之前为了不缓存旧版本把 SW 整个移除了，结果是每次
 * 打开都完全依赖网络，网络一抖界面就加载不出来、图标全空白。
 *
 * 本 SW 用「正确」的方式解决缓存：Vite 构建产物的文件名都带
 * 内容哈希（如 index-9fl6-uKi.js），内容变了文件名就变，所以
 * 缓存先命中是绝对安全的，永远不会出现旧版本问题。
 *
 * 策略：
 *  - 导航请求（HTML）→ 网络优先，失败回退到缓存的壳页面
 *  - 同源静态资源（JS/CSS/图片/字体）→ 缓存优先，后台更新
 *  - 跨域 API（api.github.com / api.deepseek.com）→ 不拦截
 *
 * 部署新版时，把 CACHE_NAME 里的版本号 +1，旧缓存会被自动清掉。
 * ───────────────────────────────────────────────────────────── */
const CACHE_NAME = 'expense-tracker-shell-v3';
const SHELL_URL = './';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // SW 所在目录（即 /expense-tracker/），作为所有相对路径的基准。
      const base = self.location.origin + self.location.pathname.replace(/[^/]*$/, '');

      // 预缓存列表：壳页面 + manifest + 从壳 HTML 解析出的哈希资源。
      const toCache = [new URL('./', base), new URL('./manifest.json', base)];

      // 拉取壳 HTML，解析出 JS/CSS/图标等资源地址一并预缓存，
      // 这样第一次打开成功后就已完全离线可用。
      try {
        const shell = await fetch(toCache[0].href);
        if (shell.ok) {
          const html = await shell.text();
          const seen = new Set();
          for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
            try {
              const abs = new URL(m[1], shell.url);
              if (abs.origin === self.location.origin && !seen.has(abs.href)) {
                seen.add(abs.href);
                toCache.push(abs);
              }
            } catch (e) { /* 忽略相对路径解析失败 */ }
          }
        }
      } catch (e) { /* 安装时断网也无妨，运行时缓存会补上 */ }

      await Promise.all(toCache.map((u) => cache.add(u.href).catch(() => {})));
      self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 只处理同源 GET；跨域 API 请求让浏览器直连。
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // ── 导航（页面 HTML）：网络优先，断网回退缓存 ──
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match(SHELL_URL)))
    );
    return;
  }

  // ── 静态资源：缓存优先，后台更新 ──
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // 已有缓存：立即返回，同时后台拉最新版本更新缓存。
        fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((c) => c.put(request, copy));
            }
          })
          .catch(() => {});
        return cached;
      }
      // 首次请求：走网络并写入缓存。
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, copy));
        }
        return response;
      });
    })
  );
});
