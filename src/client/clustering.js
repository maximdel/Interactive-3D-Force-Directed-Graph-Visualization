import { collapsedClusters } from './state.js';

export function isCollapsibleClusterNode(node) {
  return node && (node.type === 'organization' || node.type === 'topic');
}

// Graph transformation

/**
 * Collapse any nodes in `collapsedClusters` by hiding their connected project nodes and aggregating the resulting links.
 */
export function buildClusteredGraph(data) {
  if (!data?.nodes || !data?.links) return { nodes: [], links: [] };
  if (collapsedClusters.size === 0)
    return { nodes: data.nodes, links: data.links };

  const nodeById = new Map(data.nodes.map((n) => [n.id, n]));
  const hiddenProjectIds = new Set();
  const projectMemberships = new Map(); // projectId → Set<clusterId>
  const clusterMemberCounts = new Map(); // clusterId → Set<projectId>

  function addMembership(projectId, clusterId) {
    if (!projectMemberships.has(projectId))
      projectMemberships.set(projectId, new Set());
    if (!clusterMemberCounts.has(clusterId))
      clusterMemberCounts.set(clusterId, new Set());
    projectMemberships.get(projectId).add(clusterId);
    clusterMemberCounts.get(clusterId).add(projectId);
  }

  // First pass: identify which projects are hidden
  data.links.forEach((link) => {
    const s = typeof link.source === 'object' ? link.source.id : link.source;
    const t = typeof link.target === 'object' ? link.target.id : link.target;
    const sn = nodeById.get(s);
    const tn = nodeById.get(t);
    if (sn?.type === 'project' && collapsedClusters.has(t)) {
      hiddenProjectIds.add(s);
      addMembership(s, t);
    }
    if (tn?.type === 'project' && collapsedClusters.has(s)) {
      hiddenProjectIds.add(t);
      addMembership(t, s);
    }
  });

  const visibleNodes = data.nodes
    .filter((n) => n.type !== 'project' || !hiddenProjectIds.has(n.id))
    .map((n) => ({
      ...n,
      collapsedCluster: collapsedClusters.has(n.id),
      clusterMemberCount: clusterMemberCounts.get(n.id)?.size ?? 0,
    }));

  const visibleIds = new Set(visibleNodes.map((n) => n.id));
  const aggregatedLinks = new Map();

  function addAggLink(s, t, link) {
    if (s === t) return;
    const key = s < t ? `${s}::${t}` : `${t}::${s}`;
    const ex = aggregatedLinks.get(key);
    if (ex) ex.weight += link.weight || 1;
    else
      aggregatedLinks.set(key, {
        source: s,
        target: t,
        weight: link.weight || 1,
        role: 'cluster',
      });
  }

  // build aggregated link list
  data.links.forEach((link) => {
    const s = typeof link.source === 'object' ? link.source.id : link.source;
    const t = typeof link.target === 'object' ? link.target.id : link.target;
    const sh = hiddenProjectIds.has(s);
    const th = hiddenProjectIds.has(t);

    if (!sh && !th) {
      if (visibleIds.has(s) && visibleIds.has(t)) {
        const key = s < t ? `${s}::${t}` : `${t}::${s}`;
        aggregatedLinks.set(key, { ...link });
      }
      return;
    }

    const hiddenId = sh ? s : t;
    const neighborId = sh ? t : s;
    const memberships = projectMemberships.get(hiddenId);
    if (!memberships) return;
    memberships.forEach((cid) => {
      if (neighborId !== cid) addAggLink(cid, neighborId, link);
    });
  });

  return { nodes: visibleNodes, links: Array.from(aggregatedLinks.values()) };
}
