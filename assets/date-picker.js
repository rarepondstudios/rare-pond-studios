/* ============================================================================
   RARE POND - SHARED DATE PICKER  (date-picker.js)
   ----------------------------------------------------------------------------
   ONE date system for the whole site: "enter your shoot / rental dates ONCE,
   change them anywhere." Loaded root-relative (/assets/date-picker.js) by BOTH
   the studio (/) and rentals (/rentals/) pages, plus consumed by the shared
   crew form (/assets/crew-form.js).

   Holds a SINGLE shared date range (start ISO, end ISO) in sessionStorage, so a
   date chosen in the rental cart pre-fills the crew form and vice-versa. Exposes
   a small overlay calendar (its own #rpd-* DOM + prefixed CSS in date-picker.css)
   so any consumer can open the same picker.

   Public API - window.RPDates:
     .get()               -> {start, end}  (ISO 'YYYY-MM-DD' strings or '')
     .set(start, end)     -> persist + notify listeners (either may be '')
     .clear()             -> clear both
     .open(onDone)        -> open the overlay calendar; calls onDone(start,end)
                             when the user hits Done (also fires change events)
     .close()             -> close the overlay
     .formatRange()       -> "Aug 10 – Aug 13, 2026" style label ('' if unset)
     .formatLong()        -> "Aug 10 – Aug 13, 2026 (4 days)" or '' if unset
     .days()              -> integer inclusive day count (0 if incomplete)
     .minISO()            -> earliest bookable start (today + 3 business days)
     .onChange(fn)        -> subscribe; returns an unsubscribe function
   Also emits a DOM CustomEvent 'rpdates:change' on window with {start,end}.
   ============================================================================ */
