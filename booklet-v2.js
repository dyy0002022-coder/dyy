(() => {
  'use strict';
  const stage=document.querySelector('.book-stage');if(!stage)return;
  // Original attachment order, intentionally different from filename order.
  const order=[7,8,9,10,11,12,13,16,15,14,17,18,19,20,21,6];
  const sources=order.map(n=>`assets/booklet/page-${String(n).padStart(2,'0')}.webp?v=20261102b`);
  const mount=stage.querySelector('.book-mount'),status=stage.querySelector('.book-loading');
  const prev=document.querySelector('.book-prev'),next=document.querySelector('.book-next'),count=document.querySelector('.book-count'),zoom=document.querySelector('.reader-enlarge');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let book=null,index=0,lastWidth=0,lastHeight=0,resizeTimer;
  const originals=sources.map((src,i)=>{const im=new Image();im.src=src;im.alt=`研究资料册 ${i+1} / ${sources.length}`;im.draggable=false;return im;});
  function sync(){index=book?book.getCurrentPageIndex():index;count.textContent=`${index+1} / ${sources.length}`;prev.disabled=!book||index===0;next.disabled=!book||index===sources.length-1;zoom.dataset.image=sources[index];zoom.querySelector('img').src=sources[index];zoom.querySelector('img').alt=originals[index].alt;stage.dataset.page=String(index+1);stage.dataset.source=String(order[index]);}
  function layout(){const s=getComputedStyle(stage);const width=stage.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight);const height=stage.clientHeight-parseFloat(s.paddingTop)-parseFloat(s.paddingBottom);const w=Math.floor(Math.min(width,height*3484/2409)),h=Math.round(w*2409/3484);if(w<50||w===lastWidth&&h===lastHeight)return;lastWidth=w;lastHeight=h;if(book){index=book.getCurrentPageIndex();book.destroy();}mount.replaceChildren();mount.style.width=w+'px';mount.style.height=h+'px';const el=document.createElement('div');el.className='paper-book';el.style.width=w+'px';el.style.height=h+'px';mount.append(el);
    const leaves=originals.map((im,i)=>{const page=document.createElement('div');page.className='paper-page';page.dataset.density='soft';page.dataset.page=String(i+1);page.append(im.cloneNode());el.append(page);return page;});
    book=new St.PageFlip(el,{width:w,height:h,size:'fixed',autoSize:false,startPage:index,usePortrait:true,showCover:false,drawShadow:true,maxShadowOpacity:.24,flippingTime:reduced.matches?1:1150,mobileScrollSupport:false,swipeDistance:25});
    book.on('flip',sync);book.on('init',sync);book.on('changeState',e=>{stage.dataset.state=e.data;});book.loadFromHTML(leaves);sync();
  }
  function turn(direction){if(!book||book.getState()!=='read')return;if(direction<0&&index>0){if(reduced.matches)book.turnToPrevPage();else book.flipPrev('bottom');}else if(direction>0&&index<sources.length-1){if(reduced.matches)book.turnToNextPage();else book.flipNext('bottom');}}
  prev.addEventListener('click',()=>turn(-1));next.addEventListener('click',()=>turn(1));
  stage.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();if(e.key==='ArrowLeft')turn(-1);else if(e.key==='ArrowRight')turn(1);else if(book&&book.getState()==='read'){book.turnToPage(e.key==='Home'?0:sources.length-1);sync();}});
  prev.disabled=next.disabled=true;
  Promise.all(originals.map(im=>im.decode())).then(()=>{status.hidden=true;layout();new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(layout,100);}).observe(stage);}).catch(()=>{status.textContent=document.documentElement.lang==='en'?'A page could not load. Please refresh.':'有一页未能加载，请刷新重试。';});
})();
