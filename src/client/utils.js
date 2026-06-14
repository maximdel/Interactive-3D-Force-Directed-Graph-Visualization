import { statusElement, tooltip } from './dom.js';

export function debounce(fn, wait = 250) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export function linkKey(link) {
  const s = typeof link.source === 'object' ? link.source.id : link.source;
  const t = typeof link.target === 'object' ? link.target.id : link.target;
  return `${s}→${t}`;
}

/** Deterministic hash → uint32, used for reproducible sampling. */
export function hashStringToUint32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
  }
  return h >>> 0;
}

export function setStatus(message) {
  if (statusElement) statusElement.textContent = message;
}

/** Returns the display label for a node, including collapsed-cluster count. */
export function getNodeLabel(node) {
  const base = node.label || node.title || node.name || node.id;
  if (node.collapsedCluster)
    return `${base} (+${node.clusterMemberCount || 0})`;
  return base;
}

document.addEventListener('mousemove', (e) => {
  const offset = 14;
  let x = e.clientX + offset;
  let y = e.clientY + offset;
  if (x + 260 > window.innerWidth) x = e.clientX - 260;
  if (y + 60 > window.innerHeight) y = e.clientY - 60;
  tooltip.style.left = x + 'px';
  tooltip.style.top = y + 'px';
});
