const graphElement = document.getElementById('graph');
const statusElement = document.getElementById('status');
const PREVIEW_PROJECT_LIMIT = 250;

// UI controls
const previewToggleElement = document.getElementById('previewToggle');
const filterTextElement = document.getElementById('filterText');

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
let previewData = null;
let currentFiltered = null;

function setStatus(message) {
  if (statusElement) {
    statusElement.textContent = message;
  }
}

function buildPreviewGraph(data) {
  const projectNodes = data.nodes.filter((node) => node.type === 'project');
  const allowedProjectIds = new Set(
    projectNodes.slice(0, PREVIEW_PROJECT_LIMIT).map((node) => node.id),
  );
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

  return {
    nodes,
    links,
    preview: true,
    projectCount: projectNodes.length,
  };
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

  if (usingPreview && previewData) {
    currentFiltered = q ? filterGraphByText(previewData, q) : previewData;
  } else if (!usingPreview && fullData) {
    currentFiltered = q ? filterGraphByText(fullData, q) : fullData;
  } else {
    currentFiltered = { nodes: [], links: [] };
  }

  graph.graphData(currentFiltered);
  if (currentFiltered && currentFiltered.nodes) {
    setStatus(
      `Showing ${currentFiltered.nodes.length} nodes, ${currentFiltered.links.length} links${usingPreview ? ' (preview)' : ''}`,
    );
  }
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
    previewData = buildPreviewGraph(data);

    graph
      .graphData(previewData)
      .nodeId('id')
      .nodeColor((node) => node.color || '#4a9eff')
      .linkWidth((link) => Math.max(0.75, Math.min(2, link.weight || 1)))
      .linkDirectionalParticles(0)
      .d3Force('charge')
      .strength(-80);

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
