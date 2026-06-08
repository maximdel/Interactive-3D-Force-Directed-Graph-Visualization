const PREVIEW_PROJECT_LIMIT = 250;

// UI controls
const previewToggleElement = document.getElementById('previewToggle');
const filterTextElement = document.getElementById('filterText');
const sampleSlider = document.getElementById('sampleSlider');
const sampleValue = document.getElementById('sampleValue');
const applySampleBtn = document.getElementById('applySample');
const preset1 = document.getElementById('preset1');
const preset5 = document.getElementById('preset5');
const preset10 = document.getElementById('preset10');
const orgLinkWeightElement = document.getElementById('orgLinkWeight');
const topicLinkWeightElement = document.getElementById('topicLinkWeight');
const orgLinkWeightValueElement = document.getElementById('orgLinkWeightValue');
const topicLinkWeightValueElement = document.getElementById(
  'topicLinkWeightValue',
);

const graphElement = document.getElementById('graph');
const statusElement = document.getElementById('status');
const panel = document.getElementById('panel');
const panelBody = document.getElementById('panel-body');
const panelBadge = document.getElementById('panel-badge');
const panelTitle = document.getElementById('panel-title');
const panelClose = document.getElementById('panel-close');
const tooltip = document.getElementById('tooltip');
const linkWeightState = {
  organization: 1.3,
  topic: 1.0,
};

let graphData = { nodes: [], links: [] };
let selectedId = null;
let highlightNodes = new Set();
let highlightLinks = new Set();

// particle settings
const particleCountMultElement = document.getElementById('particleCountMult');
const particleSpeedMultElement = document.getElementById('particleSpeedMult');
const particleCountMultValue = document.getElementById(
  'particleCountMultValue',
);
const particleSpeedMultValue = document.getElementById(
  'particleSpeedMultValue',
);

const particleState = {
  countMult: 1,
  speedMult: 1,
};

// layout / pinning
const saveLayoutBtn = document.getElementById('saveLayout');
const clearPinsBtn = document.getElementById('clearPins');
const resetClustersBtn = document.getElementById('resetClusters');
const pinModeBtn = document.getElementById('pinMode');
const clusterModeBtn = document.getElementById('clusterMode');
const PIN_STORAGE_KEY = 'graphPinnedNodes_v1';
const CLUSTER_STORAGE_KEY = 'graphCollapsedClusters_v1';
const pinnedPositions = new Map();
const collapsedClusters = new Set();
const pinnedGlowColor = '#ffd166';
let interactionMode = 'pin';

function setInteractionMode(mode) {
  interactionMode = mode;

  if (pinModeBtn) {
    pinModeBtn.classList.toggle('is-active', mode === 'pin');
  }
  if (clusterModeBtn) {
    clusterModeBtn.classList.toggle('is-active', mode === 'cluster');
  }
}

function createPinnedGlowObject(node) {
  return null;
}

function loadPinnedNodesFromStorage() {
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

function savePinnedNodesToStorage() {
  try {
    const out = {};
    for (const [id, pos] of pinnedPositions.entries()) {
      out[id] = pos;
    }
    localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(out));
  } catch (e) {
    console.warn('Failed to save pinned nodes', e);
  }
}

function loadCollapsedClustersFromStorage() {
  try {
    const raw = localStorage.getItem(CLUSTER_STORAGE_KEY);
    if (!raw) return;

    const ids = JSON.parse(raw);
    if (Array.isArray(ids)) {
      ids.forEach((id) => collapsedClusters.add(id));
    }
  } catch (e) {
    console.warn('Failed to load collapsed clusters', e);
  }
}

function saveCollapsedClustersToStorage() {
  try {
    localStorage.setItem(
      CLUSTER_STORAGE_KEY,
      JSON.stringify(Array.from(collapsedClusters)),
    );
  } catch (e) {
    console.warn('Failed to save collapsed clusters', e);
  }
}

function saveLayoutState() {
  savePinnedNodesToStorage();
  saveCollapsedClustersToStorage();
}

function isCollapsibleClusterNode(node) {
  return node && (node.type === 'organization' || node.type === 'topic');
}

function getNodeLabel(node) {
  const baseLabel = node.label || node.title || node.name || node.id;
  if (node.collapsedCluster) {
    const count = node.clusterMemberCount || 0;
    return `${baseLabel} (+${count})`;
  }
  return baseLabel;
}

