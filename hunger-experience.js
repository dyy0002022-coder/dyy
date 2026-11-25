import * as THREE from 'three';
import { GLTFLoader } from './vendor/three/GLTFLoader.js';
import { OrbitControls } from './vendor/three/OrbitControls.js';

const world = document.querySelector('#hunger-world');
const video = document.querySelector('#hunger-video');
const status = document.querySelector('#hunger-status');
const canvas = document.querySelector('#hunger-canvas');
let renderer, scene, camera, controls;

async function loadSegmentedAsset(prefix, count, onProgress) {
  const chunks = new Array(count);
  let nextIndex = 0;
  let completed = 0;
  const worker = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= count) return;
      const part = String(index).padStart(2, '0');
      const response = await fetch(`assets/hunger-media/${prefix}-${part}.bin`);
      if (!response.ok) throw new Error(`Asset segment ${part} failed (${response.status})`);
      chunks[index] = new Uint8Array(await response.arrayBuffer());
      completed += 1;
      onProgress?.(completed, count);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, count) }, worker));
  const merged = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged.buffer;
}

async function loadExhibitionVideo() {
  const videoData = await loadSegmentedAsset('project3-exhibition-web', 23);
  video.src = URL.createObjectURL(new Blob([videoData], { type: 'video/mp4' }));
  video.load();
  await new Promise((resolve, reject) => {
    video.addEventListener('loadeddata', resolve, { once: true });
    video.addEventListener('error', reject, { once: true });
  });
  await video.play();
}

function resize() {
  const width = world.clientWidth;
  const height = world.clientHeight;
  if (!width || !height || !renderer) return;
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function prepareViewer() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#f7f7f4');
  camera = new THREE.PerspectiveCamera(34, 1, 0.01, 1000);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x77766f, 1.7));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(-5, 9, 7);
  key.castShadow = true;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 1.0);
  fill.position.set(7, 5, -6);
  scene.add(fill);
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.minDistance = 1;
  controls.maxDistance = 80;
  controls.maxPolarAngle = Math.PI * .49;
  controls.target.set(0, 0, 0);
  new ResizeObserver(resize).observe(world);
  window.addEventListener('resize', resize, { passive: true });
  resize();

  loadSegmentedAsset('eating-installation-web', 12, (loaded, total) => {
    status.textContent = `正在载入 3D 装置… ${Math.round(loaded / total * 100)}%`;
  }).then((modelData) => new GLTFLoader().parse(modelData, 'assets/hunger-media/', (gltf) => {
    const installation = gltf.scene;
    const bounds = new THREE.Box3().setFromObject(installation);
    const center = bounds.getCenter(new THREE.Vector3());
    installation.position.x -= center.x;
    installation.position.z -= center.z;
    installation.position.y -= bounds.min.y;
    scene.add(installation);
    const size = bounds.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.y, size.z, 1);
    const viewCenterY = span * .45;
    camera.position.set(span * 1.35, viewCenterY + span * .92, span * 1.7);
    camera.near = Math.max(span / 800, .01);
    camera.far = span * 12;
    camera.updateProjectionMatrix();
    controls.target.set(0, viewCenterY, 0);
    controls.minDistance = span * .72;
    controls.maxDistance = span * 3.8;
    controls.update();

    const texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    for (const name of ['Screen_Mukbang_Overhead_0', 'Screen_Mukbang_Overhead_1', 'Screen_Mukbang_Overhead_2']) {
      const screen = installation.getObjectByName(name);
      if (!screen?.isMesh) continue;
      screen.material = screen.material.clone();
      screen.material.map = texture;
      screen.material.color.set(0xffffff);
      screen.material.emissive.set(0xffffff);
      screen.material.emissiveMap = texture;
      screen.material.emissiveIntensity = .3;
      screen.material.toneMapped = false;
      screen.material.needsUpdate = true;
    }
    status.hidden = true;
    animate();
  }, (error) => {
    status.textContent = '装置模型未载入，请通过网站地址打开此页面';
    console.error('Hunger installation failed to load', error);
  })).catch((error) => {
    status.textContent = '装置模型未载入，请通过网站地址打开此页面';
    console.error('Hunger installation failed to load', error);
  });
}

prepareViewer();
loadExhibitionVideo().catch((error) => {
  status.textContent = '展览视频未载入，请通过网站地址打开此页面';
  console.error('Hunger exhibition video failed to load', error);
});
