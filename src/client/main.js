const graphElement = document.getElementById('graph');
const statusElement = document.getElementById('status');
const PREVIEW_PROJECT_LIMIT = 250;

const graph = ForceGraph3D({ controlType: 'orbit' })(graphElement)
  .backgroundColor('#0d1117')
  .nodeLabel('label')
  .linkColor(() => 'rgba(255, 255, 255, 0.35)')
  .linkOpacity(0.45)
  .nodeOpacity(0.95)
  .nodeRelSize(5)
  .nodeResolution(8)
  .enableNodeDrag(true);

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
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    const keep = allowedProjectIds.has(sourceId) || allowedProjectIds.has(targetId);

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

async function loadGraph() {
  try {
    setStatus('Loading graph data...');
    const response = await fetch('/api/graph');

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();
    const previewData = buildPreviewGraph(data);

    graph
      .graphData(previewData)
      .nodeId('id')
      .nodeColor((node) => node.color || '#4a9eff')
      .linkWidth((link) => Math.max(0.75, Math.min(2, link.weight || 1)))
      .linkDirectionalParticles(0)
      .d3Force('charge')
      .strength(-80);

    if (previewData.preview) {
      setStatus(
        `Preview mode: ${previewData.nodes.length} nodes, ${previewData.links.length} links shown from ${data.nodes.length} nodes`,
      );
    } else {
      setStatus(`${data.nodes.length} nodes, ${data.links.length} links`);
    }
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
