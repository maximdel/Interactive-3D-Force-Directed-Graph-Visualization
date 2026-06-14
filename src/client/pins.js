import { pinnedGlowColor, pinnedPositions, refs } from './state.js';

export function createPinnedGlowObject(node) {
  if (!node.pinned) return null;
  try {
    const geometry = new THREE.SphereGeometry(7, 14, 14);
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(pinnedGlowColor),
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    return new THREE.Mesh(geometry, material);
  } catch {
    return null;
  }
}

/** Applies stored pinned positions to a node list before passing to the graph. */
export function applyPinsToNodeList(nodes) {
  if (!Array.isArray(nodes)) return;
  nodes.forEach((n) => {
    const p = pinnedPositions.get(n.id);
    if (p) {
      n.fx = p.x;
      n.fy = p.y;
      n.fz = p.z;
      n.pinned = true;
    } else {
      delete n.fx;
      delete n.fy;
      delete n.fz;
      n.pinned = false;
    }
  });
}

/**
 * Reads the current on-screen positions of pinned nodes from the live
 * graph data and writes them back into pinnedPositions.
 */
export function syncPinnedPositionsFromVisibleGraph() {
  if (!refs.currentDisplayed?.nodes) return;
  refs.currentDisplayed.nodes.forEach((node) => {
    if (!node.pinned) return;
    pinnedPositions.set(node.id, {
      x: node.fx ?? node.x,
      y: node.fy ?? node.y,
      z: node.fz ?? node.z,
    });
  });
}
