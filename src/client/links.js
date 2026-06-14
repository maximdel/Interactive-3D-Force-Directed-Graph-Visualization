import { linkWeightState, particleState } from './state.js';

export function getLinkKind(link) {
  if (link.role === 'organization' || link.role === 'org')
    return 'organization';
  if (link.role === 'topic') return 'topic';
  const sourceType = link.source?.type ?? null;
  const targetType = link.target?.type ?? null;
  if (sourceType === 'organization' || targetType === 'organization')
    return 'organization';
  if (sourceType === 'topic' || targetType === 'topic') return 'topic';
  return 'topic';
}

export function getLinkVisualKind(link) {
  return getLinkKind(link) === 'organization' ? 'organization' : 'topic';
}

export function getLinkWeightMultiplier(link) {
  return linkWeightState[getLinkKind(link)] || 1;
}

export function getForceMultiplier(link) {
  return 0.8 * getLinkWeightMultiplier(link);
}

export function getParticleColor(link) {
  return getLinkVisualKind(link) === 'organization' ? '#ffb36b' : '#7dffbe';
}

export function getParticleCount(link) {
  const weight = (link.weight || 1) * getLinkWeightMultiplier(link);
  return Math.min(
    10,
    Math.round(Math.max(1, Math.round(weight)) * particleState.countMult),
  );
}

export function getParticleWidth(link) {
  const weight = (link.weight || 1) * getLinkWeightMultiplier(link);
  return Math.max(0.6, Math.min(3.5, 0.35 + weight * 0.45));
}

export function getParticleSpeed(link) {
  const weight = (link.weight || 1) * getLinkWeightMultiplier(link);
  return (
    Math.max(0.0015, Math.min(0.04, 0.0025 + weight * 0.0025)) *
    particleState.speedMult
  );
}
