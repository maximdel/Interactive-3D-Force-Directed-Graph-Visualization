/**
 * Generates minimal GLB files for each node type.
 * GLB = binary GLTF. Format: 12-byte header, JSON chunk, BIN chunk.
 */
const fs = require('fs');
const path = require('path');

// ── GLB writer ────────────────────────────────────────────────────────────────

function padTo4(n) { return Math.ceil(n / 4) * 4; }

function writeGLB(jsonObj, binBuffer) {
  const jsonStr = JSON.stringify(jsonObj);
  const jsonBytes  = Buffer.from(jsonStr, 'utf8');
  const jsonPadded = Buffer.alloc(padTo4(jsonBytes.length), 0x20); // pad with spaces
  jsonBytes.copy(jsonPadded);

  const binPadded = Buffer.alloc(padTo4(binBuffer.length), 0x00);
  binBuffer.copy(binPadded);

  const totalLen = 12 + 8 + jsonPadded.length + 8 + binPadded.length;
  const out = Buffer.alloc(totalLen);
  let off = 0;

  // Header
  out.writeUInt32LE(0x46546C67, off); off += 4; // magic 'glTF'
  out.writeUInt32LE(2,          off); off += 4; // version
  out.writeUInt32LE(totalLen,   off); off += 4;

  // JSON chunk
  out.writeUInt32LE(jsonPadded.length, off); off += 4;
  out.writeUInt32LE(0x4E4F534A,        off); off += 4; // 'JSON'
  jsonPadded.copy(out, off); off += jsonPadded.length;

  // BIN chunk
  out.writeUInt32LE(binPadded.length, off); off += 4;
  out.writeUInt32LE(0x004E4942,       off); off += 4; // 'BIN\0'
  binPadded.copy(out, off);

  return out;
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

function buildGLTF(positions, indices, bufferByteLength) {
  const posCount = positions.length / 3;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    minX = Math.min(minX, positions[i]);   maxX = Math.max(maxX, positions[i]);
    minY = Math.min(minY, positions[i+1]); maxY = Math.max(maxY, positions[i+1]);
    minZ = Math.min(minZ, positions[i+2]); maxZ = Math.max(maxZ, positions[i+2]);
  }
  const posBytes = posCount * 3 * 4;
  const idxBytes = indices.length * 2;

  return {
    asset: { version: '2.0', generator: 'force-graph-model-gen' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{
      primitives: [{
        attributes: { POSITION: 0 },
        indices: 1,
        mode: 4 // TRIANGLES
      }]
    }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126, // FLOAT
        count: posCount,
        type: 'VEC3',
        min: [minX, minY, minZ],
        max: [maxX, maxY, maxZ]
      },
      {
        bufferView: 1,
        componentType: 5123, // UNSIGNED_SHORT
        count: indices.length,
        type: 'SCALAR'
      }
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0,       byteLength: posBytes },
      { buffer: 0, byteOffset: posBytes, byteLength: idxBytes }
    ],
    buffers: [{ byteLength: bufferByteLength }]
  };
}

function buildBinBuffer(positions, indices) {
  const posBytes = positions.length * 4;
  const idxBytes = indices.length * 2;
  const total    = padTo4(posBytes) + padTo4(idxBytes);
  const buf = Buffer.alloc(total, 0);

  // Write positions
  const posView = new Float32Array(buf.buffer, buf.byteOffset, positions.length);
  for (let i = 0; i < positions.length; i++) posView[i] = positions[i];

  // Write indices (after positions, padded to 4-byte boundary)
  const idxOffset = padTo4(posBytes);
  const idxView = new Uint16Array(buf.buffer, buf.byteOffset + idxOffset, indices.length);
  for (let i = 0; i < indices.length; i++) idxView[i] = indices[i];

  return { buf, posBytes, idxOffset };
}

