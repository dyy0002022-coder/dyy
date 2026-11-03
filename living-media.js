(() => {
  const track=document.querySelector('.right-track');
  if(!track)return;
  const slides=[...track.children], prev=document.querySelector('.right-prev'),next=document.querySelector('.right-next'),count=document.querySelector('.right-count');
  let index=0;
  function sync(){index=Math.max(0,Math.min(slides.length-1,Math.round(track.scrollLeft/track.clientWidth)));count.textContent=String(index+1).padStart(2,'0')+' / '+String(slides.length).padStart(2,'0');prev.disabled=index===0;next.disabled=index===slides.length-1;}
  function move(dir){const i=Math.max(0,Math.min(slides.length-1,index+dir));track.scrollTo({left:i*track.clientWidth,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
  prev.addEventListener('click',()=>move(-1));next.addEventListener('click',()=>move(1));
  track.addEventListener('scroll',sync,{passive:true});
  track.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();move(e.key==='ArrowLeft'?-1:1);}});
  new ResizeObserver(()=>{track.scrollLeft=index*track.clientWidth;sync();}).observe(track);
  sync();
})();
