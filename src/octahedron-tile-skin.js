const SVG_NS = "http://www.w3.org/2000/svg";
const SQRT_3 = Math.sqrt(3);
const FACE_IDS = ["000", "001", "010", "011", "100", "101", "110", "111"];
const LOCAL_VERTICES = [
  [0, SQRT_3 / 2],
  [-0.5, 0],
  [0.5, 0],
];

const REPRESENTATIVE_TILES = {
  balanced: {
    "000": 0b111, "001": 0b101, "010": 0b011, "011": 0b001,
    "100": 0b110, "101": 0b100, "110": 0b010, "111": 0b000,
  },
  unequal: {
    "000": 0b111, "001": 0b101, "010": 0b010, "011": 0b000,
    "100": 0b110, "101": 0b100, "110": 0b011, "111": 0b001,
  },
  long: {
    "000": 0b111, "001": 0b001, "010": 0b010, "011": 0b100,
    "100": 0b110, "101": 0b000, "110": 0b011, "111": 0b101,
  },
};

function add(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
function subtract(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
function scale(a, scalar) { return [a[0] * scalar, a[1] * scalar]; }
function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
function midpoint(a, b) { return mix(a, b, 0.5); }
function normalize(a) {
  const length = Math.hypot(a[0], a[1]);
  return length < 1e-12 ? [0, 0] : scale(a, 1 / length);
}
function centroid(points) {
  return scale(points.reduce((sum, point) => add(sum, point), [0, 0]), 1 / points.length);
}
function tileBit(tile, axis) { return (tile >> (2 - axis)) & 1; }

function kolamCommands(tile) {
  const centre = centroid(LOCAL_VERTICES);
  const anchors = LOCAL_VERTICES.map((vertex) => mix(centre, vertex, 0.34));
  const order = [1, 2, 0];
  const tangents = {};

  order.forEach((axis, index) => {
    const previous = order[(index + order.length - 1) % order.length];
    const next = order[(index + 1) % order.length];
    tangents[axis] = normalize(subtract(anchors[next], anchors[previous]));
  });

  const sections = [[0, 1, 2], [1, 2, 0], [2, 0, 1]];
  const commands = [{ type: "M", points: [anchors[1]] }];

  for (const [axis, startAxis, endAxis] of sections) {
    const start = anchors[startAxis];
    const end = anchors[endAxis];
    const startTangent = tangents[startAxis];
    const endTangent = tangents[endAxis];

    if (tileBit(tile, axis) === 0) {
      commands.push({
        type: "C",
        points: [
          add(start, scale(startTangent, 0.18)),
          subtract(end, scale(endTangent, 0.18)),
          end,
        ],
      });
      continue;
    }

    const otherAxes = [0, 1, 2].filter((candidate) => candidate !== axis);
    const exit = midpoint(LOCAL_VERTICES[otherAxes[0]], LOCAL_VERTICES[otherAxes[1]]);
    const incoming = normalize(subtract(exit, start));
    const outgoing = normalize(subtract(end, exit));

    commands.push({
      type: "C",
      points: [
        add(start, scale(startTangent, 0.16)),
        subtract(exit, scale(incoming, 0.145)),
        exit,
      ],
    });
    commands.push({
      type: "C",
      points: [
        add(exit, scale(outgoing, 0.145)),
        subtract(end, scale(endTangent, 0.16)),
        end,
      ],
    });
  }

  commands.push({ type: "Z", points: [] });
  return commands;
}

function parseTriangle(path) {
  const values = path.getAttribute("d")?.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (values.length < 6) return null;
  return [[values[0], values[1]], [values[2], values[3]], [values[4], values[5]]];
}

function barycentric(point) {
  const [a, b, c] = LOCAL_VERTICES;
  const denominator = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  const first = ((b[1] - c[1]) * (point[0] - c[0]) + (c[0] - b[0]) * (point[1] - c[1])) / denominator;
  const second = ((c[1] - a[1]) * (point[0] - c[0]) + (a[0] - c[0]) * (point[1] - c[1])) / denominator;
  return [first, second, 1 - first - second];
}

function mapPoint(point, triangle) {
  const weights = barycentric(point);
  return [
    weights[0] * triangle[0][0] + weights[1] * triangle[1][0] + weights[2] * triangle[2][0],
    weights[0] * triangle[0][1] + weights[1] * triangle[1][1] + weights[2] * triangle[2][1],
  ];
}

function smoothPath(tile, triangle) {
  return kolamCommands(tile).map((command) => {
    if (command.type === "Z") return "Z";
    const points = command.points.map((point) => mapPoint(point, triangle));
    if (command.type === "M") return `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
    return `C ${points.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(" ")}`;
  }).join(" ");
}

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

function hexToRgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
function mixHex(first, second, t) {
  const a = hexToRgb(first);
  const b = hexToRgb(second);
  const values = a.map((value, index) => Math.round(value + (b[index] - value) * t));
  return `rgb(${values[0]} ${values[1]} ${values[2]})`;
}

function representativeId(root) {
  return root.querySelector("[data-representative].is-active")?.dataset.representative ?? "balanced";
}

function skinScene(root) {
  const scene = root.querySelector("#octa-scene");
  if (!(scene instanceof SVGGElement)) return;
  const stage = scene.closest("svg");
  if (!(stage instanceof SVGSVGElement)) return;

  let definitions = stage.querySelector("#octa-tile-skin-defs");
  if (!(definitions instanceof SVGDefsElement)) {
    definitions = svgElement("defs", { id: "octa-tile-skin-defs" });
    stage.prepend(definitions);
  }
  definitions.replaceChildren();

  const id = representativeId(root);
  const tiles = REPRESENTATIVE_TILES[id] ?? REPRESENTATIVE_TILES.balanced;
  const fold = Number(root.querySelector("#fold-range")?.value ?? 0) / 100;
  const shades = ["#74331f", "#823923", "#914229", "#9c492c", "#a34f2e", "#ad5a36", "#b76540", "#c0714d"];
  const groups = [...scene.querySelectorAll("g[data-face]")];

  groups.forEach((group, index) => {
    const face = group.dataset.face;
    const polygon = group.querySelector(".octa-face");
    const curve = group.querySelector(".octa-kolam-curve");
    if (!face || !(polygon instanceof SVGPathElement) || !(curve instanceof SVGPathElement)) return;
    const triangle = parseTriangle(polygon);
    if (!triangle) return;

    polygon.setAttribute("fill", mixHex("#a34f2e", shades[Math.min(index, shades.length - 1)], fold));
    curve.setAttribute("d", smoothPath(tiles[face], triangle));

    const clipId = `octa-tile-skin-${face}`;
    const clip = svgElement("clipPath", { id: clipId });
    clip.append(svgElement("path", { d: polygon.getAttribute("d") ?? "" }));
    definitions.append(clip);
    curve.setAttribute("clip-path", `url(#${clipId})`);
  });
}

function skinMiniNets(root) {
  root.querySelectorAll("[data-mini-net]").forEach((container) => {
    const id = container.dataset.miniNet;
    const tiles = REPRESENTATIVE_TILES[id] ?? REPRESENTATIVE_TILES.balanced;
    const svg = container.querySelector("svg");
    if (!(svg instanceof SVGSVGElement)) return;

    let definitions = svg.querySelector("defs[data-tile-skin]");
    if (!(definitions instanceof SVGDefsElement)) {
      definitions = svgElement("defs", { "data-tile-skin": "true" });
      svg.prepend(definitions);
    }
    definitions.replaceChildren();

    const groups = [...svg.querySelectorAll(":scope > g")];
    groups.forEach((group, index) => {
      const face = FACE_IDS[index];
      const polygon = group.querySelector(".octa-mini-face");
      const curve = group.querySelector(".octa-mini-curve");
      if (!(polygon instanceof SVGPathElement) || !(curve instanceof SVGPathElement)) return;
      const triangle = parseTriangle(polygon);
      if (!triangle) return;
      curve.setAttribute("d", smoothPath(tiles[face], triangle));
      const clipId = `octa-mini-tile-skin-${id}-${face}`;
      const clip = svgElement("clipPath", { id: clipId });
      clip.append(svgElement("path", { d: polygon.getAttribute("d") ?? "" }));
      definitions.append(clip);
      curve.setAttribute("clip-path", `url(#${clipId})`);
    });
  });
}

function initialise() {
  const root = document.getElementById("octahedron-root");
  const scene = root?.querySelector("#octa-scene");
  if (!(root instanceof HTMLElement) || !(scene instanceof SVGGElement)) {
    window.requestAnimationFrame(initialise);
    return;
  }

  let queued = false;
  const refresh = () => {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(() => {
      queued = false;
      skinScene(root);
    });
  };

  new MutationObserver(refresh).observe(scene, { childList: true });
  skinMiniNets(root);
  refresh();
}

initialise();
