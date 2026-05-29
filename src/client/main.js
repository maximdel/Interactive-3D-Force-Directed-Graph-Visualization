const graphElement = document.getElementById('graph');
const statusElement = document.getElementById('status');
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

const linkWeightState = {
  organization: 1.3,
  topic: 1.0,
};

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
  .nodeLabel((node) => getNodeLabel(node))
  .linkColor(() => 'rgba(255, 255, 255, 0.35)')
  .linkOpacity(0.45)
  .nodeOpacity(0.95)
  .nodeRelSize(5)
  .nodeResolution(8)
  .nodeThreeObjectExtend(() => false)
  .nodeThreeObject(createPinnedGlowObject)
  .enableNodeDrag(true);

window.__graph = graph;

// plain click pins; shift-click collapses/expands clusters
graph.onNodeClick((node, event) => {
  try {
    if (
      interactionMode === 'cluster' ||
      (event && event.shiftKey && isCollapsibleClusterNode(node))
    ) {
      toggleClusterCollapse(node);
      return;
    }

    if (interactionMode === 'pin') {
      togglePin(node);
    }
  } catch (e) {
    console.warn('Pin toggle failed', e);
  }
});

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

function setStatus(message) {
  if (statusElement) {
    statusElement.textContent = message;
  }
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

async function loadGraph() {
  try {
    setStatus('Loading graph data...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const response = await fetch('/api/graph', {
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();
    fullData = data;

    // load any saved pinned nodes so they can be applied to views
    loadPinnedNodesFromStorage();
    loadCollapsedClustersFromStorage();

    graph
      .graphData(buildSampledGraph(data, getCurrentSamplePct(), 42))
      .nodeId('id')
      .nodeColor((node) => node.color || '#4a9eff')
      .d3Force('charge')
      .strength(-80);

    applyGraphForces();
    startParticleDebugLog();

    // initial filtered view
    applyCurrentFilters();
  } catch (err) {
    if (err && err.name === 'AbortError') {
      console.error('Graph load timed out after 30 seconds');
      setStatus('Graph load timed out');
      graph.graphData({ nodes: [], links: [] });
      return;
    }

    console.error('Failed to load graph data:', err);
    setStatus('Failed to load graph data');
    graph.graphData({ nodes: [], links: [] });
  }
}

window.addEventListener('resize', () => {
  resizeGraph();
});

resizeGraph();
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
