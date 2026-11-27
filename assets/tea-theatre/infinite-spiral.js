(() => {
  const host = document.querySelector('[data-infinite-spiral]');
  const stage = host?.querySelector('.spiral-stage');
  if (!host || !stage) return;

  const pieces = [
    '8(1).png', '9.png', 'a(1).png', 'b(1).png', 'c(1).png', 'd(1).png', 'e(1).png',
    'f(1).png', 'g(1).png', 'h(1).png', 'i(1).png', 'l(1).png', 'o(1).png', 'u(1).png'
  ];
  const cards = pieces.map((file, i) => {
    const card = document.createElement('div');
    card.className = 'dome-piece';
    const image = document.createElement('img');
    image.src = `assets/tea-theatre/props/${encodeURIComponent(file)}`;
    image.alt = `Tea story image ${i + 1}`;
    image.loading = 'lazy';
    image.draggable = false;
    card.append(image);
    stage.append(card);
    return card;
  });

  let rotation = 0;
  let dragging = false;
  let previousX = 0;
  let lastTime = performance.now();
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function layout() {
    const { width, height } = host.getBoundingClientRect();
    const radius = Math.min(width * 0.43, height * 0.47, 460);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    cards.forEach((card, i) => {
      // Three latitude bands create the open, hemispherical layout used by Dome Gallery.
      const band = Math.floor(i / 5);
      const polar = (28 + band * 28 + (i % 2) * 5) * Math.PI / 180;
      const azimuth = i * goldenAngle;
      const x = radius * Math.sin(polar) * Math.sin(azimuth);
      const y = radius * (0.48 - Math.cos(polar));
      const z = radius * Math.sin(polar) * Math.cos(azimuth);
      const depth = (z / radius + 1) / 2;
      const scale = 0.72 + depth * 0.22;
      card.style.transform = `translate(-50%,-50%) translate3d(${x}px,${y}px,${z}px) rotateY(${Math.atan2(x, z)}rad) scale(${scale})`;
      card.style.zIndex = String(Math.round(z + radius));
    });
  }

  new ResizeObserver(layout).observe(host);
  layout();

  function frame(now) {
    if (!dragging && !reduceMotion && !host.matches(':hover')) rotation += (now - lastTime) * 0.004;
    lastTime = now;
    stage.style.transform = `rotateY(${rotation}deg)`;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  host.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button, a')) return;
    dragging = true;
    previousX = event.clientX;
    host.setPointerCapture(event.pointerId);
  });
  host.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    rotation += (event.clientX - previousX) * 0.25;
    previousX = event.clientX;
  });
  const stop = () => { dragging = false; };
  host.addEventListener('pointerup', stop);
  host.addEventListener('pointercancel', stop);
})();
