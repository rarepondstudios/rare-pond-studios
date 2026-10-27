/* Directional three-tier band sweep (was: a gradient panel with speed lines) between Studio <-> Rentals / Media (cross-document).
   A signature-gradient panel sweeps across the screen in ONE continuous direction that
   spans the page load: the source page slides it IN to cover, the destination page slides
   it the rest of the way OUT to reveal. Direction is carried across the navigation in
   sessionStorage ('__xw'): 'L' = panel travels right->left (Rentals), 'R' = left->right
   (Media). The matching "back to Studio" hops use the mirror direction so the pair reads as
   one motion. Pairs with the tiny inline <head> pre-paint block (adds html.xw-cover before
   first paint so the destination arrives already covered - no flash) plus the #xwipe element
   and CSS present in each document. */
(function(){
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches;
  var docEl = document.documentElement;
  function panel(){ return document.getElementById('xwipe'); }

  /* THREE-TIER BANDS (2026-10-27, Jack: "remove the motion lines ... replace them with the three tier
     opacity look"): the panel is drawn by assets/rp-water.js (RPWater.sweep): the 25% band leads, the 50%
     band follows, the solid band covers, with parallax and the bubble rim's wobbling edges; the next page
     carries the motion on (solid band moves off, the 50% and 25% bands trail it). Fully covered, the
     canvas shows exactly the panel's own CSS gradient, so the hand-over between the pages stays seamless.
     Without RPWater (or canvas) the panel slides as before. */
  var SW = null;
  function canSweep(){ return !!(window.RPWater && RPWater.ok); }
  function clearAll(w){ docEl.classList.remove('xw-active','xw-cover'); if(SW){ try{SW.stop();}catch(e){} SW=null; } if(w){ w.style.display='none'; w.style.transition=''; w.style.transform=''; w.style.background=''; } }

  /* ---------- DESTINATION: finish the sweep (slide the covering panel off-screen) ---------- */
  (function reveal(){
    var dir = window.__XW_IN;                 // set by the head pre-paint block if we arrived via a wipe
    if(!dir) return;
    try{ sessionStorage.removeItem('__xw'); }catch(e){}
    var w = panel();
    if(RM || !w){ clearAll(w); return; }
    var pv = document.getElementById('pageveil'); if(pv) pv.classList.add('pv-gone');   // the panel is the cover now
    var outX = (dir==='L') ? '-100%' : '100%';
    var slid=false;
    function slide(){
      if(slid)return; slid=true;                 // run once: the load-ready path AND the safety timer both call this
      docEl.classList.add('xw-active'); docEl.classList.remove('xw-cover');
      if(window.__resetThemeColor) window.__resetThemeColor(600);
      var fin=function(){ clearAll(w); };
      if(canSweep()){
        SW = RPWater.sweep(w,{dir:dir,phase:'out',ms:700,done:fin});
        setTimeout(fin,1500);
        return;
      }
      w.style.transition='none'; w.style.transform='translateX(0)'; void w.offsetWidth;
      w.style.transition='transform .6s cubic-bezier(.65,0,.35,1)';
      w.style.transform='translateX('+outX+')';
      w.addEventListener('transitionend',function h(e){ if(e.propertyName!=='transform')return; w.removeEventListener('transitionend',h); fin(); });
      setTimeout(fin,1000);
    }
    var fonts=(document.fonts&&document.fonts.ready)?document.fonts.ready:Promise.resolve();
    var loaded=new Promise(function(r){document.readyState==='complete'?r():addEventListener('load',r,{once:true});});
    Promise.all([fonts,loaded]).then(function(){ requestAnimationFrame(function(){ requestAnimationFrame(slide); }); });
    setTimeout(slide,2500);                    // safety: never stay covered
  })();

  /* ---------- SOURCE: intercept a [data-wipe] link and slide the panel IN to cover ---------- */
  var busy=false;   /* in-flight guard: a rapid second click must never restart the panel mid-wipe */
  document.addEventListener('click',function(e){
    var a = e.target.closest && e.target.closest('a[data-wipe]');
    if(!a) return;
    if(busy){ e.preventDefault(); e.stopImmediatePropagation(); return; }
    if(e.defaultPrevented||e.button===1||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey) return;
    if(a.target && a.target!=='_self') return;
    var dir = a.getAttribute('data-wipe'); if(dir!=='L'&&dir!=='R') return;
    var href = a.getAttribute('href')||''; var url;
    try{ url=new URL(href,location.href); }catch(_){ return; }
    if(url.origin!==location.origin || url.pathname===location.pathname) return;
    e.preventDefault(); e.stopImmediatePropagation();       // never let the old cross-fade also fire
    var w = panel();
    if(RM || !w){ location.href=url.href; return; }
    busy=true; setTimeout(function(){ busy=false; },1500);  /* self-clears in case navigation is ever blocked */
    try{ sessionStorage.setItem('__xw',dir); }catch(e2){}
    if(window.__setThemeColor) window.__setThemeColor('#3f6bff');
    var startX = (dir==='L') ? '100%' : '-100%';            // L enters from the right, R from the left
    docEl.classList.add('xw-active');
    var did=false, go=function(){ if(did)return; did=true; location.href=url.href; };
    w.style.display='block';
    if(canSweep()){
      SW = RPWater.sweep(w,{dir:dir,phase:'in',ms:600,done:go});
      setTimeout(go,900);
      return;
    }
    w.style.transition='none'; w.style.transform='translateX('+startX+')'; void w.offsetWidth;
    w.style.transition='transform .5s cubic-bezier(.65,0,.35,1)';
    w.style.transform='translateX(0)';
    w.addEventListener('transitionend',function h(e){ if(e.propertyName!=='transform')return; w.removeEventListener('transitionend',h); go(); });
    setTimeout(go,560);
  }, true);
})();
