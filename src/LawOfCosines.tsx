import { useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

type Vec = { x: number; y: number };
type Shape = { a: number; b: number };
type Regime = "acute" | "right" | "obtuse";

const DEFAULT_SHAPE: Shape = { a: 0.84, b: 0.73 };
const DEFAULT_ANCHOR: Vec = { x: 0.16, y: 0.14 };
const PLANE_VIEW = { minX: -2.3, minY: -1.8, width: 4.6, height: 3.6 };

const add = (u: Vec, v: Vec): Vec => ({ x: u.x + v.x, y: u.y + v.y });
const subtract = (u: Vec, v: Vec): Vec => ({ x: u.x - v.x, y: u.y - v.y });
const multiply = (amount: number, u: Vec): Vec => ({ x: amount * u.x, y: amount * u.y });
const quarterTurn = (u: Vec): Vec => ({ x: -u.y, y: u.x });
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const points = (vertices: Vec[]) => vertices.map(({ x, y }) => `${x},${y}`).join(" ");

function triangleGeometry({ a, b }: Shape) {
  const cosine = clamp((a * a + b * b - 1) / (2 * a * b), -1, 1);
  const sine = Math.sqrt(Math.max(0, 1 - cosine * cosine));
  const p = { x: a, y: 0 };
  const q = { x: b * cosine, y: b * sine };
  const d = subtract(p, q);
  const jp = quarterTurn(p);
  const jq = quarterTurn(q);
  const jd = quarterTurn(d);
  const angle = Math.acos(cosine) * 180 / Math.PI;
  const regime: Regime = Math.abs(cosine) < 0.008 ? "right" : cosine > 0 ? "acute" : "obtuse";
  return { a, b, cosine, sine, p, q, d, jp, jq, jd, angle, regime };
}

function keepInsideModuli(rawA: number, rawB: number): Shape {
  let a = clamp(rawA, 0.5, 1);
  let b = clamp(rawB, 0, 1);

  if (b > a) {
    const midpoint = (a + b) / 2;
    a = midpoint;
    b = midpoint;
  }

  const nondegenerateSum = 1.025;
  if (a + b < nondegenerateSum) {
    const correction = (nondegenerateSum - a - b) / 2;
    a += correction;
    b += correction;
  }

  a = clamp(a, 0.5125, 1);
  b = clamp(b, 0.0125, a);
  if (a + b < nondegenerateSum) b = nondegenerateSum - a;

  return { a, b };
}

function planeTiles(geometry: ReturnType<typeof triangleGeometry>, translation: Vec = { x: 0, y: 0 }, reach = 5) {
  const blue: Vec[][] = [];
  const yellow: Vec[][] = [];
  const { p, q, d, jp, jq, jd } = geometry;

  for (let m = -reach; m <= reach; m += 1) {
    for (let n = -reach; n <= reach; n += 1) {
      const origin = add(add(multiply(m, d), multiply(n, jd)), translation);
      blue.push([origin, add(origin, p), add(add(origin, p), jp), add(origin, jp)]);

      const yellowOrigin = add(add(origin, p), jp);
      yellow.push([
        yellowOrigin,
        subtract(yellowOrigin, q),
        subtract(subtract(yellowOrigin, q), jq),
        subtract(yellowOrigin, jq),
      ]);
    }
  }

  return { blue, yellow };
}

function gridLines(anchor: Vec, d: Vec, jd: Vec, reach = 7) {
  const lines: { first: Vec; second: Vec }[] = [];
  for (let index = -reach; index <= reach; index += 1) {
    const alongD = add(anchor, multiply(index, d));
    lines.push({ first: add(alongD, multiply(-reach, jd)), second: add(alongD, multiply(reach, jd)) });
    const alongJd = add(anchor, multiply(index, jd));
    lines.push({ first: add(alongJd, multiply(-reach, d)), second: add(alongJd, multiply(reach, d)) });
  }
  return lines;
}

function moduliPoint(shape: Shape): Vec {
  return {
    x: 70 + (shape.a - 0.5) * 520,
    y: 260 - shape.b * 220,
  };
}

function shapeFromModuliPoint(point: Vec): Shape {
  return keepInsideModuli(0.5 + (point.x - 70) / 520, (260 - point.y) / 220);
}

function pointerInSvg(event: ReactPointerEvent<SVGSVGElement>): Vec | null {
  const svg = event.currentTarget;
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const local = point.matrixTransform(matrix.inverse());
  return { x: local.x, y: local.y };
}

function ModuliChamber({ shape, setShape }: { shape: Shape; setShape: (shape: Shape) => void }) {
  const [dragging, setDragging] = useState(false);
  const current = moduliPoint(shape);
  const chamber = [moduliPoint({ a: 1, b: 1 }), moduliPoint({ a: 0.5, b: 0.5 }), moduliPoint({ a: 1, b: 0 })];
  const rightCurve = Array.from({ length: 42 }, (_, index) => {
    const a = Math.SQRT1_2 + (1 - Math.SQRT1_2) * index / 41;
    return moduliPoint({ a, b: Math.sqrt(Math.max(0, 1 - a * a)) });
  });
  const rightPath = rightCurve.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  function update(event: ReactPointerEvent<SVGSVGElement>) {
    const point = pointerInSvg(event);
    if (point) setShape(shapeFromModuliPoint(point));
  }

  return (
    <section className="cosine-moduli" aria-labelledby="moduli-heading">
      <div className="cosine-section-heading">
        <div><span>Shape space</span><h2 id="moduli-heading">Triangles up to similarity</h2></div>
        <strong>{triangleGeometry(shape).angle.toFixed(1)}°</strong>
      </div>
      <svg
        viewBox="0 0 400 300"
        role="img"
        aria-label="Moduli chamber of triangle shapes. Drag the point to change the triangle."
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
          update(event);
        }}
        onPointerMove={(event) => { if (dragging) update(event); }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          setDragging(false);
        }}
        onPointerCancel={() => setDragging(false)}
      >
        <defs>
          <linearGradient id="moduli-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#e8f2fb" />
            <stop offset="1" stopColor="#fff7cf" />
          </linearGradient>
          <path id="right-curve-label" d={rightPath} />
          <path id="degenerate-label" d={`M ${chamber[1].x + 18} ${chamber[1].y + 7} L ${chamber[2].x - 18} ${chamber[2].y - 7}`} />
        </defs>
        <polygon className="moduli-region" points={points(chamber)} fill="url(#moduli-fill)" />
        <path className="moduli-right-curve" d={rightPath} />
        <text className="moduli-path-label"><textPath href="#right-curve-label" startOffset="50%" textAnchor="middle">right</textPath></text>
        <text className="moduli-path-label moduli-degenerate-label"><textPath href="#degenerate-label" startOffset="50%" textAnchor="middle">degenerate limit</textPath></text>
        <text className="moduli-equilateral" x={chamber[0].x} y={chamber[0].y - 15} textAnchor="middle">equilateral</text>
        <circle className="moduli-halo" cx={current.x} cy={current.y} r="13" />
        <circle className="moduli-handle" cx={current.x} cy={current.y} r="6.5" />
      </svg>
      <div className="shape-presets" aria-label="Triangle shape presets">
        <button type="button" onClick={() => setShape({ a: 0.84, b: 0.73 })}>Acute</button>
        <button type="button" onClick={() => setShape({ a: Math.sqrt(3) / 2, b: 0.5 })}>Right</button>
        <button type="button" onClick={() => setShape({ a: 0.72, b: 0.48 })}>Obtuse</button>
      </div>
    </section>
  );
}

