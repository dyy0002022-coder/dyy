import * as THREE from './vendor/three/three.module.js';
import { GLTFLoader } from './vendor/three/GLTFLoader.js';
import { OrbitControls } from './vendor/three/OrbitControls.js';

const host = document.querySelector('#theatre-viewer');
if (host) {
  const canvas = host.querySelector('canvas');
  const status = host.querySelector('.viewer-status');
  const fallback = host.querySelector('.theatre-fallback');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  } catch (error) {
    host.classList.add('viewer-failed');
    status.textContent = '3D 预览不可用，请尝试其他浏览器或设备。 · 3D preview unavailable on this device.';
    status.classList.add('viewer-error');
  }
  if (renderer) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#ece9df');
    const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 1.8;
    controls.maxDistance = 12;
    controls.enablePan = false;
    scene.add(new THREE.HemisphereLight(0xfff3dc, 0x555044, 2.1));
    const key = new THREE.DirectionalLight(0xfff4df, 3.2);
    key.position.set(-3.5, 6, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xd8e4ff, 1.1);
    fill.position.set(4, 2, -4);
    scene.add(fill);

    const resize = () => {
      const rect = host.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(host);
    resize();

    let homePosition = null;
    new GLTFLoader().load(new URL('./theatre-box.glb', import.meta.url).href, (gltf) => {
      const model = gltf.scene;
      scene.add(model);
      const bounds = new THREE.Box3().setFromObject(model);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const largest = Math.max(size.x, size.y, size.z);
      model.position.sub(center);
      const distance = largest / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.32;
      homePosition = new THREE.Vector3(distance * 0.84, distance * 0.58, distance);
      camera.position.copy(homePosition);
      camera.near = Math.max(largest / 100, 0.01);
      camera.far = largest * 20;
      camera.updateProjectionMatrix();
      controls.target.set(0, 0, 0);
      controls.minDistance = largest * 0.78;
      controls.maxDistance = largest * 5;
      controls.update();
      fallback.hidden = true;
      status.hidden = true;
    }, (event) => {
      const percent = event.total ? Math.round(event.loaded / event.total * 100) : 0;
      status.textContent = percent ? `正在加载模型 ${percent}% · Loading model ${percent}%` : '正在加载模型… · Loading model…';
    }, (error) => {
      console.error('Tea theatre GLB load failed', error);
      host.classList.add('viewer-failed');
      status.textContent = `模型加载失败：${error?.message || '请刷新页面重试'} · Model failed to load.`;
      status.classList.add('viewer-error');
    });

    host.querySelector('[data-viewer-reset]').addEventListener('click', () => {
      if (!homePosition) return;
      camera.position.copy(homePosition);
      controls.target.set(0, 0, 0);
      controls.update();
    });
    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.render(scene, camera);
    });
  }
}

const scrollGrid = document.querySelector('[data-sticky-grid]');
if (scrollGrid && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const columns = [...scrollGrid.querySelectorAll('.sticky-grid-column')];
  let frame = 0;
  const updateGrid = () => {
    frame = 0;
    const rect = scrollGrid.getBoundingClientRect();
    const distance = Math.max(scrollGrid.offsetHeight - window.innerHeight, 1);
    const progress = Math.min(1, Math.max(0, -rect.top / distance));
    columns.forEach((column) => {
      const travel = Math.max(0, column.scrollHeight - window.innerHeight * .62);
      const speed = Number(column.dataset.speed || 1);
      column.style.transform = `translate3d(0, ${-progress * travel * speed}px, 0)`;
    });
  };
  const requestGridUpdate = () => { if (!frame) frame = requestAnimationFrame(updateGrid); };
  window.addEventListener('scroll', requestGridUpdate, { passive: true });
  window.addEventListener('resize', requestGridUpdate, { passive: true });
  window.addEventListener('load', requestGridUpdate, { once: true });
  requestGridUpdate();
}
