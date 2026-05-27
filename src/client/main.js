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

const graph = ForceGraph3D({ controlType: 'orbit' })(graphElement)
  .backgroundColor('#0d1117')
  .nodeLabel('label')
  .linkColor(() => 'rgba(255, 255, 255, 0.35)')
  .linkOpacity(0.45)
  .nodeOpacity(0.95)
  .nodeRelSize(5)
  .nodeResolution(8)
  .enableNodeDrag(true);

let fullData = null;
let currentFiltered = null;
let particleDebugTimer = null;

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
    currentFiltered && Array.isArray(currentFiltered.links)
      ? currentFiltered.links.length
      : 0;
  const sampleLink =
    currentFiltered && Array.isArray(currentFiltered.links)
      ? currentFiltered.links[0]
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

  graph.graphData(currentFiltered);
  applyGraphForces();
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
    const response = await fetch('/api/graph');

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();
    fullData = data;

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
    console.error('Failed to load graph data:', err);
    setStatus('Failed to load graph data');
    graph.graphData({ nodes: [], links: [] });
  }
}

window.addEventListener('resize', () => {
  graph.width(window.innerWidth).height(window.innerHeight - 49);
});

graph.width(window.innerWidth).height(window.innerHeight - 49);
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
  graph.graphData(currentFiltered);
  setStatus(
    `Sample ${pct}%: ${currentFiltered.nodes.length} nodes, ${currentFiltered.links.length} links`,
  );
  applyGraphForces();
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
    graph.graphData(currentFiltered);
    applyGraphForces();
  }
}

if (orgLinkWeightElement) {
  orgLinkWeightElement.addEventListener('input', applyLinkWeights);
}

if (topicLinkWeightElement) {
  topicLinkWeightElement.addEventListener('input', applyLinkWeights);
}

applyLinkWeights();

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
