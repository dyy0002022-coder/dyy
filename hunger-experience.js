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
let renderer, scene, camera, controls;
let viewerVisible = false;
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
  if (introVideo.getBoundingClientRect().bottom > 0) enterInstallation();
});
musicToggle.addEventListener('click', async () => {
  introVideo.muted = !introVideo.muted;
  musicToggle.setAttribute('aria-pressed', String(!introVideo.muted));
  musicToggle.textContent = introVideo.muted ? '开启背景音乐 · SOUND ON' : '关闭背景音乐 · SOUND OFF';
  if (!introVideo.muted) {
    try { await introVideo.play(); } catch (error) { console.warn('Could not start audio playback.', error); }
  }
});

function attachScreenVideo(overhead) {
  const video = document.querySelector('#hunger-screen-video');
  const texture = new THREE.VideoTexture(video);
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;

  overhead.traverse((object) => {
    if (!object.isMesh || !/^Screen_Mukbang_Overhead_[0-2]$/.test(object.name)) return;
    const original = object.material;
    video.addEventListener('playing', () => {
      object.material = new THREE.MeshBasicMaterial({
        map: texture, side: THREE.FrontSide, toneMapped: false,
      });
      original.dispose();
    }, { once: true });
  });

  const play = () => {
    if (viewerVisible) video.play().catch(() => {});
  };
  document.addEventListener('visibilitychange', play);
  world.addEventListener('pointerdown', play);
  return video;
}

function createDeviceFeeds(installation, loader) {
  const screens = [];
  const obsoleteFood = [];
  let bowl;
  installation.traverse((object) => {
    const name = object.userData.name ?? object.name;
    if (/^FoodModel_\d+_/.test(name)) obsoleteFood.push(object);
    if (/^Screen_i(?:Phone|Pad)_\d+$/.test(name)) screens.push(object);
    if (name === 'Single reference brass bowl') bowl = object;
  });
  obsoleteFood.forEach((object) => object.removeFromParent());
  if (!bowl) throw new Error('Missing brass bowl in the installation');

  const bowlBounds = new THREE.Box3().setFromObject(bowl);
  const bowlCenter = bowlBounds.getCenter(new THREE.Vector3());
  bowlCenter.y = bowlBounds.max.y;
  const subject = bowlCenter.clone().add(new THREE.Vector3(0, .03, 0));
  const feedScene = new THREE.Scene();
  feedScene.background = new THREE.Color('#f7f7f4');
  scene.children.filter((child) => child.isLight).forEach((light) => feedScene.add(light.clone()));
  const feedModel = installation.clone();
  feedScene.add(feedModel);
  const darkScreen = new THREE.MeshBasicMaterial({ color: 0x303234 });
  const clonedScreens = new Map();
  const fixtures = [];
  feedModel.traverse((object) => {
    if (/^(26cm weighted base|Black telescopic stand|Stand clamp)/.test(object.userData.name ?? '')) fixtures.push(object);
    if (!/^Screen_i(?:Phone|Pad)_\d+$/.test(object.name)) return;
    object.material = darkScreen;
    clonedScreens.set(object.name, object);
  });

  const foodDirectory = 'assets/hunger-media/food-v7/';
  const foods = new Map();
  for (const screen of screens) {
    const isPhone = screen.name.includes('iPhone');
    const alternate = Number(screen.name.slice(-2)) % 2;
    const kind = (isPhone ? ['hanbao', 'gaodian'] : ['rice', 'food'])[alternate];
    if (!foods.has(kind)) {
      const model = kind === 'rice'
        ? Promise.all(['aa','ab'].map(async (part) => {
            const response = await fetch(`${foodDirectory}rice.glb.part-${part}`);
            if (!response.ok) throw new Error(`Rice geometry unavailable: ${response.status}`);
            return response.blob();
          })).then(async (parts) => loader.parseAsync(await new Blob(parts).arrayBuffer(), foodDirectory))
        : loader.loadAsync(`${foodDirectory}${kind}.glb`);
      foods.set(kind, model);
    }

    screen.geometry.computeBoundingBox();
    const screenSize = screen.geometry.boundingBox.getSize(new THREE.Vector3());
    const aspect = screenSize.x / screenSize.y;
    const target = new THREE.WebGLRenderTarget(Math.round(448 * aspect), 448);
    target.texture.repeat.y = -1;
    target.texture.offset.y = 1;

    const cameraFeed = new THREE.PerspectiveCamera(isPhone ? 73 : 55, aspect, .025, 12);
    const position = screen.getWorldPosition(new THREE.Vector3());
    const radial = position.clone().sub(bowlCenter).setY(0).normalize();
    cameraFeed.position.copy(position).addScaledVector(radial, .20);
    cameraFeed.position.y += .08;
    cameraFeed.lookAt(subject);

    const pivot = new THREE.Group();
    pivot.position.copy(bowlCenter);
    pivot.position.y -= .012;
    pivot.visible = false;
    feedScene.add(pivot);
    screen.material = new THREE.MeshBasicMaterial({
      map: target.texture, side: THREE.FrontSide, toneMapped: false,
    });
    const station = clonedScreens.get(screen.name).parent;
    const stationPosition = station.getWorldPosition(new THREE.Vector3()).setY(0);
    const hiddenInFeed = fixtures.filter((fixture) =>
      fixture.getWorldPosition(new THREE.Vector3()).setY(0).distanceTo(stationPosition) < .04);
    const feed = {
      pivot, target, feedScene, cameraFeed, hiddenInFeed: [station, ...hiddenInFeed],
      dirty: true, hasFood: false,
    };
    foodPivots.set(screen, feed);
    foods.get(kind).then(({ scene: food }) => {
      pivot.add(food.clone());
      feed.hasFood = true;
      feed.dirty = true;
    }).catch((error) => console.error(`Hunger food model ${kind} did not load`, error));
  }
}

