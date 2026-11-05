(()=>{
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');


 const zoom=document.querySelector(".cover-zoom-sequence");let zoomPending=false;function drawZoom(){zoomPending=false;if(!zoom)return;const box=zoom.getBoundingClientRect();const progress=Math.max(0,Math.min(1,-box.top/(zoom.offsetHeight-innerHeight)));zoom.style.setProperty("--cover-scale",reduced.matches?1:.72+.28*(progress*progress*(3-2*progress)))}function queueZoom(){if(!zoomPending){zoomPending=true;requestAnimationFrame(drawZoom)}}addEventListener("scroll",queueZoom,{passive:true});addEventListener("resize",queueZoom);reduced.addEventListener("change",queueZoom);drawZoom();
 document.querySelectorAll('.channel-panel').forEach(panel=>{
  const gallery=panel.querySelector('.curved-gallery'),stage=panel.querySelector('.curved-stage'),slides=[...panel.querySelectorAll('.curved-slide')];let index=0,drag=null,moved=false,raf=0;
  const prev=panel.querySelector('.channel-prev'),next=panel.querySelector('.channel-next');
  function update(){raf=0;index=Math.max(0,Math.min(slides.length-1,Math.round(stage.scrollTop/stage.clientHeight)));slides.forEach((slide,i)=>{slide.classList.toggle('is-current',i===index);slide.classList.remove('is-before');slide.removeAttribute('aria-hidden');slide.querySelector('button').tabIndex=i===index?0:-1});panel.querySelector('.channel-count').textContent=String(index+1).padStart(2,'0')+' / '+String(slides.length).padStart(2,'0');panel.dataset.index=index;prev.disabled=index===0;next.disabled=index===slides.length-1}
  function show(n){stage.scrollTo({top:Math.max(0,Math.min(slides.length-1,n))*stage.clientHeight,behavior:reduced.matches?'instant':'smooth'})}
  prev.onclick=()=>show(index-1);next.onclick=()=>show(index+1);
  stage.addEventListener('scroll',()=>{if(!raf)raf=requestAnimationFrame(update)},{passive:true});
  gallery.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End'].includes(e.key)){e.preventDefault();show(e.key==='Home'?0:e.key==='End'?slides.length-1:index+(['ArrowDown','PageDown'].includes(e.key)?1:-1))}});
  stage.addEventListener('pointerdown',e=>{moved=false;if(e.pointerType==='mouse'){drag={y:e.clientY,index};}});
  window.addEventListener('pointermove',e=>{if(drag&&Math.abs(e.clientY-drag.y)>12)moved=true});
  window.addEventListener('pointerup',e=>{if(!drag)return;const dy=e.clientY-drag.y;if(Math.abs(dy)>40)show(drag.index+(dy<0?1:-1));drag=null});
  stage.addEventListener('pointercancel',()=>{drag=null});stage.addEventListener('click',e=>{if(moved){e.preventDefault();e.stopImmediatePropagation();moved=false}},true);
  new ResizeObserver(()=>{stage.scrollTo({top:index*stage.clientHeight,behavior:'instant'});update()}).observe(stage);update();
 });
 const hero=document.querySelector('.hero-film'),motion=document.querySelector('.hero-motion-toggle');let motionOff=reduced.matches,heroVisible=true;
 function syncHero(){if(motionOff||!heroVisible||document.hidden)hero.pause();else hero.play().catch(()=>{});motion.textContent=hero.paused?'▶':'Ⅱ';motion.setAttribute('aria-pressed',String(motionOff))}
 hero.muted=true;hero.addEventListener('play',()=>{motion.textContent='Ⅱ'});hero.addEventListener('pause',()=>{motion.textContent='▶'});motion.onclick=()=>{motionOff=!motionOff;syncHero()};reduced.addEventListener('change',()=>{motionOff=reduced.matches;syncHero()});document.addEventListener('visibilitychange',syncHero);new IntersectionObserver(entries=>{heroVisible=entries[0].isIntersecting;syncHero()}).observe(hero);syncHero();
 const audio=document.querySelector('#living-ambience'),toggle=document.querySelector('.ambience-toggle');
 let eligible=false,disabled=false,fade=0,generation=0;const playing=new Set();
 const english=()=>document.documentElement.lang.startsWith('en');
 function label(){toggle.setAttribute('aria-pressed',String(!audio.paused));toggle.querySelector('.ambience-label').textContent=audio.paused?(english()?'Enable ambience':'开启背景音乐'):(english()?'Ambience · off':'背景音乐 · 关闭')}
 function stop(){generation++;cancelAnimationFrame(fade);audio.pause();label()}
 async function start(){if(!eligible||disabled||playing.size||document.hidden)return;const gen=++generation;audio.volume=0;toggle.hidden=false;try{await audio.play();if(gen!==generation)return;label();const beginning=performance.now();function step(t){if(gen!==generation)return;audio.volume=.12*Math.min(1,(t-beginning)/4500);if(t-beginning<4500)fade=requestAnimationFrame(step)}fade=requestAnimationFrame(step)}catch{label()}}
 function videoPlaying(key){playing.add(key);stop()}
 function videoEnded(key){playing.delete(key);eligible=true;toggle.hidden=false;start()}
 document.querySelectorAll('video:not(.hero-film)').forEach(video=>{video.addEventListener('play',()=>videoPlaying(video));video.addEventListener('pause',()=>playing.delete(video));video.addEventListener('ended',()=>videoEnded(video))});
 toggle.addEventListener('click',()=>{if(audio.paused){eligible=true;disabled=false;start()}else{disabled=true;stop()}});
 document.addEventListener('visibilitychange',()=>document.hidden?stop():start());window.addEventListener('pagehide',stop);
 new MutationObserver(label).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 document.querySelectorAll('[data-video]').forEach(button=>button.addEventListener('click',e=>{
  e.preventDefault();e.stopImmediatePropagation();const id=button.dataset.video,frame=document.createElement('iframe');
  frame.src='https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1&enablejsapi=1&origin='+encodeURIComponent(location.origin);frame.title=button.querySelector('img').alt;frame.allow='autoplay; encrypted-media; picture-in-picture';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';button.replaceWith(frame);videoPlaying(frame);
  function attach(){new YT.Player(frame,{events:{onStateChange(event){if(event.data===1)videoPlaying(frame);if(event.data===0)videoEnded(frame);if(event.data===2)playing.delete(frame)}}})}
  if(window.YT?.Player)attach();else{const previous=window.onYouTubeIframeAPIReady;window.onYouTubeIframeAPIReady=()=>{previous?.();attach()};if(!document.querySelector('script[data-youtube-api]')){const script=document.createElement('script');script.dataset.youtubeApi='';script.src='https://www.youtube.com/iframe_api';document.head.append(script)}}
 },true));
 if(!reduced.matches&&'IntersectionObserver'in window){document.body.classList.add('reveal-ready');const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');io.unobserve(e.target)}}),{threshold:.06});document.querySelectorAll('[data-reveal]').forEach(x=>io.observe(x))}
})();