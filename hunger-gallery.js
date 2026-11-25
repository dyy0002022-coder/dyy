(() => {
  const track = document.querySelector('#hunger-gallery-track');
  if (!track) return;

  const items = [...track.querySelectorAll('.hunger-gallery__item')];
  const counter = document.querySelector('#hunger-gallery-counter');
  const progress = document.querySelector('#hunger-gallery-progress');
  let pointerStart = null;
  let dragged = false;

  const update = () => {
    const maxScroll = Math.max(1, track.scrollWidth - track.clientWidth);
    const ratio = Math.max(0, Math.min(1, track.scrollLeft / maxScroll));
    if (progress) progress.style.transform = `scaleX(${ratio})`;

    const center = track.scrollLeft + track.clientWidth / 2;
    const closest = items.reduce((best, item, index) => {
      const itemCenter = item.offsetLeft + item.clientWidth / 2;
      return Math.abs(itemCenter - center) < best.distance
        ? { index, distance: Math.abs(itemCenter - center) }
        : best;
    }, { index: 0, distance: Infinity });
    if (counter) counter.textContent = `${String(closest.index + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;
  };

  track.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });

  document.querySelectorAll('[data-gallery-step]').forEach((button) => {
    button.addEventListener('click', () => {
      const direction = Number(button.dataset.galleryStep) || 1;
      track.scrollBy({ left: direction * track.clientWidth * 0.78, behavior: 'smooth' });
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
