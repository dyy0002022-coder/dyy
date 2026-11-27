(() => {
  const track = document.querySelector('#hunger-gallery-track');
  if (!track) return;

  const items = [...track.querySelectorAll('.hunger-gallery__item')];
  const counter = document.querySelector('#hunger-gallery-counter');
  const gallery = track.closest('.hunger-gallery');
  const refreshImages = () => items.forEach(item => { item.querySelector('img').loading = 'eager'; });
  const preload = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      refreshImages();
      preload.disconnect();
    }
  }, { rootMargin: '700px 0px' });
  preload.observe(gallery);
  track.addEventListener('focusin', refreshImages);
  let pointerStart = null;
  let dragged = false;

  const update = () => {
    const center = track.getBoundingClientRect().left + track.clientWidth / 2;
    const closest = items.reduce((best, item, index) => {
      const rect = item.getBoundingClientRect();
      const itemCenter = rect.left + rect.width / 2;
      return Math.abs(itemCenter - center) < best.distance
        ? { index, distance: Math.abs(itemCenter - center) }
        : best;
    }, { index: 0, distance: Infinity });
    const maxScroll = track.scrollWidth - track.clientWidth;
    const index = track.scrollLeft < 2 ? 0 : track.scrollLeft >= maxScroll - 2 ? items.length - 1 : closest.index;
    if (counter) counter.textContent = `${String(index + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;
    return index;
  };

  track.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });

  document.querySelectorAll('[data-gallery-step]').forEach((button) => {
    button.addEventListener('click', () => {
      const direction = Number(button.dataset.galleryStep) || 1;
      refreshImages();
      const next = items[Math.max(0, Math.min(items.length - 1, update() + direction))];
      const frame = next.getBoundingClientRect();
      const left = track.scrollLeft + frame.left + frame.width / 2 -
        track.getBoundingClientRect().left - track.clientWidth / 2;
      track.scrollTo({ left, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  });

  track.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    pointerStart = { x: event.clientX, left: track.scrollLeft };
    dragged = false;
    track.setPointerCapture(event.pointerId);
  });
  track.addEventListener('pointermove', (event) => {
    if (!pointerStart) return;
    const distance = event.clientX - pointerStart.x;
    if (Math.abs(distance) > 4) {
      dragged = true;
      track.classList.add('is-dragging');
      track.scrollLeft = pointerStart.left - distance;
    }
  });
  const finishDrag = () => {
    pointerStart = null;
    track.classList.remove('is-dragging');
    if (dragged) requestAnimationFrame(update);
  };
  track.addEventListener('pointerup', finishDrag);
  track.addEventListener('pointercancel', finishDrag);
  track.addEventListener('lostpointercapture', finishDrag);

  update();
})();