document.addEventListener('mousemove', (e) => {
  const offset = 14;
  let x = e.clientX + offset;
  let y = e.clientY + offset;
  // keep within viewport
  if (x + 260 > window.innerWidth) x = e.clientX - 260;
  if (y + 60 > window.innerHeight) y = e.clientY - 60;
  tooltip.style.left = x + 'px';
  tooltip.style.top = y + 'px';
});

function buildClusteredGraph(data) {
  if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.links)) {
    return { nodes: [], links: [] };
  }

  if (collapsedClusters.size === 0) {
    return {
      nodes: data.nodes,
      links: data.links,
    };
  }

  const nodeById = new Map(data.nodes.map((node) => [node.id, node]));
  const hiddenProjectIds = new Set();
  const projectMemberships = new Map();
  const clusterMemberCounts = new Map();

  function addProjectMembership(projectId, clusterId) {
    if (!projectMemberships.has(projectId)) {
      projectMemberships.set(projectId, new Set());
    }
    projectMemberships.get(projectId).add(clusterId);

    if (!clusterMemberCounts.has(clusterId)) {
      clusterMemberCounts.set(clusterId, new Set());
    }
    clusterMemberCounts.get(clusterId).add(projectId);
  }

  data.links.forEach((link) => {
    const sourceId =
      typeof link.source === 'object' ? link.source.id : link.source;
    const targetId =
      typeof link.target === 'object' ? link.target.id : link.target;
    const sourceNode = nodeById.get(sourceId);
    const targetNode = nodeById.get(targetId);

    if (
      sourceNode &&
      sourceNode.type === 'project' &&
      collapsedClusters.has(targetId)
    ) {
      hiddenProjectIds.add(sourceId);
      addProjectMembership(sourceId, targetId);
    }

    if (
      targetNode &&
      targetNode.type === 'project' &&
      collapsedClusters.has(sourceId)
    ) {
      hiddenProjectIds.add(targetId);
      addProjectMembership(targetId, sourceId);
    }
  });

  const visibleNodes = data.nodes
    .filter((node) => node.type !== 'project' || !hiddenProjectIds.has(node.id))
    .map((node) => {
      node.collapsedCluster = collapsedClusters.has(node.id);
      node.clusterMemberCount = clusterMemberCounts.has(node.id)
        ? clusterMemberCounts.get(node.id).size
        : 0;
      return node;
    });

  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  const aggregatedLinks = new Map();

  function addAggregatedLink(sourceId, targetId, link) {
    if (sourceId === targetId) return;
    const key =
      sourceId < targetId
        ? `${sourceId}::${targetId}`
        : `${targetId}::${sourceId}`;
    const existing = aggregatedLinks.get(key);
    const weight = link.weight || 1;
    if (existing) {
      existing.weight += weight;
    } else {
      aggregatedLinks.set(key, {
        source: sourceId,
        target: targetId,
        weight,
        role: 'cluster',
      });
    }
  }

  data.links.forEach((link) => {
    const sourceId =
      typeof link.source === 'object' ? link.source.id : link.source;
    const targetId =
      typeof link.target === 'object' ? link.target.id : link.target;
    const sourceHidden = hiddenProjectIds.has(sourceId);
    const targetHidden = hiddenProjectIds.has(targetId);

    if (!sourceHidden && !targetHidden) {
      if (visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId)) {
        aggregatedLinks.set(
          sourceId < targetId
            ? `${sourceId}::${targetId}`
            : `${targetId}::${sourceId}`,
          { ...link },
        );
      }
      return;
    }

    const hiddenProjectId = sourceHidden ? sourceId : targetId;
    const neighborId = sourceHidden ? targetId : sourceId;
    const memberships = projectMemberships.get(hiddenProjectId);

    if (!memberships || memberships.size === 0) {
      return;
    }

    memberships.forEach((clusterId) => {
      if (neighborId === clusterId) return;
      addAggregatedLink(clusterId, neighborId, link);
    });
  });

  return {
    nodes: visibleNodes,
    links: Array.from(aggregatedLinks.values()),
  };
}

function renderCurrentGraph() {
  if (!currentFiltered) {
    currentDisplayed = { nodes: [], links: [] };
    graph.graphData(currentDisplayed);
    applyGraphForces();
    return;
  }

  currentDisplayed = buildClusteredGraph(currentFiltered);
  applyPinsToNodeList(currentDisplayed.nodes);
  graph.graphData(currentDisplayed);
  applyGraphForces();
}

