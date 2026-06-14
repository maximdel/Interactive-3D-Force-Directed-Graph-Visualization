import {
  CLUSTER_STORAGE_KEY,
  collapsedClusters,
  PIN_STORAGE_KEY,
  pinnedPositions,
} from './state.js';

// Pins

export function loadPinnedNodesFromStorage() {
  try {
    const raw = localStorage.getItem(PIN_STORAGE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    for (const id of Object.keys(obj)) {
      const p = obj[id];
      if (p && typeof p.x === 'number') pinnedPositions.set(id, p);
    }
  } catch (e) {
    console.warn('Failed to load pinned nodes', e);
  }
}

export function savePinnedNodesToStorage() {
  try {
    const out = {};
    for (const [id, pos] of pinnedPositions.entries()) out[id] = pos;
    localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(out));
  } catch (e) {
    console.warn('Failed to save pinned nodes', e);
  }
}

// Clusters
export function loadCollapsedClustersFromStorage() {
  try {
    const raw = localStorage.getItem(CLUSTER_STORAGE_KEY);
    if (!raw) return;
    const ids = JSON.parse(raw);
    if (Array.isArray(ids)) ids.forEach((id) => collapsedClusters.add(id));
  } catch (e) {
    console.warn('Failed to load collapsed clusters', e);
  }
}

export function saveCollapsedClustersToStorage() {
  try {
    localStorage.setItem(
      CLUSTER_STORAGE_KEY,
      JSON.stringify(Array.from(collapsedClusters)),
    );
  } catch (e) {
    console.warn('Failed to save collapsed clusters', e);
  }
}

export function saveLayoutState() {
  savePinnedNodesToStorage();
  saveCollapsedClustersToStorage();
}
