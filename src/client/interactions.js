import { toggleClusterCollapse, togglePin } from './actions.js';
import { isCollapsibleClusterNode } from './clustering.js';
import { graphElement, panelClose, tooltip } from './dom.js';
import {
  highlightLink,
  highlightNeighbourhood,
  refreshHighlight,
} from './graph.js';
import {
  closePanel,
  openPanel,
  renderLinkPanelFull,
  renderNodePanel,
} from './panel.js';
import { refs } from './state.js';

export function clearSelection() {
  refs.selectedId = null;
  refs.highlightNodes = new Set();
  refs.highlightLinks = new Set();
  refreshHighlight();
  closePanel();
}

export function handleNodeClick(node, event) {
  if (!node) return;

  if (
    refs.interactionMode === 'cluster' ||
    (event?.shiftKey && isCollapsibleClusterNode(node))
  ) {
    toggleClusterCollapse(node);
    return;
  }

  if (refs.interactionMode === 'pin') {
    togglePin(node);
    return;
  }

  refs.selectedId = node.id;
  highlightNeighbourhood(node.id);
  renderNodePanel(node);
  openPanel();
}

export function handleLinkClick(link) {
  if (!link) return;
  highlightLink(link);
  renderLinkPanelFull(link);
  openPanel();
}

export function handleNodeHover(node) {
  graphElement.style.cursor = node ? 'pointer' : 'default';
  if (!node) {
    tooltip.classList.remove('visible');
    return;
  }

  const d = node.data || {};
  let sub = '';
  if (node.type === 'project')
    sub = [d.acronym, d.status, d.fundingScheme].filter(Boolean).join(' · ');
  else if (node.type === 'organization')
    sub = [d.activityType, d.country].filter(Boolean).join(' · ');
  else if (node.type === 'topic') sub = d.topic || '';

  tooltip.innerHTML = `<div>${node.label || node.id}</div>${sub ? `<div class="tt-sub">${sub}</div>` : ''}`;
  tooltip.classList.add('visible');
}

export function handleLinkHover(link) {
  graphElement.style.cursor = link ? 'pointer' : 'default';
  if (!link) {
    tooltip.classList.remove('visible');
    return;
  }

  const nodeMap = Object.fromEntries(
    refs.graphData.nodes.map((n) => [n.id, n]),
  );
  const s = typeof link.source === 'object' ? link.source.id : link.source;
  const t = typeof link.target === 'object' ? link.target.id : link.target;

  tooltip.innerHTML = `<div>${nodeMap[s]?.label || s} → ${nodeMap[t]?.label || t}</div>
    ${link.role ? `<div class="tt-sub">${link.role}</div>` : ''}`;
  tooltip.classList.add('visible');
}

panelClose.addEventListener('click', clearSelection);