function makeGLB(positions, indices) {
  const { buf, posBytes, idxOffset } = buildBinBuffer(positions, indices);
  const gltf = buildGLTF(positions, indices, posBytes + indices.length * 2);
  // Fix buffer views to account for padding
  gltf.bufferViews[1].byteOffset = idxOffset;
  gltf.buffers[0].byteLength = buf.length;
  return writeGLB(gltf, buf);
}

// ── Shapes ────────────────────────────────────────────────────────────────────

// Box: 6 faces × 4 vertices (separate per face for clean edges)
function boxPositions(s) {
  const h = s / 2;
  return [
    // +Z front
    -h,-h, h,  h,-h, h,  h, h, h, -h, h, h,
    // -Z back
     h,-h,-h, -h,-h,-h, -h, h,-h,  h, h,-h,
    // +Y top
    -h, h, h,  h, h, h,  h, h,-h, -h, h,-h,
    // -Y bottom
    -h,-h,-h,  h,-h,-h,  h,-h, h, -h,-h, h,
    // +X right
     h,-h, h,  h,-h,-h,  h, h,-h,  h, h, h,
    // -X left
    -h,-h,-h, -h,-h, h, -h, h, h, -h, h,-h,
  ];
}
function quadIndices(faceCount) {
  const idx = [];
  for (let f = 0; f < faceCount; f++) {
    const b = f * 4;
    idx.push(b, b+1, b+2, b, b+2, b+3);
  }
  return idx;
}

// Octahedron
function octahedronPositions(r) {
  return [
     0,  r,  0,
     r,  0,  0,
     0,  0,  r,
    -r,  0,  0,
     0,  0, -r,
     0, -r,  0,
  ];
}
const OCT_IDX = [
  0,1,2, 0,2,3, 0,3,4, 0,4,1,
  5,2,1, 5,3,2, 5,4,3, 5,1,4,
];

// Cylinder (building shape: slightly tapered, multi-segment)
function cylinderPositions(rTop, rBot, h, segs) {
  const pos = [];
  for (let i = 0; i <= segs; i++) {
    const theta = (i / segs) * Math.PI * 2;
    const cos = Math.cos(theta), sin = Math.sin(theta);
    pos.push(rBot * cos, -h/2, rBot * sin); // bottom ring
    pos.push(rTop * cos,  h/2, rTop * sin); // top ring
  }
  // center top and bottom
  pos.push(0, -h/2, 0); // bottom center
  pos.push(0,  h/2, 0); // top center
  return pos;
}
function cylinderIndices(segs) {
  const idx = [];
  for (let i = 0; i < segs; i++) {
    const b  = i * 2, n = (i + 1) * 2;
    // side quad
    idx.push(b, n, n+1, b, n+1, b+1);
  }
  const botCenter = (segs + 1) * 2;
  const topCenter = botCenter + 1;
  for (let i = 0; i < segs; i++) {
    const b = i * 2, n = (i + 1) * 2;
    idx.push(b, botCenter, n);   // bottom cap
    idx.push(b+1, n+1, topCenter); // top cap
  }
  return idx;
}

// ── Generate files ────────────────────────────────────────────────────────────

const OUT = path.join(__dirname, 'models-out');
fs.mkdirSync(OUT, { recursive: true });

// project.glb — box
{
  const pos = boxPositions(1.6);
  const idx = quadIndices(6);
  fs.writeFileSync(path.join(OUT, 'project.glb'), makeGLB(pos, idx));
  console.log('project.glb written');
}

// organization.glb — cylinder / tower
{
  const segs = 12;
  const pos = cylinderPositions(0.55, 0.7, 1.8, segs);
  const idx = cylinderIndices(segs);
  fs.writeFileSync(path.join(OUT, 'organization.glb'), makeGLB(pos, idx));
  console.log('organization.glb written');
}

// topic.glb — octahedron / diamond
{
  const pos = octahedronPositions(1.1);
  fs.writeFileSync(path.join(OUT, 'topic.glb'), makeGLB(pos, OCT_IDX));
  console.log('topic.glb written');
}

console.log('\nAll models written to', OUT);
