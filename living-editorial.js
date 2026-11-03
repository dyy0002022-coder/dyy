(()=>{
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),desktop=matchMedia('(min-width:901px)');
 const stages=[...document.querySelectorAll('.channel-scroll')];let pending=false;
 const clamp=x=>Math.max(0,Math.min(1,x));
 function draw(){pending=false;const active=desktop.matches&&!reduced.matches;document.body.classList.toggle('motion-ready',active);for(const s of stages){const box=s.getBoundingClientRect(),inner=s.querySelector('.channel-sticky'),win=s.querySelector('.channel-window'),before=s.querySelector('.channel-before'),after=s.querySelector('.channel-after');if(!active){win.style.clipPath='';before.style.opacity='';after.style.opacity='';continue}const p=clamp((80-box.top)/(box.height-inner.offsetHeight));const expand=clamp(p/.68),e=expand*expand*(3-2*expand);win.style.clipPath=`inset(${15*(1-e)}% ${34*(1-e)}%)`;before.style.opacity=1-clamp(p/.32);after.style.opacity=clamp((p-.58)/.2);win.style.setProperty('--shade',clamp((p-.45)/.25))}}
 function schedule(){if(!pending){pending=true;requestAnimationFrame(draw)}}
 addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);reduced.addEventListener('change',schedule);desktop.addEventListener('change',schedule);draw();
 if(!reduced.matches&&'IntersectionObserver'in window){document.body.classList.add('reveal-ready');const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');io.unobserve(e.target)}}),{threshold:.06});document.querySelectorAll('[data-reveal]').forEach(x=>io.observe(x))}
})();
