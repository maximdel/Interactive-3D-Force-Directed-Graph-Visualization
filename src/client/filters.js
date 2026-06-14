import {
  activeFiltersElement,
  countryFilterElement,
  filterTextElement,
  previewToggleElement,
  schemeFilterElement,
  showOrganizationsElement,
  showProjectsElement,
  showTopicsElement,
  statusFilterElement,
  yearMaxElement,
  yearMinElement,
} from './dom.js';
import { renderCurrentGraph, resizeGraph } from './graph.js';
import { buildSampledGraph, getCurrentSamplePct } from './sampling.js';
import { filterState, refs } from './state.js';
import { setStatus } from './utils.js';

// filter algorithm

// 1. Remove nodes of hidden types (always).
// 2. Find seed nodes that pass every active dimension filter for their type.
//      Types with no active filter are never seeds
// 3. One-hop expansion: for each link, if either endpoint is a seed, include
//      both endpoints.
// 4. Return the resulting node + link subset.

export function applyAllFilters(data) {
  if (!data) return { nodes: [], links: [] };

  const visible = data.nodes.filter((n) => filterState.nodeTypes[n.type]);
  const visibleIds = new Set(visible.map((n) => n.id));

  const q = (filterState.text || '').toLowerCase();
  const country = (filterState.country || '').toLowerCase();
  const scheme = (filterState.scheme || '').toLowerCase();

  const hasText = !!q;
  const hasProject = !!(
    filterState.status ||
    scheme ||
    filterState.yearMin ||
    filterState.yearMax
  );
  const hasOrg = !!country;
  const hasAny = hasText || hasProject || hasOrg;

  if (!hasAny) {
    return {
      nodes: visible,
      links: data.links.filter((l) => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        return visibleIds.has(s) && visibleIds.has(t);
      }),
    };
  }

  const seedIds = new Set();

  visible.forEach((node) => {
    const d = node.data || {};

    if (node.type === 'project') {
      if (!hasProject && !hasText) return;
      if (hasProject) {
        if (filterState.status === 'SIGNED' && d.status !== 'SIGNED') return;
        if (filterState.status === 'other' && d.status === 'SIGNED') return;
        if (scheme && !(d.fundingScheme || '').toLowerCase().includes(scheme))
          return;
        if (filterState.yearMin || filterState.yearMax) {
          const yr = d.startDate
            ? parseInt(String(d.startDate).slice(0, 4))
            : null;
          if (!yr) return;
          if (filterState.yearMin && yr < filterState.yearMin) return;
          if (filterState.yearMax && yr > filterState.yearMax) return;
        }
      }
      if (hasText) {
        const hit =
          (node.label || '').toLowerCase().includes(q) ||
          (d.objective || '').toLowerCase().includes(q) ||
          (d.keywords || '').toLowerCase().includes(q);
        if (!hit) return;
      }
      seedIds.add(node.id);
    } else if (node.type === 'organization') {
      if (!hasOrg && !hasText) return;
      if (hasOrg) {
        const c = (d.country || '').toLowerCase();
        const ci = (d.city || '').toLowerCase();
        if (!c.includes(country) && !ci.includes(country)) return;
      }
      if (hasText) {
        const hit =
          (node.label || '').toLowerCase().includes(q) ||
          (d.country || '').toLowerCase().includes(q) ||
          (d.city || '').toLowerCase().includes(q);
        if (!hit) return;
      }
      seedIds.add(node.id);
    } else if (node.type === 'topic') {
      if (!hasText) return;
      if (!(node.label || '').toLowerCase().includes(q)) return;
      seedIds.add(node.id);
    }
  });

  // One-hop expansion
  const keepIds = new Set(seedIds);
  data.links.forEach((link) => {
    const s = typeof link.source === 'object' ? link.source.id : link.source;
    const t = typeof link.target === 'object' ? link.target.id : link.target;
    if (!visibleIds.has(s) || !visibleIds.has(t)) return;
    if (seedIds.has(s)) keepIds.add(t);
    if (seedIds.has(t)) keepIds.add(s);
  });

  const finalNodes = visible.filter((n) => keepIds.has(n.id));
  const finalIds = new Set(finalNodes.map((n) => n.id));
  const finalLinks = data.links.filter((l) => {
    const s = typeof l.source === 'object' ? l.source.id : l.source;
    const t = typeof l.target === 'object' ? l.target.id : l.target;
    return finalIds.has(s) && finalIds.has(t);
  });

  return { nodes: finalNodes, links: finalLinks };
}

export function populateFilterOptions(data) {
  const countries = new Set();
  const schemes = new Set();

  data.nodes.forEach((n) => {
    if (!n.data) return;
    if (n.type === 'organization' && n.data.country)
      countries.add(n.data.country);
    if (n.type === 'project' && n.data.fundingScheme)
      schemes.add(n.data.fundingScheme);
  });

  const countryList = document.getElementById('countryList');
  if (countryList)
    countryList.innerHTML = Array.from(countries)
      .sort()
      .map((c) => `<option value="${c}">`)
      .join('');

  const schemeList = document.getElementById('schemeList');
  if (schemeList)
    schemeList.innerHTML = Array.from(schemes)
      .sort()
      .map((s) => `<option value="${s}">`)
      .join('');
}

