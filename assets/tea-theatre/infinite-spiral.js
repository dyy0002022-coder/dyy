(() => {
  const host = document.querySelector('[data-infinite-spiral]');
  if (!host) return;
  const stage = host.querySelector('.spiral-stage');
  const artboards = Array.from({ length: 7 }, (_, i) => `assets/dream-pages/page-${String(i + 1).padStart(2, '0')}.jpg`);
  const total = 21;
  for (let i = 0; i < total; i += 1) {
    const figure = document.createElement('figure');
    figure.className = 'spiral-card';
    figure.style.setProperty('--i', i);
    figure.style.setProperty('--angle', `${i * 360 / 7}deg`);
    figure.style.setProperty('--rise', `${(i - total / 2) * 30}px`);
    figure.style.setProperty('--depth', `${Math.max(200, 440 - Math.abs(i - total / 2) * 8)}px`);
    const img = document.createElement('img');
    img.src = artboards[i % artboards.length];
    img.alt = `Dream of Tea Plantation collage ${i % artboards.length + 1}`;
    img.loading = 'lazy';
    img.draggable = false;
    figure.append(img);
    stage.append(figure);
  }

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let rotation = 0;
  let dragging = false;
  let previousX = 0;
  let lastTime = performance.now();
  const frame = (now) => {
    if (!dragging && !reduceMotion && !host.matches(':hover')) rotation += (now - lastTime) * 0.0035;
    lastTime = now;
    stage.style.transform = `rotateY(${rotation}deg)`;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  host.addEventListener('pointerdown', (event) => { dragging = true; previousX = event.clientX; host.setPointerCapture(event.pointerId); });
  host.addEventListener('pointermove', (event) => { if (!dragging) return; rotation += (event.clientX - previousX) * 0.35; previousX = event.clientX; });
  const stop = () => { dragging = false; };
  host.addEventListener('pointerup', stop);
  host.addEventListener('pointercancel', stop);
})();
