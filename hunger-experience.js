import * as THREE from 'three';
import { GLTFLoader } from './vendor/three/GLTFLoader.js';
import { OrbitControls } from './vendor/three/OrbitControls.js';

const world = document.querySelector('#hunger-world');
const introVideo = document.querySelector('#hunger-intro-video');
const status = document.querySelector('#hunger-status');
const canvas = document.querySelector('#hunger-canvas');
const musicToggle = document.querySelector('#hunger-music-toggle');
const enterButton = document.querySelector('#hunger-enter');
const introCaption = document.querySelector('#hunger-intro-caption');
let renderer, scene, camera, controls, loadedInstallation;
let screenVideoLoaded = false;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const foodPivots = new Map();
let activeFoodPivot = null;
let lastPointer = null;

async function loadSegmentedAsset(prefix, count, onProgress, mediaType = null) {
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
  if (mediaType) return new Blob(chunks, { type: mediaType });
  const merged = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged.buffer;
}

async function loadIntroVideo() {
  const videoData = await loadSegmentedAsset('hunger-intro', 25, null, 'video/mp4');
  introVideo.src = URL.createObjectURL(videoData);
  introVideo.load();
  await new Promise((resolve, reject) => {
    introVideo.addEventListener('loadeddata', resolve, { once: true });
    introVideo.addEventListener('error', reject, { once: true });
  });
  try {
    await introVideo.play();
  } catch (error) {
    console.warn('Opening video is ready; waiting for a gesture to play.', error);
  }
}

function enterInstallation() {
  world.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

enterButton.addEventListener('click', enterInstallation);
introVideo.addEventListener('ended', () => {
  introCaption.textContent = '影像结束 · 正在进入 Hunger 装置';
  window.setTimeout(enterInstallation, 900);
});
musicToggle.addEventListener('click', async () => {
  introVideo.muted = !introVideo.muted;
  musicToggle.setAttribute('aria-pressed', String(!introVideo.muted));
  musicToggle.textContent = introVideo.muted ? '开启背景音乐 · SOUND ON' : '关闭背景音乐 · SOUND OFF';
  if (!introVideo.muted) {
    try { await introVideo.play(); } catch (error) { console.warn('Could not start audio playback.', error); }
  }
});

async function loadScreenVideo(installation) {
  if (screenVideoLoaded) return;
  screenVideoLoaded = true;
  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'auto';
  const videoData = await loadSegmentedAsset('hunger-screens', 36, (loaded, total) => {
    status.hidden = false;
    status.textContent = `正在载入屏幕影像… ${Math.round(loaded / total * 100)}%`;
  }, 'video/quicktime');
  video.src = URL.createObjectURL(videoData);
  video.load();
  await new Promise((resolve, reject) => {
    video.addEventListener('loadeddata', resolve, { once: true });
    video.addEventListener('error', reject, { once: true });
  });
  try { await video.play(); } catch (error) { console.warn('Screen video is ready but waiting for a gesture.', error); }
  if (applyVideoToScreens(installation, video)) status.hidden = true;
}

function applyVideoToScreens(installation, video) {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return false;
  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  let screensUpdated = 0;
  installation.traverse((object) => {
    if (!object.isMesh || !/^Screen_Mukbang_Overhead_\d+$/.test(object.name)) return;
    object.material = object.material.clone();
    object.material.map = texture;
    object.material.color.set(0xffffff);
    object.material.side = THREE.FrontSide;
    object.material.emissive.set(0xffffff);
    object.material.emissiveMap = texture;
    object.material.emissiveIntensity = .3;
    object.material.toneMapped = false;
    object.material.needsUpdate = true;
    screensUpdated += 1;
  });
  if (screensUpdated !== 3) console.warn(`Expected 3 video screens, found ${screensUpdated}`);
  return screensUpdated === 3;
}

function addFoodRotation(installation) {
  const foods = new Map();
  installation.updateMatrixWorld(true);
  installation.traverse((object) => {
    const match = object.isMesh && object.name.match(/^FoodModel_(\d+)_/);
    if (!match) return;
    if (!foods.has(match[1])) foods.set(match[1], []);
    foods.get(match[1]).push(object);
  });

  for (const [station, objects] of foods) {
    const parent = objects[0].parent;
    if (!parent || objects.some((object) => object.parent !== parent)) continue;
    const bounds = new THREE.Box3();
    objects.forEach((object) => bounds.expandByObject(object));
    const center = parent.worldToLocal(bounds.getCenter(new THREE.Vector3()));
    const pivot = new THREE.Group();
    pivot.name = `FoodModel_Rotation_${station}`;
    pivot.position.copy(center);
    parent.add(pivot);
    parent.updateMatrixWorld(true);

    objects.forEach((object) => {
      const worldMatrix = object.matrixWorld.clone();
      parent.remove(object);
      pivot.add(object);
      object.matrix.copy(pivot.matrixWorld.clone().invert().multiply(worldMatrix));
      object.matrix.decompose(object.position, object.quaternion, object.scale);
      object.matrixAutoUpdate = true;
      object.updateMatrix();
      foodPivots.set(object, pivot);
    });
  }
}

function installFoodDrag() {
  const updatePointer = (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  };

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    updatePointer(event);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects([...foodPivots.keys()], false)[0];
    if (!hit) return;
    activeFoodPivot = foodPivots.get(hit.object);
    lastPointer = { x: event.clientX, y: event.clientY };
    controls.enabled = false;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!activeFoodPivot || !lastPointer) return;
    const dx = event.clientX - lastPointer.x;
    const dy = event.clientY - lastPointer.y;
    activeFoodPivot.rotation.y += dx * .012;
    activeFoodPivot.rotation.x += dy * .012;
    lastPointer = { x: event.clientX, y: event.clientY };
  });
  const finish = () => {
    if (!activeFoodPivot) return;
    activeFoodPivot = null;
    lastPointer = null;
    controls.enabled = true;
  };
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);
  canvas.addEventListener('lostpointercapture', finish);
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
    loadedInstallation = installation;
    addFoodRotation(installation);
    installFoodDrag();
    const size = bounds.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.y, size.z, 1);
    const viewCenterY = span * .45;
    // Start from the presentation side so the angled overhead screens show
    // their active faces, as in the installation reference.
    camera.position.set(-span * 1.35, viewCenterY + span * .92, span * 1.7);
    camera.near = Math.max(span / 800, .01);
    camera.far = span * 12;
    camera.updateProjectionMatrix();
    controls.target.set(0, viewCenterY, 0);
    controls.minDistance = span * .72;
    controls.maxDistance = span * 3.8;
    controls.update();

    status.hidden = true;
    animate();
    const screenObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        screenObserver.disconnect();
        loadScreenVideo(installation).catch((error) => {
          status.hidden = false;
          status.textContent = '屏幕影像暂时无法载入；装置仍可拖动查看';
          console.error('Hunger screen video failed to load', error);
        });
      }
    }, { threshold: 0.08 });
    screenObserver.observe(world);
  }, (error) => {
    status.textContent = '装置模型未载入，请通过网站地址打开此页面';
    console.error('Hunger installation failed to load', error);
  })).catch((error) => {
    status.textContent = '装置模型未载入，请通过网站地址打开此页面';
    console.error('Hunger installation failed to load', error);
  });
}

prepareViewer();
loadIntroVideo().catch((error) => {
  introCaption.textContent = '开场影像暂时无法载入，可继续向下进入装置';
  console.error('Hunger opening video failed to load', error);
});
