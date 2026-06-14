import './controls.js'; // imported for side effects — wires all UI event listeners
import { applyCurrentFilters, populateFilterOptions } from './filters.js';
import { applyGraphForces, graph, resizeGraph } from './graph.js';
import {
  clearSelection,
  handleLinkClick,
  handleLinkHover,
  handleNodeClick,
  handleNodeHover,
} from './interactions.js';
import { pinnedPositions, refs } from './state.js';
import {
  loadCollapsedClustersFromStorage,
  loadPinnedNodesFromStorage,
  savePinnedNodesToStorage,
} from './storage.js';
import { setStatus } from './utils.js';

// Wire graph event handlers are
// done here (not in graph.js) so graph.js never needs to import from interactions.js, because that wcreates a circular dependency

graph
  .onNodeClick(handleNodeClick)
  .onNodeHover(handleNodeHover)
  .onLinkClick(handleLinkClick)
  .onLinkHover(handleLinkHover)
  .onBackgroundClick(clearSelection);

// Update the stored position when a pinned node is dragged
graph.onNodeDragEnd((node) => {
  if (!node?.pinned) return;
  pinnedPositions.set(node.id, { x: node.x, y: node.y, z: node.z });
  savePinnedNodesToStorage();
});

// Data loading

async function loadGraph() {
  try {
    setStatus('Loading…');
    const res = await fetch('/api/graph', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    refs.fullData = data;
    refs.graphData = data;

    populateFilterOptions(data);
    loadPinnedNodesFromStorage();
    loadCollapsedClustersFromStorage();

    graph
      .nodeId('id')
      .nodeColor((node) => node.color || '#4a9eff')
      .d3Force('charge')
      .strength(-80);

    applyCurrentFilters();
    applyGraphForces();
  } catch (err) {
    console.error('Failed to load graph:', err);
    setStatus('Failed to load');
    graph.graphData({ nodes: [], links: [] });
  }
}

// Start

window.addEventListener('resize', resizeGraph);
resizeGraph();
loadGraph();