function toggleClusterCollapse(node) {
  if (!isCollapsibleClusterNode(node)) return;

  if (collapsedClusters.has(node.id)) {
    collapsedClusters.delete(node.id);
  } else {
    collapsedClusters.add(node.id);
  }

  saveCollapsedClustersToStorage();
  renderCurrentGraph();
  setStatus(
    `${collapsedClusters.has(node.id) ? 'Collapsed' : 'Expanded'} ${getNodeLabel(node)}`,
  );
}

function resetClusterState() {
  collapsedClusters.clear();
  saveCollapsedClustersToStorage();
  renderCurrentGraph();
}

function applyPinsToNodeList(nodes) {
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

function syncPinnedPositionsFromVisibleGraph() {
  if (!currentDisplayed || !Array.isArray(currentDisplayed.nodes)) return;

  currentDisplayed.nodes.forEach((node) => {
    if (!node.pinned) return;

    pinnedPositions.set(node.id, {
      x: node.fx ?? node.x,
      y: node.fy ?? node.y,
      z: node.fz ?? node.z,
    });
  });
}

function togglePin(node) {
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
  setStatus(`${node.pinned ? 'Pinned' : 'Unpinned'} ${getNodeLabel(node)}`);
}

function clearAllPins() {
  pinnedPositions.clear();
  localStorage.removeItem(PIN_STORAGE_KEY);
  if (currentFiltered && Array.isArray(currentFiltered.nodes)) {
    currentFiltered.nodes.forEach((n) => {
      delete n.fx;
      delete n.fy;
      delete n.fz;
      n.pinned = false;
    });
  }
  if (fullData && Array.isArray(fullData.nodes)) {
    fullData.nodes.forEach((n) => {
      delete n.fx;
      delete n.fy;
      delete n.fz;
      n.pinned = false;
    });
  }
  graph.refresh();
}

const graph = ForceGraph3D({ controlType: 'orbit' })(graphElement)
  .backgroundColor('#0d1117')
  .nodeLabel((node) => '')
  .linkOpacity(0.45)
  .nodeOpacity(0.95)
  .nodeRelSize(5)
  .nodeResolution(8)
  .nodeThreeObjectExtend(() => false)
  .nodeThreeObject(createPinnedGlowObject)
  .enableNodeDrag(true)
  // node colour — dim non-highlighted nodes when something is selected
  .nodeColor((node) => {
    if (highlightNodes.size === 0) return node.color || '#4a9eff';
    return highlightNodes.has(node.id)
      ? node.color || '#4a9eff'
      : 'rgba(80,80,80,0.25)';
  })
  // link colour — highlight connected links
  .linkColor((link) => {
    if (highlightLinks.size === 0) return 'rgba(255,255,255,0.25)';
    const key = linkKey(link);
    return highlightLinks.has(key)
      ? 'rgba(255,255,255,0.85)'
      : 'rgba(255,255,255,0.05)';
  })
  .linkWidth((link) => {
    const key = linkKey(link);
    return highlightLinks.has(key) ? 2.5 : Math.max(0.5, link.weight || 1);
  })
  .linkDirectionalParticles((link) => {
    const key = linkKey(link);
    return highlightLinks.has(key) ? 4 : 0;
  })
  .linkDirectionalParticleWidth(2)
  // interactions
  .onNodeClick(handleNodeClick)
  .onNodeHover(handleNodeHover)
  .onLinkClick(handleLinkClick)
  .onLinkHover(handleLinkHover)
  .onBackgroundClick(clearSelection);

window.__graph = graph;

// plain click pins; shift-click collapses/expands clusters
// graph.onNodeClick((node, event) => {
//   try {
//     if (
//       interactionMode === 'cluster' ||
//       (event && event.shiftKey && isCollapsibleClusterNode(node))
//     ) {
//       toggleClusterCollapse(node);
//       return;
//     }

//     if (interactionMode === 'pin') {
//       togglePin(node);
//     }
//   } catch (e) {
//     console.warn('Pin toggle failed', e);
//   }
// });

graph.onNodeDragEnd((node) => {
  if (!node) return;
  if (node.pinned) {
    // update saved pinned position
    pinnedPositions.set(node.id, { x: node.x, y: node.y, z: node.z });
    savePinnedNodesToStorage();
  }
});

let fullData = null;
let currentFiltered = null;
let currentDisplayed = null;
let particleDebugTimer = null;
const headerElement = document.querySelector('.app-header');

function getForceMultiplier(link) {
  return 0.8 * getLinkWeightMultiplier(link);
}

function getLinkVisualKind(link) {
  const kind = getLinkKind(link);
  return kind === 'organization' ? 'organization' : 'topic';
}

function getParticleColor(link) {
  return getLinkVisualKind(link) === 'organization' ? '#ffb36b' : '#7dffbe';
}

function getParticleCount(link) {
  const weight = (link.weight || 1) * getLinkWeightMultiplier(link);
  const base = Math.max(1, Math.round(weight));
  return Math.min(10, Math.round(base * particleState.countMult));
}

function getParticleWidth(link) {
  const weight = (link.weight || 1) * getLinkWeightMultiplier(link);
  return Math.max(0.6, Math.min(3.5, 0.35 + weight * 0.45));
}

function getParticleSpeed(link) {
  const weight = (link.weight || 1) * getLinkWeightMultiplier(link);
  return (
    Math.max(0.0015, Math.min(0.04, 0.0025 + weight * 0.0025)) *
    particleState.speedMult
  );
}

function updateParticleLabels() {
  if (particleCountMultValue) {
    particleCountMultValue.textContent = `${particleState.countMult.toFixed(1)}x`;
  }
  if (particleSpeedMultValue) {
    const speed = particleState.speedMult;
    const formattedSpeed = speed < 0.1 ? speed.toFixed(3) : speed.toFixed(1);
    particleSpeedMultValue.textContent = `${formattedSpeed}x`;
  }
}

function logParticleDebug() {
  const activeLinks =
    currentDisplayed && Array.isArray(currentDisplayed.links)
      ? currentDisplayed.links.length
      : 0;
  const sampleLink =
    currentDisplayed && Array.isArray(currentDisplayed.links)
      ? currentDisplayed.links[0]
      : null;

  console.log('[particles]', {
    countMult: particleState.countMult,
    speedMult: particleState.speedMult,
    activeLinks,
    sample: sampleLink
      ? {
          kind: getLinkVisualKind(sampleLink),
          count: getParticleCount(sampleLink),
          speed: getParticleSpeed(sampleLink),
        }
      : null,
  });
}

function startParticleDebugLog() {
  if (particleDebugTimer) {
    clearInterval(particleDebugTimer);
  }

  particleDebugTimer = setInterval(() => {
    logParticleDebug();
  }, 1000);
}

function resizeGraph() {
  const headerHeight = headerElement ? headerElement.offsetHeight : 0;
  const graphHeight = Math.max(0, window.innerHeight - headerHeight);

  graph.width(window.innerWidth).height(graphHeight);
}

function linkKey(link) {
  const s = typeof link.source === 'object' ? link.source.id : link.source;
  const t = typeof link.target === 'object' ? link.target.id : link.target;
  return `${s}→${t}`;
}

function setStatus(message) {
  if (statusElement) {
    statusElement.textContent = message;
  }
}

function highlightNeighbourhood(nodeId) {
  const source = currentDisplayed || graphData;
  highlightNodes = new Set([nodeId]);
  highlightLinks = new Set();

  for (const link of source.links) {
    const s = typeof link.source === 'object' ? link.source.id : link.source;
    const t = typeof link.target === 'object' ? link.target.id : link.target;
    if (s === nodeId || t === nodeId) {
      highlightLinks.add(linkKey(link));
      highlightNodes.add(s);
      highlightNodes.add(t);
    }
  }

  graph
    .nodeColor(graph.nodeColor())
    .linkColor(graph.linkColor())
    .linkWidth(graph.linkWidth())
    .linkDirectionalParticles(graph.linkDirectionalParticles());
}

function highlightLink(link) {
  highlightNodes = new Set();
  highlightLinks = new Set([linkKey(link)]);

  const s = typeof link.source === 'object' ? link.source.id : link.source;
  const t = typeof link.target === 'object' ? link.target.id : link.target;
  highlightNodes.add(s);
  highlightNodes.add(t);

  graph
    .nodeColor(graph.nodeColor())
    .linkColor(graph.linkColor())
    .linkWidth(graph.linkWidth())
    .linkDirectionalParticles(graph.linkDirectionalParticles());
}

function clearSelection() {
  selectedId = null;
  highlightNodes = new Set();
  highlightLinks = new Set();

  graph
    .nodeColor(graph.nodeColor())
    .linkColor(graph.linkColor())
    .linkWidth(graph.linkWidth())
    .linkDirectionalParticles(graph.linkDirectionalParticles());

  closePanel();
}

function openPanel() {
  panel.classList.add('open');
  graphElement.classList.add('panel-open');
  // give graph a moment then resize
  setTimeout(() => graph.width(graphElement.offsetWidth), 310);
}

function closePanel() {
  panel.classList.remove('open');
  graphElement.classList.remove('panel-open');
  setTimeout(() => graph.width(graphElement.offsetWidth), 310);
}

panelClose.addEventListener('click', clearSelection);

function setBadge(type) {
  panelBadge.textContent = type.toUpperCase();
  panelBadge.className = `panel-type-badge badge-${type}`;
}

function fmt(val) {
  if (val === null || val === undefined || val === '') return null;
  return String(val);
}

function fmtCurrency(val) {
  if (!val) return null;
  const n = Number(val);
  if (isNaN(n)) return String(val);
  return '€ ' + n.toLocaleString('en-EU', { maximumFractionDigits: 0 });
}

function fmtDate(val) {
  if (!val) return null;
  // CORDIS dates come as strings like "2021-01-01"
  return String(val).replace('T00:00:00', '');
}

function row(key, value, cls = '') {
  if (!value && value !== 0) return '';
  return `<div class="field-row">
    <span class="field-key">${key}</span>
    <span class="field-val${cls ? ' ' + cls : ''}">${value}</span>
  </div>`;
}

function section(title, content) {
  if (!content.trim()) return '';
  return `<div class="panel-section">
    <div class="panel-section-title">${title}</div>
    ${content}
  </div>`;
}

// Deterministic hash -> uint32
function hashStringToUint32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
  }
  return h >>> 0;
}