function renderFoodScreens() {
  for (const feed of foodPivots.values()) {
    if (!feed.dirty) continue;
    feed.hiddenInFeed.forEach((object) => { object.visible = false; });
    feed.pivot.visible = true;
    renderer.setRenderTarget(feed.target);
    renderer.render(feed.feedScene, feed.cameraFeed);
    feed.pivot.visible = false;
    feed.hiddenInFeed.forEach((object) => { object.visible = true; });
    feed.dirty = false;
  }
  renderer.setRenderTarget(null);
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
    const hit = raycaster.intersectObjects(scene.children, true)[0];
    if (!hit || !foodPivots.get(hit.object)?.hasFood) return;
    activeFoodPivot = foodPivots.get(hit.object);
    lastPointer = { x: event.clientX, y: event.clientY };
    controls.enabled = false;
    canvas.setPointerCapture(event.pointerId);
  }, { capture: true });
  canvas.addEventListener('pointermove', (event) => {
    if (!activeFoodPivot || !lastPointer) return;
    const dx = event.clientX - lastPointer.x;
    const dy = event.clientY - lastPointer.y;
    activeFoodPivot.pivot.rotation.y += dx * .012;
    activeFoodPivot.pivot.rotation.x = THREE.MathUtils.clamp(activeFoodPivot.pivot.rotation.x + dy * .008, -.45, .45);
    activeFoodPivot.dirty = true;
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
  if (!viewerVisible || document.hidden) return;
  controls.update();
  renderFoodScreens();
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
  controls.enableZoom = false;
  canvas.style.touchAction = 'pan-y';
  for (const button of world.querySelectorAll('[data-hunger-zoom]')) {
    button.addEventListener('click', () => {
      const offset = camera.position.clone().sub(controls.target);
      const distance = THREE.MathUtils.clamp(
        offset.length() * Number(button.dataset.hungerZoom),
        controls.minDistance, controls.maxDistance,
      );
      camera.position.copy(controls.target).add(offset.setLength(distance));
      controls.update();
    });
  }
  controls.dampingFactor = 0.065;
  controls.minDistance = 1;
  controls.maxDistance = 80;
  controls.maxPolarAngle = Math.PI * .49;
  controls.target.set(0, 0, 0);
  new ResizeObserver(resize).observe(world);
  window.addEventListener('resize', resize, { passive: true });
  resize();

  const loader = new GLTFLoader();
  const installationPromise = loadSegmentedAsset('eating-installation-web', 12, (loaded, total) => {
    status.textContent = `正在载入 3D 装置… ${Math.round(loaded / total * 100)}%`;
  }).then((data) => loader.parseAsync(data, 'assets/hunger-media/'));

  Promise.all([installationPromise, loader.loadAsync('assets/hunger-media/hunger-overhead-v7.glb')])
    .then(([gltf, overheadModel]) => {
    const installation = gltf.scene;
    const overhead = overheadModel.scene;
    const replaced = [];
    installation.traverse((object) => {
      if (/^(Screen_Mukbang_Overhead_[0-2]_Orientation|Overhead signal wire|Jib end mounting link|Jib horizontal forward beam|Jib hinge cross pin\.001|Parallel jib diagonal(?:\.001)?|Jib pivot mast)$/.test(object.userData.name ?? object.name)) {
        replaced.push(object);
      }
    });
    replaced.forEach((object) => object.removeFromParent());
    installation.add(overhead);
    const bounds = new THREE.Box3().setFromObject(installation);
    const center = bounds.getCenter(new THREE.Vector3());
    installation.position.x -= center.x;
    installation.position.z -= center.z;
    installation.position.y -= bounds.min.y;
    scene.add(installation);
    createDeviceFeeds(installation, loader);
    installFoodDrag();
    const size = bounds.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.y, size.z, 1);
    const viewCenterY = size.y * .48;
    // Start at the forward screen. Orbit to see the other two faces.
    camera.position.set(span * .62, viewCenterY + span * .35, span * 1.45);
    camera.near = Math.max(span / 800, .01);
    camera.far = span * 12;
    camera.updateProjectionMatrix();
    controls.target.set(0, viewCenterY, 0);
    controls.minDistance = span * .72;
    controls.maxDistance = span * 3.8;
    controls.update();

    status.hidden = true;
    world.classList.add('is-ready');
    const video = attachScreenVideo(overhead);
    new IntersectionObserver(([entry]) => {
      viewerVisible = entry.isIntersecting;
      if (viewerVisible) video.play().catch(() => {});
      else video.pause();
    }).observe(world);
    animate();
  }).catch(showModelError);
}

function showModelError(error) {
  status.textContent = '暂时无法载入 3D 装置，可继续浏览项目介绍';
  console.error('Hunger installation failed to load', error);
}

new IntersectionObserver((entries, observer) => {
  if (!entries.some((entry) => entry.isIntersecting)) return;
  observer.disconnect();
  requestAnimationFrame(() => {
    try { prepareViewer(); } catch (error) { showModelError(error); }
  });
}, { rootMargin: '220px 0px' }).observe(world);

loadIntroVideo().catch((error) => {
  introCaption.textContent = '开场影像暂时无法载入，可继续向下进入装置';
  console.error('Hunger opening video failed to load', error);
});
