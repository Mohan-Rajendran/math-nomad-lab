import "./octahedron.css";

type Axis = 0 | 1 | 2;
type FaceId = "000" | "001" | "010" | "011" | "100" | "101" | "110" | "111";
type Vec2 = readonly [number, number];
type Vec3 = readonly [number, number, number];
type Mat4 = readonly number[];
type FaceGeometry = Record<Axis, Vec2>;

type Representative = {
  id: "balanced" | "unequal" | "long";
  number: string;
  title: string;
  shortTitle: string;
  arms: string;
  directionWords: string;
  note: string;
  orbitSize: number;
  tiles: Record<FaceId, number>;
};

const SVG_NS = "http://www.w3.org/2000/svg";
const SQRT_3 = Math.sqrt(3);
const FOLD_ANGLE = Math.acos(1 / 3);
const VIEWBOX_WIDTH = 900;
const VIEWBOX_HEIGHT = 620;
const FACE_IDS: FaceId[] = ["000", "001", "010", "011", "100", "101", "110", "111"];
const FACE_ORDER: FaceId[] = ["000", "100", "010", "110", "011", "111", "001", "101"];
const PARENT: Record<FaceId, FaceId | null> = {
  "000": null,
  "100": "000",
  "010": "000",
  "110": "100",
  "011": "010",
  "111": "110",
  "001": "011",
  "101": "111",
};

const REPRESENTATIVES: Representative[] = [
  {
    id: "balanced",
    number: "I",
    title: "Three equal arms",
    shortTitle: "Equal arms",
    arms: "(2, 2, 2)",
    directionWords: "12 | 23 | 31",
    note: "Each branch from the 111 face contains one degree-two tile.",
    orbitSize: 16,
    tiles: {
      "000": 0b111,
      "001": 0b101,
      "010": 0b011,
      "011": 0b001,
      "100": 0b110,
      "101": 0b100,
      "110": 0b010,
      "111": 0b000,
    },
  },
  {
    id: "unequal",
    number: "II",
    title: "Three unequal arms",
    shortTitle: "Unequal arms",
    arms: "(3, 2, 1)",
    directionWords: "123 | 31 | 2",
    note: "The three branches have distinct lengths, so the representative has no nontrivial symmetry.",
    orbitSize: 48,
    tiles: {
      "000": 0b111,
      "001": 0b101,
      "010": 0b010,
      "011": 0b000,
      "100": 0b110,
      "101": 0b100,
      "110": 0b011,
      "111": 0b001,
    },
  },
  {
    id: "long",
    number: "III",
    title: "One long arm",
    shortTitle: "One long arm",
    arms: "(4, 1, 1)",
    directionWords: "1231 | 2 | 3",
    note: "All three degree-two tiles lie on one branch from the central 111 face.",
    orbitSize: 48,
    tiles: {
      "000": 0b111,
      "001": 0b001,
      "010": 0b010,
      "011": 0b100,
      "100": 0b110,
      "101": 0b000,
      "110": 0b011,
      "111": 0b101,
    },
  },
];

function faceBits(face: FaceId): [number, number, number] {
  return [Number(face[0]), Number(face[1]), Number(face[2])];
}

function changedAxis(first: FaceId, second: FaceId): Axis {
  const a = faceBits(first);
  const b = faceBits(second);
  const differences = ([0, 1, 2] as Axis[]).filter((axis) => a[axis] !== b[axis]);
  if (differences.length !== 1) throw new Error(`Faces ${first} and ${second} are not adjacent.`);
  return differences[0];
}

function tileWord(tile: number): string {
  return tile.toString(2).padStart(3, "0");
}

function tileBit(tile: number, axis: Axis): 0 | 1 {
  return ((tile >> (2 - axis)) & 1) as 0 | 1;
}

function add2(a: Vec2, b: Vec2): Vec2 {
  return [a[0] + b[0], a[1] + b[1]];
}

function subtract2(a: Vec2, b: Vec2): Vec2 {
  return [a[0] - b[0], a[1] - b[1]];
}

function scale2(a: Vec2, scalar: number): Vec2 {
  return [a[0] * scalar, a[1] * scalar];
}

function mix2(a: Vec2, b: Vec2, t: number): Vec2 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function dot2(a: Vec2, b: Vec2): number {
  return a[0] * b[0] + a[1] * b[1];
}

function reflectAcrossLine(point: Vec2, start: Vec2, end: Vec2): Vec2 {
  const line = subtract2(end, start);
  const projection = dot2(subtract2(point, start), line) / dot2(line, line);
  const foot = add2(start, scale2(line, projection));
  return subtract2(scale2(foot, 2), point);
}