function sampleProjectIds(nodes, pct, seed = 42) {
  const projects = nodes.filter((n) => n.type === 'project');
  const selected = new Set();
  const threshold = pct / 100;
  let bestProject = null;
  let bestHash = Number.POSITIVE_INFINITY;

  projects.forEach((p) => {
    const h = hashStringToUint32(`${p.id}:${seed}`);
    const r = h / 4294967295; // [0,1]
    if (h < bestHash) {
      bestHash = h;
      bestProject = p.id;
    }
    if (r < threshold) selected.add(p.id);
  });

  if (selected.size === 0 && bestProject) {
    selected.add(bestProject);
  }

  return selected;
}

function buildSampledGraph(data, pct, seed = 42) {
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

  const nodes = data.nodes.filter((node) => connectedNodeIds.has(node.id));
  return { nodes, links, sampled: true, pct, seed };
}

function getCurrentSamplePct() {
  if (!sampleSlider) return 1;
  return Math.max(1, parseInt(sampleSlider.value, 10) || 1);
}

function getLinkKind(link) {
  if (link.role === 'organization' || link.role === 'org')
    return 'organization';
  if (link.role === 'topic') return 'topic';

  const sourceType = link.source && link.source.type ? link.source.type : null;
  const targetType = link.target && link.target.type ? link.target.type : null;

  if (sourceType === 'organization' || targetType === 'organization') {
    return 'organization';
  }
  if (sourceType === 'topic' || targetType === 'topic') {
    return 'topic';
  }

  return 'topic';
}

