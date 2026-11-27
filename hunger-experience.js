import * as THREE from 'three';
import { GLTFLoader } from './vendor/three/GLTFLoader.js';
import { OrbitControls } from './vendor/three/OrbitControls.js';

const world = document.querySelector('#hunger-world');
const status = document.querySelector('#hunger-status');
const canvas = document.querySelector('#hunger-canvas');
const detailDialog = document.getElementById('hunger-food-dialog');
const detailStage = document.getElementById('hunger-food-stage');
const foodPicker = document.getElementById('hunger-food-choice');
const openFoodButton = document.getElementById('hunger-food-open');
const foodLabels = { rice: '米饭拼盘', food: '红碗拼盘', hanbao: '汉堡拼盘', gaodian: '甜点拼盘' };
const availableFoods = new Map();
let detailViewer = null;
let previousFocus = null;
let renderer, scene, camera, controls;
let viewerVisible = false;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const foodPivots = new Map();
let activeFoodPivot = null;
let lastPointer = null;

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

function fitFoodIntoBowl(food, bowl, bowlBounds) {
  const model = food.clone();
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const bowlSize = bowlBounds.getSize(new THREE.Vector3());
  const width = Math.min(bowlSize.x, bowlSize.z);
  const scale = width * .72 / Math.max(size.x, size.z);
  const origin = bowlBounds.getCenter(new THREE.Vector3());
  const probe = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  let seatY = bowlBounds.min.y + bowlSize.y * .18;
  // Sample the bowl's inner surface where the food base meets it.
  for (let index = 0; index < 8; index++) {
    const angle = index * Math.PI / 4;
    probe.set(new THREE.Vector3(
      origin.x + width * .30 * Math.cos(angle),
      bowlBounds.max.y + .01,
      origin.z + width * .30 * Math.sin(angle),
    ), down);
    const [hit] = probe.intersectObject(bowl, true);
    if (hit && hit.point.y < bowlBounds.max.y - bowlSize.y * .15) seatY = Math.max(seatY, hit.point.y);
  }
  model.scale.multiplyScalar(scale);
  model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  return { model, seatY };
}

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
    const target = new THREE.WebGLRenderTarget(Math.round(640 * aspect), 640);
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
      kind, pivot, target, feedScene, cameraFeed, hiddenInFeed: [station, ...hiddenInFeed],
      dirty: true, hasFood: false,
    };
    foodPivots.set(screen, feed);
    foods.get(kind).then(({ scene: food }) => {
      const { model, seatY } = fitFoodIntoBowl(food, bowl, bowlBounds);
      pivot.position.y = seatY;
      pivot.add(model);
      feed.hasFood = true;
      feed.dirty = true;
      if (!availableFoods.has(kind)) {
        availableFoods.set(kind, food);
        foodPicker.querySelector('option[value="' + kind + '"]').disabled = false;
        if (openFoodButton.disabled) {
          foodPicker.value = kind;
          foodPicker.disabled = false;
          openFoodButton.disabled = false;
        }
      }
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

function getScreenFood(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(scene.children, true)[0];
  const feed = hit && foodPivots.get(hit.object);
  return feed?.hasFood ? feed : null;
}

function installFoodDrag() {
  let touchTap = null;
  let dragMoved = false;

  canvas.addEventListener('pointerdown', event => {
    if (detailViewer || event.button !== 0 || !event.isPrimary) return;
    activeFoodPivot = getScreenFood(event);
    if (!activeFoodPivot) return;
    lastPointer = { x: event.clientX, y: event.clientY };
    dragMoved = false;
    controls.enabled = false;
    canvas.setPointerCapture(event.pointerId);
  }, { capture: true });

  canvas.addEventListener('pointermove', event => {
    if (!activeFoodPivot || !lastPointer || !event.isPrimary) return;
    const dx = event.clientX - lastPointer.x;
    const dy = event.clientY - lastPointer.y;
    if (!dragMoved && Math.hypot(dx, dy) < 5) return;
    dragMoved = true;
    activeFoodPivot.pivot.rotation.y += dx * .012;
    activeFoodPivot.dirty = true;
    lastPointer = { x: event.clientX, y: event.clientY };
  });

  const finish = event => {
    if (!activeFoodPivot) return;
    const feed = activeFoodPivot;
    activeFoodPivot = null;
    lastPointer = null;
    controls.enabled = true;
    if (event.type !== 'pointerup' || event.pointerType !== 'touch' || dragMoved) {
      touchTap = null;
      return;
    }
    const now = performance.now();
    if (touchTap && touchTap.feed === feed && now - touchTap.time < 350 &&
        Math.hypot(event.clientX - touchTap.x, event.clientY - touchTap.y) < 28) {
      touchTap = null;
      openFoodDetail(feed.kind, feed.pivot.rotation.y);
      return;
    }
    touchTap = { feed, time: now, x: event.clientX, y: event.clientY };
  };
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);
  canvas.addEventListener('lostpointercapture', finish);
  canvas.addEventListener('dblclick', event => {
    if (detailViewer) return;
    const feed = getScreenFood(event);
    if (feed) openFoodDetail(feed.kind, feed.pivot.rotation.y);
  });
}

function openFoodDetail(kind, angle = 0) {
  const food = availableFoods.get(kind);
  if (!food || detailViewer) return;
  const model = food.clone();
  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  const radius = bounds.getBoundingSphere(new THREE.Sphere()).radius;
  model.position.sub(center);
  const pivot = new THREE.Group();
  pivot.rotation.y = angle;
  pivot.add(model);
  const preview = new THREE.Scene();
  preview.background = new THREE.Color('#f7f7f4');
  scene.children.filter(child => child.isLight).forEach(light => preview.add(light.clone()));
  preview.add(pivot);

  const previewCamera = new THREE.PerspectiveCamera(38, 1, .001, 20);
  const orbit = new OrbitControls(previewCamera, canvas);
  orbit.enableDamping = true;
  orbit.enablePan = false;
  orbit.minDistance = radius * 1.4;
  orbit.maxDistance = radius * 11;
  orbit.minPolarAngle = .03;
  orbit.maxPolarAngle = Math.PI - .03;
  previewCamera.position.set(1, .63, 1.2).setLength(radius * 4.2);
  orbit.update();

  previousFocus = document.activeElement;
  document.getElementById('hunger-food-title').textContent = foodLabels[kind];
  controls.enabled = false;
  detailViewer = { scene: preview, camera: previewCamera, controls: orbit, radius };
  detailStage.append(canvas);
  canvas.setAttribute('aria-label', '拖动 360° 查看食物模型，滚动或捏合缩放');
  detailDialog.showModal();
  resize();
}

openFoodButton.addEventListener('click', () => openFoodDetail(foodPicker.value));
detailDialog.addEventListener('close', () => {
  if (!detailViewer) return;
  detailViewer.controls.dispose();
  detailViewer = null;
  world.prepend(canvas);
  canvas.style.touchAction = 'pan-y';
  canvas.setAttribute('aria-label', '拖动旋转 Hunger 装置');
  controls.enabled = true;
  resize();
  previousFocus?.focus({ preventScroll: true });
});

function resize() {
  if (!renderer) return;
  const viewport = detailViewer ? detailStage : world;
  const width = viewport.clientWidth;
  const height = viewport.clientHeight;
  if (!width || !height) return;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.setSize(width, height, false);
  const currentCamera = detailViewer?.camera ?? camera;
  currentCamera.aspect = width / height;
  currentCamera.updateProjectionMatrix();
  if (detailViewer) {
    const field = Math.atan(Math.tan(THREE.MathUtils.degToRad(currentCamera.fov / 2)) * Math.min(1, currentCamera.aspect));
    const distance = detailViewer.radius / Math.sin(field) * 1.14;
    const offset = currentCamera.position.clone().sub(detailViewer.controls.target);
    if (detailViewer.fitAspect === undefined) currentCamera.position.copy(offset.setLength(distance));
    detailViewer.fitAspect = currentCamera.aspect;
  }
}

function animate() {
  requestAnimationFrame(animate);
  if (document.hidden) return;
  if (detailViewer) {
    detailViewer.controls.update();
    renderer.render(detailViewer.scene, detailViewer.camera);
    return;
  }
  if (!viewerVisible) return;
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
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(world);
  resizeObserver.observe(detailStage);
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
}, { threshold: .05 }).observe(world);

