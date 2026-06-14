/**
 * models.js
 * Loads GLB models per node type with a procedural-geometry fallback.
 * Call preloadModels() once before the graph renders.
 */

const MODEL_URLS = {
  project:      '/models/project.glb',
  organization: '/models/organization.glb',
  topic:        '/models/topic.glb',
};

// Procedural geometry used when a GLB fails to load
const FALLBACK_GEOM = {
  project:      () => new window.THREE.BoxGeometry(8, 8, 8),
  organization: () => new window.THREE.CylinderGeometry(3.5, 4.5, 11, 12),
  topic:        () => new window.THREE.OctahedronGeometry(6.5),
};

const _cache  = {};   // type -> { scene: THREE.Group } | { fallback: true }
let _Loader   = null; // GLTFLoader constructor, loaded once

// ── GLTFLoader bootstrap ───────────────────────────────────────────────────────

async function getGLTFLoader() {
  if (_Loader) return _Loader;
  // Three.js exposes it here when loaded as an ES module + side import
  if (window.THREE?.GLTFLoader) {
    _Loader = window.THREE.GLTFLoader;
    return _Loader;
  }
  try {
    // Dynamic import from the same CDN version used by index.html
    const threeVersion = window.THREE?.REVISION
      ? `0.${window.THREE.REVISION}.0`
      : '0.155.0';
    const url = `https://cdn.jsdelivr.net/npm/three@${threeVersion}/examples/jsm/loaders/GLTFLoader.js`;
    const mod = await import(/* @vite-ignore */ url);
    _Loader = mod.GLTFLoader;
    return _Loader;
  } catch {
    return null;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normaliseScale(object, targetSize = 10) {
  const box    = new window.THREE.Box3().setFromObject(object);
  const size   = box.getSize(new window.THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  object.scale.setScalar(targetSize / maxDim);
}

function tintObject(object, hexColor) {
  object.traverse(child => {
    if (!child.isMesh) return;
    child.material = child.material.clone();
    child.material.color.setHex(hexColor);
    child.material.emissive = new window.THREE.Color(hexColor);
    child.material.emissiveIntensity = 0.12;
  });
}

function makeFallback(type, hexColor) {
  const THREE    = window.THREE;
  const geomFn   = FALLBACK_GEOM[type] || (() => new THREE.SphereGeometry(5, 8, 8));
  const material = new THREE.MeshLambertMaterial({ color: hexColor });
  return new THREE.Mesh(geomFn(), material);
}

function addPinGlow(group) {
  const THREE = window.THREE;
  const geom  = new THREE.SphereGeometry(7, 12, 12);
  const mat   = new THREE.MeshBasicMaterial({
    color:       0xffd166,
    transparent: true,
    opacity:     0.28,
    depthWrite:  false,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.userData.isPinGlow = true;
  group.add(mesh);
}

/** Add a pin glow to an already-existing node Three.js object. */
export function attachPinGlow(threeObj) {
  if (!threeObj || !window.THREE) return;
  // Only add if not already present
  if (threeObj.children.some((c) => c.userData?.isPinGlow)) return;
  addPinGlow(threeObj);
}

/** Remove the pin glow from an already-existing node Three.js object. */
export function detachPinGlow(threeObj) {
  if (!threeObj) return;
  const glow = threeObj.children.find((c) => c.userData?.isPinGlow);
  if (glow) threeObj.remove(glow);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Preload all GLB models. Call this once before the graph renders.
 * Missing or broken GLB files silently fall back to procedural geometry.
 */
export async function preloadModels() {
  const LoaderClass = await getGLTFLoader();

  const tasks = Object.entries(MODEL_URLS).map(async ([type, url]) => {
    if (!LoaderClass) {
      _cache[type] = { fallback: true };
      return;
    }
    try {
      const gltf = await new Promise((resolve, reject) => {
        new LoaderClass().load(url, resolve, undefined, reject);
      });
      normaliseScale(gltf.scene);
      _cache[type] = { scene: gltf.scene };
    } catch {
      _cache[type] = { fallback: true };
    }
  });

  await Promise.all(tasks);
  console.log('[models] loaded:', Object.entries(_cache).map(([t, v]) => `${t}:${v.fallback ? 'fallback' : 'gltf'}`).join(' '));
}

/**
 * Returns the THREE.Object3D for a node.
 * Handles pin glow and colour tinting automatically.
 * Use with: graph.nodeThreeObject(getNodeObject).nodeThreeObjectExtend(false)
 */
export function getNodeObject(node) {
  const THREE = window.THREE;
  if (!THREE) return null;

  const type     = node.type || 'project';
  const hexColor = node.color ? parseInt(node.color.replace('#', ''), 16) : 0x888888;
  const cached   = _cache[type];
  const group    = new THREE.Group();

  if (!cached || cached.fallback) {
    group.add(makeFallback(type, hexColor));
  } else {
    const clone = cached.scene.clone(true);
    tintObject(clone, hexColor);
    group.add(clone);
  }

  if (node.pinned) addPinGlow(group);

  return group;
}
