const graph = ForceGraph3D()(document.getElementById('graph'));

fetch('/api/graph')
  .then((res) => res.json())
  .then((data) => {
    graph
      .graphData(data)
      .nodeLabel('label')
      .nodeColor(() => '#4a9eff')
      .linkColor(() => '#ffffff');
  })
  .catch((err) => {
    console.error('Failed to load graph data:', err);
  });
