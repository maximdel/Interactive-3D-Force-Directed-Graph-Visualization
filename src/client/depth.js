/**
 * Parallax depth field.
 *
 * On every engine tick (and when sliders change) we compute the current Z
 * extent of all visible nodes, then fade each node's opacity based on how far
 * its Z coordinate is from the focal plane.  Nodes inside the focus band stay
 * at full opacity; nodes outside fade toward MIN_OPACITY over a falloff zone.
 */

const MIN_OPACITY = 0.08;

export const depthState = {
  enabled:  false,
  focalPct: 50,  // 0–100 %: position of focal plane through the Z range
  widthPct: 30,  // 0–100 %: fraction of Z range that is fully in focus
};

let _wasEnabled = false; // tracks previous enabled state so we restore once on disable

export function applyDepthField(nodes) {
  if (!nodes?.length) return;

  if (!depthState.enabled) {
    if (_wasEnabled) {
      nodes.forEach((n) => _setNodeOpacity(n, 1.0));
      _wasEnabled = false;
    }
    return;
  }
  _wasEnabled = true;

  // Compute current Z span
  let zMin = Infinity;
  let zMax = -Infinity;
  for (const n of nodes) {
    if (n.z != null) {
      if (n.z < zMin) zMin = n.z;
      if (n.z > zMax) zMax = n.z;
    }
  }
  if (!isFinite(zMin)) return;

  const zRange   = zMax - zMin || 1;
  const focalZ   = zMin + (depthState.focalPct / 100) * zRange;
  const halfBand = (depthState.widthPct  / 100) * zRange * 0.5;
  // Fade zone: at minimum 20 world-units; otherwise half the focus band width
  const falloff  = Math.max(halfBand * 0.5, 20);

  for (const n of nodes) {
    const dist = Math.abs((n.z ?? 0) - focalZ);
    let opacity;
    if (dist <= halfBand) {
      opacity = 1.0;
    } else {
      const t = Math.min(1, (dist - halfBand) / falloff);
      opacity = 1.0 - t * (1.0 - MIN_OPACITY);
    }
    _setNodeOpacity(n, opacity);
  }
}

function _setNodeOpacity(node, opacity) {
  const obj = node.__threeObj;
  if (!obj) return;
  const transparent = opacity < 1.0;
  obj.traverse((child) => {
    if (!child.isMesh) return;
    const mat = child.material;
    if (mat.opacity === opacity && mat.transparent === transparent) return;
    mat.transparent  = transparent;
    mat.opacity      = opacity;
    mat.needsUpdate  = true;
  });
}