const triangleScreen = (point: Vec): Vec => ({ x: 150 + 145 * point.x, y: 205 - 145 * point.y });

function TriangleDiagram({ shape, anchor }: { shape: Shape; anchor: Vec }) {
  const geometry = useMemo(() => triangleGeometry(shape), [shape]);
  const { p, q, d, jp, jq, jd } = geometry;
  const zero = { x: 0, y: 0 };
  const squareA = [zero, p, subtract(p, jp), multiply(-1, jp)];
  const squareB = [q, zero, jq, add(q, jq)];
  const squareC = [p, q, add(q, jd), add(p, jd)];
  const screenPolygon = (polygon: Vec[]) => points(polygon.map(triangleScreen));

  const aTranslation = multiply(-1, jp);
  const bTranslation = subtract(add(q, jq), add(p, jp));
  const cTranslation = subtract(q, anchor);
  const aGrid = gridLines(add(anchor, aTranslation), d, jd, 5);
  const bGrid = gridLines(add(anchor, bTranslation), d, jd, 5);
  const copiedTiles = planeTiles(geometry, cTranslation, 4);

  const renderLine = (line: { first: Vec; second: Vec }, key: string) => {
    const first = triangleScreen(line.first);
    const second = triangleScreen(line.second);
    return <line key={key} x1={first.x} y1={first.y} x2={second.x} y2={second.y} />;
  };

  return (
    <section className="cosine-triangle" aria-labelledby="triangle-heading">
      <div className="cosine-section-heading">
        <div><span>Representative</span><h2 id="triangle-heading">The triangle and its squares</h2></div>
        <strong className={`regime-badge is-${geometry.regime}`}>{geometry.regime}</strong>
      </div>
      <svg viewBox="0 0 500 360" role="img" aria-label={`A ${geometry.regime} triangle with squares on sides a, b, and c`}>
        <defs>
          <clipPath id="triangle-square-a"><polygon points={screenPolygon(squareA)} /></clipPath>
          <clipPath id="triangle-square-b"><polygon points={screenPolygon(squareB)} /></clipPath>
          <clipPath id="triangle-square-c"><polygon points={screenPolygon(squareC)} /></clipPath>
        </defs>

        <polygon className="copy-square copy-a" points={screenPolygon(squareA)} />
        <g className="copied-grid" clipPath="url(#triangle-square-a)">{aGrid.map((line, index) => renderLine(line, `a-${index}`))}</g>

        <polygon className="copy-square copy-b" points={screenPolygon(squareB)} />
        <g className="copied-grid" clipPath="url(#triangle-square-b)">{bGrid.map((line, index) => renderLine(line, `b-${index}`))}</g>

        <g className="copied-tiles" clipPath="url(#triangle-square-c)">
          {copiedTiles.blue.map((tile, index) => <polygon className="plane-a-tile" points={screenPolygon(tile)} key={`copy-blue-${index}`} />)}
          {copiedTiles.yellow.map((tile, index) => <polygon className="plane-b-tile" points={screenPolygon(tile)} key={`copy-yellow-${index}`} />)}
        </g>

        <polygon className="square-border" points={screenPolygon(squareA)} />
        <polygon className="square-border" points={screenPolygon(squareB)} />
        <polygon className="square-border" points={screenPolygon(squareC)} />
        <polygon className="triangle-face" points={screenPolygon([zero, p, q])} />

        <g className="square-labels" aria-hidden="true">
          <text x={triangleScreen(multiply(0.5, add(squareA[0], squareA[2]))).x} y={triangleScreen(multiply(0.5, add(squareA[0], squareA[2]))).y}>a²</text>
          <text x={triangleScreen(multiply(0.5, add(squareB[0], squareB[2]))).x} y={triangleScreen(multiply(0.5, add(squareB[0], squareB[2]))).y}>b²</text>
          <text x={triangleScreen(multiply(0.5, add(squareC[0], squareC[2]))).x} y={triangleScreen(multiply(0.5, add(squareC[0], squareC[2]))).y}>c²</text>
        </g>
        <text className="angle-label" x={triangleScreen({ x: 0.13, y: 0.08 }).x} y={triangleScreen({ x: 0.13, y: 0.08 }).y}>C</text>
      </svg>
    </section>
  );
}