function getLinkWeightMultiplier(link) {
  const kind = getLinkKind(link);
  return linkWeightState[kind] || 1;
}

function filterGraphByText(data, text) {
  if (!text) return data;
  const q = text.toLowerCase();

  const keepNodeIds = new Set(
    data.nodes
      .filter((n) => (n.label || '').toLowerCase().includes(q))
      .map((n) => n.id),
  );

  // Keep nodes that match or are connected to matching nodes
  const links = data.links.filter((link) => {
    const sourceId =
      typeof link.source === 'object' ? link.source.id : link.source;
    const targetId =
      typeof link.target === 'object' ? link.target.id : link.target;
    if (keepNodeIds.has(sourceId) || keepNodeIds.has(targetId)) {
      keepNodeIds.add(sourceId);
      keepNodeIds.add(targetId);
      return true;
    }
    return false;
  });

  const nodes = data.nodes.filter((n) => keepNodeIds.has(n.id));
  return { nodes, links };
}

function applyCurrentFilters() {
  const q =
    filterTextElement && filterTextElement.value
      ? filterTextElement.value.trim()
      : '';
  const usingPreview = !(previewToggleElement && !previewToggleElement.checked);

  if (usingPreview && fullData) {
    const sampled = buildSampledGraph(fullData, getCurrentSamplePct(), 42);
    currentFiltered = q ? filterGraphByText(sampled, q) : sampled;
  } else if (!usingPreview && fullData) {
    currentFiltered = q ? filterGraphByText(fullData, q) : fullData;
  } else {
    currentFiltered = { nodes: [], links: [] };
  }

  renderCurrentGraph();
  if (currentFiltered && currentFiltered.nodes) {
    setStatus(
      `Showing ${currentFiltered.nodes.length} nodes, ${currentFiltered.links.length} links${usingPreview ? ` (preview ${getCurrentSamplePct()}%)` : ''}`,
    );
  }
}

