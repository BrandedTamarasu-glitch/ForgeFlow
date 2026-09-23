// Checkout-only synthetic frame. This is not a general CAD kernel or STL validator.
const crypto = require('node:crypto');
const fs = require('node:fs');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const sub = (a, b) => a.map((value, i) => value - b[i]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
function requireCondition(ok, message) { if (!ok) throw new Error(message); }

function validateParameters(p) {
  requireCondition(p.units === 'mm', 'units must explicitly be mm');
  for (const [key, length] of [['outer', 2], ['opening', 2], ['object', 2], ['plate', 3], ['placement', 3]]) {
    requireCondition(Array.isArray(p[key]) && p[key].length === length && p[key].every(Number.isFinite), `invalid ${key}`);
    if (key !== 'placement') requireCondition(p[key].every(v => v > 0), `nonpositive ${key}`);
  }
  for (const key of ['height', 'openingTolerance', 'objectTolerance', 'minimumPerSideClearance', 'minimumWall']) {
    requireCondition(Number.isFinite(p[key]) && p[key] >= 0, `invalid ${key}`);
  }
  requireCondition(p.height > 0 && p.minimumWall > 0, 'height and wall must be positive');
  for (let i = 0; i < 2; i++) {
    requireCondition(p.opening[i] > p.openingTolerance, 'opening tolerance consumes opening');
    requireCondition(p.object[i] > p.objectTolerance, 'object tolerance consumes object');
    requireCondition((p.outer[i] - p.opening[i] - p.openingTolerance) / 2 >= p.minimumWall, 'wall below minimum');
    requireCondition((p.opening[i] - p.openingTolerance - p.object[i] - p.objectTolerance) / 2 >= p.minimumPerSideClearance, 'clearance below minimum');
  }
  const size = [...p.outer, p.height];
  requireCondition(p.placement.every((v, i) => v >= 0 && v + size[i] <= p.plate[i]), 'outside plate');
  requireCondition(p.placement[2] === 0, 'frame must contact plate');
}

function mesh(p) {
  validateParameters(p);
  const [w, d] = p.outer, [iw, id] = p.opening;
  const x = (w - iw) / 2, y = (d - id) / 2;
  const outer = [[0, 0], [w, 0], [w, d], [0, d]];
  const inner = [[x, y], [x + iw, y], [x + iw, y + id], [x, y + id]];
  const point = (ring, i, z) => [...ring[i], z];
  const faces = [];
  const quad = (a, b, c, e) => faces.push([a, b, c], [a, c, e]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4, h = p.height;
    const ob = point(outer, i, 0), on = point(outer, j, 0), ot = point(outer, i, h), ont = point(outer, j, h);
    const ib = point(inner, i, 0), inn = point(inner, j, 0), it = point(inner, i, h), int = point(inner, j, h);
    quad(ob, on, ont, ot);
    quad(inn, ib, it, int);
    quad(ot, ont, int, it);
    quad(on, ob, ib, inn);
  }
  return faces;
}

function stl(faces) {
  return `solid frame\n${faces.map(([a, b, c]) => {
    const n = cross(sub(b, a), sub(c, a)), length = Math.hypot(...n);
    requireCondition(length > 0, 'degenerate triangle');
    return `facet normal ${n.map(v => v / length).join(' ')}\nouter loop\n${[a, b, c].map(v => `vertex ${v.join(' ')}`).join('\n')}\nendloop\nendfacet`;
  }).join('\n')}\nendsolid frame\n`;
}

function parseStl(bytes) {
  // Accept only this fixture's emitted ASCII subset; reject ignored/trailing data.
  const lines = bytes.trim().split('\n');
  requireCondition(lines.shift() === 'solid frame' && lines.pop() === 'endsolid frame' && lines.length > 0 && lines.length % 7 === 0, 'invalid STL');
  const faces = [];
  for (let i = 0; i < lines.length; i += 7) {
    requireCondition(/^facet normal /.test(lines[i]) && lines[i + 1] === 'outer loop' && lines[i + 5] === 'endloop' && lines[i + 6] === 'endfacet', 'invalid STL facet');
    const normal = lines[i].slice(13).split(' ').map(Number);
    requireCondition(normal.length === 3 && normal.every(Number.isFinite), 'invalid normal');
    faces.push(lines.slice(i + 2, i + 5).map(line => {
      requireCondition(/^vertex /.test(line), 'invalid vertex');
      const v = line.slice(7).split(' ').map(Number);
      requireCondition(v.length === 3 && v.every(Number.isFinite), 'nonfinite vertex');
      return v;
    }));
  }
  return faces;
}

function inspect(faces) {
  requireCondition(Array.isArray(faces) && faces.length > 0, 'empty mesh');
  const edges = new Map(), seen = new Set(), adjacency = faces.map(() => new Set());
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  let volume = 0;
  faces.forEach((face, index) => {
    requireCondition(face.length === 3 && face.every(p => p.length === 3 && p.every(Number.isFinite)), 'nonfinite vertex');
    const [a, b, c] = face;
    requireCondition(Math.hypot(...cross(sub(b, a), sub(c, a))) > 1e-9, 'degenerate triangle');
    const keys = face.map(p => p.join(',')), faceKey = [...keys].sort().join('|');
    requireCondition(!seen.has(faceKey), 'duplicate face'); seen.add(faceKey);
    face.forEach(p => p.forEach((v, i) => { min[i] = Math.min(min[i], v); max[i] = Math.max(max[i], v); }));
    volume += dot(a, cross(b, c)) / 6;
    keys.forEach((key, i) => {
      const next = keys[(i + 1) % 3], edgeKey = [key, next].sort().join('|');
      const uses = edges.get(edgeKey) || [];
      uses.push({ index, direction: key < next ? 1 : -1 }); edges.set(edgeKey, uses);
    });
  });
  for (const uses of edges.values()) {
    requireCondition(uses.length === 2, 'open or nonmanifold edge');
    requireCondition(uses[0].direction + uses[1].direction === 0, 'inconsistent winding');
    adjacency[uses[0].index].add(uses[1].index); adjacency[uses[1].index].add(uses[0].index);
  }
  const visited = new Set(), queue = [0];
  while (queue.length) { const i = queue.pop(); if (visited.has(i)) continue; visited.add(i); queue.push(...adjacency[i]); }
  requireCondition(visited.size === faces.length, 'disconnected mesh');
  requireCondition(volume > 0, 'inverted volume');
  return { min, max, volume, triangles: faces.length };
}

function preview(bytes) {
  const faces = parseStl(bytes), bounds = inspect(faces);
  const views = [[0, 1, 'XY'], [0, 2, 'XZ'], [1, 2, 'YZ']];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 140" role="img" aria-label="Synthetic frame mesh projections">\n<metadata>mesh-sha256:${hash(bytes)}</metadata>\n${views.map(([x, y, label], i) => {
    const scale = 90 / Math.max(bounds.max[x] - bounds.min[x], bounds.max[y] - bounds.min[y]);
    return `<g transform="translate(${i * 120 + 10} 25)"><text x="0" y="-8">${label}</text><g fill="none" stroke="#253549" stroke-width="0.5">${faces.map(face => `<polygon points="${face.map(p => `${(p[x] - bounds.min[x]) * scale},${(bounds.max[y] - p[y]) * scale}`).join(' ')}"/>`).join('')}</g></g>`;
  }).join('\n')}\n</svg>\n`;
}

function sectionAreas(faces, z) {
  // Interior horizontal planes only; exact coordinates in this rectangular fixture.
  const graph = new Map(), points = new Map();
  for (const face of faces) {
    const hits = [];
    for (let i = 0; i < 3; i++) {
      const a = face[i], b = face[(i + 1) % 3];
      requireCondition(a[2] !== z && b[2] !== z, 'section through vertex unsupported');
      if ((a[2] < z) === (b[2] < z)) continue;
      const t = (z - a[2]) / (b[2] - a[2]);
      hits.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
    if (!hits.length) continue;
    requireCondition(hits.length === 2, 'invalid section');
    const keys = hits.map(p => p.join(','));
    keys.forEach((key, i) => {
      points.set(key, hits[i]);
      const neighbors = graph.get(key) || []; neighbors.push(keys[1 - i]); graph.set(key, neighbors);
    });
  }
  requireCondition(graph.size > 0, 'empty section');
  for (const neighbors of graph.values()) requireCondition(neighbors.length === 2, 'open section');
  const visited = new Set(), areas = [];
  for (const start of graph.keys()) {
    if (visited.has(start)) continue;
    let previous = null, current = start, area = 0;
    do {
      requireCondition(!visited.has(current), 'invalid section loop'); visited.add(current);
      const next = graph.get(current).find(key => key !== previous);
      const a = points.get(current), b = points.get(next);
      area += a[0] * b[1] - b[0] * a[1];
      previous = current; current = next;
    } while (current !== start);
    areas.push(Math.abs(area / 2));
  }
  return areas.sort((a, b) => a - b);
}

function build(p) {
  const bytes = stl(mesh(p));
  return { stl: bytes, preview: preview(bytes), manifest: { units: p.units, generator: hash(fs.readFileSync(__filename)), parameters: hash(JSON.stringify(p)), mesh: hash(bytes) } };
}

function verify(p, artifacts) {
  validateParameters(p);
  const expected = build(p);
  requireCondition(JSON.stringify(artifacts.manifest) === JSON.stringify(expected.manifest), 'stale source or artifact identity');
  const actual = inspect(parseStl(artifacts.stl));
  requireCondition(artifacts.stl === expected.stl, 'export differs from source');
  requireCondition(artifacts.preview === preview(artifacts.stl), 'stale preview');
  requireCondition(actual.min.every(v => v === 0) && actual.max.every((v, i) => Math.abs(v - [...p.outer, p.height][i]) < 1e-8), 'wrong bounds');
  const volume = (p.outer[0] * p.outer[1] - p.opening[0] * p.opening[1]) * p.height;
  requireCondition(Math.abs(actual.volume - volume) < 1e-7, 'wrong volume');
  return { digital: 'pass', slicer: 'pending', physical: 'pending', overall: 'pending', ...actual };
}

module.exports = { mesh, stl, parseStl, inspect, preview, sectionAreas, build, verify, validateParameters, hash };
