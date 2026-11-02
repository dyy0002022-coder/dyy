(() => {
  const stage=document.querySelector('.book-stage'); if(!stage)return;
  const volume=stage.querySelector('.book-volume'), base=stage.querySelector('.book-base'), leaf=stage.querySelector('.book-turn');
  const prev=document.querySelector('.book-prev'),next=document.querySelector('.book-next'),count=document.querySelector('.book-count'),zoom=document.querySelector('.reader-enlarge');
  const pages=[7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,6].map(n=>`assets/booklet/page-${String(n).padStart(2,'0')}.webp`);
  let index=0,busy=false,drag=null;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function sync(){base.src=pages[index];base.alt=`研究资料册 ${index+1} / ${pages.length}`;count.textContent=`${index+1} / ${pages.length}`;prev.disabled=index===0;next.disabled=index===pages.length-1;zoom.dataset.image=pages[index];zoom.querySelector('img').src=pages[index];zoom.querySelector('img').alt=base.alt;for(const n of [index-1,index+1])if(pages[n]){const im=new Image();im.src=pages[n];}}
  function fit(){const r=stage.getBoundingClientRect(),s=getComputedStyle(stage);const h=r.height-parseFloat(s.paddingTop)-parseFloat(s.paddingBottom);const w=r.width-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight);volume.style.width=Math.max(0,Math.min(w,h*3484/2409))+'px';}
  function setup(dir){leaf.style.transition='none';leaf.hidden=false;if(dir>0){base.src=pages[index+1];leaf.src=pages[index];}else{base.src=pages[index];leaf.src=pages[index-1];}}
  function pose(dir,p){leaf.style.transform=`rotateY(${dir>0?-100*p:-100*(1-p)}deg)`;}
  function finish(dir,commit,from=0){busy=true;const duration=reduced.matches?0:Math.max(140,480*(commit?1-from:from));leaf.style.transition=`transform ${duration}ms cubic-bezier(.2,.65,.25,1)`;requestAnimationFrame(()=>pose(dir,commit?1:0));setTimeout(()=>{if(commit)index+=dir;sync();leaf.hidden=true;leaf.style.transition='none';busy=false;},duration+35);}
  function turn(dir){if(busy||drag||index+dir<0||index+dir>=pages.length)return;setup(dir);pose(dir,0);void leaf.offsetWidth;finish(dir,true);}
  prev.addEventListener('click',()=>turn(-1));next.addEventListener('click',()=>turn(1));
  stage.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();if(e.key==='ArrowLeft')turn(-1);else if(e.key==='ArrowRight')turn(1);else if(!busy&&!drag){index=e.key==='Home'?0:pages.length-1;sync();}}});
  stage.addEventListener('pointerdown',e=>{if(busy||e.button!==0)return;drag={x:e.clientX,y:e.clientY,id:e.pointerId,dir:0,p:0};});
  stage.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.dir){if(Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>10){drag=null;return;}if(Math.abs(dx)<10)return;const dir=dx<0?1:-1;if(index+dir<0||index+dir>=pages.length){drag=null;return;}drag.dir=dir;stage.setPointerCapture(e.pointerId);setup(dir);}drag.p=Math.max(0,Math.min(1,-dx*drag.dir/Math.max(120,volume.clientWidth*.65)));pose(drag.dir,drag.p);});
  function release(e,cancel=false){if(!drag||e.pointerId!==drag.id)return;const d=drag;drag=null;if(stage.hasPointerCapture(e.pointerId))stage.releasePointerCapture(e.pointerId);if(d.dir)finish(d.dir,!cancel&&d.p>.12,d.p);}
  stage.addEventListener('pointerup',e=>release(e));stage.addEventListener('pointercancel',e=>release(e,true));
  new ResizeObserver(fit).observe(stage);sync();fit();
})();
