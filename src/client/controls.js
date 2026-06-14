import {
  clearAllPins,
  resetClusterState,
  setInteractionMode,
} from './actions.js';
import {
  applySampleBtn,
  clearPinsBtn,
  clusterModeBtn,
  inspectModeBtn,
  countryFilterElement,
  filterTextElement,
  orgLinkWeightElement,
  orgLinkWeightValueElement,
  particleCountMultElement,
  particleSpeedMultElement,
  pinModeBtn,
  preset1,
  preset10,
  preset5,
  previewToggleElement,
  resetClustersBtn,
  sampleSlider,
  sampleValueEl,
  saveLayoutBtn,
  schemeFilterElement,
  showOrganizationsElement,
  showProjectsElement,
  showTopicsElement,
  statusFilterElement,
  topicLinkWeightElement,
  topicLinkWeightValueElement,
  yearMaxElement,
  yearMinElement,
  depthToggleElement,
  depthFocalElement,
  depthWidthElement,
} from './dom.js';
import { applyCurrentFilters } from './filters.js';
import { applyDepthField, depthState } from './depth.js';
import { graph, renderCurrentGraph, updateParticleLabels } from './graph.js';
import { syncPinnedPositionsFromVisibleGraph } from './pins.js';
import { buildSampledGraph, filterGraphByText } from './sampling.js';
import {
  collapsedClusters,
  filterState,
  linkWeightState,
  particleState,
  refs,
} from './state.js';
import { saveLayoutState } from './storage.js';
import { debounce, setStatus } from './utils.js';

export function applyLinkWeights() {
  if (orgLinkWeightElement && orgLinkWeightValueElement) {
    const v = parseFloat(orgLinkWeightElement.value) || 1.3;
    linkWeightState.organization = v;
    orgLinkWeightValueElement.textContent = v.toFixed(1);
  }
  if (topicLinkWeightElement && topicLinkWeightValueElement) {
    const v = parseFloat(topicLinkWeightElement.value) || 1.0;
    linkWeightState.topic = v;
    topicLinkWeightValueElement.textContent = v.toFixed(1);
  }
  if (refs.currentFiltered) renderCurrentGraph();
}

export function applyParticleSettings() {
  if (particleCountMultElement)
    particleState.countMult = parseFloat(particleCountMultElement.value) || 1;
  if (particleSpeedMultElement)
    particleState.speedMult =
      parseFloat(particleSpeedMultElement.value) || 0.01;
  updateParticleLabels();
  graph.refresh();
}

export function applySampledView(pct, seed = 42) {
  if (!refs.fullData) {
    setStatus('Data not loaded yet');
    return;
  }
  setStatus(`Sampling ${pct}% (seed ${seed})…`);
  const sampled = buildSampledGraph(refs.fullData, pct, seed);
  const q = filterTextElement?.value?.trim() ?? '';
  refs.currentFiltered = q ? filterGraphByText(sampled, q) : sampled;
  renderCurrentGraph();
  setStatus(
    `Sample ${pct}%: ${refs.currentFiltered.nodes.length} nodes, ${refs.currentFiltered.links.length} links`,
  );
}

if (filterTextElement)
  filterTextElement.addEventListener(
    'input',
    debounce(() => applyCurrentFilters(), 300),
  );

if (previewToggleElement) {
  previewToggleElement.addEventListener('change', () => {
    if (!previewToggleElement.checked) {
      const ok = confirm(
        'Load full graph? This may be slow or unresponsive for very large datasets.',
      );
      if (!ok) {
        previewToggleElement.checked = true;
        return;
      }
    }
    applyCurrentFilters();
  });
}

if (sampleSlider && sampleValueEl) {
  sampleValueEl.textContent = `${sampleSlider.value}%`;
  sampleSlider.addEventListener('input', () => {
    sampleValueEl.textContent = `${sampleSlider.value}%`;
  });
}

if (applySampleBtn)
  applySampleBtn.addEventListener('click', () => {
    if (!refs.fullData) {
      setStatus('Data not loaded yet');
      return;
    }
    applyCurrentFilters();
  });

if (preset1)
  preset1.addEventListener('click', () => {
    sampleSlider.value = 1;
    sampleValueEl.textContent = '1%';
  });
if (preset5)
  preset5.addEventListener('click', () => {
    sampleSlider.value = 5;
    sampleValueEl.textContent = '5%';
  });
