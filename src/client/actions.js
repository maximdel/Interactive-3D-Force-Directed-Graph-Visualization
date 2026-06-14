import { isCollapsibleClusterNode } from './clustering.js';
import { clusterModeBtn, pinModeBtn } from './dom.js';
import { graph, renderCurrentGraph } from './graph.js';
import {
  collapsedClusters,
  PIN_STORAGE_KEY,
  pinnedPositions,
  refs,
} from './state.js';
import {
  saveCollapsedClustersToStorage,
  savePinnedNodesToStorage,
} from './storage.js';
import { getNodeLabel, setStatus } from './utils.js';

export function setInteractionMode(mode) {
  refs.interactionMode = mode;
  if (inspectModeBtn)
    inspectModeBtn.classList.toggle('is-active', mode === 'inspect');
  if (pinModeBtn) pinModeBtn.classList.toggle('is-active', mode === 'pin');
  if (clusterModeBtn)
    clusterModeBtn.classList.toggle('is-active', mode === 'cluster');
}

export function togglePin(node) {
  if (!node) return;
  if (node.pinned) {
    delete node.fx;
    delete node.fy;
    delete node.fz;
    node.pinned = false;
    pinnedPositions.delete(node.id);
  } else {
    node.fx = node.x;
    node.fy = node.y;
    node.fz = node.z;
    node.pinned = true;
    pinnedPositions.set(node.id, { x: node.fx, y: node.fy, z: node.fz });
  }
  savePinnedNodesToStorage();
  graph.refresh(); // redraw so glow appears / disappears immediately
  setStatus(`${node.pinned ? 'Pinned' : 'Unpinned'} ${getNodeLabel(node)}`);
}

export function clearAllPins() {
  pinnedPositions.clear();
  localStorage.removeItem(PIN_STORAGE_KEY);

  [refs.currentFiltered, refs.fullData].forEach((dataset) => {
    if (dataset && Array.isArray(dataset.nodes)) {
      dataset.nodes.forEach((n) => {
        delete n.fx;
        delete n.fy;
        delete n.fz;
        n.pinned = false;
      });
    }
  });

  graph.refresh();
}

export function toggleClusterCollapse(node) {
  if (!isCollapsibleClusterNode(node)) return;
  if (collapsedClusters.has(node.id)) collapsedClusters.delete(node.id);
  else collapsedClusters.add(node.id);
  saveCollapsedClustersToStorage();
  renderCurrentGraph();
  setStatus(
    `${collapsedClusters.has(node.id) ? 'Collapsed' : 'Expanded'} ${getNodeLabel(node)}`,
  );
}

export function resetClusterState() {
  collapsedClusters.clear();
  saveCollapsedClustersToStorage();
  renderCurrentGraph();
}
