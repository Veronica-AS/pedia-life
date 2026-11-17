// Pedia Life: funciona sin conexión. La página se sirve de la caché y se actualiza en segundo plano.
const CACHE='pedia-life-v2';
const CORE=['./','./index.html','./manifest.webmanifest','./icon.svg','./icon-192.png'];
self.addEventListener('install',e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url); if(e.request.method!=='GET') return;
  const mine=u.origin===location.origin && u.pathname.startsWith(new URL('./',location).pathname) && !/\/(pdf|herramientas-pdf)\//.test(u.pathname);
  const font=/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if(!mine&&!font) return;
  e.respondWith(caches.open(CACHE).then(async c=>{
    const hit=await c.match(e.request,{ignoreSearch:mine});
    const net=fetch(e.request).then(r=>{ if(r&&(r.ok||r.type==='opaque')) c.put(e.request,r.clone()); return r; }).catch(()=>hit);
    if(hit){ e.waitUntil(net); return hit; } return net;
  }));
});
