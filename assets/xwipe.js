/* Directional gradient wipe between Studio <-> Rentals / Media (cross-document).
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

  /* ---------- SPEED LINES (injected; no per-page markup) ----------
     Thin parallel streaks INSIDE the wipe panel that drift along the sweep direction a
     little faster than the panel itself - a subtle velocity cue. Seamlessness contract:
     the lines exist ONLY while the panel is actually sliding, and their opacity keyframes
     start AND end at 0. At the cross-document handoff the panel is at rest (fully
     covering) with lines at opacity 0 on both sides, so the cut stays invisible and no
     cross-page animation-phase sync is needed. They inherit #xwipe's edge mask, so
     streaks feather out with the panel's soft edges. Hidden under reduced-motion. */
  function linesCss(){
    if(document.getElementById('xw-lines-css')) return;
    var s=document.createElement('style'); s.id='xw-lines-css';
    s.textContent=
      '.xw-lines{position:absolute;top:0;bottom:0;left:-400px;right:-400px;opacity:0;pointer-events:none;'+
      'background-image:'+
      'linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.55) 30%,rgba(255,255,255,.55) 62%,rgba(255,255,255,0) 100%),'+
      'linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.35) 25%,rgba(255,255,255,.35) 55%,rgba(255,255,255,0) 100%),'+
      'linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.5) 35%,rgba(255,255,255,.5) 70%,rgba(255,255,255,0) 100%),'+
      'linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.3) 28%,rgba(255,255,255,.3) 60%,rgba(255,255,255,0) 100%),'+
      'linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.45) 32%,rgba(255,255,255,.45) 64%,rgba(255,255,255,0) 100%),'+
      'linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.35) 26%,rgba(255,255,255,.35) 58%,rgba(255,255,255,0) 100%),'+
      'linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.5) 30%,rgba(255,255,255,.5) 66%,rgba(255,255,255,0) 100%),'+
      'linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.3) 30%,rgba(255,255,255,.3) 62%,rgba(255,255,255,0) 100%);'+
      'background-size:520px 3px,340px 2px,640px 3px,280px 2px,460px 2px,380px 2px,560px 3px,320px 2px;'+
      'background-position:80px 8%,420px 17%,-60px 28%,260px 38%,120px 50%,520px 61%,-140px 72%,360px 86%;'+
      'background-repeat:repeat-x;will-change:transform,opacity}'+
      '@keyframes xw-lines-l{from{transform:translateX(320px)}to{transform:translateX(-320px)}}'+
      '@keyframes xw-lines-r{from{transform:translateX(-320px)}to{transform:translateX(320px)}}'+
      '@keyframes xw-lines-fade{0%{opacity:0}30%{opacity:.5}70%{opacity:.5}100%{opacity:0}}'+
      '@media (prefers-reduced-motion:reduce){.xw-lines{display:none!important}}';
    document.head.appendChild(s);
  }
  linesCss();
  function runLines(w,dir,ms){
    if(RM||!w) return;
    var el=w.querySelector('.xw-lines');
    if(!el){ el=document.createElement('div'); el.className='xw-lines'; el.setAttribute('aria-hidden','true'); w.appendChild(el); }
    el.style.animation='none'; void el.offsetWidth;   /* restart cleanly on rapid hops */
    el.style.animation='xw-lines-'+(dir==='L'?'l':'r')+' '+ms+'ms linear both, xw-lines-fade '+ms+'ms ease both';
  }
  function clearAll(w){ docEl.classList.remove('xw-active','xw-cover'); if(w){ w.style.display='none'; w.style.transition=''; w.style.transform=''; var ln=w.querySelector('.xw-lines'); if(ln) ln.style.animation=''; } }

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
      w.style.transition='none'; w.style.transform='translateX(0)'; void w.offsetWidth;
      w.style.transition='transform .6s cubic-bezier(.65,0,.35,1)';
      w.style.transform='translateX('+outX+')';
      runLines(w,dir,600);
      if(window.__resetThemeColor) window.__resetThemeColor(600);
      var fin=function(){ clearAll(w); };
      w.addEventListener('transitionend',function h(e){ if(e.propertyName!=='transform')return; w.removeEventListener('transitionend',h); fin(); });
      setTimeout(fin,1000);
    }
    var fonts=(document.fonts&&document.fonts.ready)?document.fonts.ready:Promise.resolve();
    var loaded=new Promise(function(r){document.readyState==='complete'?r():addEventListener('load',r,{once:true});});
    Promise.all([fonts,loaded]).then(function(){ requestAnimationFrame(function(){ requestAnimationFrame(slide); }); });
    setTimeout(slide,2500);                    // safety: never stay covered
  })();

  /* ---------- SOURCE: intercept a [data-wipe] link and slide the panel IN to cover ---------- */
  document.addEventListener('click',function(e){
    var a = e.target.closest && e.target.closest('a[data-wipe]');
    if(!a) return;
    if(e.defaultPrevented||e.button===1||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey) return;
    if(a.target && a.target!=='_self') return;
    var dir = a.getAttribute('data-wipe'); if(dir!=='L'&&dir!=='R') return;
    var href = a.getAttribute('href')||''; var url;
    try{ url=new URL(href,location.href); }catch(_){ return; }
    if(url.origin!==location.origin || url.pathname===location.pathname) return;
    e.preventDefault(); e.stopImmediatePropagation();       // never let the old cross-fade also fire
    var w = panel();
    if(RM || !w){ location.href=url.href; return; }
    try{ sessionStorage.setItem('__xw',dir); }catch(e2){}
    if(window.__setThemeColor) window.__setThemeColor('#3f6bff');
    var startX = (dir==='L') ? '100%' : '-100%';            // L enters from the right, R from the left
    docEl.classList.add('xw-active');
    w.style.display='block'; w.style.transition='none'; w.style.transform='translateX('+startX+')'; void w.offsetWidth;
    w.style.transition='transform .5s cubic-bezier(.65,0,.35,1)';
    w.style.transform='translateX(0)';
    runLines(w,dir,500);
    var did=false, go=function(){ if(did)return; did=true; location.href=url.href; };
    w.addEventListener('transitionend',function h(e){ if(e.propertyName!=='transform')return; w.removeEventListener('transitionend',h); go(); });
    setTimeout(go,560);
  }, true);
})();
