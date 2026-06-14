export const PREVIEW_PROJECT_LIMIT = 250;
export const PIN_STORAGE_KEY = 'graphPinnedNodes_v1';
export const CLUSTER_STORAGE_KEY = 'graphCollapsedClusters_v1';
export const pinnedGlowColor = '#ffd166';

export const filterState = {
  text: '',
  status: '', // '' | 'SIGNED' | 'other'
  scheme: '', // substring match on fundingScheme
  yearMin: null,
  yearMax: null,
  country: '', // substring match on organization.country / city
  nodeTypes: { project: true, organization: true, topic: true },
};

export const linkWeightState = {
  organization: 1.3,
  topic: 1.0,
};

export const particleState = {
  countMult: 1,
  speedMult: 1,
};

// collections that are mutated in place
export const pinnedPositions = new Map();
export const collapsedClusters = new Set();

// Mutable references are wrapped in one object so any module can reassign them via refs.x = ...
// (ES module exports are live bindings but can't be reassigned from outside)

export const refs = {
  graphData: { nodes: [], links: [] },
  selectedId: null,
  highlightNodes: new Set(),
  highlightLinks: new Set(),
  interactionMode: 'pin',
  fullData: null,
  currentFiltered: null,
  currentDisplayed: null,
};
