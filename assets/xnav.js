/* Cross-site nav helpers (shared by studio, rentals, media):
   1) hover-blurb popups on the sibling-site chips (blurb text is each site's own CMS field,
      data.navBlurb, so Studio/Rentals/Media each edit their own).
   2) collapse the chip cluster into a burger when the header would otherwise overflow on
      narrow screens (skipped on the studio, which already has its own hamburger). */
(function(){
  /* ---------- 1. hover blurb popups ---------- */
  var SRC={studio:'/data/site.json',rentals:'/data/rentals.json',media:'/data/media.json'};
  var linkChips=[].slice.call(document.querySelectorAll('.xnav a.xchip[data-site]'));
  var wanted={};
  linkChips.forEach(function(c){ wanted[c.getAttribute('data-site')]=1; });
  Object.keys(wanted).forEach(function(site){
    if(!SRC[site])return;
    fetch(SRC[site],{cache:'no-cache'}).then(function(r){return r.ok?r.json():null;}).then(function(d){
      var b=d&&d.navBlurb; if(!b)return;
      linkChips.forEach(function(c){
        if(c.getAttribute('data-site')!==site||c.querySelector('.xnav-tip'))return;
        var t=document.createElement('span'); t.className='xnav-tip'; t.setAttribute('aria-hidden','true'); t.textContent=b; c.appendChild(t);
      });
    }).catch(function(){});
  });

  /* ---------- 2. collapse into a burger when the header runs out of room ---------- */
  [].slice.call(document.querySelectorAll('.xnav')).forEach(function(nav){
    var cluster=nav.parentNode; if(!cluster) return;
    if(cluster.querySelector('.hmenu-btn')) return;                 // studio: its own menu handles this
    if(getComputedStyle(cluster).position==='static') cluster.style.position='relative';
    var dark=nav.classList.contains('xnav-dark');
    var burger=document.createElement('button');
    burger.className='xnav-burger'+(dark?' xnav-burger-dark':''); burger.type='button';
    burger.setAttribute('aria-label','Menu'); burger.setAttribute('aria-expanded','false'); burger.innerHTML='<span></span>';
    var pop=document.createElement('div'); pop.className='xnav-pop'+(dark?' xnav-pop-dark':'');
    cluster.appendChild(burger); cluster.appendChild(pop);
    var soc=cluster.querySelector('.rp-soc');
    function fill(){
      pop.innerHTML='';
      var header=cluster.closest('header');
      var pnav=header&&header.querySelector('.hnav,.mnav');     // page nav (Team / Projects / Contact)
      if(pnav){
        [].slice.call(pnav.querySelectorAll('a')).forEach(function(a){ var cl=a.cloneNode(true); cl.classList.add('xnav-pop-link'); pop.appendChild(cl); });
        var hr=document.createElement('div'); hr.className='xnav-pop-div'; pop.appendChild(hr);
      }
      [].slice.call(nav.querySelectorAll('.xchip')).forEach(function(ch){
        var cl=ch.cloneNode(true); var tip=cl.querySelector('.xnav-tip'); if(tip)tip.remove(); pop.appendChild(cl);
      });
      if(soc&&soc.children.length){ var sd=document.createElement('div'); sd.className='rp-soc xnav-pop-soc'; sd.innerHTML=soc.innerHTML; pop.appendChild(sd); }
    }
    var open=false;
    function setOpen(o){ open=o; pop.classList.toggle('open',o); burger.classList.toggle('open',o); burger.setAttribute('aria-expanded',o?'true':'false'); }
    burger.addEventListener('click',function(e){ e.stopPropagation(); if(!open)fill(); setOpen(!open); });
    document.addEventListener('click',function(e){ if(open&&!pop.contains(e.target)&&!burger.contains(e.target))setOpen(false); });
    pop.addEventListener('click',function(e){ if(e.target.closest('a'))setOpen(false); });
    document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&open)setOpen(false); });
    function measure(){
      cluster.classList.remove('xnav-collapsed');                  // un-collapse to measure the natural width need
      var header=cluster.closest('header')||cluster;
      var over=header.scrollWidth>header.clientWidth+1;
      cluster.classList.toggle('xnav-collapsed',over);
    }
    measure();
    try{ var ro=new ResizeObserver(function(){ setOpen(false); measure(); }); ro.observe(cluster.closest('header')||document.body); }catch(e){}
    addEventListener('resize',function(){ setOpen(false); measure(); },{passive:true});
    if(document.fonts&&document.fonts.ready) document.fonts.ready.then(measure);   // remeasure once webfonts land
  });
})();
