import { buildClusteredGraph } from './clustering.js';
import {
  graphElement,
  headerElement,
  particleCountMultValue,
  particleSpeedMultValue,
} from './dom.js';
import {
  getForceMultiplier,
  getLinkVisualKind,
  getParticleColor,
  getParticleCount,
  getParticleSpeed,
  getParticleWidth,
} from './links.js';
import { getNodeObject } from './models.js';
import { applyPinsToNodeList } from './pins.js';
import { particleState, pinnedGlowColor, refs } from './state.js';
import { linkKey } from './utils.js';

// Event handlers (onNodeClick etc.) are wired in main.js to avoid circular deps

export const graph = ForceGraph3D({ controlType: 'orbit' })(graphElement)
  .backgroundColor('#0d1117')
  .nodeLabel(() => '')
  .linkOpacity(0.45)
  .nodeOpacity(0.95)
  .nodeRelSize(5)
  .nodeResolution(8)
  .nodeThreeObjectExtend(false)
  .nodeThreeObject(getNodeObject)
  .enableNodeDrag(true)
  .nodeColor((node) => {
    // pinned nodes always render gold regardless of selection state
    if (node.pinned) return pinnedGlowColor;
    // When something is selected, dim everything outside the neighbourhood
    if (refs.highlightNodes.size > 0) {
      return refs.highlightNodes.has(node.id)
        ? node.color || '#4a9eff'
        : 'rgba(80,80,80,0.25)';
    }
    return node.color || '#4a9eff';
  })
  .linkColor((link) => {
    if (refs.highlightLinks.size === 0) return 'rgba(255,255,255,0.25)';
    return refs.highlightLinks.has(linkKey(link))
      ? 'rgba(255,255,255,0.85)'
      : 'rgba(255,255,255,0.05)';
  })
  .linkWidth((link) =>
    refs.highlightLinks.has(linkKey(link))
      ? 2.5
      : Math.max(0.5, link.weight || 1),
  )
  .linkDirectionalParticles((link) =>
    refs.highlightLinks.has(linkKey(link)) ? 4 : 0,
  )
  .linkDirectionalParticleWidth(2);

window.__graph = graph;

export function applyGraphForces() {
  const linkForce = graph.d3Force('link');
  if (linkForce && typeof linkForce.strength === 'function') {
    linkForce.strength((link) => getForceMultiplier(link));
  }

  graph
    .linkWidth((link) => Math.max(0.75, Math.min(3.5, getParticleWidth(link))))
    .linkDirectionalParticleColor((link) => getParticleColor(link))
    .linkDirectionalParticleWidth((link) => getParticleWidth(link))
    .linkDirectionalParticles((link) =>
      Math.max(1, Math.min(4, getParticleCount(link))),
    )
    .linkDirectionalParticleSpeed((link) => getParticleSpeed(link))
    .linkDirectionalParticleResolution(8)
    .linkDirectionalParticleOffset((link) =>
      getLinkVisualKind(link) === 'organization' ? 0.15 : 0.55,
    );

  graph.refresh();
}

export function updateParticleLabels() {
  if (particleCountMultValue)
    particleCountMultValue.textContent = `${particleState.countMult.toFixed(1)}x`;
  if (particleSpeedMultValue) {
    const s = particleState.speedMult;
    particleSpeedMultValue.textContent = `${s < 0.1 ? s.toFixed(3) : s.toFixed(1)}x`;
  }
}

/** Re-triggers all colour/width getters so the graph redraws with current highlight state. */
export function refreshHighlight() {
  graph
    .nodeColor(graph.nodeColor())
    .linkColor(graph.linkColor())
    .linkWidth(graph.linkWidth())
    .linkDirectionalParticles(graph.linkDirectionalParticles());
}

export function highlightNeighbourhood(nodeId) {
  const src = refs.currentDisplayed || refs.graphData;
  refs.highlightNodes = new Set([nodeId]);
  refs.highlightLinks = new Set();

  for (const link of src.links) {
    const s = typeof link.source === 'object' ? link.source.id : link.source;
    const t = typeof link.target === 'object' ? link.target.id : link.target;
    if (s === nodeId || t === nodeId) {
      refs.highlightLinks.add(linkKey(link));
      refs.highlightNodes.add(s);
      refs.highlightNodes.add(t);
    }
  }
  refreshHighlight();
}

export function highlightLink(link) {
  refs.highlightNodes = new Set();
  refs.highlightLinks = new Set([linkKey(link)]);
  const s = typeof link.source === 'object' ? link.source.id : link.source;
  const t = typeof link.target === 'object' ? link.target.id : link.target;
  refs.highlightNodes.add(s);
  refs.highlightNodes.add(t);
  refreshHighlight();
}

export function renderCurrentGraph() {
  if (!refs.currentFiltered) {
    refs.currentDisplayed = { nodes: [], links: [] };
    graph.graphData(refs.currentDisplayed);
    applyGraphForces();
    return;
  }
  refs.currentDisplayed = buildClusteredGraph(refs.currentFiltered);
  applyPinsToNodeList(refs.currentDisplayed.nodes);
  graph.graphData(refs.currentDisplayed);
  applyGraphForces();
}

export function resizeGraph() {
  const headerHeight = headerElement ? headerElement.offsetHeight : 0;
  graph
    .width(graphElement.offsetWidth)
    .height(Math.max(0, window.innerHeight - headerHeight));
}
