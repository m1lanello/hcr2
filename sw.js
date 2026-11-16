/* HCR2 Mythic Tracker: offline support.
   The app opens instantly from the saved copy and quietly checks for a newer one in the background. */
const CACHE="hcr2-tracker-v1";
const SHELL=["./","index.html","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","icons/apple-touch-icon.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const req=e.request;if(req.method!=="GET")return;
  if(new URL(req.url).origin!==location.origin)return;
  e.respondWith((async()=>{
    const c=await caches.open(CACHE),hit=await c.match(req,{ignoreSearch:true}),old=hit?hit.clone():null;   /* private copy, taken before the page starts reading the saved one */
    /* ask the server for the current copy (a plain new request: a "navigate" request cannot be re-sent with options) */
    const net=fetch(new Request(req.url,{cache:"no-cache",credentials:"same-origin"})).then(async r=>{
      if(r&&r.ok){
        let changed=false;
        if(old&&req.mode==="navigate"){try{const [a,b]=await Promise.all([old.text(),r.clone().text()]);changed=a!==b}catch(x){}}
        await c.put(req,r.clone());
        /* the new page may still be starting, so tell the open windows a few times until it is listening */
        if(changed)for(let i=0;i<8;i++){(await self.clients.matchAll({type:"window"})).forEach(cl=>cl.postMessage({type:"update"}));await new Promise(x=>setTimeout(x,500))}}
      return r}).catch(()=>null);
    if(hit){e.waitUntil(net);return hit}
    const r=await net;if(r)return r;
    if(req.mode==="navigate"){const f=await c.match("index.html");if(f)return f}
    return new Response("Offline",{status:503})})())});
