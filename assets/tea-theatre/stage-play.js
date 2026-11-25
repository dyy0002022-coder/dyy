(() => {
  const stage = document.querySelector('[data-stage-layer]');
  const list = document.querySelector('[data-prop-list]');
  const host = stage?.closest('.theatre-viewer');
  if (!stage || !list || !host) return;
  const pieces = [
    ['page-02.jpg','theatre installation'],['page-03.jpg','stage composition'],['page-04.jpg','story scene'],['page-05.jpg','final installation'],['page-06.jpg','image collage'],['page-07.jpg','theatre performance'],['page-03.jpg','collage detail'],['page-05.jpg','stage view']
  ];
  let sequence = 0;
  const wm = '© Yingying Dong · 董盈盈';
  pieces.forEach(([file,label],i) => {
    const button=document.createElement('button'); button.className='prop-option'; button.type='button'; button.draggable=true; button.setAttribute('aria-label',`Add ${label} to stage`);
    const img=document.createElement('img'); img.src=`assets/dream-pages/${encodeURIComponent(file)}`; img.alt=label; img.loading='lazy';
    button.append(img); button.addEventListener('click',()=>addPiece(i));
    button.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',String(i));e.dataTransfer.effectAllowed='copy'});
    list.append(button);
  });
  host.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('text/plain')){e.preventDefault();e.dataTransfer.dropEffect='copy'}});
  host.addEventListener('drop',e=>{e.preventDefault();const i=Number(e.dataTransfer.getData('text/plain'));if(Number.isInteger(i)&&pieces[i]){const r=stage.getBoundingClientRect();addPiece(i,((e.clientX-r.left)/r.width)*100,((e.clientY-r.top)/r.height)*100)}});
  function addPiece(i,x=48+(sequence%4)*3,y=42+(sequence%4)*4){
    sequence++;
    const [file,label]=pieces[i],el=document.createElement('div'); el.className='stage-piece';el.tabIndex=0;el.style.left=`${x}%`;el.style.top=`${y}%`;el.style.transform='translate(-50%,-50%) rotate(0deg) scale(1)';el.dataset.scale='1';el.dataset.angle='0';
    const img=document.createElement('img');img.src=`assets/dream-pages/${encodeURIComponent(file)}`;img.alt=label;img.draggable=false;
    const tools=document.createElement('div');tools.className='piece-controls';const rotate=document.createElement('button');rotate.type='button';rotate.title='Rotate';rotate.setAttribute('aria-label','Rotate image');rotate.textContent='↻';rotate.onclick=()=>{el.dataset.angle=String((Number(el.dataset.angle)+15)%360);apply()};const remove=document.createElement('button');remove.type='button';remove.title='Remove';remove.setAttribute('aria-label','Remove image');remove.textContent='×';remove.onclick=()=>el.remove();tools.append(rotate,remove);el.append(img,tools);stage.append(el);dragPiece(el);el.focus();
    function apply(){el.style.transform=`translate(-50%,-50%) rotate(${el.dataset.angle}deg) scale(${el.dataset.scale})`}
  }
  function dragPiece(el){let active=null;el.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;active={x:e.clientX,y:e.clientY,left:parseFloat(el.style.left),top:parseFloat(el.style.top)};el.setPointerCapture(e.pointerId);e.preventDefault()});el.addEventListener('pointermove',e=>{if(!active)return;const r=stage.getBoundingClientRect();el.style.left=`${Math.max(3,Math.min(97,active.left+(e.clientX-active.x)/r.width*100))}%`;el.style.top=`${Math.max(5,Math.min(95,active.top+(e.clientY-active.y)/r.height*100))}%`});el.addEventListener('pointerup',()=>active=null);el.addEventListener('wheel',e=>{e.preventDefault();const s=Math.max(.45,Math.min(2.1,Number(el.dataset.scale)*(e.deltaY<0?1.08:.92)));el.dataset.scale=String(s);el.style.transform=`translate(-50%,-50%) rotate(${el.dataset.angle}deg) scale(${s})`},{passive:false});el.addEventListener('dblclick',()=>el.remove())}
})();
