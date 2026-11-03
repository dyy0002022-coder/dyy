(()=>{
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 document.querySelectorAll('.channel-panel').forEach(panel=>{
  const gallery=panel.querySelector('.curved-gallery'),slides=[...panel.querySelectorAll('.curved-slide')];let index=0,start=null,moved=false;
  function show(next){index=(next+slides.length)%slides.length;slides.forEach((slide,i)=>{slide.classList.toggle('is-current',i===index);slide.classList.toggle('is-before',i<index);slide.setAttribute('aria-hidden',String(i!==index));slide.querySelector('button').tabIndex=i===index?0:-1});panel.querySelector('.channel-count').textContent=String(index+1).padStart(2,'0')+' / '+String(slides.length).padStart(2,'0');panel.dataset.index=index}
  panel.querySelector('.channel-prev').onclick=()=>show(index-1);panel.querySelector('.channel-next').onclick=()=>show(index+1);
  gallery.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();show(index+(e.key==='ArrowRight'?1:-1))}});
  gallery.addEventListener('pointerdown',e=>{if(e.target.closest('.channel-controls'))return;start={x:e.clientX,y:e.clientY,id:e.pointerId};moved=false});
  gallery.addEventListener('pointermove',e=>{if(start&&Math.abs(e.clientX-start.x)>12)moved=true});
  window.addEventListener('pointerup',e=>{if(!start||e.pointerId!==start.id)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy))show(index+(dx<0?1:-1));start=null});
  gallery.addEventListener('pointercancel',()=>{start=null});gallery.addEventListener('click',e=>{if(moved){e.preventDefault();e.stopImmediatePropagation();moved=false}},true);show(0);
 });
 const audio=document.querySelector('#living-ambience'),toggle=document.querySelector('.ambience-toggle');
 let eligible=false,disabled=false,fade=0,generation=0;const playing=new Set();
 const english=()=>document.documentElement.lang.startsWith('en');
 function label(){toggle.setAttribute('aria-pressed',String(!audio.paused));toggle.querySelector('.ambience-label').textContent=audio.paused?(english()?'Enable ambience':'开启背景音乐'):(english()?'Ambience · off':'背景音乐 · 关闭')}
 function stop(){generation++;cancelAnimationFrame(fade);audio.pause();label()}
 async function start(){if(!eligible||disabled||playing.size||document.hidden)return;const gen=++generation;audio.volume=0;toggle.hidden=false;try{await audio.play();if(gen!==generation)return;label();const beginning=performance.now();function step(t){if(gen!==generation)return;audio.volume=.12*Math.min(1,(t-beginning)/4500);if(t-beginning<4500)fade=requestAnimationFrame(step)}fade=requestAnimationFrame(step)}catch{label()}}
 function videoPlaying(key){playing.add(key);stop()}
 function videoEnded(key){playing.delete(key);eligible=true;toggle.hidden=false;start()}
 document.querySelectorAll('video').forEach(video=>{video.addEventListener('play',()=>videoPlaying(video));video.addEventListener('pause',()=>playing.delete(video));video.addEventListener('ended',()=>videoEnded(video))});
 toggle.addEventListener('click',()=>{if(audio.paused){disabled=false;start()}else{disabled=true;stop()}});
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