if (preset10)
  preset10.addEventListener('click', () => {
    sampleSlider.value = 10;
    sampleValueEl.textContent = '10%';
  });

// npde type checkboxes

if (showProjectsElement)
  showProjectsElement.addEventListener('change', () => {
    filterState.nodeTypes.project = showProjectsElement.checked;
    applyCurrentFilters();
  });
if (showOrganizationsElement)
  showOrganizationsElement.addEventListener('change', () => {
    filterState.nodeTypes.organization = showOrganizationsElement.checked;
    applyCurrentFilters();
  });
if (showTopicsElement)
  showTopicsElement.addEventListener('change', () => {
    filterState.nodeTypes.topic = showTopicsElement.checked;
    applyCurrentFilters();
  });

// project filters

if (statusFilterElement)
  statusFilterElement.addEventListener('change', () => {
    filterState.status = statusFilterElement.value;
    applyCurrentFilters();
  });

if (schemeFilterElement)
  schemeFilterElement.addEventListener(
    'input',
    debounce(() => {
      filterState.scheme = schemeFilterElement.value.trim();
      applyCurrentFilters();
    }, 300),
  );

if (yearMinElement)
  yearMinElement.addEventListener('change', () => {
    const v = parseInt(yearMinElement.value, 10);
    filterState.yearMin = isNaN(v) ? null : v;
    applyCurrentFilters();
  });

if (yearMaxElement)
  yearMaxElement.addEventListener('change', () => {
    const v = parseInt(yearMaxElement.value, 10);
    filterState.yearMax = isNaN(v) ? null : v;
    applyCurrentFilters();
  });

// org filters

if (countryFilterElement)
  countryFilterElement.addEventListener(
    'input',
    debounce(() => {
      filterState.country = countryFilterElement.value.trim();
      applyCurrentFilters();
    }, 300),
  );

if (orgLinkWeightElement)
  orgLinkWeightElement.addEventListener('input', applyLinkWeights);
if (topicLinkWeightElement)
  topicLinkWeightElement.addEventListener('input', applyLinkWeights);
applyLinkWeights();

if (particleCountMultElement)
  particleCountMultElement.addEventListener('input', applyParticleSettings);
if (particleSpeedMultElement)
  particleSpeedMultElement.addEventListener('input', applyParticleSettings);
applyParticleSettings();

if (inspectModeBtn)
  inspectModeBtn.addEventListener('click', () => {
    setInteractionMode('inspect');
    setStatus('Inspect mode active');
  });

if (pinModeBtn)
  pinModeBtn.addEventListener('click', () => {
    setInteractionMode('pin');
    setStatus('Pin mode active');
  });
if (clusterModeBtn)
  clusterModeBtn.addEventListener('click', () => {
    setInteractionMode('cluster');
    setStatus('Cluster mode active');
  });

setInteractionMode('inspect');

if (saveLayoutBtn)
  saveLayoutBtn.addEventListener('click', () => {
    syncPinnedPositionsFromVisibleGraph();
    saveLayoutState();
    setStatus('Layout saved with pins and cluster state');
  });

if (clearPinsBtn)
  clearPinsBtn.addEventListener('click', () => {
    if (confirm('Clear all pinned nodes?')) {
      clearAllPins();
      setStatus('Cleared pinned nodes');
    }
  });

if (resetClustersBtn)
  resetClustersBtn.addEventListener('click', () => {
    if (collapsedClusters.size === 0) {
      setStatus('No collapsed clusters to expand');
      return;
    }
    resetClusterState();
    setStatus('Expanded all clusters');
  });

// Depth field controls
function _applyDepthNow() {
  const nodes = refs.currentDisplayed?.nodes;
  if (nodes) applyDepthField(nodes);
}

if (depthToggleElement)
  depthToggleElement.addEventListener('change', () => {
    depthState.enabled = depthToggleElement.checked;
    _applyDepthNow();
  });

if (depthFocalElement)
  depthFocalElement.addEventListener('input', () => {
    depthState.focalPct = parseFloat(depthFocalElement.value);
    if (depthState.enabled) _applyDepthNow();
  });

if (depthWidthElement)
  depthWidthElement.addEventListener('input', () => {
    depthState.widthPct = parseFloat(depthWidthElement.value);
    if (depthState.enabled) _applyDepthNow();
  });