function centroid2(points: readonly Vec2[]): Vec2 {
  const sum = points.reduce<Vec2>((accumulator, point) => add2(accumulator, point), [0, 0]);
  return scale2(sum, 1 / points.length);
}

function midpoint2(a: Vec2, b: Vec2): Vec2 {
  return mix2(a, b, 0.5);
}

function add3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function subtract3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale3(a: Vec3, scalar: number): Vec3 {
  return [a[0] * scalar, a[1] * scalar, a[2] * scalar];
}

function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function length3(a: Vec3): number {
  return Math.sqrt(dot3(a, a));
}

function normalize3(a: Vec3): Vec3 {
  const length = length3(a);
  if (length < 1e-12) return [0, 0, 0];
  return scale3(a, 1 / length);
}

function centroid3(points: readonly Vec3[]): Vec3 {
  const sum = points.reduce<Vec3>((accumulator, point) => add3(accumulator, point), [0, 0, 0]);
  return scale3(sum, 1 / points.length);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function mix(first: number, second: number, t: number): number {
  return first + (second - first) * t;
}

function smoothstep(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function easeInOutCubic(value: number): number {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function identityMatrix(): Mat4 {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
}

function multiplyMatrices(first: Mat4, second: Mat4): Mat4 {
  const result = Array<number>(16).fill(0);
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      for (let index = 0; index < 4; index += 1) {
        result[row * 4 + column] += first[row * 4 + index] * second[index * 4 + column];
      }
    }
  }
  return result;
}

function transformPoint(matrix: Mat4, point: Vec3): Vec3 {
  const [x, y, z] = point;
  return [
    matrix[0] * x + matrix[1] * y + matrix[2] * z + matrix[3],
    matrix[4] * x + matrix[5] * y + matrix[6] * z + matrix[7],
    matrix[8] * x + matrix[9] * y + matrix[10] * z + matrix[11],
  ];
}

function rotationAroundLine(start: Vec3, end: Vec3, angle: number): Mat4 {
  const [x, y, z] = normalize3(subtract3(end, start));
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const remainder = 1 - cosine;
  const rotation = [
    cosine + x * x * remainder,
    x * y * remainder - z * sine,
    x * z * remainder + y * sine,
    y * x * remainder + z * sine,
    cosine + y * y * remainder,
    y * z * remainder - x * sine,
    z * x * remainder - y * sine,
    z * y * remainder + x * sine,
    cosine + z * z * remainder,
  ];
  const rotatedStart: Vec3 = [
    rotation[0] * start[0] + rotation[1] * start[1] + rotation[2] * start[2],
    rotation[3] * start[0] + rotation[4] * start[1] + rotation[5] * start[2],
    rotation[6] * start[0] + rotation[7] * start[1] + rotation[8] * start[2],
  ];
  const translation = subtract3(start, rotatedStart);
  return [
    rotation[0], rotation[1], rotation[2], translation[0],
    rotation[3], rotation[4], rotation[5], translation[1],
    rotation[6], rotation[7], rotation[8], translation[2],
    0, 0, 0, 1,
  ];
}

function rotationX(angle: number): Mat4 {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return [
    1, 0, 0, 0,
    0, cosine, -sine, 0,
    0, sine, cosine, 0,
    0, 0, 0, 1,
  ];
}

function rotationY(angle: number): Mat4 {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return [
    cosine, 0, sine, 0,
    0, 1, 0, 0,
    -sine, 0, cosine, 0,
    0, 0, 0, 1,
  ];
}

function rotationZ(angle: number): Mat4 {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return [
    cosine, -sine, 0, 0,
    sine, cosine, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
}

function quadraticPoint(start: Vec2, control: Vec2, end: Vec2, t: number): Vec2 {
  const first = scale2(start, (1 - t) * (1 - t));
  const second = scale2(control, 2 * (1 - t) * t);
  const third = scale2(end, t * t);
  return add2(add2(first, second), third);
}

function sampleQuadratic(start: Vec2, control: Vec2, end: Vec2, steps: number, includeStart: boolean): Vec2[] {
  const points: Vec2[] = [];
  const firstIndex = includeStart ? 0 : 1;
  for (let index = firstIndex; index <= steps; index += 1) {
    points.push(quadraticPoint(start, control, end, index / steps));
  }
  return points;
}

function createFlatGeometry(): Record<FaceId, FaceGeometry> {
  const geometry = {} as Record<FaceId, FaceGeometry>;
  geometry["000"] = {
    0: [0, SQRT_3 / 2],
    1: [-0.5, 0],
    2: [0.5, 0],
  };

  for (const face of FACE_ORDER.slice(1)) {
    const parent = PARENT[face];
    if (!parent) throw new Error(`Face ${face} is missing its parent.`);
    const axis = changedAxis(parent, face);
    const sharedAxes = ([0, 1, 2] as Axis[]).filter((candidate) => candidate !== axis) as [Axis, Axis];
    const start = geometry[parent][sharedAxes[0]];
    const end = geometry[parent][sharedAxes[1]];
    geometry[face] = {
      [sharedAxes[0]]: start,
      [sharedAxes[1]]: end,
      [axis]: reflectAcrossLine(geometry[parent][axis], start, end),
    } as FaceGeometry;
  }
  return geometry;
}

const FLAT_GEOMETRY = createFlatGeometry();

type Hinge = { parent: FaceId; startAxis: Axis; endAxis: Axis; sign: 1 | -1 };

function createHinges(): Partial<Record<FaceId, Hinge>> {
  const hinges: Partial<Record<FaceId, Hinge>> = {};
  for (const face of FACE_ORDER.slice(1)) {
    const parent = PARENT[face];
    if (!parent) continue;
    const axis = changedAxis(parent, face);
    const sharedAxes = ([0, 1, 2] as Axis[]).filter((candidate) => candidate !== axis) as [Axis, Axis];
    const start = FLAT_GEOMETRY[parent][sharedAxes[0]];
    const end = FLAT_GEOMETRY[parent][sharedAxes[1]];
    const childCentroid = centroid2(([0, 1, 2] as Axis[]).map((candidate) => FLAT_GEOMETRY[face][candidate]));
    const axisVector: Vec3 = [end[0] - start[0], end[1] - start[1], 0];
    const centroidVector: Vec3 = [childCentroid[0] - start[0], childCentroid[1] - start[1], 0];
    const derivative = cross3(normalize3(axisVector), centroidVector);
    hinges[face] = {
      parent,
      startAxis: sharedAxes[0],
      endAxis: sharedAxes[1],
      sign: derivative[2] >= 0 ? 1 : -1,
    };
  }
  return hinges;
}

const HINGES = createHinges();

function faceTransforms(fold: number): Record<FaceId, Mat4> {
  const transforms = {} as Record<FaceId, Mat4>;
  transforms["000"] = identityMatrix();

  for (const face of FACE_ORDER.slice(1)) {
    const hinge = HINGES[face];
    if (!hinge) throw new Error(`Face ${face} is missing hinge data.`);
    const parentTransform = transforms[hinge.parent];
    const startFlat = FLAT_GEOMETRY[hinge.parent][hinge.startAxis];
    const endFlat = FLAT_GEOMETRY[hinge.parent][hinge.endAxis];
    const startWorld = transformPoint(parentTransform, [startFlat[0], startFlat[1], 0]);
    const endWorld = transformPoint(parentTransform, [endFlat[0], endFlat[1], 0]);
    const rotation = rotationAroundLine(startWorld, endWorld, hinge.sign * FOLD_ANGLE * fold);
    transforms[face] = multiplyMatrices(rotation, parentTransform);
  }
  return transforms;
}

function faceVertices2(face: FaceId): [Vec2, Vec2, Vec2] {
  const geometry = FLAT_GEOMETRY[face];
  return [geometry[0], geometry[1], geometry[2]];
}

function sideMidpoint(face: FaceId, axis: Axis): Vec2 {
  const otherAxes = ([0, 1, 2] as Axis[]).filter((candidate) => candidate !== axis) as [Axis, Axis];
  return midpoint2(FLAT_GEOMETRY[face][otherAxes[0]], FLAT_GEOMETRY[face][otherAxes[1]]);
}

function kolamCurve(face: FaceId, tile: number): Vec2[] {
  const vertices = faceVertices2(face);
  const centre = centroid2(vertices);
  const inner = vertices.map((vertex) => mix2(centre, vertex, 0.29)) as [Vec2, Vec2, Vec2];
  const sectionAxes: [Axis, Axis, Axis][] = [
    [0, 1, 2],
    [1, 2, 0],
    [2, 0, 1],
  ];
  const points: Vec2[] = [];

  sectionAxes.forEach(([axis, startAxis, endAxis], sectionIndex) => {
    const start = inner[startAxis];
    const end = inner[endAxis];
    const midpoint = sideMidpoint(face, axis);
    const active = tileBit(tile, axis) === 1;

    if (active) {
      const firstControl = mix2(start, midpoint, 0.64);
      const secondControl = mix2(end, midpoint, 0.64);
      points.push(...sampleQuadratic(start, firstControl, midpoint, 5, sectionIndex === 0));
      points.push(...sampleQuadratic(midpoint, secondControl, end, 5, false));
    } else {
      const control = mix2(centre, midpoint, 0.34);
      points.push(...sampleQuadratic(start, control, end, 8, sectionIndex === 0));
    }
  });

  return points;
}

function svgElement<K extends keyof SVGElementTagNameMap>(name: K, attributes: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

function projectedPath(points: readonly [number, number][], close = false): string {
  if (points.length === 0) return "";
  const commands = [`M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`];
  for (const point of points.slice(1)) commands.push(`L ${point[0].toFixed(2)} ${point[1].toFixed(2)}`);
  if (close) commands.push("Z");
  return commands.join(" ");
}

function validateRepresentatives(): void {
  for (const representative of REPRESENTATIVES) {
    const values = FACE_IDS.map((face) => representative.tiles[face]);
    if (new Set(values).size !== 8 || values.some((value) => value < 0 || value > 7)) {
      throw new Error(`${representative.title} does not use each triangular tile exactly once.`);
    }

    let activeEdges = 0;
    for (const face of FACE_IDS) {
      const bits = faceBits(face);
      for (const axis of [0, 1, 2] as Axis[]) {
        if (bits[axis] !== 0) continue;
        const neighbourBits = [...bits] as [number, number, number];
        neighbourBits[axis] = 1;
        const neighbour = neighbourBits.join("") as FaceId;
        if (tileBit(representative.tiles[face], axis) !== tileBit(representative.tiles[neighbour], axis)) {
          throw new Error(`${representative.title} has a mismatched side between ${face} and ${neighbour}.`);
        }
        if (tileBit(representative.tiles[face], axis) === 1) activeEdges += 1;
      }
    }
    if (activeEdges !== 6) throw new Error(`${representative.title} should have six active cube edges.`);
  }
}

validateRepresentatives();

const rootElement = document.getElementById("octahedron-root");
if (!(rootElement instanceof HTMLElement)) throw new Error("The octahedron sandbox root element is missing.");
const root: HTMLElement = rootElement;

const isEmbed = root.dataset.mode === "embed";

root.innerHTML = `
  <a class="octa-skip" href="#octa-viewer">Skip to the interactive</a>
  <main class="octa-page ${isEmbed ? "is-embed" : ""}">
    ${isEmbed ? "" : `
      <nav class="octa-nav" aria-label="Math Nomad Lab">
        <a class="octa-brand" href="/" aria-label="Go to the Math Nomad Lab home page">
          <img src="/mathnomad-logo.png" alt="" width="36" height="36" />
          <span><strong>Math Nomad</strong><small>Kolam Lab</small></span>
        </a>
        <a class="octa-back" href="/">Lab home <span aria-hidden="true">↗</span></a>
      </nav>
    `}

    <header class="octa-hero">
      <div class="octa-eyebrow"><span>Sandbox 04 · Preview</span><span></span></div>
      <h1>Kolams on an octahedron</h1>
      <p>Compare the three graph-theoretic representatives, fold a common triangular net, and rotate the completed solid.</p>
    </header>

    <section class="octa-layout" aria-label="Octahedral kolam explorer">
      <aside class="octa-representatives" aria-labelledby="representatives-heading">
        <div class="octa-panel-heading">
          <span>Choose a representative</span>
          <h2 id="representatives-heading">Three possible kolams</h2>
        </div>
        <div class="octa-representative-list">
          ${REPRESENTATIVES.map((representative, index) => `
            <button
              type="button"
              class="octa-representative ${index === 0 ? "is-active" : ""}"
              data-representative="${representative.id}"
              aria-pressed="${index === 0 ? "true" : "false"}"
            >
              <span class="octa-mini-net" data-mini-net="${representative.id}" aria-hidden="true"></span>
              <span class="octa-representative-copy">
                <small>Kolam ${representative.number}</small>
                <strong>${representative.shortTitle}</strong>
                <span>arms ${representative.arms}</span>
              </span>
            </button>
          `).join("")}
        </div>
      </aside>

      <section class="octa-viewer-card" id="octa-viewer" aria-labelledby="selected-title">
        <div class="octa-viewer-heading">
          <div>
            <span class="octa-kicker">Selected representative</span>
            <h2 id="selected-title">${REPRESENTATIVES[0].title}</h2>
          </div>
          <div class="octa-arm-badge" aria-label="Arm lengths"><span>arm lengths</span><strong id="selected-arms">${REPRESENTATIVES[0].arms}</strong></div>
        </div>

        <div class="octa-stage-wrap">
          <svg
            id="octa-stage"
            class="octa-stage"
            viewBox="0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}"
            role="img"
            tabindex="0"
            aria-label="Foldable net for the representative with arm lengths ${REPRESENTATIVES[0].arms}. Drag to rotate and use the slider to fold."
          >
            <defs>
              <filter id="octa-shadow" x="-30%" y="-30%" width="160%" height="180%">
                <feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#44251c" flood-opacity="0.18" />
              </filter>
              <radialGradient id="octa-stage-glow" cx="50%" cy="46%" r="58%">
                <stop offset="0" stop-color="#ffffff" stop-opacity="0.84" />
                <stop offset="1" stop-color="#efe3d5" stop-opacity="0" />
              </radialGradient>
            </defs>
            <rect width="${VIEWBOX_WIDTH}" height="${VIEWBOX_HEIGHT}" fill="url(#octa-stage-glow)" />
            <g id="octa-scene" filter="url(#octa-shadow)"></g>
          </svg>
          <div class="octa-stage-hint"><span>Drag to rotate</span><span>Scroll to zoom</span></div>
        </div>

        <div class="octa-fold-controls">
          <button type="button" class="octa-primary-button" id="fold-button"><span aria-hidden="true">△</span><span id="fold-button-label">Fold the net</span></button>
          <label class="octa-range-label" for="fold-range"><span>Net</span><input id="fold-range" type="range" min="0" max="100" value="0" step="1" /><span>Octahedron</span></label>
          <output id="fold-output" for="fold-range">0% · flat net</output>
        </div>

        <div class="octa-secondary-controls" aria-label="Display controls">
          <button type="button" class="octa-toggle" id="labels-toggle" aria-pressed="false"><span class="octa-toggle-mark"></span>Tile labels</button>
          <button type="button" class="octa-toggle" id="graph-toggle" aria-pressed="false"><span class="octa-toggle-mark"></span>Active graph</button>
          <button type="button" class="octa-reset" id="reset-button">Reset view</button>
        </div>

        <div class="octa-selection-note">
          <div><span>Direction words</span><strong id="selected-directions">${REPRESENTATIVES[0].directionWords}</strong></div>
          <p id="selected-note">${REPRESENTATIVES[0].note}</p>
        </div>
        <p class="octa-live" id="octa-live" aria-live="polite"></p>
      </section>

      <aside class="octa-proof-card" aria-labelledby="proof-card-heading">
        <span class="octa-kicker">Why only three?</span>
        <h2 id="proof-card-heading">The proof needs no exhaustive search.</h2>
        <p>The nonzero faces form a seven-vertex tree with one degree-three vertex. Its three positive arm lengths sum to six.</p>
        <div class="octa-partitions" aria-label="The three partitions of six into three positive parts">
          <span>6 = 2 + 2 + 2</span>
          <span>6 = 3 + 2 + 1</span>
          <span>6 = 4 + 1 + 1</span>
        </div>
        <p class="octa-proof-footnote">The direction labels on the dual cube show that each tree shape has one exact-inventory realization up to full octahedral symmetry.</p>
      </aside>
    </section>
  </main>
`;

function requiredElement<T extends Element>(selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`The octahedron sandbox is missing ${selector}.`);
  return element;
}

const stage = requiredElement<SVGSVGElement>("#octa-stage");
const scene = requiredElement<SVGGElement>("#octa-scene");
const foldRange = requiredElement<HTMLInputElement>("#fold-range");
const foldOutput = requiredElement<HTMLOutputElement>("#fold-output");
const foldButton = requiredElement<HTMLButtonElement>("#fold-button");
const foldButtonLabel = requiredElement<HTMLSpanElement>("#fold-button-label");
const resetButton = requiredElement<HTMLButtonElement>("#reset-button");
const labelsToggle = requiredElement<HTMLButtonElement>("#labels-toggle");
const graphToggle = requiredElement<HTMLButtonElement>("#graph-toggle");
const selectedTitle = requiredElement<HTMLElement>("#selected-title");
const selectedArms = requiredElement<HTMLElement>("#selected-arms");
const selectedDirections = requiredElement<HTMLElement>("#selected-directions");
const selectedNote = requiredElement<HTMLElement>("#selected-note");
const liveRegion = requiredElement<HTMLElement>("#octa-live");

const parameters = new URLSearchParams(window.location.search);
const requestedRepresentative = REPRESENTATIVES.find((representative) => representative.id === parameters.get("rep"));
let selected = requestedRepresentative ?? REPRESENTATIVES[0];
let fold = clamp(Number(parameters.get("fold") ?? 0), 0, 1);
let showLabels = parameters.get("labels") === "1";
let showGraph = parameters.get("graph") === "1";
let userYaw = 0;
let userPitch = 0;
let zoom = 1;
let animationFrame: number | null = null;
let dragState: { pointerId: number; x: number; y: number } | null = null;

function currentRepresentative(): Representative {
  return selected;
}

function worldPoint(face: FaceId, point: Vec2, transforms: Record<FaceId, Mat4>): Vec3 {
  return transformPoint(transforms[face], [point[0], point[1], 0]);
}

function createObjectRotation(): Mat4 {
  const folded = smoothstep(fold);
  const automaticYaw = 1.05 * folded;
  const automaticPitch = -0.72 * folded;
  const automaticRoll = 0.04 * folded;
  return multiplyMatrices(
    rotationZ(automaticRoll),
    multiplyMatrices(rotationX(userPitch + automaticPitch), rotationY(userYaw + automaticYaw)),
  );
}

function project(point: Vec3, scale: number): [number, number, number, number] {
  const cameraDistance = 5.2;
  const perspective = cameraDistance / (cameraDistance - point[2] * 0.92);
  return [
    VIEWBOX_WIDTH / 2 + point[0] * scale * perspective,
    VIEWBOX_HEIGHT / 2 - point[1] * scale * perspective,
    point[2],
    perspective,
  ];
}

function faceFill(normal: Vec3, depth: number): string {
  const light = normalize3([-0.4, -0.55, 1]);
  const illumination = Math.abs(dot3(normalize3(normal), light));
  const depthLift = clamp((depth + 1.2) / 2.4, 0, 1);
  const lightness = 89 + illumination * 5 + depthLift * 1.5;
  return `hsl(35 48% ${lightness.toFixed(1)}%)`;
}

function renderScene(): void {
  const transforms = faceTransforms(fold);
  const faceCentres = FACE_IDS.map((face) => worldPoint(face, centroid2(faceVertices2(face)), transforms));
  const objectCentre = centroid3(faceCentres);
  const rotation = createObjectRotation();
  const scale = mix(138, 298, smoothstep(fold)) * zoom;
  const representative = currentRepresentative();

  type RenderFace = {
    id: FaceId;
    vertices3: [Vec3, Vec3, Vec3];
    vertices2: [number, number][];
    depth: number;
    normal: Vec3;
  };

  const renderedFaces: RenderFace[] = FACE_IDS.map((face) => {
    const vertices3 = faceVertices2(face).map((point) => {
      const centred = subtract3(worldPoint(face, point, transforms), objectCentre);
      return transformPoint(rotation, centred);
    }) as [Vec3, Vec3, Vec3];
    const vertices2 = vertices3.map((point) => {
      const projected = project(point, scale);
      return [projected[0], projected[1]] as [number, number];
    });
    const normal = cross3(subtract3(vertices3[1], vertices3[0]), subtract3(vertices3[2], vertices3[0]));
    return {
      id: face,
      vertices3,
      vertices2,
      depth: centroid3(vertices3)[2],
      normal,
    };
  }).sort((first, second) => first.depth - second.depth);

  scene.replaceChildren();

  for (const rendered of renderedFaces) {
    const face = rendered.id;
    const tile = representative.tiles[face];
    const group = svgElement("g", { class: "octa-face-group", "data-face": face });
    const polygon = svgElement("path", {
      class: "octa-face",
      d: projectedPath(rendered.vertices2, true),
      fill: faceFill(rendered.normal, rendered.depth),
      "vector-effect": "non-scaling-stroke",
    });
    group.append(polygon);

    if (showGraph) {
      const centreFlat = centroid2(faceVertices2(face));
      const centre3 = transformPoint(rotation, subtract3(worldPoint(face, centreFlat, transforms), objectCentre));
      const centreProjected = project(centre3, scale);
      for (const axis of [0, 1, 2] as Axis[]) {
        if (tileBit(tile, axis) === 0) continue;
        const midpointFlat = sideMidpoint(face, axis);
        const midpoint3 = transformPoint(rotation, subtract3(worldPoint(face, midpointFlat, transforms), objectCentre));
        const midpointProjected = project(midpoint3, scale);
        group.append(svgElement("path", {
          class: "octa-graph-edge",
          d: `M ${centreProjected[0].toFixed(2)} ${centreProjected[1].toFixed(2)} L ${midpointProjected[0].toFixed(2)} ${midpointProjected[1].toFixed(2)}`,
          "vector-effect": "non-scaling-stroke",
        }));
      }
      group.append(svgElement("circle", {
        class: "octa-graph-node",
        cx: centreProjected[0],
        cy: centreProjected[1],
        r: tile === 0 ? 5.2 : 4.1,
        "vector-effect": "non-scaling-stroke",
      }));
    }

    const curvePoints = kolamCurve(face, tile).map((point) => {
      const rotated = transformPoint(rotation, subtract3(worldPoint(face, point, transforms), objectCentre));
      const projected = project(rotated, scale);
      return [projected[0], projected[1]] as [number, number];
    });
    group.append(svgElement("path", {
      class: "octa-kolam-curve",
      d: projectedPath(curvePoints, true),
      "vector-effect": "non-scaling-stroke",
    }));

    const centreFlat = centroid2(faceVertices2(face));
    const centre3 = transformPoint(rotation, subtract3(worldPoint(face, centreFlat, transforms), objectCentre));
    const centreProjected = project(centre3, scale);
    group.append(svgElement("circle", {
      class: "octa-kolam-dot",
      cx: centreProjected[0],
      cy: centreProjected[1],
      r: 4.5 * clamp(centreProjected[3], 0.82, 1.2),
      "vector-effect": "non-scaling-stroke",
    }));

    if (showLabels) {
      const label = svgElement("text", {
        class: "octa-face-label",
        x: centreProjected[0],
        y: centreProjected[1] - 12,
        "text-anchor": "middle",
      });
      label.textContent = tileWord(tile);
      group.append(label);
    }

    scene.append(group);
  }

  stage.setAttribute(
    "aria-label",
    `Foldable net for ${representative.title.toLowerCase()}, with arm lengths ${representative.arms}. The net is ${Math.round(fold * 100)} percent folded.`,
  );
}

function miniNetSvg(representative: Representative): SVGSVGElement {
  const svg = svgElement("svg", { viewBox: "0 0 190 132", focusable: "false" });
  const rotatedPoints = FACE_IDS.flatMap((face) => faceVertices2(face).map((point) => [point[1], -point[0]] as Vec2));
  const xs = rotatedPoints.map((point) => point[0]);
  const ys = rotatedPoints.map((point) => point[1]);
  const minimumX = Math.min(...xs);
  const maximumX = Math.max(...xs);
  const minimumY = Math.min(...ys);
  const maximumY = Math.max(...ys);
  const scale = Math.min(166 / (maximumX - minimumX), 108 / (maximumY - minimumY));
  const offsetX = 95 - ((minimumX + maximumX) / 2) * scale;
  const offsetY = 66 - ((minimumY + maximumY) / 2) * scale;
  const mapPoint = (point: Vec2): [number, number] => [offsetX + point[1] * scale, offsetY - point[0] * scale];

  for (const face of FACE_IDS) {
    const group = svgElement("g");
    const triangle = faceVertices2(face).map(mapPoint);
    group.append(svgElement("path", {
      class: "octa-mini-face",
      d: projectedPath(triangle, true),
      "vector-effect": "non-scaling-stroke",
    }));
    const curve = kolamCurve(face, representative.tiles[face]).map(mapPoint);
    group.append(svgElement("path", {
      class: "octa-mini-curve",
      d: projectedPath(curve, true),
      "vector-effect": "non-scaling-stroke",
    }));
    const centre = mapPoint(centroid2(faceVertices2(face)));
    group.append(svgElement("circle", { class: "octa-mini-dot", cx: centre[0], cy: centre[1], r: 1.7 }));
    svg.append(group);
  }
  return svg;
}

function renderMiniNets(): void {
  root.querySelectorAll<HTMLElement>("[data-mini-net]").forEach((container) => {
    const representative = REPRESENTATIVES.find((candidate) => candidate.id === container.dataset.miniNet);
    if (!representative) return;
    container.replaceChildren(miniNetSvg(representative));
  });
}

function updateToggle(button: HTMLButtonElement, active: boolean): void {
  button.setAttribute("aria-pressed", String(active));
  button.classList.toggle("is-active", active);
}

function updateInterface(announce = false): void {
  const representative = currentRepresentative();
  const percentage = Math.round(fold * 100);
  const state = percentage === 0 ? "flat net" : percentage === 100 ? "folded octahedron" : "folding";
  foldRange.value = String(percentage);
  foldRange.style.setProperty("--fold-progress", `${percentage}%`);
  foldOutput.textContent = `${percentage}% · ${state}`;
  foldButtonLabel.textContent = fold < 0.98 ? "Fold the net" : "Unfold the net";
  foldButton.classList.toggle("is-unfold", fold >= 0.98);
  selectedTitle.textContent = representative.title;
  selectedArms.textContent = representative.arms;
  selectedDirections.textContent = representative.directionWords;
  selectedNote.textContent = representative.note;
  updateToggle(labelsToggle, showLabels);
  updateToggle(graphToggle, showGraph);

  root.querySelectorAll<HTMLButtonElement>("[data-representative]").forEach((button) => {
    const active = button.dataset.representative === representative.id;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  renderScene();
  if (announce) liveRegion.textContent = `${representative.title} selected. Arm lengths ${representative.arms}.`;
}

function cancelAnimation(): void {
  if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
  animationFrame = null;
}

function setFold(value: number): void {
  fold = clamp(value, 0, 1);
  updateInterface();
}

function animateFold(target: number): void {
  cancelAnimation();
  const start = fold;
  const distance = Math.abs(target - start);
  if (distance < 0.001) return;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) {
    setFold(target);
    liveRegion.textContent = target > 0.5 ? "The net is folded into an octahedron." : "The octahedron is unfolded into its net.";
    return;
  }
  const startTime = performance.now();
  const duration = 1450 * distance + 300;
  const frame = (time: number) => {
    const progress = clamp((time - startTime) / duration, 0, 1);
    fold = mix(start, target, easeInOutCubic(progress));
    updateInterface();
    if (progress < 1) {
      animationFrame = window.requestAnimationFrame(frame);
    } else {
      animationFrame = null;
      liveRegion.textContent = target > 0.5 ? "The net is folded into an octahedron." : "The octahedron is unfolded into its net.";
    }
  };
  animationFrame = window.requestAnimationFrame(frame);
}

root.querySelectorAll<HTMLButtonElement>("[data-representative]").forEach((button) => {
  button.addEventListener("click", () => {
    const representative = REPRESENTATIVES.find((candidate) => candidate.id === button.dataset.representative);
    if (!representative || representative.id === selected.id) return;
    selected = representative;
    updateInterface(true);
  });
});

foldRange.addEventListener("input", () => {
  cancelAnimation();
  setFold(Number(foldRange.value) / 100);
});

foldRange.addEventListener("change", () => {
  liveRegion.textContent = `The net is ${Math.round(fold * 100)} percent folded.`;
});

foldButton.addEventListener("click", () => animateFold(fold < 0.98 ? 1 : 0));

labelsToggle.addEventListener("click", () => {
  showLabels = !showLabels;
  updateInterface();
  liveRegion.textContent = showLabels ? "Tile labels are visible." : "Tile labels are hidden.";
});

graphToggle.addEventListener("click", () => {
  showGraph = !showGraph;
  updateInterface();
  liveRegion.textContent = showGraph ? "The active face-adjacency graph is visible." : "The active graph is hidden.";
});

resetButton.addEventListener("click", () => {
  cancelAnimation();
  fold = 0;
  userYaw = 0;
  userPitch = 0;
  zoom = 1;
  updateInterface();
  liveRegion.textContent = "The view has been reset to the flat net.";
});

stage.addEventListener("pointerdown", (event) => {
  cancelAnimation();
  dragState = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  stage.setPointerCapture(event.pointerId);
  stage.classList.add("is-dragging");
});

stage.addEventListener("pointermove", (event) => {
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  const deltaX = event.clientX - dragState.x;
  const deltaY = event.clientY - dragState.y;
  dragState = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  userYaw += deltaX * 0.009;
  userPitch = clamp(userPitch + deltaY * 0.009, -1.25, 1.25);
  renderScene();
});

function endDrag(event: PointerEvent): void {
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  dragState = null;
  stage.classList.remove("is-dragging");
  if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
}

stage.addEventListener("pointerup", endDrag);
stage.addEventListener("pointercancel", endDrag);

stage.addEventListener("wheel", (event) => {
  event.preventDefault();
  zoom = clamp(zoom * Math.exp(-event.deltaY * 0.001), 0.72, 1.5);
  renderScene();
}, { passive: false });

stage.addEventListener("keydown", (event) => {
  const rotationStep = event.shiftKey ? 0.18 : 0.09;
  let handled = true;
  if (event.key === "ArrowLeft") userYaw -= rotationStep;
  else if (event.key === "ArrowRight") userYaw += rotationStep;
  else if (event.key === "ArrowUp") userPitch = clamp(userPitch - rotationStep, -1.25, 1.25);
  else if (event.key === "ArrowDown") userPitch = clamp(userPitch + rotationStep, -1.25, 1.25);
  else if (event.key === "+" || event.key === "=") zoom = clamp(zoom + 0.08, 0.72, 1.5);
  else if (event.key === "-" || event.key === "_") zoom = clamp(zoom - 0.08, 0.72, 1.5);
  else if (event.key === "Home") {
    userYaw = 0;
    userPitch = 0;
    zoom = 1;
  } else if (event.key === " " || event.key === "Enter") {
    animateFold(fold < 0.98 ? 1 : 0);
  } else handled = false;
  if (handled) {
    event.preventDefault();
    renderScene();
  }
});

renderMiniNets();
showLabels = showLabels || parameters.get("labels") === "1";
showGraph = showGraph || parameters.get("graph") === "1";
updateInterface();
