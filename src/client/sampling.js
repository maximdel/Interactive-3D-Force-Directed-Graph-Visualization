import { sampleSlider } from './dom.js';
import { hashStringToUint32 } from './utils.js';

// Seeded sampling

/**
 * Returns a Set of project IDs sampled deterministically from `nodes`.
 * Always includes at least one project even when pct is very small.
 */
export function sampleProjectIds(nodes, pct, seed = 42) {
  const projects = nodes.filter((n) => n.type === 'project');
  const selected = new Set();
  const threshold = pct / 100;
  let bestProject = null;
  let bestHash = Number.POSITIVE_INFINITY;

  projects.forEach((p) => {
    const h = hashStringToUint32(`${p.id}:${seed}`);
    const r = h / 4294967295; // normalise to [0, 1]
    if (h < bestHash) {
      bestHash = h;
      bestProject = p.id;
    }
    if (r < threshold) selected.add(p.id);
  });

  if (selected.size === 0 && bestProject) selected.add(bestProject);
  return selected;
}

/**
 * Returns a subset of `data` containing only the sampled projects
 * and any nodes connected to them.
 */
export function buildSampledGraph(data, pct, seed = 42) {
  const allowedProjectIds = sampleProjectIds(data.nodes, pct, seed);
  const connectedNodeIds = new Set();

  const links = data.links.filter((link) => {
    const sourceId =
      typeof link.source === 'object' ? link.source.id : link.source;
    const targetId =
      typeof link.target === 'object' ? link.target.id : link.target;
    const keep =
      allowedProjectIds.has(sourceId) || allowedProjectIds.has(targetId);
    if (keep) {
      connectedNodeIds.add(sourceId);
      connectedNodeIds.add(targetId);
    }
    return keep;
  });

  return {
    nodes: data.nodes.filter((n) => connectedNodeIds.has(n.id)),
    links,
    sampled: true,
    pct,
    seed,
  };
}

/** Reads the current slider value, with a minimum of 1%. */
export function getCurrentSamplePct() {
  if (!sampleSlider) return 1;
  return Math.max(1, parseInt(sampleSlider.value, 10) || 1);
}

// text filter

/**
 * Returns the subset of `data` where at least one endpoint of each link has a label matching `text`. Connected neighbours are included.
 */
export function filterGraphByText(data, text) {
  if (!text) return data;
  const q = text.toLowerCase();

  const keepNodeIds = new Set(
    data.nodes
      .filter((n) => (n.label || '').toLowerCase().includes(q))
      .map((n) => n.id),
  );

  const links = data.links.filter((link) => {
    const s = typeof link.source === 'object' ? link.source.id : link.source;
    const t = typeof link.target === 'object' ? link.target.id : link.target;
    if (keepNodeIds.has(s) || keepNodeIds.has(t)) {
      keepNodeIds.add(s);
      keepNodeIds.add(t);
      return true;
    }
    return false;
  });

  return { nodes: data.nodes.filter((n) => keepNodeIds.has(n.id)), links };
}