function applyGraphForces() {
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

// async function loadGraph() {
//   try {
//     setStatus('Loading graph data...');
//     const controller = new AbortController();
//     const timeoutId = setTimeout(() => controller.abort(), 30000);
//     const response = await fetch('/api/graph', {
//       cache: 'no-store',
//       signal: controller.signal,
//     });
//     clearTimeout(timeoutId);

//     if (!response.ok) {
//       throw new Error(`Request failed with status ${response.status}`);
//     }

//     const data = await response.json();
//     fullData = data;

//     // load any saved pinned nodes so they can be applied to views
//     loadPinnedNodesFromStorage();
//     loadCollapsedClustersFromStorage();

//     graph
//       .graphData(buildSampledGraph(data, getCurrentSamplePct(), 42))
//       .nodeId('id')
//       .nodeColor((node) => node.color || '#4a9eff')
//       .d3Force('charge')
//       .strength(-80);

//     applyGraphForces();
//     startParticleDebugLog();

//     // initial filtered view
//     applyCurrentFilters();
//   } catch (err) {
//     if (err && err.name === 'AbortError') {
//       console.error('Graph load timed out after 30 seconds');
//       setStatus('Graph load timed out');
//       graph.graphData({ nodes: [], links: [] });
//       return;
//     }

//     console.error('Failed to load graph data:', err);
//     setStatus('Failed to load graph data');
//     graph.graphData({ nodes: [], links: [] });
//   }
// }

async function loadGraph() {
  try {
    setStatus('Loading…');
    const res = await fetch('/api/graph', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    fullData = data;
    graphData = data; // keep graphData in sync for highlight/count helpers

    loadPinnedNodesFromStorage();
    loadCollapsedClustersFromStorage();

    graph
      .nodeId('id')
      .nodeColor((node) => node.color || '#4a9eff')
      .d3Force('charge')
      .strength(-80);

    applyCurrentFilters(); // this calls renderCurrentGraph() which calls graph.graphData()
    applyGraphForces();
  } catch (err) {
    console.error('Failed to load graph:', err);
    setStatus('Failed to load');
    graph.graphData({ nodes: [], links: [] });
  }
}

window.addEventListener('resize', resizeGraph);
resize();
loadGraph();

// Debounce helper
function debounce(fn, wait = 250) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

// Wire UI controls
if (filterTextElement) {
  filterTextElement.addEventListener(
    'input',
    debounce(() => {
      applyCurrentFilters();
    }, 300),
  );
}

// Sampling UI wiring
if (sampleSlider && sampleValue) {
  sampleValue.textContent = `${sampleSlider.value}%`;
  sampleSlider.addEventListener('input', () => {
    sampleValue.textContent = `${sampleSlider.value}%`;
  });
}

function applySampledView(pct, seed = 42) {
  if (!fullData) {
    setStatus('Data not loaded yet');
    return;
  }
  setStatus(`Sampling ${pct}% (seed ${seed})...`);
  const sampled = buildSampledGraph(fullData, pct, seed);
  const q =
    filterTextElement && filterTextElement.value
      ? filterTextElement.value.trim()
      : '';
  currentFiltered = q ? filterGraphByText(sampled, q) : sampled;
  renderCurrentGraph();
  setStatus(
    `Sample ${pct}%: ${currentFiltered.nodes.length} nodes, ${currentFiltered.links.length} links`,
  );
}

if (applySampleBtn) {
  applySampleBtn.addEventListener('click', () => {
    const pct = parseInt(sampleSlider.value, 10) || 1;
    applySampledView(pct, 42);
  });
}

if (preset1)
  preset1.addEventListener('click', () => {
    sampleSlider.value = 1;
    sampleValue.textContent = '1%';
  });
if (preset5)
  preset5.addEventListener('click', () => {
    sampleSlider.value = 5;
    sampleValue.textContent = '5%';
  });
if (preset10)
  preset10.addEventListener('click', () => {
    sampleSlider.value = 10;
    sampleValue.textContent = '10%';
  });

if (previewToggleElement) {
  previewToggleElement.addEventListener('change', async (e) => {
    const checked = previewToggleElement.checked;
    if (!checked) {
      // user turned OFF preview -> full mode
      const ok = confirm(
        'Load full graph? This may be slow or unresponsive for very large datasets.',
      );
      if (!ok) {
        previewToggleElement.checked = true;
        return;
      }
    }

    // apply filters for the chosen mode
    applyCurrentFilters();
  });
}

function applyLinkWeights() {
  if (orgLinkWeightElement && orgLinkWeightValueElement) {
    const value = parseFloat(orgLinkWeightElement.value) || 1.3;
    linkWeightState.organization = value;
    orgLinkWeightValueElement.textContent = value.toFixed(1);
  }
  if (topicLinkWeightElement && topicLinkWeightValueElement) {
    const value = parseFloat(topicLinkWeightElement.value) || 1.0;
    linkWeightState.topic = value;
    topicLinkWeightValueElement.textContent = value.toFixed(1);
  }

  if (currentFiltered) {
    renderCurrentGraph();
  }
}

if (orgLinkWeightElement) {
  orgLinkWeightElement.addEventListener('input', applyLinkWeights);
}

if (topicLinkWeightElement) {
  topicLinkWeightElement.addEventListener('input', applyLinkWeights);
}

applyLinkWeights();

if (pinModeBtn) {
  pinModeBtn.addEventListener('click', () => {
    setInteractionMode('pin');
    setStatus('Pin mode active');
  });
}

if (clusterModeBtn) {
  clusterModeBtn.addEventListener('click', () => {
    setInteractionMode('cluster');
    setStatus('Cluster mode active');
  });
}

setInteractionMode('pin');

// Particle UI wiring
function applyParticleSettings() {
  if (particleCountMultElement && particleCountMultValue) {
    const v = parseFloat(particleCountMultElement.value) || 1;
    particleState.countMult = v;
  }
  if (particleSpeedMultElement && particleSpeedMultValue) {
    const v = parseFloat(particleSpeedMultElement.value) || 0.01;
    particleState.speedMult = v;
  }

  updateParticleLabels();
  graph.refresh();
}

if (particleCountMultElement)
  particleCountMultElement.addEventListener('input', applyParticleSettings);
if (particleSpeedMultElement)
  particleSpeedMultElement.addEventListener('input', applyParticleSettings);

applyParticleSettings();

// Layout controls
if (saveLayoutBtn) {
  saveLayoutBtn.addEventListener('click', () => {
    syncPinnedPositionsFromVisibleGraph();
    saveLayoutState();
    setStatus('Layout saved with pins and cluster state');
  });
}

if (clearPinsBtn) {
  clearPinsBtn.addEventListener('click', () => {
    if (confirm('Clear all pinned nodes?')) {
      clearAllPins();
      setStatus('Cleared pinned nodes');
    }
  });
}

if (resetClustersBtn) {
  resetClustersBtn.addEventListener('click', () => {
    if (collapsedClusters.size === 0) {
      setStatus('No collapsed clusters to expand');
      return;
    }

    resetClusterState();
    setStatus('Expanded all clusters');
  });
}

function renderProject(data) {
  const statusClass =
    data.status === 'SIGNED' ? 'status-SIGNED' : 'status-default';
  const statusPill = data.status
    ? `<span class="status-pill ${statusClass}">${data.status}</span>`
    : '';

  const keywords = data.keywords
    ? data.keywords
        .split(';')
        .map((k) => k.trim())
        .filter(Boolean)
    : [];
  const keywordHtml = keywords.length
    ? `<div class="keywords">${keywords.map((k) => `<span class="keyword-pill">${k}</span>`).join('')}</div>`
    : '';

  const info = [
    row('Status', statusPill),
    row('Acronym', fmt(data.acronym), 'mono'),
    row('Start', fmtDate(data.startDate)),
    row('End', fmtDate(data.endDate)),
    row('Scheme', fmt(data.fundingScheme)),
  ].join('');

  const funding = [
    row(
      'Total cost',
      `<span class="cost-val">${fmtCurrency(data.totalCost)}</span>`,
    ),
    row(
      'EC contribution',
      `<span class="cost-val">${fmtCurrency(data.ecMaxContribution)}</span>`,
    ),
  ].join('');

  const objectiveHtml = data.objective
    ? `<div class="panel-section">
        <div class="panel-section-title">Objective</div>
        <div class="objective-text">${data.objective}</div>
       </div>`
    : '';

  const kwHtml = keywordHtml
    ? `<div class="panel-section">
        <div class="panel-section-title">Keywords</div>
        ${keywordHtml}
       </div>`
    : '';

  return (
    section('Details', info) +
    section('Funding', funding) +
    objectiveHtml +
    kwHtml
  );
}

function renderOrganization(data) {
  const urlHtml = data.url
    ? `<a href="${data.url}" target="_blank" rel="noopener">${data.url}</a>`
    : null;

  const info = [
    row('Full name', fmt(data.name)),
    row('Activity', fmt(data.activityType)),
    row('Country', fmt(data.country)),
    row('City', fmt(data.city)),
    row('VAT', fmt(data.vatNumber), 'mono'),
    row('Website', urlHtml),
  ].join('');

  return section('Details', info);
}

function renderTopic(data) {
  const info = [
    row('Code', fmt(data.topic), 'mono'),
    row('Title', fmt(data.title)),
  ].join('');

  return section('Details', info);
}

function renderLinkPanel(link, sourceNode, targetNode) {
  const s = sourceNode
    ? sourceNode.label
    : typeof link.source === 'object'
      ? link.source.id
      : link.source;
  const t = targetNode
    ? targetNode.label
    : typeof link.target === 'object'
      ? link.target.id
      : link.target;

  const info = [
    row('From', fmt(s)),
    row('To', fmt(t)),
    row('Role', fmt(link.role)),
    row('Weight', fmt(link.weight)),
  ].join('');

  return section('Relationship', info);
}

function countConnections(nodeId) {
  const source = currentDisplayed || graphData;
  let count = 0;
  for (const link of source.links) {
    const s = typeof link.source === 'object' ? link.source.id : link.source;
    const t = typeof link.target === 'object' ? link.target.id : link.target;
    if (s === nodeId || t === nodeId) count++;
  }
  return count;
}

function handleNodeClick(node, event) {
  if (!node) return;

  // cluster mode or shift+click on collapsible node
  if (
    interactionMode === 'cluster' ||
    (event && event.shiftKey && isCollapsibleClusterNode(node))
  ) {
    toggleClusterCollapse(node);
    return;
  }

  // pin mode
  if (interactionMode === 'pin') {
    togglePin(node);
  }

  // always open the detail panel
  selectedId = node.id;
  highlightNeighbourhood(node.id);
  const data = node.data || {};
  const conns = countConnections(node.id);
  setBadge(node.type);
  panelTitle.textContent = node.label || node.id;
  const connChip = `<div class="conn-chip">Connections <span>${conns}</span></div>`;
  let content = connChip;
  if (node.type === 'project') content += renderProject(data);
  else if (node.type === 'organization') content += renderOrganization(data);
  else if (node.type === 'topic') content += renderTopic(data);
  panelBody.innerHTML =
    content || '<div class="empty-state">No details available.</div>';
  openPanel();
}

function handleLinkClick(link) {
  if (!link) return;
  highlightLink(link);

  const nodeMap = Object.fromEntries(graphData.nodes.map((n) => [n.id, n]));
  const s = typeof link.source === 'object' ? link.source.id : link.source;
  const t = typeof link.target === 'object' ? link.target.id : link.target;

  setBadge('link');
  panelTitle.textContent = `${nodeMap[s]?.label || s}  →  ${nodeMap[t]?.label || t}`;
  panelBody.innerHTML = renderLinkPanel(link, nodeMap[s], nodeMap[t]);
  openPanel();
}

function handleNodeHover(node, prevNode) {
  graphElement.style.cursor = node ? 'pointer' : 'default';

  if (!node) {
    tooltip.classList.remove('visible');
    return;
  }

  const data = node.data || {};
  let sub = '';
  if (node.type === 'project') {
    sub = [data.acronym, data.status, data.fundingScheme]
      .filter(Boolean)
      .join(' · ');
  } else if (node.type === 'organization') {
    sub = [data.activityType, data.country].filter(Boolean).join(' · ');
  } else if (node.type === 'topic') {
    sub = data.topic || '';
  }

  tooltip.innerHTML = `<div>${node.label || node.id}</div>${sub ? `<div class="tt-sub">${sub}</div>` : ''}`;
  tooltip.classList.add('visible');
}

function handleLinkHover(link) {
  graphElement.style.cursor = link ? 'pointer' : 'default';

  if (!link) {
    tooltip.classList.remove('visible');
    return;
  }

  const nodeMap = Object.fromEntries(graphData.nodes.map((n) => [n.id, n]));
  const s = typeof link.source === 'object' ? link.source.id : link.source;
  const t = typeof link.target === 'object' ? link.target.id : link.target;
  const sLabel = nodeMap[s]?.label || s;
  const tLabel = nodeMap[t]?.label || t;

  tooltip.innerHTML = `<div>${sLabel} → ${tLabel}</div>${link.role ? `<div class="tt-sub">${link.role}</div>` : ''}`;
  tooltip.classList.add('visible');
}
