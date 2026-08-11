/* Shared Contact popup for studio / rentals / media. One implementation, one config
   (data/contact.json), so the contact form is identical on every site and edited in one place.
   - window.RP_openContact() opens it; any element with [data-contact] opens it on click.
   - The HubSpot form + brand bubbles are built once and the modal is hidden (not destroyed) on
     close, so anything already typed is preserved.
   Loads its own stylesheet if the page didn't already include /assets/contact.css. */
(function(){
  var DEFAULT={eyebrow:"Get in touch",heading:"Let's make something amazing.",
    sub:"Tell us about your project and we'll be in touch.",
    hubspot:{region:"na2",portalId:"245995240",formId:"2f174b0e-b67d-4ca2-b12c-bd877ac8cab3"}};
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function safeUrl(u){return /^https?:\/\//i.test(String(u||''))?String(u):'#';}
  var backdrop,modal,hsLoaded=false,cfg=null,lastFocus=null,cfgReady=false;

  if(!document.querySelector('link[href="/assets/contact.css"]')){
    var l=document.createElement('link'); l.rel='stylesheet'; l.href='/assets/contact.css'; document.head.appendChild(l);
  }

  function lum(hex){var h=String(hex||'').replace('#','');if(h.length===3)h=h.replace(/(.)/g,'$1$1');var r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);return isNaN(r)?0:(0.2126*r+0.7152*g+0.0722*b);}
  function fgFor(a,b,c){var xs=[a,b,c].filter(Boolean);if(!xs.length)return '#ffffff';var avg=xs.reduce(function(s,h){return s+lum(h);},0)/xs.length;return avg>180?'#141414':'#ffffff';}
  function bubblesHTML(socials,looks){
    var byKey={}; (looks||[]).forEach(function(l){ if(l&&l.key)byKey[String(l.key).toLowerCase()]=l; });
    return (socials||[]).map(function(s){
      var lk=byKey[String(s.colorLook||'').toLowerCase()]||{};
      var c1=lk.c1||'#1f6fd0',c2=lk.c2||c1,c3=lk.c3||c2,fg=fgFor(c1,c2,c3);
      var ico=lk.icon?'<span class="cbub-ico" style="--m:url(\''+esc(lk.icon)+'\')" aria-hidden="true"></span>':((window.RP_SOCIAL_ICONS&&window.RP_SOCIAL_ICONS[s.icon])||'');
      return '<a class="contact-bubble" href="'+esc(safeUrl(s.url))+'" target="_blank" rel="noopener" aria-label="'+esc(s.label)+'" data-net="'+esc(s.icon)+'" style="--c1:'+esc(c1)+';--c2:'+esc(c2)+';--c3:'+esc(c3)+';--fg:'+esc(fg)+'"><span class="cbub-badge">'+ico+'</span><span class="cbub-label">'+esc(s.blurb||s.label)+'</span><span class="cbub-arrow" aria-hidden="true">&rarr;</span></a>';
    }).join('');
  }

  function build(){
    if(backdrop)return;
    var c=cfg||DEFAULT, hs=c.hubspot||DEFAULT.hubspot;
    backdrop=document.createElement('div'); backdrop.className='rpc-backdrop'; backdrop.setAttribute('hidden',''); backdrop.setAttribute('data-kb-modal','');
    backdrop.innerHTML='<div class="rpc-modal" role="dialog" aria-modal="true" aria-labelledby="rpcTitle">'
      +'<button class="rpc-close" type="button" aria-label="Close">&times;</button>'
      +'<div class="contact-head"><div class="ey">'+esc(c.eyebrow||DEFAULT.eyebrow)+'</div><h2 id="rpcTitle">'+esc(c.heading||DEFAULT.heading)+'</h2><p>'+esc(c.sub||DEFAULT.sub)+'</p></div>'
      +'<div class="contact-grid"><div class="form-card"><div class="hs-form-frame" data-region="'+esc(hs.region||'na2')+'" data-form-id="'+esc(hs.formId||'')+'" data-portal-id="'+esc(hs.portalId||'')+'"></div></div>'
      +'<div class="contact-socials" id="rpcSocials"></div></div></div>';
    document.body.appendChild(backdrop);
    modal=backdrop.querySelector('.rpc-modal');
    backdrop.addEventListener('click',function(e){ if(e.target===backdrop) closeM(); });
    backdrop.querySelector('.rpc-close').addEventListener('click',closeM);
    var frame=backdrop.querySelector('.hs-form-frame');
    if(frame){
      var ready=function(){ frame.classList.add('rpc-ready'); };
      try{ var mo=new MutationObserver(function(){ if(frame.querySelector('iframe,form')){ ready(); mo.disconnect(); } }); mo.observe(frame,{childList:true,subtree:true}); }catch(e){}
      setTimeout(ready,2800);   // fallback so the form always appears even if detection misses
    }
    Promise.all([
      fetch('/data/socials.json',{cache:'no-cache'}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}),
      fetch('/data/colorlooks.json',{cache:'no-cache'}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;})
    ]).then(function(res){
      var soc=(res[0]&&res[0].socials)||[]; var looks=(res[1]&&(res[1].looks||res[1]))||[];
      var host=backdrop.querySelector('#rpcSocials'); if(host) host.innerHTML=bubblesHTML(soc,looks);
    });
  }
  function loadHubspot(){
    if(hsLoaded)return; hsLoaded=true;
    var hs=(cfg&&cfg.hubspot)||DEFAULT.hubspot;
    var s=document.createElement('script'); s.defer=true;
    s.src='https://js-'+(hs.region||'na2')+'.hsforms.net/forms/embed/'+(hs.portalId||'')+'.js';
    document.body.appendChild(s);
  }
  function openM(){
    build(); loadHubspot();
    lastFocus=document.activeElement;
    backdrop.removeAttribute('hidden');
    requestAnimationFrame(function(){ backdrop.classList.add('rpc-show'); });
    document.documentElement.classList.add('rpc-open');
    var cb=backdrop.querySelector('.rpc-close'); if(cb)cb.focus();
  }
  function closeM(){
    if(!backdrop||backdrop.hasAttribute('hidden'))return;
    backdrop.classList.remove('rpc-show');
    document.documentElement.classList.remove('rpc-open');
    setTimeout(function(){ backdrop.setAttribute('hidden',''); },240);
    try{ if(lastFocus&&lastFocus.focus)lastFocus.focus(); }catch(e){}
  }
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&backdrop&&!backdrop.hasAttribute('hidden')) closeM(); });
  window.RP_openContact=openM; window.RP_closeContact=closeM;

  /* ---- Cookie consent (CIPA). HubSpot's form embed sets analytics cookies, so we DO NOT load it
     on browse. A one-time banner lets the visitor accept (which enables analytics + pre-warming).
     Until accepted, HubSpot loads ONLY when the visitor actually opens the contact form
     (functional, user-initiated). The choice is remembered in localStorage. ---- */
  var CONSENT_KEY='rpConsent';
  function consentGet(){ try{return localStorage.getItem(CONSENT_KEY);}catch(e){return null;} }
  function consentSet(v){ try{localStorage.setItem(CONSENT_KEY,v);}catch(e){} }
  var consentCssDone=false;
  function consentCss(){ if(consentCssDone)return; consentCssDone=true;
    var st=document.createElement('style'); st.textContent=
      '.rpc-consent{position:fixed;left:50%;bottom:16px;transform:translate(-50%,150%);z-index:2147482000;max-width:min(680px,94vw);display:flex;flex-wrap:wrap;align-items:center;gap:11px 16px;padding:14px 18px;border-radius:14px;background:rgba(12,28,54,.97);color:#eaf1ff;border:1px solid rgba(122,162,255,.28);box-shadow:0 18px 50px -12px rgba(0,0,0,.6);font:500 14px/1.5 Heebo,-apple-system,Segoe UI,sans-serif;transition:transform .32s cubic-bezier(.3,.7,.2,1),opacity .32s;opacity:0}'
      +'.rpc-consent.rpc-consent-in{transform:translate(-50%,0);opacity:1}'
      +'html.rpc-open .rpc-consent{opacity:0;pointer-events:none;visibility:hidden}'
      +'.rpc-consent-t{flex:1 1 300px}.rpc-consent a{color:#7aa2ff}'
      +'.rpc-consent-btns{display:flex;gap:8px;flex:none;margin-left:auto}'
      +'.rpc-consent button{cursor:pointer;border-radius:9px;font:700 13px/1 Heebo,sans-serif;padding:10px 16px;border:1px solid rgba(255,255,255,.28);background:transparent;color:#cfe0ff}'
      +'.rpc-consent-yes{background:linear-gradient(90deg,#5aa0ff,#8f7bff);border-color:transparent;color:#fff}'
      +'@media(prefers-reduced-motion:reduce){.rpc-consent{transition:none}}';
    document.head.appendChild(st);
  }
  var consentShown=false;
  function showConsent(){ if(consentShown||consentGet())return; consentShown=true; consentCss();
    var b=document.createElement('div'); b.className='rpc-consent'; b.setAttribute('role','dialog'); b.setAttribute('aria-label','Cookie consent');
    b.innerHTML='<span class="rpc-consent-t">We use cookies from HubSpot to run our contact form and understand site usage. See our <a href="/privacy/">Privacy Policy</a>.</span>'
      +'<span class="rpc-consent-btns"><button type="button" class="rpc-consent-no">Decline</button><button type="button" class="rpc-consent-yes">Accept</button></span>';
    document.body.appendChild(b);
    requestAnimationFrame(function(){ b.classList.add('rpc-consent-in'); });
    function done(v){ consentSet(v); b.classList.remove('rpc-consent-in'); setTimeout(function(){ if(b.parentNode)b.parentNode.removeChild(b); },300); if(v==='accepted')warm(); }
    b.querySelector('.rpc-consent-yes').addEventListener('click',function(){ done('accepted'); });
    b.querySelector('.rpc-consent-no').addEventListener('click',function(){ done('declined'); });
  }

  /* Pre-warm the form before the user clicks (removes the render delay) -- but ONLY once the
     visitor has accepted cookies. Triggers on the first hover/focus/touch of any Contact trigger,
     and on idle after load. build()/loadHubspot() are idempotent. Without consent this is a no-op,
     so HubSpot never loads on browse; the form still loads on an explicit open (openM). */
  var warmed=false;
  function warm(){ if(warmed)return; if(consentGet()!=='accepted')return; warmed=true; build(); loadHubspot(); }
  ['pointerenter','focusin','touchstart'].forEach(function(ev){
    document.addEventListener(ev,function(e){ if(e.target&&e.target.closest&&e.target.closest('[data-contact]')) warm(); }, {capture:true,passive:true});
  });
  (function(){ var go=function(){
      var ric=window.requestIdleCallback||function(f){return setTimeout(f,1200);};
      if(consentGet()==='accepted') ric(warm);            /* previously accepted -> pre-warm */
      else if(!consentGet()) ric(showConsent);            /* no choice yet -> ask; declined -> nothing */
    };
    if(document.readyState==='complete')go(); else addEventListener('load',go,{once:true}); })();

  document.addEventListener('click',function(e){
    var t=e.target.closest&&e.target.closest('[data-contact]');
    if(t){ e.preventDefault(); e.stopPropagation(); openM(); }
  },true);

  fetch('/data/contact.json',{cache:'no-cache'}).then(function(r){return r.ok?r.json():null;}).then(function(d){ if(d)cfg=d; })
    .catch(function(){}).then(function(){
      cfgReady=true;
      if((location.hash||'')==='#contact') openM();
    });
})();