function PlaneTessellation({ shape, anchor, setAnchor }: { shape: Shape; anchor: Vec; setAnchor: (point: Vec) => void }) {
  const geometry = useMemo(() => triangleGeometry(shape), [shape]);
  const [dragging, setDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const tiles = useMemo(() => planeTiles(geometry), [geometry]);
  const lines = useMemo(() => gridLines(anchor, geometry.d, geometry.jd), [anchor, geometry.d, geometry.jd]);

  function updateAnchor(event: ReactPointerEvent<SVGSVGElement>) {
    const point = pointerInSvg(event);
    if (!point) return;
    setAnchor({
      x: clamp(point.x, PLANE_VIEW.minX + 0.12, PLANE_VIEW.minX + PLANE_VIEW.width - 0.12),
      y: clamp(-point.y, -PLANE_VIEW.minY - PLANE_VIEW.height + 0.12, -PLANE_VIEW.minY - 0.12),
    });
  }

  function moveByKeyboard(event: KeyboardEvent<SVGCircleElement>) {
    const amount = event.shiftKey ? 0.12 : 0.035;
    const movement: Record<string, Vec> = {
      ArrowLeft: { x: -amount, y: 0 },
      ArrowRight: { x: amount, y: 0 },
      ArrowUp: { x: 0, y: amount },
      ArrowDown: { x: 0, y: -amount },
    };
    if (event.key === "Home") {
      event.preventDefault();
      setAnchor(DEFAULT_ANCHOR);
      return;
    }
    if (!movement[event.key]) return;
    event.preventDefault();
    setAnchor(add(anchor, movement[event.key]));
  }

  return (
    <section className="cosine-plane" aria-labelledby="plane-heading">
      <div className="plane-topline">
        <div>
          <span>Tessellation of the plane</span>
          <h2 id="plane-heading">Two square families, one moving grid</h2>
        </div>
        <button type="button" onClick={() => setAnchor(DEFAULT_ANCHOR)}>Reset anchor</button>
      </div>
      <div className="plane-legend" aria-label="Tessellation colour key">
        <span><i className="legend-blue" />a² squares</span>
        <span><i className="legend-yellow" />b² squares</span>
        <span><i className={`legend-mixed is-${geometry.regime}`} />{geometry.regime === "acute" ? "overlap" : geometry.regime === "obtuse" ? "gap" : "no correction"}</span>
      </div>
      <svg
        ref={svgRef}
        className="plane-svg"
        viewBox={`${PLANE_VIEW.minX} ${PLANE_VIEW.minY} ${PLANE_VIEW.width} ${PLANE_VIEW.height}`}
        role="img"
        aria-label={`${geometry.regime} triangle tessellation. Drag the gold anchor to translate the c squared grid.`}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
          updateAnchor(event);
        }}
        onPointerMove={(event) => { if (dragging) updateAnchor(event); }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          setDragging(false);
        }}
        onPointerCancel={() => setDragging(false)}
      >
        <g transform="scale(1 -1)">
          <rect x={PLANE_VIEW.minX} y={-PLANE_VIEW.minY - PLANE_VIEW.height} width={PLANE_VIEW.width} height={PLANE_VIEW.height} className="plane-background" />
          <g className="plane-square-layer">
            {tiles.blue.map((tile, index) => <polygon className="plane-a-tile" points={points(tile)} key={`blue-${index}`} />)}
            {tiles.yellow.map((tile, index) => <polygon className="plane-b-tile" points={points(tile)} key={`yellow-${index}`} />)}
          </g>
          <g className="c-grid-lines">
            {lines.map((line, index) => <line key={`grid-${index}`} x1={line.first.x} y1={line.first.y} x2={line.second.x} y2={line.second.y} />)}
          </g>
          <circle
            className="grid-anchor-hit"
            cx={anchor.x}
            cy={anchor.y}
            r="0.16"
            tabIndex={0}
            role="button"
            aria-label="Movable c squared grid anchor. Use arrow keys to move it and Home to reset it."
            onKeyDown={moveByKeyboard}
          />
          <circle className="grid-anchor" cx={anchor.x} cy={anchor.y} r="0.075" aria-hidden="true" />
          <circle className="grid-anchor-centre" cx={anchor.x} cy={anchor.y} r="0.024" aria-hidden="true" />
        </g>
      </svg>
      <p className="plane-note">
        {geometry.regime === "acute"
          ? "The green parallelograms are overlaps: blue and yellow cover the same area twice."
          : geometry.regime === "obtuse"
            ? "The white parallelograms are gaps between the two families of squares."
            : "At a right angle the overlaps or gaps collapse, leaving the Pythagorean tessellation."}
      </p>
    </section>
  );
}

export function LawOfCosines({ embedded = false }: { embedded?: boolean }) {
  const [shape, setShape] = useState<Shape>(DEFAULT_SHAPE);
  const [anchor, setAnchor] = useState<Vec>(DEFAULT_ANCHOR);

  return (
    <div className={`cosine-lab ${embedded ? "is-cosine-embedded" : ""}`}>
      <header className="cosine-hero">
        <div className="eyebrow"><span>Interactive geometry</span><span className="eyebrow-line" /></div>
        <h1>A tessellation based proof for the law of cosines</h1>
        <div className="cosine-equation" aria-label="c squared equals a squared plus b squared minus two a b cosine C">
          c<sup>2</sup> = a<sup>2</sup> + b<sup>2</sup> − 2ab cos C
        </div>
      </header>

      <div className="cosine-first-box">
        <ModuliChamber shape={shape} setShape={setShape} />
        <TriangleDiagram shape={shape} anchor={anchor} />
      </div>

      <PlaneTessellation shape={shape} anchor={anchor} setAnchor={setAnchor} />
    </div>
  );
}

