/* ============================================================================
   RARE POND — SHARED CREW-INQUIRY FORM  (crew-form.js)
   ----------------------------------------------------------------------------
   Single source of truth for the "crew your shoot" popup. Loaded root-relative
   (/assets/crew-form.js) by BOTH the studio (/) and rentals (/rentals/) pages.
   Editing this file updates BOTH pages.

   Self-contained: owns its overlay markup, its own helpers, and its styling lives
   in the sibling /assets/crew-form.css. Shoot start/end dates now come from the
   site-wide SHARED date state (window.RPDates, /assets/date-picker.js) — the crew
   form shows the currently-chosen dates + a "Change dates" button that opens the
   SAME shared calendar. Dates entered here or in the rental cart are one value.

   Public API:  window.RPCrew.open()   — opens the overlay on the current page.
                window.RPCrew.close()  — closes it.

   Jotform: posts to form 261816743694064 with the validated field keys. Keys are
   read from window.FORMS.crewInquiry (form-config.js) when present, otherwise the
   correct defaults baked in below are used — so this works with or without
   form-config.js on the page.
   ============================================================================ */
(function(){
  "use strict";
  if(window.RPCrew) return; // already initialised

  /* ---- Jotform config: prefer form-config.js, else baked-in correct keys ---- */
  var CC = (window.FORMS && window.FORMS.crewInquiry) || null;
  var FORM_ID = (CC && CC.formId) || "261816743694064";
  var F = (CC && CC.fields) || {
    firstName:"q18_firstName", lastName:"q19_lastName", email:"q20_email",
    roles:"q12_roles", people:"q13_assignedTo", dates:"q14_dates",
    insurance:"q15_insurance", budget:"q16_budget", notes:"q17_notes",
    project:"q21_projectName", dealName:"q22_dealName",
    shootDateField:"q23_date", crewEndField:"q24_date24", budgetAmount:"q25_typeA"
  };

  /* ---- Role -> person mapping + people cards (copied from rentals app.js) ---- */
  var JACKIMG   = "/rentals/media/gear/g_bcc32d94f19f3a3f.png";
  var KARINAIMG = "/rentals/media/gear/g_6e80063f5330de13.jpg";
  var CREWROLES = ["Cinematography","Gaffing","On-Set Visual Effects","Production Design","Costume"];
  var CREWMAP   = {"Cinematography":"jack","Gaffing":"jack","On-Set Visual Effects":"jack","Production Design":"karina","Costume":"karina"};
  var PEOPLE = {
    jack:  {name:"Jack Carlsen",   roles:"Cinematography · Gaffing · On-Set VFX", link:"https://jackcarlsen.com",                     img:JACKIMG},
    karina:{name:"Karina Salerno", roles:"Production Design · Costume",           link:"https://www.instagram.com/karinayourfriend", img:KARINAIMG}
  };

  /* ---- Per-field input types — CMS-editable (data/form-fields.json → "crew" map).
     Defensive: if the fetch fails, CTYPES stays {} and every field behaves as before. ---- */
  var CTYPES = {};
  try{ fetch('/data/form-fields.json',{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).then(function(j){ if(j&&j.crew) CTYPES=j.crew; }).catch(function(){}); }catch(e){}
  function cType(key){ return CTYPES[key] || 'text'; }
  /* Live mask: "number" keeps digits + one decimal point; "tel" keeps phone chars; others pass through. */
  function maskInput(type,v){ v=String(v==null?'':v); if(type==='number'){ v=v.replace(/[^0-9.]/g,''); var i=v.indexOf('.'); if(i!==-1) v=v.slice(0,i+1)+v.slice(i+1).replace(/\./g,''); } else if(type==='tel'){ v=v.replace(/[^0-9+()\-.\s]/g,''); } return v; }

  /* ---- helpers (self-contained) ---- */
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function pIso(iso){var p=String(iso).split('-');return new Date(+p[0],+p[1]-1,+p[2]);}
  function fmtD(iso){if(!iso)return '';return pIso(iso).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});}
  function daysBetween(a,b){if(!a||!b)return 0;var d=(pIso(b)-pIso(a))/86400000+1;return d>0?Math.round(d):0;}
  // Earliest bookable shoot start = today + 3 business days (skipping Sat/Sun).
  function bizMinISO(){var d=new Date();d.setHours(0,0,0,0);var a=0;while(a<3){d.setDate(d.getDate()+1);var w=d.getDay();if(w!==0&&w!==6)a++;}return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  var MINISO = bizMinISO();
  function datesText(){if(!S.dstart)return '';if(!S.dend||S.dend===S.dstart)return fmtD(S.dstart);return fmtD(S.dstart)+' – '+fmtD(S.dend)+' ('+daysBetween(S.dstart,S.dend)+' days)';}
  var emailOK=function(v){return /.+@.+\..+/.test(String(v||''));};

  /* ---- state ----
     dstart / dend are a LIVE VIEW over the site-wide shared date state
     (window.RPDates, /assets/date-picker.js) so the crew form and the rental
     cart share ONE set of dates, entered once and changeable anywhere. Falls
     back to plain local strings if the shared module ever fails to load. */
  var S = {open:false, step:0, roles:[], first:"", last:"", email:"", project:"",
           _ds:"", _de:"", ins:"", budget:"", notes:"", warn:""};
  if(window.RPDates){
    Object.defineProperty(S,'dstart',{get:function(){return window.RPDates.get().start;},set:function(v){var g=window.RPDates.get();window.RPDates.set(v||'',g.end);}});
    Object.defineProperty(S,'dend',{get:function(){return window.RPDates.get().end;},set:function(v){var g=window.RPDates.get();window.RPDates.set(g.start,v||'');}});
  } else {
    Object.defineProperty(S,'dstart',{get:function(){return S._ds;},set:function(v){S._ds=v||'';}});
    Object.defineProperty(S,'dend',{get:function(){return S._de;},set:function(v){S._de=v||'';}});
  }

  /* ---- overlay element (created once, appended to <body>) ---- */
  var pop = document.createElement('div');
  pop.className = 'rpc-pop';
  pop.id = 'rpc-crewpop';
  var mounted = false;
  function mount(){
    if(mounted) return;
    (document.body||document.documentElement).appendChild(pop);
    pop.addEventListener('click', function(e){ if(e.target===pop) close(); });
    mounted = true;
  }
  function g(id){ return pop.querySelector('#'+id); }

  /* ---- progress-fill fraction (9 required inputs, matches rentals) ---- */
  function fillFrac(){
    var n=0;
    if(S.first.trim())n++; if(S.last.trim())n++; if(emailOK(S.email))n++;
    if(S.project.trim())n++; if(S.roles.length)n++;
    if(S.dstart && S.dend && S.dend>=S.dstart && S.dstart>=MINISO)n++;
    if(S.ins)n++; if(S.budget.trim())n++; if(S.notes.trim())n++;
    return n/9;
  }
  function setFill(b,fr){ if(!b)return; fr=Math.max(0,Math.min(1,fr||0)); b.style.setProperty('--rpc-fill',(4+fr*96).toFixed(1)+'%'); b.classList.toggle('rpc-ready',fr>=0.999); }
  function syncFill(){ var nx=g('rpc-next'); if(nx) setFill(nx, fillFrac()); }
  function flashRed(el){ if(!el)return; el.classList.remove('rpc-flashred'); void el.offsetWidth; el.classList.add('rpc-flashred'); setTimeout(function(){ el.classList.remove('rpc-flashred'); },1700); }

  function personCard(who){
    var p=PEOPLE[who];
    return '<div class="rpc-card">'+(p.img?'<img src="'+p.img+'" alt="" loading="lazy" decoding="async">':'')+
      '<div><div class="rpc-pname">'+esc(p.name)+'</div><div class="rpc-prole">'+esc(p.roles)+'</div>'+
      '<a class="rpc-plink" href="'+p.link+'" target="_blank" rel="noopener">See '+esc(p.name.split(" ")[0])+'’s work →</a></div></div>';
  }

  /* ---- shared-date display block: shows the currently-chosen dates (from the
     site-wide shared state) + a "Change dates" button that opens the SAME shared
     calendar overlay (window.RPDates). Replaces the old native date inputs. ---- */
  function dateBlockHTML(){
    var have=!!(S.dstart&&S.dend), tooSoon=S.dstart&&S.dstart<MINISO;
    var label = have ? esc(datesText()) : (S.dstart ? esc(fmtD(S.dstart))+' — <i>pick an end date</i>' : 'No dates selected yet');
    return '<div class="rpc-dateblock'+(have?' rpc-hasdates':'')+'" id="rpc-dateblock">'+
      '<div class="rpc-datebadge"><svg viewBox="0 0 24 24" fill="none" stroke="#bfe3ff" stroke-width="1.6"><path d="M4 5h16v16H4z M4 9h16" stroke-linecap="round"/></svg>'+
      '<span class="rpc-datetxt">'+label+'</span></div>'+
      '<button type="button" class="rpc-datebtn" id="rpc-datebtn">'+(have?'Change dates':'Select dates')+'</button>'+
      (tooSoon?'<div class="rpc-datesoon">Earliest start is '+esc(fmtD(MINISO))+'.</div>':'')+
      '</div>';
  }
  function wireDateBlock(){
    var b=g('rpc-datebtn');
    if(b) b.onclick=function(){
      if(window.RPDates && typeof window.RPDates.open==='function'){
        window.RPDates.open(function(){ render(); }); // on Done -> re-render with new shared dates
      }
    };
  }

  function render(){
    if(S.step===1){ renderReview(); return; }
    if(S.step===2){ renderDone(); return; }
    var who=[...new Set(S.roles.map(function(r){return CREWMAP[r];}))].sort();
    var h='<div class="rpc-box"><button class="rpc-x" id="rpc-x" aria-label="Close">&times;</button><h2>Crew your shoot</h2>';
    h+='<p class="rpc-lede">Tell us about your set and which department(s) you need. If you bring us on, a basic gear package for that role can be folded into our day rate.</p>';
    h+='<div class="rpc-row2"><div><div class="rpc-lab">First name</div><input class="rpc-in" id="rpc-fn" value="'+esc(S.first)+'"></div><div><div class="rpc-lab">Last name</div><input class="rpc-in" id="rpc-ln" value="'+esc(S.last)+'"></div></div>';
    h+='<div class="rpc-lab">Contact email</div><input class="rpc-in" id="rpc-em" type="email" value="'+esc(S.email)+'">';
    h+='<div class="rpc-lab">Project name</div><input class="rpc-in" id="rpc-pr" placeholder="Name of your film / project" value="'+esc(S.project)+'">';
    h+='<div class="rpc-lab">Which role(s) do you need? <span class="rpc-hint">select all that apply</span></div><div class="rpc-roles">'+CREWROLES.map(function(r){return '<button class="rpc-role'+(S.roles.includes(r)?" rpc-on":"")+'" data-role="'+esc(r)+'">'+esc(r)+'</button>';}).join("")+'</div>';
    if(who.length)h+='<div class="rpc-cards">'+who.map(personCard).join("")+'</div>';
    h+='<div class="rpc-lab">Shoot dates</div>'+dateBlockHTML();
    h+='<span class="rpc-note">Shoots need at least 3 business days’ lead time, so the earliest start date is '+fmtD(MINISO)+'. These are the same dates used across the site — set them once, change them anywhere.</span>';
    h+='<div class="rpc-lab">Do you have production insurance?</div><div class="rpc-seg" id="rpc-seg">'+["Yes","No"].map(function(o){return '<button class="rpc-segb'+(S.ins===o?" rpc-on":"")+'" data-ins="'+o+'">'+o+'</button>';}).join("")+'</div>';
    h+='<div class="rpc-lab">Your budget</div><input class="rpc-in" id="rpc-bd" placeholder="'+(cType('budget')==='number'?'e.g. 2000':'e.g. around $2,000 for the shoot')+'" value="'+esc(S.budget)+'">';
    h+='<div class="rpc-lab">Tell us about your set</div><textarea class="rpc-ta" id="rpc-nt" placeholder="Project, location, what you are shooting, and what you need...">'+esc(S.notes)+'</textarea>';
    h+='<div class="rpc-warn" id="rpc-warn">'+esc(S.warn)+'</div><button class="rpc-send rpc-pbtn" id="rpc-next"><span>Review request →</span></button></div>';
    pop.innerHTML=h;

    g('rpc-x').onclick=close;
    pop.querySelectorAll('[data-role]').forEach(function(b){ b.onclick=function(){ var r=b.dataset.role; S.roles=S.roles.includes(r)?S.roles.filter(function(x){return x!==r;}):S.roles.concat(r); render(); }; });
    pop.querySelectorAll('[data-ins]').forEach(function(b){ b.onclick=function(){ S.ins=b.dataset.ins; render(); }; });
    var bind=function(id,key,fn){ var el=g(id); if(!el) return; var t=cType(key); if(t==='number') el.setAttribute('inputmode','decimal'); else if(t==='tel') el.setAttribute('inputmode','tel'); el.oninput=function(e){ var mv=maskInput(t,e.target.value); if(mv!==e.target.value) e.target.value=mv; fn(mv); syncFill(); }; };
    bind('rpc-fn','first',function(v){S.first=v;}); bind('rpc-ln','last',function(v){S.last=v;}); bind('rpc-em','email',function(v){S.email=v;});
    bind('rpc-pr','project',function(v){S.project=v;}); bind('rpc-bd','budget',function(v){S.budget=v;}); bind('rpc-nt','notes',function(v){S.notes=v;});
    wireDateBlock();
    g('rpc-next').onclick=toReview;
    syncFill();
  }

  function crewMiss(){
    var m=[];
    if(!S.first.trim())m.push('first name');
    if(!S.last.trim())m.push('last name');
    if(!emailOK(S.email))m.push('a valid email');
    if(!S.project.trim())m.push('project name');
    if(!S.roles.length)m.push('at least one role you need');
    if(!S.dstart)m.push('a shoot start date');
    if(!S.dend)m.push('a shoot end date');
    if(S.dstart&&S.dstart<MINISO)m.push('a start date on or after '+fmtD(MINISO));
    if(S.dstart&&S.dend&&S.dend<S.dstart)m.push('an end date on or after the start date');
    if(!S.ins)m.push('whether you have production insurance');
    if(!S.budget.trim())m.push('a budget');
    if(!S.notes.trim())m.push('a note about your set');
    return m;
  }
  function flashEmpty(){
    [['rpc-fn',S.first.trim()],['rpc-ln',S.last.trim()],['rpc-em',emailOK(S.email)],['rpc-pr',S.project.trim()],['rpc-bd',S.budget.trim()],['rpc-nt',S.notes.trim()]]
      .forEach(function(pp){ if(!pp[1]) flashRed(g(pp[0])); });
    if(!S.roles.length) flashRed(pop.querySelector('.rpc-roles'));
    if(!S.ins) flashRed(g('rpc-seg'));
    if(!S.dstart||!S.dend||S.dstart<MINISO||(S.dstart&&S.dend&&S.dend<S.dstart)) flashRed(g('rpc-dateblock'));
  }
  function toReview(){
    var m=crewMiss();
    if(m.length){ S.warn='Please add: '+m.join(', ')+'.'; var w=g('rpc-warn'); if(w)w.textContent=S.warn; flashEmpty(); return; }
    S.warn=''; S.step=1; render();
  }

  function renderReview(){
    var who=[...new Set(S.roles.map(function(r){return PEOPLE[CREWMAP[r]].name;}))];
    function row(l,v){return '<div class="rpc-qrow"><span>'+esc(l)+'</span><b>'+esc(v||'-')+'</b></div>';}
    var h='<div class="rpc-box"><button class="rpc-x" id="rpc-x" aria-label="Close">&times;</button><h2>Confirm your request</h2>';
    h+='<div class="rpc-sum">'+row('First name',S.first)+row('Last name',S.last)+row('Contact email',S.email)+
       row('Project',S.project)+row('Role(s) needed',S.roles.join(', '))+row('Team',who.join(' & '))+
       row('Shoot dates',datesText())+row('Production insurance',S.ins)+row('Budget',S.budget)+'</div>';
    if(S.notes.trim())h+='<div class="rpc-lab">About your set</div><div class="rpc-notes">'+esc(S.notes)+'</div>';
    h+='<div class="rpc-reqrow"><button class="rpc-back" id="rpc-back">← Back</button><button class="rpc-send rpc-pbtn rpc-ready" id="rpc-send" style="margin:0">Send request →</button></div></div>';
    pop.innerHTML=h;
    g('rpc-x').onclick=close;
    g('rpc-back').onclick=function(){ S.step=0; render(); };
    g('rpc-send').onclick=send;
  }

  function renderDone(){
    var nm=S.first||'there', pj=S.project||'your project', em=S.email||'your inbox';
    var h='<div class="rpc-box rpc-done"><div class="rpc-check">&#10003;</div><h2>Request sent!</h2>'+
      '<p class="rpc-lede">Thanks, '+esc(nm)+', your crew inquiry for <b>'+esc(pj)+'</b> is in. A copy is on its way to you at <b>'+esc(em)+'</b>, and our team has it at <b>studio@rarepond.com</b>. We&#8217;ll follow up soon.</p>'+
      '<button class="rpc-send" id="rpc-done" style="margin-top:10px">Done</button></div>';
    pop.innerHTML=h;
    g('rpc-done').onclick=close;
  }

  /* ---- build the Jotform payload (validated field keys) ---- */
  function buildPayload(){
    var who=[...new Set(S.roles.map(function(r){return PEOPLE[CREWMAP[r]].name;}))];
    var data={};
    if(F.project)data[F.project]=S.project||"";
    if(F.dealName)data[F.dealName]='Crew: '+((S.project||'').trim()||'Untitled project')+' ('+(S.roles.join(', ')||'crew')+')';
    if(F.roles)data[F.roles]=S.roles.join(", ");
    if(F.people)data[F.people]=who.join(" & ");
    if(F.dates)data[F.dates]=datesText();
    if(F.insurance)data[F.insurance]=S.ins||"";
    if(F.budget)data[F.budget]=S.budget||"";
    if(F.notes)data[F.notes]=S.notes||"";
    if(F.firstName)data[F.firstName]=S.first||"";
    if(F.lastName)data[F.lastName]=S.last||"";
    if(F.email)data[F.email]=S.email||"";
    // Shoot START -> q23_date sub-fields (Google Calendar span start).
    if(F.shootDateField&&S.dstart){var p=S.dstart.split('-');data[F.shootDateField+'[year]']=p[0];data[F.shootDateField+'[month]']=p[1];data[F.shootDateField+'[day]']=p[2];}
    // Shoot END -> q24_date24 sub-fields (span end; falls back to start).
    if(F.crewEndField&&(S.dend||S.dstart)){var e=(S.dend||S.dstart).split('-');data[F.crewEndField+'[year]']=e[0];data[F.crewEndField+'[month]']=e[1];data[F.crewEndField+'[day]']=e[2];}
    // Budget PARSED to a plain number for the HubSpot deal amount ("$3,500" -> "3500").
    if(F.budgetAmount){var bm=(String(S.budget).match(/[\d,]+(\.\d+)?/)||[''])[0].replace(/,/g,'');if(bm)data[F.budgetAmount]=bm;}
    return data;
  }

  function send(){
    var btn=g('rpc-send'); if(btn){ btn.disabled=true; btn.textContent='Sending…'; }
    var data=buildPayload();
    // Test hook: if a tester sets window.RPCrew._captureOnly = true, capture the
    // payload and DO NOT hit Jotform (used to verify without creating test data).
    if(window.RPCrew && window.RPCrew._captureOnly){
      window.RPCrew._lastPayload = data;
      console.log('[RPCrew] captureOnly — payload NOT sent:', JSON.stringify(data));
      S.step=2; render(); return;
    }
    var sent=false;
    if(FORM_ID && !/PASTE|XXXX/i.test(FORM_ID)){
      try{
        var fd=new FormData();
        Object.keys(data).forEach(function(k){ fd.append(k,data[k]); });
        fetch('https://submit.jotform.com/submit/'+FORM_ID,{method:'POST',body:fd,mode:'no-cors'});
        sent=true;
      }catch(e){ console.error('[RPCrew] Jotform submit failed:',e); }
    }
    if(!sent){
      var subj=encodeURIComponent("Crew request"+(S.roles.length?": "+S.roles.join(", "):""));
      var who=[...new Set(S.roles.map(function(r){return PEOPLE[CREWMAP[r]].name;}))];
      var body=encodeURIComponent("Project: "+(S.project||"(none)")+"\nRoles: "+(S.roles.join(", ")||"(none)")+"\nTeam: "+(who.join(" & ")||"-")+"\nShoot dates: "+(datesText()||"(not set)")+"\nInsurance: "+(S.ins||"(n/a)")+"\nBudget: "+(S.budget||"(n/a)")+"\n\n"+(S.notes||""));
      try{ window.location.href="mailto:studio@rarepond.com?subject="+subj+"&body="+body; }catch(e){}
    }
    S.step=2; render();
  }

  /* ---- open / close / esc ---- */
  function open(){ mount(); S.open=true; S.step=0; S.warn=''; render(); pop.classList.add('rpc-show'); document.body.style.overflow='hidden'; syncFill(); }
  function close(){ S.open=false; pop.classList.remove('rpc-show'); S.step=0; document.body.style.overflow=''; }
  document.addEventListener('keydown', function(e){ if(e.key==='Escape' && S.open) close(); });

  window.RPCrew = { open:open, close:close, _captureOnly:false, _lastPayload:null };

  /* Keep the crew form's date display fresh if the shared dates change elsewhere
     while it's open (step 0). Re-rendering the review/done steps would be jarring,
     so only refresh the editable step. */
  if(window.RPDates && typeof window.RPDates.onChange==='function'){
    window.RPDates.onChange(function(){ if(S.open && S.step===0) render(); });
  }
})();
