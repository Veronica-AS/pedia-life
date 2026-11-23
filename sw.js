// Pedia Life · service worker (solo GitHub Pages).
//
// PARA PUBLICAR UNA CORRECCIÓN:
//   1. Cambie VERSION aquí abajo (por ejemplo, la fecha: "2026.11.19"; si publica dos veces el mismo día, "2026.11.19b").
//   2. Haga commit en pedia-life.
//   3. Publique con `npm run publicar` (copia este archivo e index.html a ../pedia-life-web y hace push).
// Cambiar VERSION crea una caché nueva y borra la vieja; quien tenga la página abierta verá el aviso
// «Hay una versión nueva de Pedia Life con correcciones». build.py también escribe esta VERSION en el pie de la página.
const VERSION='2026.11.22c';
const CACHE='pedia-life-'+VERSION;
const CORE=['./','./index.html','./manifest.webmanifest','./icon.svg','./icon-192.png'];
const NAV_TIMEOUT=3000; // ms: si la red tarda más, se muestra la copia guardada mientras termina de llegar la nueva
let lastNavOffline=false;

// Sin skipWaiting en la instalación: la versión nueva espera a que el usuario toque el aviso (mensaje SKIP_WAITING).
// La primera vez que se instala no hay versión anterior, así que se activa sola.
self.addEventListener('install',e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE))); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('pedia-life-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('message',e=>{
  const d=e.data||{};
  if(d.type==='SKIP_WAITING') self.skipWaiting();
  if(d.type==='GET_STATUS' && e.source) e.source.postMessage({type:'STATUS',version:VERSION,offline:lastNavOffline});
});

self.addEventListener('fetch',e=>{
  const req=e.request, u=new URL(req.url); if(req.method!=='GET') return;
  const base=new URL('./',self.location).pathname;
  const mine=u.origin===self.location.origin && u.pathname.startsWith(base) && !/\/(pdf|herramientas-pdf)\//.test(u.pathname);
  const font=/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if(!mine&&!font) return;
  const isPage= req.mode==='navigate' || (mine && (u.pathname===base || u.pathname.endsWith('/index.html')));
  e.respondWith(isPage? networkFirst(e,req) : cacheFirst(req,mine));
});

// Página (index.html): red primero, con tope de ~3 s; la caché solo es respaldo sin conexión.
async function networkFirst(e,req){
  const c=await caches.open(CACHE);
  const net=fetch(req,{cache:'no-store'}).then(r=>{ if(r&&r.ok){ c.put('./index.html',r.clone()); lastNavOffline=false; } return r; });
  e.waitUntil(net.catch(()=>{}));
  const timeout=new Promise(res=>setTimeout(()=>res('timeout'),NAV_TIMEOUT));
  try{
    const r=await Promise.race([net,timeout]);
    if(r!=='timeout') return r;
    const hit=await c.match('./index.html'); if(hit){ lastNavOffline=true; return hit; }
    return await net;
  }catch(err){
    const hit=await c.match('./index.html'); if(hit){ lastNavOffline=true; return hit; }
    throw err;
  }
}
// Íconos, manifiesto y fuentes: caché primero.
async function cacheFirst(req,mine){
  const c=await caches.open(CACHE);
  const hit=await c.match(req,{ignoreSearch:mine}); if(hit) return hit;
  const r=await fetch(req); if(r&&(r.ok||r.type==='opaque')) c.put(req,r.clone()); return r;
}