export function getActiveChips() {
  const chips = [];
  const typeLabels = {
    project: 'Projects',
    organization: 'Orgs',
    topic: 'Topics',
  };

  if (filterState.text)
    chips.push({
      group: 'Search',
      label: `"${filterState.text}"`,
      clear() {
        filterState.text = '';
        if (filterTextElement) filterTextElement.value = '';
      },
    });

  if (filterState.status)
    chips.push({
      group: 'Status',
      label: filterState.status === 'other' ? 'Not SIGNED' : filterState.status,
      clear() {
        filterState.status = '';
        if (statusFilterElement) statusFilterElement.value = '';
      },
    });

  if (filterState.scheme)
    chips.push({
      group: 'Scheme',
      label: filterState.scheme,
      clear() {
        filterState.scheme = '';
        if (schemeFilterElement) schemeFilterElement.value = '';
      },
    });

  if (filterState.yearMin)
    chips.push({
      group: 'Year',
      label: `≥ ${filterState.yearMin}`,
      clear() {
        filterState.yearMin = null;
        if (yearMinElement) yearMinElement.value = '';
      },
    });

  if (filterState.yearMax)
    chips.push({
      group: 'Year',
      label: `≤ ${filterState.yearMax}`,
      clear() {
        filterState.yearMax = null;
        if (yearMaxElement) yearMaxElement.value = '';
      },
    });

  if (filterState.country)
    chips.push({
      group: 'Country',
      label: filterState.country,
      clear() {
        filterState.country = '';
        if (countryFilterElement) countryFilterElement.value = '';
      },
    });

  Object.entries(filterState.nodeTypes).forEach(([type, visible]) => {
    if (!visible)
      chips.push({
        group: 'Hidden',
        label: typeLabels[type],
        clear() {
          filterState.nodeTypes[type] = true;
          const el = {
            project: showProjectsElement,
            organization: showOrganizationsElement,
            topic: showTopicsElement,
          }[type];
          if (el) el.checked = true;
        },
      });
  });

  return chips;
}

export function renderFilterChips() {
  if (!activeFiltersElement) return;
  const chips = getActiveChips();

  if (chips.length === 0) {
    activeFiltersElement.innerHTML = '';
    activeFiltersElement.classList.remove('has-chips');
    resizeGraph();
    return;
  }

  activeFiltersElement.classList.add('has-chips');
  activeFiltersElement.innerHTML =
    chips
      .map(
        (chip, i) =>
          `<span class="filter-chip">
        <span class="chip-group">${chip.group}</span>
        <span class="chip-label">${chip.label}</span>
        <button class="chip-remove" data-index="${i}" aria-label="Remove">×</button>
      </span>`,
      )
      .join('') +
    (chips.length > 1
      ? `<button class="filter-chip filter-chip--clear-all">Clear all</button>`
      : '');

  activeFiltersElement.querySelectorAll('.chip-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      chips[parseInt(btn.dataset.index, 10)].clear();
      applyCurrentFilters();
    });
  });

  const clearAllBtn = activeFiltersElement.querySelector(
    '.filter-chip--clear-all',
  );
  if (clearAllBtn) clearAllBtn.addEventListener('click', clearAllFilters);

  resizeGraph();
}

export function clearAllFilters() {
  filterState.text = '';
  filterState.status = '';
  filterState.scheme = '';
  filterState.yearMin = null;
  filterState.yearMax = null;
  filterState.country = '';
  filterState.nodeTypes = { project: true, organization: true, topic: true };

  if (filterTextElement) filterTextElement.value = '';
  if (statusFilterElement) statusFilterElement.value = '';
  if (schemeFilterElement) schemeFilterElement.value = '';
  if (yearMinElement) yearMinElement.value = '';
  if (yearMaxElement) yearMaxElement.value = '';
  if (countryFilterElement) countryFilterElement.value = '';
  if (showProjectsElement) showProjectsElement.checked = true;
  if (showOrganizationsElement) showOrganizationsElement.checked = true;
  if (showTopicsElement) showTopicsElement.checked = true;

  applyCurrentFilters();
}

export function applyCurrentFilters() {
  const usingPreview = !(previewToggleElement && !previewToggleElement.checked);

  let base;
  if (usingPreview && refs.fullData)
    base = buildSampledGraph(refs.fullData, getCurrentSamplePct(), 42);
  else if (!usingPreview && refs.fullData) base = refs.fullData;
  else base = { nodes: [], links: [] };

  refs.currentFiltered = applyAllFilters(base);
  renderCurrentGraph();
  renderFilterChips();

  if (refs.currentFiltered?.nodes) {
    const preview = usingPreview ? ` (${getCurrentSamplePct()}% sample)` : '';
    setStatus(
      `${refs.currentFiltered.nodes.length} nodes, ${refs.currentFiltered.links.length} links${preview}`,
    );
  }
}
