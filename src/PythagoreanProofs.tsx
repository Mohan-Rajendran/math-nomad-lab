import { useMemo, useState } from "react";
import type { ChangeEvent, KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

type Vec = { x: number; y: number };
type Preset = "free" | "medieval" | "perigal" | "ferrarese";

const DEFAULT_ANGLE = 30;
const PLANE_VIEW = { minX: -2.25, minY: -1.62, width: 4.5, height: 3.24 };

const add = (first: Vec, second: Vec): Vec => ({ x: first.x + second.x, y: first.y + second.y });
const subtract = (first: Vec, second: Vec): Vec => ({ x: first.x - second.x, y: first.y - second.y });
const multiply = (amount: number, vector: Vec): Vec => ({ x: amount * vector.x, y: amount * vector.y });
const translatePolygon = (polygon: Vec[], translation: Vec) => polygon.map((point) => add(point, translation));
const points = (polygon: Vec[]) => polygon.map(({ x, y }) => `${x},${y}`).join(" ");
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

function geometry(angle: number, mirrored: boolean) {
  const radians = angle * Math.PI / 180;
  const a = Math.cos(radians);
  const b = Math.sin(radians);
  const epsilon = mirrored ? 1 : -1;
  const horizontal = -epsilon;
  const origin = { x: 0, y: 0 };
  const vertexA = { x: horizontal * a, y: 0 };
  const vertexB = { x: 0, y: b };
  const u = { x: epsilon * a, y: b };
  const v = { x: -epsilon * b, y: a };
  const bTileOffset = { x: epsilon * (a - b) / 2, y: (a + b) / 2 };
  return { a, b, epsilon, horizontal, origin, vertexA, vertexB, u, v, bTileOffset };
}

function squareAround(centre: Vec, side: number): Vec[] {
  const half = side / 2;
  return [
    { x: centre.x - half, y: centre.y - half },
    { x: centre.x + half, y: centre.y - half },
    { x: centre.x + half, y: centre.y + half },
    { x: centre.x - half, y: centre.y + half },
  ];
}

function planeTiles(shape: ReturnType<typeof geometry>, reach = 9) {
  const aTiles: Vec[][] = [];
  const bTiles: Vec[][] = [];
  for (let m = -reach; m <= reach; m += 1) {
    for (let n = -reach; n <= reach; n += 1) {
      const period = add(multiply(m, shape.u), multiply(n, shape.v));
      aTiles.push(squareAround(period, shape.a));
      bTiles.push(squareAround(add(period, shape.bTileOffset), shape.b));
    }
  }
  return { aTiles, bTiles };
}

function squareGrid(anchor: Vec, u: Vec, v: Vec, reach = 9) {
  const lines: { first: Vec; second: Vec }[] = [];
  for (let index = -reach; index <= reach; index += 1) {
    const onUFamily = add(anchor, multiply(index, v));
    lines.push({ first: add(onUFamily, multiply(-reach, u)), second: add(onUFamily, multiply(reach, u)) });
    const onVFamily = add(anchor, multiply(index, u));
    lines.push({ first: add(onVFamily, multiply(-reach, v)), second: add(onVFamily, multiply(reach, v)) });
  }
  return lines;
}

function historicalAnchor(preset: Preset, shape: ReturnType<typeof geometry>): Vec {
  if (preset === "medieval") return { x: shape.epsilon * shape.a / 2, y: shape.a / 2 };
  if (preset === "ferrarese") return shape.bTileOffset;
  return { x: 0, y: 0 };
}

function pointInSvg(event: ReactPointerEvent<SVGSVGElement>): Vec | null {
  const matrix = event.currentTarget.getScreenCTM();
  if (!matrix) return null;
  const point = event.currentTarget.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const local = point.matrixTransform(matrix.inverse());
  return { x: local.x, y: -local.y };
}

function TrianglePanel({ shape, angle, anchor }: {
  shape: ReturnType<typeof geometry>;
  angle: number;
  anchor: Vec;
}) {
  const { a, b, epsilon, horizontal, origin, vertexA, vertexB, u, v } = shape;
  const squareA = [origin, vertexA, { x: vertexA.x, y: -a }, { x: 0, y: -a }];
  const squareB = [origin, vertexB, { x: epsilon * b, y: b }, { x: epsilon * b, y: 0 }];
  const squareC = [vertexA, vertexB, add(vertexB, v), add(vertexA, v)];
  const legACentre = { x: horizontal * a / 2, y: -a / 2 };
  const legBCentre = { x: epsilon * b / 2, y: b / 2 };
  const translationA = legACentre;
  const translationB = subtract(legBCentre, shape.bTileOffset);
  const translationC = subtract(vertexA, anchor);
  const grid = useMemo(() => squareGrid(anchor, u, v, 9), [anchor, u, v]);
  const tiles = useMemo(() => planeTiles(shape, 8), [shape]);
  const rightMarkSize = Math.min(a, b) * 0.13;
  const rightMark = epsilon < 0
    ? [{ x: 0, y: rightMarkSize }, { x: rightMarkSize, y: rightMarkSize }, { x: rightMarkSize, y: 0 }]
    : [{ x: 0, y: rightMarkSize }, { x: -rightMarkSize, y: rightMarkSize }, { x: -rightMarkSize, y: 0 }];

  const translatedLine = (line: { first: Vec; second: Vec }, translation: Vec, key: string) => (
    <line
      key={key}
      x1={line.first.x + translation.x}
      y1={line.first.y + translation.y}
      x2={line.second.x + translation.x}
      y2={line.second.y + translation.y}
    />
  );

  return (
    <section className="pythagoras-panel pythagoras-triangle-panel" aria-labelledby="pythagoras-triangle-heading">
      <div className="pythagoras-panel-heading">
        <div>
          <span>Shape</span>
          <h2 id="pythagoras-triangle-heading">Right triangle and its squares</h2>
        </div>
        <strong>{angle.toFixed(1)}°</strong>
      </div>
      <svg className="pythagoras-triangle-svg" viewBox="-1.55 -1.72 3.1 3.16" role="img" aria-label={`Right triangle with smallest angle ${angle.toFixed(1)} degrees and squares on all three sides`}>
        <defs>
          <clipPath id="pythagoras-square-a"><polygon points={points(squareA)} /></clipPath>
          <clipPath id="pythagoras-square-b"><polygon points={points(squareB)} /></clipPath>
          <clipPath id="pythagoras-square-c"><polygon points={points(squareC)} /></clipPath>
        </defs>
        <g transform="scale(1 -1)">
          <polygon className="pythagoras-a-fill" points={points(squareA)} />
          <g className="pythagoras-copied-grid" clipPath="url(#pythagoras-square-a)">
            {grid.map((line, index) => translatedLine(line, translationA, `leg-a-${index}`))}
          </g>

          <polygon className="pythagoras-b-fill" points={points(squareB)} />
          <g className="pythagoras-copied-grid" clipPath="url(#pythagoras-square-b)">
            {grid.map((line, index) => translatedLine(line, translationB, `leg-b-${index}`))}
          </g>

          <g className="pythagoras-copied-tiles" clipPath="url(#pythagoras-square-c)">
            {tiles.aTiles.map((tile, index) => <polygon className="pythagoras-a-tile" points={points(translatePolygon(tile, translationC))} key={`copy-a-${index}`} />)}
            {tiles.bTiles.map((tile, index) => <polygon className="pythagoras-b-tile" points={points(translatePolygon(tile, translationC))} key={`copy-b-${index}`} />)}
          </g>

          <polygon className="pythagoras-square-outline" points={points(squareA)} />
          <polygon className="pythagoras-square-outline" points={points(squareB)} />
          <polygon className="pythagoras-square-outline" points={points(squareC)} />
          <polygon className="pythagoras-triangle-face" points={points([origin, vertexA, vertexB])} />
          <polyline className="pythagoras-right-mark" points={points(rightMark)} />
        </g>
      </svg>
    </section>
  );
}

const presetDescriptions: Record<Preset, string> = {
  free: "Mahlo–MacMahon–Siddons continuous family",
  medieval: "Medieval corner · attributed to Thābit ibn Qurra, via al-Nayrīzī",
  perigal: "Perigal · symmetric five-piece dissection",
  ferrarese: "Symmetric twin · attributed to Giorgio Ferrarese",
};

function TilingPanel({ shape, anchor, preset, setPreset, setAnchor, resetAnchor, toggleMirror, mirrored }: {
  shape: ReturnType<typeof geometry>;
  anchor: Vec;
  preset: Preset;
  setPreset: (preset: Preset) => void;
  setAnchor: (anchor: Vec) => void;
  resetAnchor: () => void;
  toggleMirror: () => void;
  mirrored: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const tiles = useMemo(() => planeTiles(shape, 11), [shape]);
  const lines = useMemo(() => squareGrid(anchor, shape.u, shape.v, 11), [anchor, shape.u, shape.v]);

  function updateAnchor(event: ReactPointerEvent<SVGSVGElement>) {
    const point = pointInSvg(event);
    if (!point) return;
    setPreset("free");
    setAnchor({
      x: clamp(point.x, PLANE_VIEW.minX + 0.08, PLANE_VIEW.minX + PLANE_VIEW.width - 0.08),
      y: clamp(point.y, PLANE_VIEW.minY + 0.08, PLANE_VIEW.minY + PLANE_VIEW.height - 0.08),
    });
  }

  function moveAnchor(event: KeyboardEvent<SVGCircleElement>) {
    if (event.key === "Home") {
      event.preventDefault();
      resetAnchor();
      return;
    }
    const amount = event.shiftKey ? 0.12 : 0.035;
    const movements: Record<string, Vec> = {
      ArrowLeft: { x: -amount, y: 0 },
      ArrowRight: { x: amount, y: 0 },
      ArrowUp: { x: 0, y: amount },
      ArrowDown: { x: 0, y: -amount },
    };
    const movement = movements[event.key];
    if (!movement) return;
    event.preventDefault();
    setPreset("free");
    setAnchor(add(anchor, movement));
  }

  function choosePreset(event: ChangeEvent<HTMLSelectElement>) {
    const nextPreset = event.target.value as Preset;
    setPreset(nextPreset);
    if (nextPreset !== "free") setAnchor(historicalAnchor(nextPreset, shape));
  }

  return (
    <section className="pythagoras-panel pythagoras-plane-panel" aria-labelledby="pythagoras-plane-heading">
      <div className="pythagoras-panel-heading pythagoras-plane-heading">
        <div>
          <span>Dissection</span>
          <h2 id="pythagoras-plane-heading">Two tilings of the plane</h2>
        </div>
        <button className="pythagoras-mirror" type="button" aria-pressed={mirrored} onClick={toggleMirror}>
          Mirror
        </button>
      </div>
      <div className="pythagoras-controls">
        <label>
          <span>Historical anchor</span>
          <select value={preset} onChange={choosePreset}>
            <option value="free">Free / continuous family</option>
            <option value="medieval">Medieval corner</option>
            <option value="perigal">Perigal</option>
            <option value="ferrarese">Ferrarese twin</option>
          </select>
        </label>
        <button type="button" onClick={resetAnchor}>Reset anchor</button>
      </div>
      <p className="pythagoras-attribution" aria-live="polite">{presetDescriptions[preset]}</p>
      <svg
        className="pythagoras-plane-svg"
        viewBox={`${PLANE_VIEW.minX} ${-PLANE_VIEW.minY - PLANE_VIEW.height} ${PLANE_VIEW.width} ${PLANE_VIEW.height}`}
        role="img"
        aria-label="A pastel Pythagorean tiling overlaid by a movable grid of hypotenuse squares"
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
          <rect className="pythagoras-plane-background" x={PLANE_VIEW.minX} y={PLANE_VIEW.minY} width={PLANE_VIEW.width} height={PLANE_VIEW.height} />
          <g className="pythagoras-plane-tiles">
            {tiles.aTiles.map((tile, index) => <polygon className="pythagoras-a-tile" points={points(tile)} key={`plane-a-${index}`} />)}
            {tiles.bTiles.map((tile, index) => <polygon className="pythagoras-b-tile" points={points(tile)} key={`plane-b-${index}`} />)}
          </g>
          <g className="pythagoras-grid-lines">
            {lines.map((line, index) => <line key={`plane-grid-${index}`} x1={line.first.x} y1={line.first.y} x2={line.second.x} y2={line.second.y} />)}
          </g>
          <circle
            className="pythagoras-anchor-hit"
            cx={anchor.x}
            cy={anchor.y}
            r="0.17"
            tabIndex={0}
            role="button"
            aria-label="Movable square-grid anchor. Use arrow keys to move it and Home to reset it."
            onKeyDown={moveAnchor}
          />
          <circle className="pythagoras-anchor" cx={anchor.x} cy={anchor.y} r="0.072" aria-hidden="true" />
          <circle className="pythagoras-anchor-centre" cx={anchor.x} cy={anchor.y} r="0.022" aria-hidden="true" />
        </g>
      </svg>
    </section>
  );
}

export function PythagoreanProofs({ embedded = false }: { embedded?: boolean }) {
  const [angle, setAngle] = useState(DEFAULT_ANGLE);
  const [mirrored, setMirrored] = useState(false);
  const [preset, setPreset] = useState<Preset>("perigal");
  const [anchor, setAnchor] = useState<Vec>({ x: 0, y: 0 });
  const shape = useMemo(() => geometry(angle, mirrored), [angle, mirrored]);

  function changeAngle(event: ChangeEvent<HTMLInputElement>) {
    const nextAngle = Number(event.target.value);
    const nextShape = geometry(nextAngle, mirrored);
    setAngle(nextAngle);
    if (preset !== "free") setAnchor(historicalAnchor(preset, nextShape));
  }

  function toggleMirror() {
    const nextMirrored = !mirrored;
    const nextShape = geometry(angle, nextMirrored);
    setMirrored(nextMirrored);
    setAnchor(preset === "free" ? { x: -anchor.x, y: anchor.y } : historicalAnchor(preset, nextShape));
  }

  function resetAnchor() {
    setPreset("perigal");
    setAnchor({ x: 0, y: 0 });
  }

  return (
    <div className={`pythagoras-lab ${embedded ? "is-pythagoras-embedded" : ""}`}>
      <header className="pythagoras-hero">
        <div className="eyebrow"><span>Interactive geometry</span><span className="eyebrow-line" /></div>
        <h1><span>Infinitely many “proofs”</span> of Pythagoras’ theorem</h1>
      </header>

      <div className="pythagoras-angle-control">
        <label htmlFor="pythagoras-angle">Smallest angle</label>
        <input id="pythagoras-angle" type="range" min="1" max="45" step="0.1" value={angle} onChange={changeAngle} />
        <output htmlFor="pythagoras-angle">{angle.toFixed(1)}°</output>
      </div>

      <div className="pythagoras-stage">
        <TrianglePanel shape={shape} angle={angle} anchor={anchor} />
        <TilingPanel
          shape={shape}
          anchor={anchor}
          preset={preset}
          setPreset={setPreset}
          setAnchor={setAnchor}
          resetAnchor={resetAnchor}
          toggleMirror={toggleMirror}
          mirrored={mirrored}
        />
      </div>
    </div>
  );
}
