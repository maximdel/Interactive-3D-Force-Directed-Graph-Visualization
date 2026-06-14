import {
  graphElement,
  panel,
  panelBadge,
  panelBody,
  panelTitle,
} from './dom.js';
import { resizeGraph } from './graph.js';
import { refs } from './state.js';

export function openPanel() {
  panel.classList.add('open');
  graphElement.classList.add('panel-open');
  setTimeout(() => resizeGraph(), 310);
}

export function closePanel() {
  panel.classList.remove('open');
  graphElement.classList.remove('panel-open');
  setTimeout(() => resizeGraph(), 310);
}

export function setBadge(type) {
  panelBadge.textContent = type.toUpperCase();
  panelBadge.className = `panel-type-badge badge-${type}`;
}

export function countConnections(nodeId) {
  const src = refs.currentDisplayed || refs.graphData;
  let count = 0;
  for (const link of src.links) {
    const s = typeof link.source === 'object' ? link.source.id : link.source;
    const t = typeof link.target === 'object' ? link.target.id : link.target;
    if (s === nodeId || t === nodeId) count++;
  }
  return count;
}

// HTML helpers (private)

function fmt(val) {
  if (val === null || val === undefined || val === '') return null;
  return String(val);
}

function fmtCurrency(val) {
  if (!val) return null;
  const n = Number(val);
  if (isNaN(n)) return String(val);
  return '€ ' + n.toLocaleString('en-EU', { maximumFractionDigits: 0 });
}

function fmtDate(val) {
  if (!val) return null;
  return String(val).replace('T00:00:00', '');
}

function row(key, value, cls = '') {
  if (!value && value !== 0) return '';
  return `<div class="field-row">
    <span class="field-key">${key}</span>
    <span class="field-val${cls ? ' ' + cls : ''}">${value}</span>
  </div>`;
}

function section(title, content) {
  if (!content.trim()) return '';
  return `<div class="panel-section">
    <div class="panel-section-title">${title}</div>
    ${content}
  </div>`;
}

export function renderProject(data) {
  const statusClass =
    data.status === 'SIGNED' ? 'status-SIGNED' : 'status-default';
  const statusPill = data.status
    ? `<span class="status-pill ${statusClass}">${data.status}</span>`
    : '';

  const keywords = data.keywords
    ? data.keywords
        .split(';')
        .map((k) => k.trim())
        .filter(Boolean)
    : [];
  const kwHtml = keywords.length
    ? `<div class="panel-section">
        <div class="panel-section-title">Keywords</div>
        <div class="keywords">
          ${keywords.map((k) => `<span class="keyword-pill">${k}</span>`).join('')}
        </div>
      </div>`
    : '';

  return (
    section(
      'Details',
      [
        row('Status', statusPill),
        row('Acronym', fmt(data.acronym), 'mono'),
        row('Start', fmtDate(data.startDate)),
        row('End', fmtDate(data.endDate)),
        row('Scheme', fmt(data.fundingScheme)),
      ].join(''),
    ) +
    section(
      'Funding',
      [
        row(
          'Total cost',
          `<span class="cost-val">${fmtCurrency(data.totalCost)}</span>`,
        ),
        row(
          'EC contribution',
          `<span class="cost-val">${fmtCurrency(data.ecMaxContribution)}</span>`,
        ),
      ].join(''),
    ) +
    (data.objective
      ? `<div class="panel-section">
           <div class="panel-section-title">Objective</div>
           <div class="objective-text">${data.objective}</div>
         </div>`
      : '') +
    kwHtml
  );
}

export function renderOrganization(data) {
  return section(
    'Details',
    [
      row('Full name', fmt(data.name)),
      row('Activity', fmt(data.activityType)),
      row('Country', fmt(data.country)),
      row('City', fmt(data.city)),
      row('VAT', fmt(data.vatNumber), 'mono'),
      row(
        'Website',
        data.url
          ? `<a href="${data.url}" target="_blank" rel="noopener">${data.url}</a>`
          : null,
      ),
    ].join(''),
  );
}

export function renderTopic(data) {
  return section(
    'Details',
    [row('Code', fmt(data.topic), 'mono'), row('Title', fmt(data.title))].join(
      '',
    ),
  );
}

export function renderLinkPanel(link, sNode, tNode) {
  const s =
    sNode?.label ??
    (typeof link.source === 'object' ? link.source.id : link.source);
  const t =
    tNode?.label ??
    (typeof link.target === 'object' ? link.target.id : link.target);
  return section(
    'Relationship',
    [
      row('From', fmt(s)),
      row('To', fmt(t)),
      row('Role', fmt(link.role)),
      row('Weight', fmt(link.weight)),
    ].join(''),
  );
}

// Panel body builder
/** Builds and injects the full HTML for a node into the panel body. */
export function renderNodePanel(node) {
  const d = node.data || {};
  const conns = countConnections(node.id);

  setBadge(node.type);
  panelTitle.textContent = node.label || node.id;

  let content = `<div class="conn-chip">Connections <span>${conns}</span></div>`;
  if (node.type === 'project') content += renderProject(d);
  else if (node.type === 'organization') content += renderOrganization(d);
  else if (node.type === 'topic') content += renderTopic(d);

  panelBody.innerHTML =
    content || '<div class="empty-state">No details available.</div>';
}

/** Builds and injects the full HTML for a link into the panel body. */
export function renderLinkPanelFull(link) {
  const nodeMap = Object.fromEntries(
    refs.graphData.nodes.map((n) => [n.id, n]),
  );
  const s = typeof link.source === 'object' ? link.source.id : link.source;
  const t = typeof link.target === 'object' ? link.target.id : link.target;

  setBadge('link');
  panelTitle.textContent = `${nodeMap[s]?.label || s}  →  ${nodeMap[t]?.label || t}`;
  panelBody.innerHTML = renderLinkPanel(link, nodeMap[s], nodeMap[t]);
}