(function(){
  "use strict";
  if(window.RPDates) return; // already initialised

  var KEY = 'rpDates.v1';

  /* ---- date primitives (mirrors rentals app.js so behavior is identical) ---- */
  function pISO(s){var p=String(s).split('-');return new Date(+p[0],+p[1]-1,+p[2]);}
  function isoOf(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function dn(s){return pISO(s).setHours(0,0,0,0);}
  // Earliest bookable start = today + 3 business days (skipping Sat/Sun).
  function minStartD(){var d=new Date();d.setHours(0,0,0,0);var a=0;while(a<3){d.setDate(d.getDate()+1);var w=d.getDay();if(w!==0&&w!==6)a++;}return d;}
  function minStartISO(){return isoOf(minStartD());}
  function tooEarly(is){return dn(is)<dn(minStartISO());}
  function fmtOne(s){return pISO(s).toLocaleDateString('en-US',{month:'short',day:'numeric'});}
  function fmtOneY(s){return pISO(s).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});}

  /* ---- shared state (single source of truth) + sessionStorage persistence ---- */
  var S = {start:'', end:''};
  try{ var raw=sessionStorage.getItem(KEY); if(raw){var o=JSON.parse(raw); if(o&&typeof o.start==='string'&&typeof o.end==='string'){S.start=o.start;S.end=o.end;}} }catch(e){}

  var listeners = [];
  function persist(){ try{ sessionStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} }
  function notify(){
    persist();
    var snap={start:S.start,end:S.end};
    listeners.slice().forEach(function(fn){ try{fn(snap.start,snap.end);}catch(e){} });
    try{ window.dispatchEvent(new CustomEvent('rpdates:change',{detail:snap})); }catch(e){}
  }

  function days(){ if(!S.start||!S.end)return 0; var d=Math.round((dn(S.end)-dn(S.start))/86400000)+1; return d>0?d:0; }
  function formatRange(){ if(!S.start)return ''; if(!S.end||S.end===S.start)return fmtOneY(S.start); return fmtOne(S.start)+' – '+fmtOneY(S.end); }
  function formatLong(){ var r=formatRange(); if(!r)return ''; var d=days(); return d?r+' ('+d+' day'+(d>1?'s':'')+')':r; }

  function set(start,end){
    start=start||''; end=end||'';
    if(start&&end&&dn(end)<dn(start)) end='';           // guard: end never before start
    if(S.start===start && S.end===end) return;          // no-op
    S.start=start; S.end=end; notify();
  }
  function clear(){ if(!S.start&&!S.end)return; S.start=''; S.end=''; notify(); }

  /* ============================================================================
     OVERLAY CALENDAR - self-contained DOM (#rpd-*), styled in date-picker.css.
     Faithful port of the rentals in-page calendar (same gradient band, same
     3-business-day rule, same Start/End toggle) so it looks/behaves identically.
     ============================================================================ */
  var CS='#5aa0ff', CE='#8f7bff';                       // start / end accent colors
  function lerp(a,b,t){return a+(b-a)*t;}
  function hexToRgb(h){h=h.replace('#','');return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
  var CSr=hexToRgb(CS), CEr=hexToRgb(CE);
  function bandCol(t){t=Math.max(0,Math.min(1,t));var r=Math.round(lerp(CSr[0],CEr[0],t)),g=Math.round(lerp(CSr[1],CEr[1],t)),b=Math.round(lerp(CSr[2],CEr[2],t));return 'rgb('+r+','+g+','+b+')';}

  // local editing state for the overlay (committed to S only on Done)
  var E={s:'',e:''}, calRef=null, pick='start', badDay=null, doneCb=null;

  var pop=null, mounted=false;
  function mount(){
    if(mounted) return;
    pop=document.createElement('div');
    pop.className='rpd-pop'; pop.id='rpd-pop';
    pop.innerHTML='<div class="rpd-box"><button class="rpd-x" id="rpd-x" aria-label="Close">&times;</button>'+
      '<h3 id="rpd-title">Select your dates</h3><p class="rpd-sub" id="rpd-sub">Pick a start date, then an end date.</p>'+
      '<div id="rpd-calbox"></div>'+
      '<div class="rpd-acts"><button class="rpd-cl" id="rpd-clear">Clear</button><button class="rpd-ap" id="rpd-done">Done</button></div></div>';
    (document.body||document.documentElement).appendChild(pop);
    pop.addEventListener('click',function(e){ if(e.target===pop) close(); });
    q('rpd-x').onclick=close;
    q('rpd-done').onclick=commit;
    q('rpd-clear').onclick=function(){ E.s='';E.e='';pick='start';calRender(); };
    document.addEventListener('keydown',function(e){ if(e.key==='Escape' && pop && pop.classList.contains('rpd-show')) close(); });
    mounted=true;
  }
  function q(id){ return pop.querySelector('#'+id); }

  function calSum(){
    if(E.s&&E.e){var d=Math.round((dn(E.e)-dn(E.s))/86400000)+1;return '<b style="color:'+CS+'">'+fmtOne(E.s)+'</b> → <b style="color:'+CE+'">'+fmtOne(E.e)+'</b> · '+d+' day'+(d>1?'s':'');}
    if(E.s)return '<b style="color:'+CS+'">'+fmtOne(E.s)+'</b>, now pick an end date';
    return 'Pick your start date';
  }
  function calNote(){ if(!(E.s&&E.e))return ''; return '<div class="rpd-note"><b>Start</b> '+fmtOne(E.s)+'&nbsp; ·&nbsp; <b>End</b> '+fmtOne(E.e)+'</div>'; }

  function calRender(){
    var el=q('rpd-calbox'); if(!el)return;
    if(!calRef){var b=E.s?pISO(E.s):new Date();calRef=new Date(b.getFullYear(),b.getMonth(),1);}
    var y=calRef.getFullYear(),m=calRef.getMonth();
    var first=new Date(y,m,1),sw=first.getDay(),dim=new Date(y,m+1,0).getDate();
    var mon=first.toLocaleDateString('en-US',{month:'long',year:'numeric'});
    var cells='';for(var i=0;i<sw;i++)cells+='<div class="rpd-cd rpd-empty"></div>';
    var span=(E.s&&E.e)?(dn(E.e)-dn(E.s)):0,step=span?1/span:0,R=17;
    for(var d=1;d<=dim;d++){var is=isoOf(new Date(y,m,d));var cls='rpd-cd';
      if(tooEarly(is))cls+=' rpd-off';
      var col=(sw+d-1)%7;
      var isS=E.s===is,isE=E.e===is,inR=E.s&&E.e&&dn(is)>dn(E.s)&&dn(is)<dn(E.e);
      var bd='';
      if(isS||isE||inR){
        var tC=span?((dn(is)-dn(E.s))/span):0;
        var left='0',right='0',gL=bandCol(tC-step/2),gR=bandCol(tC+step/2);
        var capL=isS||col===0,capR=isE||col===6;
        if(isS&&!isE){left='calc(50% - 1px)';right='0';gL=bandCol(0);gR=bandCol(step/2);}
        else if(isE&&!isS){left='0';right='calc(50% - 1px)';gL=bandCol(1-step/2);gR=bandCol(1);}
        var rad=(capL?R:0)+'px '+(capR?R:0)+'px '+(capR?R:0)+'px '+(capL?R:0)+'px';
        bd='<span class="rpd-bd" style="left:'+left+';right:'+right+';border-radius:'+rad+';background:linear-gradient(90deg,'+gL+','+gR+')"></span>';}
      if(isS)cls+=' rpd-selS';if(isE)cls+=' rpd-selE';if(inR)cls+=' rpd-inr';if(badDay===is)cls+=' rpd-bad';
      var dot=(isS||isE)?'<span class="rpd-dot"></span>':'';
      cells+='<div class="'+cls+'" data-d="'+is+'" role="button" tabindex="0" aria-label="'+is+'">'+bd+dot+'<span class="rpd-num">'+d+'</span></div>';}
    el.innerHTML='<div class="rpd-rule">Heads up: shoots &amp; rentals need at least <b>3 business days\'</b> lead time, so the earliest date you can pick is <b>'+fmtOne(minStartISO())+'</b>.</div>'
      +'<div class="rpd-toggle"><button class="rpd-tS'+(pick==='start'?' rpd-on':'')+'" data-pick="start">Start date</button><button class="rpd-tE'+(pick==='end'?' rpd-on':'')+'" data-pick="end">End date</button></div>'
      +'<div class="rpd-head"><button class="rpd-nav" data-nav="-1">‹</button><span>'+mon+'</span><button class="rpd-nav" data-nav="1">›</button></div>'
      +'<div class="rpd-grid"><div class="rpd-cw">Su</div><div class="rpd-cw">Mo</div><div class="rpd-cw">Tu</div><div class="rpd-cw">We</div><div class="rpd-cw">Th</div><div class="rpd-cw">Fr</div><div class="rpd-cw">Sa</div>'+cells+'</div>'
      +'<div class="rpd-warn" id="rpd-warn"></div><div class="rpd-summ">'+calSum()+'</div>'+calNote();
    el.querySelectorAll('[data-pick]').forEach(function(b){b.onclick=function(){pick=b.dataset.pick;calRender();};});
    el.querySelectorAll('[data-nav]').forEach(function(b){b.onclick=function(){calRef=new Date(calRef.getFullYear(),calRef.getMonth()+ +b.dataset.nav,1);calRender();};});
    el.querySelectorAll('.rpd-cd[data-d]').forEach(function(c){c.onclick=function(){pickDay(c.dataset.d);};});
  }

  function pickDay(is){
    badDay=null;
    if(tooEarly(is)){badDay=is;calRender();var we=q('rpd-warn');if(we){we.textContent="Shoots & rentals need at least 3 business days' notice, so the earliest date is "+fmtOne(minStartISO())+".";we.classList.add('rpd-show');}setTimeout(function(){badDay=null;calRender();},2200);return;}
    if(pick==='start'){E.s=is;if(E.e&&dn(E.e)<=dn(is))E.e='';pick='end';}
    else{
      if(!E.s){E.s=is;pick='end';}
      else if(dn(is)<=dn(E.s)){badDay=is;calRender();var w=q('rpd-warn');if(w){w.textContent=(dn(is)===dn(E.s))?"That's a minimum of one day, so pick an end date after your start date.":"You can't select an end date before your start date.";w.classList.add('rpd-show');}setTimeout(function(){badDay=null;calRender();},1600);return;}
      else{E.e=is;}
    }
    calRender();
  }

  /* ---- open / close / commit ---- */
  function open(onDone){
    mount();
    E.s=S.start; E.e=S.end; pick='start'; badDay=null; calRef=null; doneCb=(typeof onDone==='function')?onDone:null;
    calRender();
    pop.classList.add('rpd-show');
    document.body.style.overflow='hidden';
  }
  function close(){ if(!pop)return; pop.classList.remove('rpd-show'); document.body.style.overflow=''; doneCb=null; }
  function commit(){
    set(E.s, E.e);              // persist + notify all consumers
    var cb=doneCb;
    pop.classList.remove('rpd-show'); document.body.style.overflow=''; doneCb=null;
    if(cb) cb(S.start,S.end);
  }

  function onChange(fn){ if(typeof fn==='function'){listeners.push(fn);} return function(){var i=listeners.indexOf(fn);if(i!==-1)listeners.splice(i,1);}; }

  /* Enter/Space activate the calendar day cells, which are role="button" <div>s. The
     nav arrows and start/end toggle are already real <button>s. */
  document.addEventListener('keydown',function(e){
    if(e.key!=='Enter'&&e.key!==' ')return;
    var t=e.target;
    if(!t||!t.matches||t.matches('button,a,input,textarea,select'))return;
    if(!t.matches('.rpd-cd[data-d]'))return;
    e.preventDefault(); t.click();
  });

  window.RPDates = {
    get:function(){return {start:S.start,end:S.end};},
    set:set, clear:clear,
    open:open, close:close,
    formatRange:formatRange, formatLong:formatLong,
    days:days, minISO:minStartISO,
    onChange:onChange
  };
})();
