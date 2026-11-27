(() => {
  const video = document.getElementById('hunger-intro-video');
  const caption = document.getElementById('hunger-intro-caption');
  const sound = document.getElementById('hunger-music-toggle');
  const enter = document.getElementById('hunger-enter');
  const world = document.getElementById('hunger-world');
  let fallbackStarted = false;
  let savedPosition = 0;

  function enterInstallation() {
    video.pause();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    world.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }

  enter.addEventListener('click', enterInstallation);
  video.addEventListener('ended', () => {
    const bounds = video.getBoundingClientRect();
    if (bounds.bottom > 0 && bounds.top < innerHeight) enterInstallation();
  });
  video.addEventListener('playing', () => {
    caption.textContent = '';
  });
  sound.addEventListener('click', () => {
    video.muted = !video.muted;
    sound.setAttribute('aria-pressed', String(!video.muted));
    sound.textContent = video.muted ? '开启声音 · SOUND ON' : '关闭声音 · SOUND OFF';
    video.play().catch(() => {});
  });

  function setVideoSource(src) {
    video.src = src;
    video.play().catch(() => {});
  }

  async function loadFallback() {
    if (fallbackStarted) return;
    fallbackStarted = true;
    savedPosition = video.currentTime || 0;
    caption.textContent = '正在缓冲开场影片…';
    try {
      const parts = new Array(25);
      let nextPart = 0;
      await Promise.all(Array.from({ length: 4 }, async () => {
        while (nextPart < parts.length) {
          const index = nextPart++;
          const part = String(index).padStart(2, '0');
          const response = await fetch('assets/hunger-media/hunger-intro-' + part + '.bin');
          if (!response.ok) throw new Error('Opening video part ' + part + ' unavailable');
          parts[index] = await response.blob();
        }
      }));
      const url = URL.createObjectURL(new Blob(parts, { type: 'video/mp4' }));
      video.addEventListener('loadedmetadata', () => {
        if (savedPosition > 0 && savedPosition < video.duration) video.currentTime = savedPosition;
      }, { once: true });
      window.addEventListener('pagehide', event => {
        if (!event.persisted) URL.revokeObjectURL(url);
      });
      setVideoSource(url);
    } catch (error) {
      caption.textContent = '开场影片暂时无法播放，可进入装置。';
      console.error(error);
    }
  }

  async function start() {
    if (!navigator.serviceWorker) return loadFallback();
    const workers = navigator.serviceWorker;
    const worker = new URL('hunger-video-worker.js?v=8', document.baseURI);
    const controlsPage = () => workers.controller?.scriptURL === worker.href;
    try {
      await workers.register(worker.href, { updateViaCache: 'none' });
      if (!controlsPage()) {
        await new Promise((resolve, reject) => {
          const onChange = () => {
            if (!controlsPage()) return;
            clearTimeout(timer);
            workers.removeEventListener('controllerchange', onChange);
            resolve();
          };
          const timer = setTimeout(() => {
            workers.removeEventListener('controllerchange', onChange);
            reject(new Error('Opening video worker did not activate'));
          }, 4000);
          workers.addEventListener('controllerchange', onChange);
          onChange();
        });
      }
      video.addEventListener('error', () => {
        if (fallbackStarted) caption.textContent = '开场影片暂时无法播放，可进入装置。';
        else loadFallback();
      });
      setVideoSource('assets/hunger-media/opening-v8.mp4');
    } catch (error) {
      console.warn('Progressive opening unavailable', error);
      await loadFallback();
    }
  }

  start();
})();
