const graphElement = document.getElementById('graph');
const statusElement = document.getElementById('status');

const graph = ForceGraph3D({ controlType: 'orbit' })(graphElement)
  .backgroundColor('#0d1117')
  .nodeLabel('label')
  .linkColor(() => 'rgba(255, 255, 255, 0.35)')
  .linkOpacity(0.45)
  .nodeOpacity(0.95)
  .nodeRelSize(5)
  .enableNodeDrag(true);

function setStatus(message) {
  if (statusElement) {
    statusElement.textContent = message;
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

    graph
      .graphData(data)
      .nodeId('id')
      .nodeColor((node) => node.color || '#4a9eff')
      .linkWidth((link) => Math.max(1, link.weight || 1))
      .linkDirectionalParticles(0)
      .d3Force('charge').strength(-140);

    setStatus(`${data.nodes.length} nodes, ${data.links.length} links`);
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
