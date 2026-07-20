import { useEffect, useMemo, useRef, useState } from "react";
import { LawOfCosines } from "./LawOfCosines";
import "./law-of-cosines.css";

type Direction = "E" | "N" | "W" | "S";
type Epsilon = 1 | -1;
type TileSource = { kind: "tray" } | { kind: "board"; index: number };
type Selection = { tile: number; source: TileSource } | null;
type EdgeIssue = { first: number; firstDirection: Direction; second?: number; secondDirection?: Direction };
type PointerDrag = {
  tile: number;
  source: TileSource;
  pointerId: number;
  startX: number;
  startY: number;
  dragging: boolean;
};
type PuzzlePair = { epsilon: Epsilon; x: number; y: number; distance: number; path: number[] };

const EMPTY_BOARD: (number | null)[] = Array(16).fill(null);
const TILE_VALUES = Array.from({ length: 16 }, (_, index) => index);
const VALID_EXAMPLE = [
  1, 9, 11, 3,
  13, 14, 15, 7,
  12, 2, 4, 5,
  0, 8, 10, 6,
];

const DIRECTION_BITS: Record<Direction, number> = { E: 8, N: 4, W: 2, S: 1 };
const PUZZLE_SEEDS: { epsilon: Epsilon; distance: number; partner: number; state: number[] }[] = [
  { epsilon: -1, distance: 10, partner: 1, state: [9, 10, 11, 2, 5, 1, 13, 3, 12, 14, 15, 7, 0, 8, 6, 4] },
  { epsilon: -1, distance: 10, partner: 0, state: [1, 9, 10, 2, 5, 13, 11, 3, 12, 14, 15, 7, 0, 8, 6, 4] },
  { epsilon: -1, distance: 12, partner: 3, state: [9, 10, 3, 1, 13, 11, 14, 7, 12, 15, 2, 5, 0, 4, 8, 6] },
  { epsilon: -1, distance: 12, partner: 2, state: [9, 10, 3, 1, 13, 11, 7, 5, 4, 12, 15, 6, 0, 8, 14, 2] },
  { epsilon: -1, distance: 14, partner: 5, state: [8, 11, 10, 3, 9, 7, 1, 5, 13, 14, 15, 6, 4, 0, 12, 2] },
  { epsilon: -1, distance: 14, partner: 4, state: [8, 10, 3, 1, 9, 11, 7, 5, 13, 14, 15, 6, 4, 0, 12, 2] },
  { epsilon: 1, distance: 10, partner: 7, state: [1, 9, 11, 2, 5, 13, 14, 3, 12, 15, 10, 7, 0, 4, 8, 6] },
  { epsilon: 1, distance: 10, partner: 6, state: [1, 9, 11, 2, 13, 14, 15, 3, 5, 0, 12, 7, 4, 8, 10, 6] },
  { epsilon: 1, distance: 10, partner: 9, state: [9, 10, 11, 2, 5, 1, 13, 3, 12, 15, 14, 7, 0, 4, 8, 6] },
  { epsilon: 1, distance: 10, partner: 8, state: [1, 9, 10, 2, 5, 13, 11, 3, 12, 15, 14, 7, 0, 4, 8, 6] },
  { epsilon: 1, distance: 12, partner: 11, state: [8, 11, 2, 1, 9, 15, 10, 7, 13, 14, 3, 5, 4, 0, 12, 6] },
  { epsilon: 1, distance: 12, partner: 10, state: [8, 11, 10, 2, 9, 15, 3, 1, 13, 14, 7, 5, 4, 0, 12, 6] },
];
// Exact shortest paths, independently replay-verified. We use non-10 distances
// so each freshly generated challenge visibly demonstrates that 10 is not universal.
const CHALLENGE_PAIRS: PuzzlePair[] = [
  { epsilon: -1, x: 2, y: 3, distance: 12, path: [4, 8, 2, 14, 7, 5, 6, 2, 14, 15, 12, 4] },
  { epsilon: -1, x: 2, y: 4, distance: 31, path: [4, 15, 2, 8, 15, 2, 12, 13, 11, 14, 8, 15, 2, 12, 14, 8, 7, 1, 3, 10, 8, 11, 9, 8, 11, 7, 1, 5, 6, 2, 12] },
  { epsilon: -1, x: 2, y: 5, distance: 29, path: [4, 15, 2, 8, 15, 2, 12, 13, 11, 14, 8, 15, 2, 12, 14, 8, 3, 10, 8, 11, 9, 8, 10, 3, 7, 5, 6, 2, 12] },
  { epsilon: -1, x: 3, y: 4, distance: 29, path: [4, 13, 11, 7, 15, 12, 8, 14, 12, 15, 7, 8, 15, 6, 5, 1, 3, 10, 8, 11, 9, 8, 11, 7, 1, 5, 6, 15, 14] },
  { epsilon: -1, x: 3, y: 5, distance: 23, path: [4, 13, 9, 10, 11, 7, 15, 12, 8, 14, 12, 15, 7, 8, 13, 9, 8, 11, 10, 8, 9, 13, 14] },
  { epsilon: -1, x: 4, y: 5, distance: 14, path: [14, 15, 6, 5, 1, 7, 11, 10, 3, 1, 5, 6, 15, 14] },
  { epsilon: 1, x: 6, y: 8, distance: 14, path: [12, 15, 10, 14, 13, 10, 15, 5, 1, 9, 10, 1, 5, 12] },
  { epsilon: 1, x: 6, y: 9, distance: 18, path: [12, 15, 10, 14, 11, 9, 13, 10, 14, 11, 10, 13, 9, 10, 11, 14, 15, 12] },
  { epsilon: 1, x: 7, y: 8, distance: 24, path: [12, 15, 14, 13, 5, 12, 15, 10, 8, 4, 12, 15, 10, 14, 13, 10, 15, 5, 1, 9, 10, 1, 5, 12] },
  { epsilon: 1, x: 7, y: 9, distance: 26, path: [12, 15, 14, 13, 5, 12, 15, 10, 8, 15, 10, 14, 11, 9, 13, 10, 14, 11, 10, 13, 9, 10, 11, 14, 15, 4] },
  { epsilon: 1, x: 10, y: 11, distance: 12, path: [12, 6, 5, 7, 1, 2, 10, 3, 7, 5, 6, 12] },
];
const DEFAULT_PUZZLE_SEED_INDEX = 6;
const DEFAULT_PUZZLE_STATE = PUZZLE_SEEDS[DEFAULT_PUZZLE_SEED_INDEX].state;
const DEFAULT_CHALLENGE_PAIR_INDEX = 7;

function word(tile: number) {
  return tile.toString(2).padStart(4, "0");
}

function hasPort(tile: number, direction: Direction) {
  return (tile & DIRECTION_BITS[direction]) !== 0;
}

function coordinate(index: number) {
  const row = Math.floor(index / 4);
  const column = index % 4;
  return `(${column + 1}, ${4 - row})`;
}

function tileDescription(tile: number) {
  const directions = (["E", "N", "W", "S"] as Direction[]).filter((direction) => hasPort(tile, direction));
  if (directions.length === 0) return "no boundary connections";
  const names: Record<Direction, string> = { E: "east", N: "north", W: "west", S: "south" };
  return `${directions.map((direction) => names[direction]).join(", ")} ${directions.length === 1 ? "connection" : "connections"}`;
}

function kolamPath(tile: number) {
  const [east, north, west, south] = word(tile).split("").map(Number);
  const radius = 25 * Math.SQRT2;
  const section = (active: number, anchorX: number, anchorY: number, endX: number, endY: number) =>
    active
      ? `L ${anchorX} ${anchorY} L ${endX} ${endY}`
      : `A ${radius} ${radius} 0 0 1 ${endX} ${endY}`;

  return [
    "M 75 25",
    section(east, 100, 50, 75, 75),
    section(south, 50, 100, 25, 75),
    section(west, 0, 50, 25, 25),
    section(north, 50, 0, 75, 25),
    "Z",
  ].join(" ");
}

function KolamArt({ tile }: { tile: number }) {
  return (
    <svg
      className="kolam-art"
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="100" height="100" fill="#A0522D" />
      <path
        d={kolamPath(tile)}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="50" cy="50" r="6" fill="#FFFFFF" />
    </svg>
  );
}

function analyseBoard(board: (number | null)[]) {
  const placed = board.filter((tile) => tile !== null).length;
  const boundaryIssues: EdgeIssue[] = [];
  const matchingIssues: EdgeIssue[] = [];
  let checkedAdjacencies = 0;

  board.forEach((tile, index) => {
    if (tile === null) return;
    const row = Math.floor(index / 4);
    const column = index % 4;
    if (row === 0 && hasPort(tile, "N")) boundaryIssues.push({ first: index, firstDirection: "N" });
    if (row === 3 && hasPort(tile, "S")) boundaryIssues.push({ first: index, firstDirection: "S" });
    if (column === 0 && hasPort(tile, "W")) boundaryIssues.push({ first: index, firstDirection: "W" });
    if (column === 3 && hasPort(tile, "E")) boundaryIssues.push({ first: index, firstDirection: "E" });
  });

  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      const index = row * 4 + column;
      if (column < 3 && board[index] !== null && board[index + 1] !== null) {
        checkedAdjacencies += 1;
        if (hasPort(board[index]!, "E") !== hasPort(board[index + 1]!, "W")) {
          matchingIssues.push({ first: index, firstDirection: "E", second: index + 1, secondDirection: "W" });
        }
      }
      if (row < 3 && board[index] !== null && board[index + 4] !== null) {
        checkedAdjacencies += 1;
        if (hasPort(board[index]!, "S") !== hasPort(board[index + 4]!, "N")) {
          matchingIssues.push({ first: index, firstDirection: "S", second: index + 4, secondDirection: "N" });
        }
      }
    }
  }

  const nonzeroPositions = board
    .map((tile, index) => (tile !== null && tile !== 0 ? index : -1))
    .filter((index) => index >= 0);
  const unseen = new Set(nonzeroPositions);
  let components = 0;

  while (unseen.size > 0) {
    components += 1;
    const start = unseen.values().next().value as number;
    unseen.delete(start);
    const queue = [start];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const row = Math.floor(current / 4);
      const column = current % 4;
      const neighbours: [number, Direction, Direction][] = [];
      if (column < 3) neighbours.push([current + 1, "E", "W"]);
      if (column > 0) neighbours.push([current - 1, "W", "E"]);
      if (row < 3) neighbours.push([current + 4, "S", "N"]);
      if (row > 0) neighbours.push([current - 4, "N", "S"]);
      for (const [next, outward, inward] of neighbours) {
        const nextTile = board[next];
        if (
          nextTile !== null &&
          nextTile !== 0 &&
          unseen.has(next) &&
          hasPort(board[current]!, outward) &&
          hasPort(nextTile, inward)
        ) {
          unseen.delete(next);
          queue.push(next);
        }
      }
    }
  }

  const complete = placed === 16;
  const correct = complete && boundaryIssues.length === 0 && matchingIssues.length === 0 && components === 1;
  return { placed, complete, boundaryIssues, matchingIssues, checkedAdjacencies, components, correct };
}

function epsilonDetails(board: number[]) {
  let inversions = 0;
  for (let first = 0; first < board.length; first += 1) {
    for (let second = first + 1; second < board.length; second += 1) {
      if (board[first] > board[second]) inversions += 1;
    }
  }
  const blankIndex = board.indexOf(0);
  const a0 = (blankIndex % 4) + 1;
  const b0 = 4 - Math.floor(blankIndex / 4);
  const exponent = inversions + a0 + b0;
  const epsilon: Epsilon = exponent % 2 === 0 ? 1 : -1;
  return { inversions, a0, b0, exponent, epsilon };
}

function validatePuzzleSeeds() {
  const allowedBlankPositions = new Set([9, 12, 13]);
  PUZZLE_SEEDS.forEach((seed, index) => {
    const inventory = [...seed.state].sort((first, second) => first - second);
    const partner = PUZZLE_SEEDS[seed.partner];
    const validInventory = inventory.every((tile, tileIndex) => tile === tileIndex);
    if (
      !validInventory ||
      !allowedBlankPositions.has(seed.state.indexOf(0)) ||
      !analyseBoard(seed.state).correct ||
      epsilonDetails(seed.state).epsilon !== seed.epsilon ||
      !partner ||
      partner.partner !== index ||
      partner.epsilon !== seed.epsilon ||
      seed.state.every((tile, tileIndex) => tile === partner.state[tileIndex])
    ) {
      throw new Error(`Invalid puzzle seed pair at index ${index}.`);
    }
  });
}

function validateChallengePairs() {
  CHALLENGE_PAIRS.forEach((pair, pairIndex) => {
    const x = PUZZLE_SEEDS[pair.x];
    const y = PUZZLE_SEEDS[pair.y];
    const replay = [...x.state];
    if (!x || !y || x.epsilon !== pair.epsilon || y.epsilon !== pair.epsilon || pair.path.length !== pair.distance) {
      throw new Error(`Invalid challenge pair at index ${pairIndex}.`);
    }
    pair.path.forEach((tile) => {
      const blank = replay.indexOf(0);
      const tileIndex = replay.indexOf(tile);
      if (!neighbouringIndices(blank).includes(tileIndex)) throw new Error(`Illegal challenge path at index ${pairIndex}.`);
      replay[blank] = tile;
      replay[tileIndex] = 0;
    });
    if (!sameState(replay, y.state)) throw new Error(`Challenge path misses its target at index ${pairIndex}.`);
  });
}

validatePuzzleSeeds();
validateChallengePairs();

function sameState(first: number[], second: number[]) {
  return first.every((tile, index) => tile === second[index]);
}

function neighbouringIndices(index: number) {
  const row = Math.floor(index / 4);
  const column = index % 4;
  const neighbours: number[] = [];
  if (row > 0) neighbours.push(index - 4);
  if (row < 3) neighbours.push(index + 4);
  if (column > 0) neighbours.push(index - 1);
  if (column < 3) neighbours.push(index + 1);
  return neighbours;
}

function pickPuzzleSeedIndex(epsilon: Epsilon, avoidIndex?: number) {
  const candidates = PUZZLE_SEEDS
    .map((seed, index) => ({ seed, index }))
    .filter(({ seed, index }) => seed.epsilon === epsilon && index !== avoidIndex);
  return candidates[Math.floor(Math.random() * candidates.length)].index;
}

function pickChallengePairIndex(epsilon: Epsilon, avoidIndex?: number) {
  const candidates = CHALLENGE_PAIRS
    .map((pair, index) => ({ pair, index }))
    .filter(({ pair, index }) => pair.epsilon === epsilon && index !== avoidIndex);
  return candidates[Math.floor(Math.random() * candidates.length)].index;
}

function puzzleStateKey(state: number[]) {
  return state.map((tile) => tile.toString(16)).join("");
}

function manhattanDistance(state: number[], targetPositions: number[]) {
  let distance = 0;
  state.forEach((tile, index) => {
    if (tile === 0) return;
    const target = targetPositions[tile];
    distance += Math.abs(Math.floor(index / 4) - Math.floor(target / 4)) + Math.abs((index % 4) - (target % 4));
  });
  return distance;
}

function canReachWithin(start: number[], target: number[], maximumDistance: number) {
  if (maximumDistance < 0) return false;
  if (sameState(start, target)) return true;

  const targetPositions = Array(16).fill(0);
  target.forEach((tile, index) => { targetPositions[tile] = index; });
  const initialHeuristic = manhattanDistance(start, targetPositions);
  if (initialHeuristic > maximumDistance) return false;

  type SearchNode = { state: number[]; key: string; blank: number; steps: number; heuristic: number };
  const heap: SearchNode[] = [];
  const score = (node: SearchNode) => node.steps + node.heuristic;
  const push = (node: SearchNode) => {
    heap.push(node);
    let index = heap.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (score(heap[parent]) <= score(heap[index])) break;
      [heap[parent], heap[index]] = [heap[index], heap[parent]];
      index = parent;
    }
  };
  const pop = () => {
    const root = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < heap.length && score(heap[left]) < score(heap[smallest])) smallest = left;
        if (right < heap.length && score(heap[right]) < score(heap[smallest])) smallest = right;
        if (smallest === index) break;
        [heap[index], heap[smallest]] = [heap[smallest], heap[index]];
        index = smallest;
      }
    }
    return root;
  };

  const startKey = puzzleStateKey(start);
  const targetKey = puzzleStateKey(target);
  const bestSteps = new Map<string, number>([[startKey, 0]]);
  push({ state: [...start], key: startKey, blank: start.indexOf(0), steps: 0, heuristic: initialHeuristic });

  while (heap.length > 0) {
    const current = pop();
    if (current.key === targetKey) return true;
    if (current.steps >= maximumDistance) continue;
    for (const neighbour of neighbouringIndices(current.blank)) {
      const movedTile = current.state[neighbour];
      const next = [...current.state];
      next[current.blank] = movedTile;
      next[neighbour] = 0;
      const nextSteps = current.steps + 1;
      const oldTargetDistance = Math.abs(Math.floor(neighbour / 4) - Math.floor(targetPositions[movedTile] / 4)) + Math.abs((neighbour % 4) - (targetPositions[movedTile] % 4));
      const newTargetDistance = Math.abs(Math.floor(current.blank / 4) - Math.floor(targetPositions[movedTile] / 4)) + Math.abs((current.blank % 4) - (targetPositions[movedTile] % 4));
      const nextHeuristic = current.heuristic - oldTargetDistance + newTargetDistance;
      if (nextSteps + nextHeuristic > maximumDistance) continue;
      const key = puzzleStateKey(next);
      if ((bestSteps.get(key) ?? Infinity) <= nextSteps) continue;
      bestSteps.set(key, nextSteps);
      push({ state: next, key, blank: neighbour, steps: nextSteps, heuristic: nextHeuristic });
    }
  }
  return false;
}

function distanceAfterSlide(next: number[], target: number[], currentDistance: number) {
  if (sameState(next, target)) return 0;
  if (currentDistance === 0) return 1;
  return canReachWithin(next, target, currentDistance - 1) ? currentDistance - 1 : currentDistance + 1;
}

function findPuzzlePath(start: number[], target: number[], maximumDistance: number) {
  if (sameState(start, target)) return [];

  const targetPositions = Array(16).fill(0);
  target.forEach((tile, index) => { targetPositions[tile] = index; });
  const initialHeuristic = manhattanDistance(start, targetPositions);
  if (initialHeuristic > maximumDistance) return null;

  type PathNode = { state: number[]; key: string; blank: number; steps: number; heuristic: number };
  const heap: PathNode[] = [];
  const score = (node: PathNode) => node.steps + node.heuristic;
  const push = (node: PathNode) => {
    heap.push(node);
    let index = heap.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (score(heap[parent]) <= score(heap[index])) break;
      [heap[parent], heap[index]] = [heap[index], heap[parent]];
      index = parent;
    }
  };
  const pop = () => {
    const root = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < heap.length && score(heap[left]) < score(heap[smallest])) smallest = left;
        if (right < heap.length && score(heap[right]) < score(heap[smallest])) smallest = right;
        if (smallest === index) break;
        [heap[index], heap[smallest]] = [heap[smallest], heap[index]];
        index = smallest;
      }
    }
    return root;
  };

  const startKey = puzzleStateKey(start);
  const targetKey = puzzleStateKey(target);
  const bestSteps = new Map<string, number>([[startKey, 0]]);
  const parent = new Map<string, { previous: string; tile: number }>();
  push({ state: [...start], key: startKey, blank: start.indexOf(0), steps: 0, heuristic: initialHeuristic });

  while (heap.length > 0) {
    const current = pop();
    if (current.key === targetKey) {
      const path: number[] = [];
      let key = targetKey;
      while (key !== startKey) {
        const step = parent.get(key)!;
        path.push(step.tile);
        key = step.previous;
      }
      return path.reverse();
    }
    if (current.steps >= maximumDistance) continue;
    for (const neighbour of neighbouringIndices(current.blank)) {
      const movedTile = current.state[neighbour];
      const next = [...current.state];
      next[current.blank] = movedTile;
      next[neighbour] = 0;
      const nextSteps = current.steps + 1;
      const oldTargetDistance = Math.abs(Math.floor(neighbour / 4) - Math.floor(targetPositions[movedTile] / 4)) + Math.abs((neighbour % 4) - (targetPositions[movedTile] % 4));
      const newTargetDistance = Math.abs(Math.floor(current.blank / 4) - Math.floor(targetPositions[movedTile] / 4)) + Math.abs((current.blank % 4) - (targetPositions[movedTile] % 4));
      const nextHeuristic = current.heuristic - oldTargetDistance + newTargetDistance;
      if (nextSteps + nextHeuristic > maximumDistance) continue;
      const key = puzzleStateKey(next);
      if ((bestSteps.get(key) ?? Infinity) <= nextSteps) continue;
      bestSteps.set(key, nextSteps);
      parent.set(key, { previous: current.key, tile: movedTile });
      push({ state: next, key, blank: neighbour, steps: nextSteps, heuristic: nextHeuristic });
    }
  }
  return null;
}

function SandboxOne() {
  const [board, setBoard] = useState<(number | null)[]>(EMPTY_BOARD);
  const [past, setPast] = useState<(number | null)[][]>([]);
  const [future, setFuture] = useState<(number | null)[][]>([]);
  const [selection, setSelection] = useState<Selection>(null);
  const [targetCell, setTargetCell] = useState<number | null>(null);
  const [showLabels, setShowLabels] = useState(false);
  const [announcement, setAnnouncement] = useState("The board is empty. Choose a tile to begin.");
  const pointerDrag = useRef<PointerDrag | null>(null);
  const suppressClick = useRef(false);
  const [dragGhost, setDragGhost] = useState<{ tile: number; x: number; y: number } | null>(null);

  const analysis = useMemo(() => analyseBoard(board), [board]);
  const available = useMemo(() => new Set(TILE_VALUES.filter((tile) => !board.includes(tile))), [board]);
  const issueEdges = useMemo(() => {
    const map = Array.from({ length: 16 }, () => new Set<Direction>());
    [...analysis.boundaryIssues, ...analysis.matchingIssues].forEach((issue) => {
      map[issue.first].add(issue.firstDirection);
      if (issue.second !== undefined && issue.secondDirection) map[issue.second].add(issue.secondDirection);
    });
    return map;
  }, [analysis.boundaryIssues, analysis.matchingIssues]);

  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelection(null);
        setTargetCell(null);
      }
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, []);

  function commit(next: (number | null)[], message: string) {
    if (next.every((tile, index) => tile === board[index])) return;
    setPast((history) => [...history, board]);
    setFuture([]);
    setBoard(next);
    setSelection(null);
    setTargetCell(null);
    setAnnouncement(message);
  }

  function place(tile: number, source: TileSource, destination: number) {
    const next = [...board];
    const displaced = next[destination];
    if (source.kind === "board") {
      if (source.index === destination) {
        setSelection(null);
        return;
      }
      next[source.index] = displaced;
    }
    next[destination] = tile;
    commit(next, `Tile ${word(tile)} placed at ${coordinate(destination)}${displaced !== null ? "; tiles swapped" : ""}.`);
  }

  function returnTile(source: TileSource, tile: number) {
    if (source.kind !== "board") return;
    const next = [...board];
    if (next[source.index] !== tile) return;
    next[source.index] = null;
    commit(next, `Tile ${word(tile)} returned to the tray.`);
  }

  function chooseTrayTile(tile: number) {
    if (!available.has(tile)) return;
    if (targetCell !== null) {
      place(tile, { kind: "tray" }, targetCell);
      return;
    }
    if (selection?.tile === tile && selection.source.kind === "tray") {
      setSelection(null);
      setAnnouncement(`Tile ${word(tile)} deselected.`);
    } else {
      setSelection({ tile, source: { kind: "tray" } });
      setAnnouncement(`Tile ${word(tile)} selected. Choose a board cell.`);
    }
  }

  function chooseCell(index: number) {
    if (selection) {
      place(selection.tile, selection.source, index);
      return;
    }
    const tile = board[index];
    if (tile !== null) {
      setSelection({ tile, source: { kind: "board", index } });
      setTargetCell(null);
      setAnnouncement(`Tile ${word(tile)} selected at ${coordinate(index)}. Choose another cell or return it to the tray.`);
    } else {
      setTargetCell((current) => (current === index ? null : index));
      setAnnouncement(`Cell ${coordinate(index)} selected. Choose a tile from the tray.`);
    }
  }

  function beginPointerDrag(event: React.PointerEvent<HTMLElement>, tile: number, source: TileSource) {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    pointerDrag.current = {
      tile,
      source,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function movePointerDrag(event: React.PointerEvent<HTMLElement>) {
    const active = pointerDrag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - active.startX, event.clientY - active.startY);
    if (!active.dragging && distance < 8) return;
    event.preventDefault();
    active.dragging = true;
    suppressClick.current = true;
    setDragGhost({ tile: active.tile, x: event.clientX, y: event.clientY });
  }

  function endPointerDrag(event: React.PointerEvent<HTMLElement>) {
    const active = pointerDrag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    pointerDrag.current = null;
    setDragGhost(null);
    if (!active.dragging) return;
    event.preventDefault();

    const target = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    const cell = target?.closest<HTMLElement>("[data-drop-cell]");
    const tray = target?.closest<HTMLElement>("[data-drop-tray]");
    if (cell) {
      place(active.tile, active.source, Number(cell.dataset.dropCell));
    } else if (tray && active.source.kind === "board") {
      returnTile(active.source, active.tile);
    } else {
      setAnnouncement(`Tile ${word(active.tile)} was not moved.`);
    }
    window.setTimeout(() => { suppressClick.current = false; }, 0);
  }

  function cancelPointerDrag() {
    pointerDrag.current = null;
    setDragGhost(null);
    window.setTimeout(() => { suppressClick.current = false; }, 0);
  }

  function guardedClick(event: React.MouseEvent, action: () => void) {
    if (suppressClick.current) {
      event.preventDefault();
      return;
    }
    action();
  }

  function undo() {
    const previous = past[past.length - 1];
    if (!previous) return;
    setFuture((states) => [board, ...states]);
    setPast((states) => states.slice(0, -1));
    setBoard(previous);
    setSelection(null);
    setTargetCell(null);
    setAnnouncement("Last move undone.");
  }

  function redo() {
    const next = future[0];
    if (!next) return;
    setPast((states) => [...states, board]);
    setFuture((states) => states.slice(1));
    setBoard(next);
    setSelection(null);
    setTargetCell(null);
    setAnnouncement("Move restored.");
  }

  function keyboardCell(event: React.KeyboardEvent, index: number) {
    const row = Math.floor(index / 4);
    const column = index % 4;
    const destination =
      event.key === "ArrowUp" && row > 0 ? index - 4 :
      event.key === "ArrowDown" && row < 3 ? index + 4 :
      event.key === "ArrowLeft" && column > 0 ? index - 1 :
      event.key === "ArrowRight" && column < 3 ? index + 1 : null;
    if (destination !== null) {
      event.preventDefault();
      document.getElementById(`board-cell-${destination}`)?.focus();
    }
    if ((event.key === "Delete" || event.key === "Backspace") && board[index] !== null) {
      event.preventDefault();
      returnTile({ kind: "board", index }, board[index]!);
    }
  }

  return (
    <>
      <header className="hero">
        <div className="eyebrow"><span>Sandbox 01</span><span className="eyebrow-line" /></div>
        <h1>Square Kolam Tile Challenge</h1>
        <p className="subtitle">Build a square kolam by placing each of the sixteen tiles exactly once.</p>
        <p className="how-to-play"><strong>How to play:</strong> drag a tile from the tile grid to the construction board. You can also select a tile, then select a cell. Drag a board tile back to the tile grid to return it.</p>
      </header>

      <section className="workspace" aria-label="Kolam tile builder">
        <div className="board-column">
          <div className="section-heading">
            <div>
              <span className="step-number">01</span>
              <h2>Construction board</h2>
            </div>
            <span className="placement-count">{analysis.placed}<small>/16 placed</small></span>
          </div>

          <div className={`board-wrap ${analysis.correct ? "board-correct" : ""}`}>
              <div className="board-grid square-grid" role="group" aria-label="Four by four construction grid">
                {board.map((tile, index) => {
                  const selected = selection?.source.kind === "board" && selection.source.index === index;
                  return (
                    <button
                      id={`board-cell-${index}`}
                      className={`board-cell ${tile === null ? "cell-empty" : "cell-filled"} ${selected ? "is-selected" : ""} ${targetCell === index ? "is-target" : ""}`}
                      key={index}
                      type="button"
                      aria-label={tile === null ? `Empty cell ${coordinate(index)}` : `Cell ${coordinate(index)}, tile ${word(tile)}`}
                      aria-pressed={selected || targetCell === index}
                      data-drop-cell={index}
                      onClick={(event) => guardedClick(event, () => chooseCell(index))}
                      onKeyDown={(event) => keyboardCell(event, index)}
                      onPointerDown={(event) => tile !== null && beginPointerDrag(event, tile, { kind: "board", index })}
                      onPointerMove={movePointerDrag}
                      onPointerUp={endPointerDrag}
                      onPointerCancel={cancelPointerDrag}
                    >
                      {tile === null ? (
                        <span className="empty-mark" aria-hidden="true">{index + 1}</span>
                      ) : (
                        <>
                          <KolamArt tile={tile} />
                          {showLabels && <span className="board-label">{word(tile)}</span>}
                        </>
                      )}
                      {(["N", "E", "S", "W"] as Direction[]).map((direction) =>
                        issueEdges[index].has(direction) ? <span key={direction} className={`edge-alert edge-${direction.toLowerCase()}`} aria-hidden="true" /> : null
                      )}
                    </button>
                  );
                })}
              </div>
            {analysis.correct && <div className="success-ribbon" role="status">Correct configuration</div>}
          </div>

          <div className="board-actions" aria-label="Board controls">
            <button type="button" className="action-button" onClick={undo} disabled={past.length === 0}>↶ Undo</button>
            <button type="button" className="action-button" onClick={redo} disabled={future.length === 0}>↷ Redo</button>
            <button
              type="button"
              className="action-button"
              onClick={() => selection && returnTile(selection.source, selection.tile)}
              disabled={selection?.source.kind !== "board"}
            >
              Return tile
            </button>
            <button type="button" className="action-button" onClick={() => commit([...EMPTY_BOARD], "Board cleared.")} disabled={analysis.placed === 0}>Clear</button>
            <button type="button" className="action-button action-example" onClick={() => commit([...VALID_EXAMPLE], "A valid example has been loaded.")}>Load example</button>
          </div>
        </div>

        <section className="tile-column" aria-labelledby="tray-heading" data-drop-tray>
        <div className="section-heading tile-heading">
          <div>
            <span className="step-number">02</span>
            <h2 id="tray-heading">Kolam tiles</h2>
          </div>
          <label className="label-toggle">
            <input type="checkbox" checked={showLabels} onChange={(event) => setShowLabels(event.target.checked)} />
            <span>Show labels on board</span>
          </label>
        </div>

        <div className="tile-tray square-grid" role="list" aria-label="Sixteen kolam tiles in increasing binary order">
          {TILE_VALUES.map((tile) => {
            const inTray = available.has(tile);
            const selected = selection?.tile === tile && selection.source.kind === "tray";
            return (
              <div className={`tray-slot ${inTray ? "" : "slot-used"}`} role="listitem" key={tile}>
                {inTray ? (
                  <button
                    type="button"
                    className={`tray-tile ${selected ? "is-selected" : ""}`}
                    aria-label={`Tile ${word(tile)}: ${tileDescription(tile)}`}
                    aria-pressed={selected}
                    onClick={(event) => guardedClick(event, () => chooseTrayTile(tile))}
                    onPointerDown={(event) => beginPointerDrag(event, tile, { kind: "tray" })}
                    onPointerMove={movePointerDrag}
                    onPointerUp={endPointerDrag}
                    onPointerCancel={cancelPointerDrag}
                  >
                    <KolamArt tile={tile} />
                  </button>
                ) : (
                  <div className="used-placeholder" aria-label={`Tile ${word(tile)} is on the board`}><span>On board</span></div>
                )}
                <span className="tray-label">{word(tile)}</span>
              </div>
            );
          })}
        </div>
        </section>
      </section>

      <footer className="page-footer">
        <p className="live-announcement" aria-live="polite">{announcement}</p>
      </footer>

      {dragGhost && (
        <div className="drag-ghost" style={{ left: dragGhost.x, top: dragGhost.y }} aria-hidden="true">
          <KolamArt tile={dragGhost.tile} />
          <span>{word(dragGhost.tile)}</span>
        </div>
      )}
    </>
  );
}

function SandboxTwo() {
  const [selectedEpsilon, setSelectedEpsilon] = useState<Epsilon>(1);
  const [seedIndex, setSeedIndex] = useState(DEFAULT_PUZZLE_SEED_INDEX);
  const [startState, setStartState] = useState<number[]>([...DEFAULT_PUZZLE_STATE]);
  const [puzzle, setPuzzle] = useState<number[]>([...DEFAULT_PUZZLE_STATE]);
  const [moves, setMoves] = useState(0);
  const [stepsAway, setStepsAway] = useState(PUZZLE_SEEDS[DEFAULT_PUZZLE_SEED_INDEX].distance);
  const [announcement, setAnnouncement] = useState("A correct configuration is ready. Move a tile beside the empty cell.");

  const analysis = useMemo(() => analyseBoard(puzzle), [puzzle]);
  const epsilon = useMemo(() => epsilonDetails(puzzle), [puzzle]);
  const blankIndex = puzzle.indexOf(0);
  const movable = useMemo(() => new Set(neighbouringIndices(blankIndex)), [blankIndex]);
  const targetState = PUZZLE_SEEDS[PUZZLE_SEEDS[seedIndex].partner].state;
  const solved = moves > 0 && analysis.correct && !sameState(puzzle, startState);
  const issueEdges = useMemo(() => {
    const map = Array.from({ length: 16 }, () => new Set<Direction>());
    [...analysis.boundaryIssues, ...analysis.matchingIssues].forEach((issue) => {
      map[issue.first].add(issue.firstDirection);
      if (issue.second !== undefined && issue.secondDirection) map[issue.second].add(issue.secondDirection);
    });
    return map;
  }, [analysis.boundaryIssues, analysis.matchingIssues]);

  function loadFreshState(nextEpsilon: Epsilon) {
    const nextSeedIndex = pickPuzzleSeedIndex(nextEpsilon, seedIndex);
    const nextSeed = PUZZLE_SEEDS[nextSeedIndex];
    const next = [...nextSeed.state];
    setSelectedEpsilon(nextEpsilon);
    setSeedIndex(nextSeedIndex);
    setStartState(next);
    setPuzzle([...next]);
    setMoves(0);
    setStepsAway(nextSeed.distance);
    setAnnouncement(`A new correct configuration with epsilon ${nextEpsilon > 0 ? "plus one" : "minus one"} is ready.`);
  }

  function moveTile(index: number) {
    if (!movable.has(index)) return;
    const next = [...puzzle];
    const tile = next[index];
    next[blankIndex] = tile;
    next[index] = 0;
    setPuzzle(next);
    setMoves((count) => count + 1);
    const nextAnalysis = analyseBoard(next);
    const nextSolved = nextAnalysis.correct && !sameState(next, startState);
    setStepsAway(nextSolved ? 0 : distanceAfterSlide(next, targetState, stepsAway));
    setAnnouncement(nextSolved ? "Success: you reached a different correct configuration." : `Tile ${word(tile)} moved into the empty cell.`);
  }

  function resetPuzzle() {
    setPuzzle([...startState]);
    setMoves(0);
    setStepsAway(PUZZLE_SEEDS[seedIndex].distance);
    setAnnouncement("The puzzle has been reset to its most recent correct starting configuration.");
  }

  return (
    <>
      <header className="hero puzzle-hero">
        <div className="eyebrow"><span>Sandbox 02</span><span className="eyebrow-line" /></div>
        <h1>Slide to a new kolam</h1>
        <p className="how-to-play"><strong>How to play:</strong> select any highlighted tile beside the open space. The tile moves into that space. Reach a different correct configuration while watching the exact distance indicator.</p>
      </header>

      <section className="puzzle-workspace" aria-label="Kolam fifteen puzzle">
        <div className="puzzle-board-column">
          <div className="section-heading">
            <h2>15-puzzle board</h2>
            <div className="puzzle-stats">
              <span className="move-count">{moves}<small>{moves === 1 ? "move" : "moves"}</small></span>
              <span className="distance-count"><strong>{stepsAway}</strong><small>{stepsAway === 1 ? "step" : "steps"} to next configuration</small></span>
            </div>
          </div>

          <div className={`puzzle-board-wrap ${solved ? "puzzle-solved" : ""}`}>
            <div className="puzzle-grid square-grid" role="group" aria-label="Four by four sliding puzzle">
              {puzzle.map((tile, index) => {
                const isBlank = tile === 0;
                const canMove = movable.has(index);
                return (
                  <button
                    type="button"
                    className={`puzzle-cell ${isBlank ? "puzzle-blank" : "puzzle-tile"} ${canMove ? "is-movable" : ""}`}
                    key={`${tile}-${index}`}
                    aria-label={isBlank ? "Open space" : `Tile ${word(tile)} at ${coordinate(index)}${canMove ? ", available to move" : ""}`}
                    disabled={!canMove || solved}
                    onClick={() => moveTile(index)}
                  >
                    {!isBlank && <KolamArt tile={tile} />}
                    {(["N", "E", "S", "W"] as Direction[]).map((direction) =>
                      issueEdges[index].has(direction) ? <span key={direction} className={`edge-alert edge-${direction.toLowerCase()}`} aria-hidden="true" /> : null
                    )}
                  </button>
                );
              })}
            </div>
            {solved && <div className="success-ribbon" role="status">New correct configuration</div>}
          </div>

          <div className="puzzle-actions" aria-label="Puzzle controls">
            <button type="button" className="action-button action-example" onClick={() => loadFreshState(selectedEpsilon)}>Scramble</button>
            <button type="button" className="action-button" onClick={resetPuzzle} disabled={moves === 0}>Reset</button>
          </div>

          <section className="epsilon-card orbit-card">
            <div className="epsilon-card-top">
              <div><span className="panel-kicker">Choose an orbit</span><h2>ε value</h2></div>
              <div className="epsilon-toggle" role="group" aria-label="Choose epsilon value">
                {([1, -1] as Epsilon[]).map((value) => (
                  <button
                    type="button"
                    key={value}
                    className={selectedEpsilon === value ? "is-active" : ""}
                    aria-pressed={selectedEpsilon === value}
                    onClick={() => loadFreshState(value)}
                  >
                    {value > 0 ? "+1" : "−1"}
                  </button>
                ))}
              </div>
            </div>

            <div className="epsilon-readout" aria-live="polite">
              <span>ε(X)</span><strong>{epsilon.epsilon > 0 ? "+1" : "−1"}</strong>
              <small>Invariant under every legal slide</small>
            </div>

            <details className="epsilon-details">
              <summary>How this value is computed</summary>
              <p>Read the sixteen entries row by row, counting the empty cell as <code>0000</code>. If <em>N</em> is the inversion count and the empty cell is at <em>(a₀,b₀)</em>, then</p>
              <div className="epsilon-formula">ε(X) = (−1)<sup>N + a₀ + b₀</sup></div>
              <dl>
                <div><dt>N</dt><dd>{epsilon.inversions}</dd></div>
                <div><dt>(a₀,b₀)</dt><dd>({epsilon.a0},{epsilon.b0})</dd></div>
                <div><dt>Exponent</dt><dd>{epsilon.exponent} · {epsilon.exponent % 2 === 0 ? "even" : "odd"}</dd></div>
              </dl>
            </details>
          </section>
          <p className="sr-only" aria-live="polite">{announcement}</p>
        </div>
      </section>
    </>
  );
}

function SandboxThree() {
  const [selectedEpsilon, setSelectedEpsilon] = useState<Epsilon>(1);
  const [pairIndex, setPairIndex] = useState(DEFAULT_CHALLENGE_PAIR_INDEX);
  const [isReversed, setIsReversed] = useState(false);
  const defaultPair = CHALLENGE_PAIRS[DEFAULT_CHALLENGE_PAIR_INDEX];
  const [puzzle, setPuzzle] = useState<number[]>([...PUZZLE_SEEDS[defaultPair.x].state]);
  const [moves, setMoves] = useState(0);
  const [stepsAway, setStepsAway] = useState(defaultPair.distance);
  const [isAnimating, setIsAnimating] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("Configuration X is ready. Match it to configuration Y.");
  const animationToken = useRef(0);
  const highlightTimer = useRef<number | null>(null);
  const initialPairChosen = useRef(false);

  const selectedPair = CHALLENGE_PAIRS[pairIndex];
  const startState = PUZZLE_SEEDS[isReversed ? selectedPair.y : selectedPair.x].state;
  const targetState = PUZZLE_SEEDS[isReversed ? selectedPair.x : selectedPair.y].state;
  const blankIndex = puzzle.indexOf(0);
  const movable = useMemo(() => new Set(neighbouringIndices(blankIndex)), [blankIndex]);
  const solved = sameState(puzzle, targetState);

  useEffect(() => {
    if (initialPairChosen.current) return;
    initialPairChosen.current = true;
    const randomPairIndex = pickChallengePairIndex(1);
    const randomPair = CHALLENGE_PAIRS[randomPairIndex];
    const reverse = Math.random() < 0.5;
    setPairIndex(randomPairIndex);
    setIsReversed(reverse);
    setPuzzle([...PUZZLE_SEEDS[reverse ? randomPair.y : randomPair.x].state]);
    setStepsAway(randomPair.distance);
    setAnnouncement("A random pair with epsilon plus one is ready.");
  }, []);

  useEffect(() => () => {
    animationToken.current += 1;
    if (highlightTimer.current !== null) window.clearTimeout(highlightTimer.current);
  }, []);

  function flashMovedTile(index: number) {
    if (highlightTimer.current !== null) window.clearTimeout(highlightTimer.current);
    setHighlightedIndex(index);
    highlightTimer.current = window.setTimeout(() => setHighlightedIndex(null), 720);
  }

  function loadPair(nextEpsilon: Epsilon) {
    animationToken.current += 1;
    if (highlightTimer.current !== null) window.clearTimeout(highlightTimer.current);
    const nextPairIndex = pickChallengePairIndex(nextEpsilon, pairIndex);
    const nextPair = CHALLENGE_PAIRS[nextPairIndex];
    const reverse = Math.random() < 0.5;
    const nextStart = PUZZLE_SEEDS[reverse ? nextPair.y : nextPair.x].state;
    setSelectedEpsilon(nextEpsilon);
    setPairIndex(nextPairIndex);
    setIsReversed(reverse);
    setPuzzle([...nextStart]);
    setMoves(0);
    setStepsAway(nextPair.distance);
    setIsAnimating(false);
    setHighlightedIndex(null);
    setAnnouncement(`A new pair with epsilon ${nextEpsilon > 0 ? "plus one" : "minus one"} is ready.`);
  }

  function moveChallengeTile(index: number) {
    if (isAnimating || solved || !movable.has(index)) return;
    const next = [...puzzle];
    const tile = next[index];
    next[blankIndex] = tile;
    next[index] = 0;
    const nextDistance = distanceAfterSlide(next, targetState, stepsAway);
    setPuzzle(next);
    flashMovedTile(blankIndex);
    setMoves((count) => count + 1);
    setStepsAway(nextDistance);
    setAnnouncement(nextDistance === 0 ? "Configuration X now matches Y." : `${nextDistance} ${nextDistance === 1 ? "step remains" : "steps remain"}.`);
  }

  function resetChallenge() {
    animationToken.current += 1;
    if (highlightTimer.current !== null) window.clearTimeout(highlightTimer.current);
    setPuzzle([...startState]);
    setMoves(0);
    setStepsAway(selectedPair.distance);
    setIsAnimating(false);
    setHighlightedIndex(null);
    setAnnouncement("Configuration X has been reset.");
  }

  async function showSolution() {
    if (isAnimating || solved) return;
    if (highlightTimer.current !== null) window.clearTimeout(highlightTimer.current);
    const path = sameState(puzzle, startState)
      ? (isReversed ? [...selectedPair.path].reverse() : [...selectedPair.path])
      : findPuzzlePath(puzzle, targetState, stepsAway);
    if (!path) {
      setAnnouncement("A solution could not be prepared from this position.");
      return;
    }

    const token = animationToken.current + 1;
    animationToken.current = token;
    setIsAnimating(true);
    setAnnouncement(`Animating a shortest solution of ${path.length} ${path.length === 1 ? "step" : "steps"}.`);
    const delay = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 120 : 460;
    const animated = [...puzzle];
    let animatedMoves = moves;

    await new Promise((resolve) => window.setTimeout(resolve, Math.min(delay, 220)));
    for (let index = 0; index < path.length; index += 1) {
      if (animationToken.current !== token) return;
      const tileIndex = animated.indexOf(path[index]);
      const openIndex = animated.indexOf(0);
      animated[openIndex] = path[index];
      animated[tileIndex] = 0;
      animatedMoves += 1;
      setPuzzle([...animated]);
      setHighlightedIndex(openIndex);
      setMoves(animatedMoves);
      setStepsAway(path.length - index - 1);
      await new Promise((resolve) => window.setTimeout(resolve, delay));
    }
    if (animationToken.current === token) {
      setIsAnimating(false);
      highlightTimer.current = window.setTimeout(() => setHighlightedIndex(null), 320);
      setAnnouncement("Solution complete. Configuration X matches Y.");
    }
  }

  return (
    <>
      <header className="hero puzzle-hero">
        <div className="eyebrow"><span>Sandbox 03</span><span className="eyebrow-line" /></div>
        <h1>Move X to Y</h1>
        <p className="how-to-play"><strong>How to play:</strong> slide highlighted tiles on X until it matches the fixed configuration Y. Choose an ε class, try the challenge yourself, or animate a shortest solution from your current position.</p>
      </header>

      <section className="comparison-workspace" aria-label="Match two Kolam fifteen-puzzle configurations">
        <div className="comparison-grid">
          <section className="comparison-column" aria-labelledby="configuration-x-heading">
            <div className="comparison-heading">
              <div><span className="configuration-letter">X</span><h2 id="configuration-x-heading">Movable configuration</h2></div>
              <div className="comparison-metrics">
                <span><strong>{moves}</strong>{moves === 1 ? "move" : "moves"}</span>
                <span><strong>{stepsAway}</strong>{stepsAway === 1 ? "step left" : "steps left"}</span>
              </div>
            </div>
            <div className={`comparison-board ${solved ? "puzzle-solved" : ""}`}>
              <div className="puzzle-grid square-grid" role="group" aria-label="Movable configuration X">
                {puzzle.map((tile, index) => {
                  const isBlank = tile === 0;
                  const canMove = movable.has(index) && !isAnimating && !solved;
                  return (
                    <button
                      type="button"
                      className={`puzzle-cell ${isBlank ? "puzzle-blank" : "puzzle-tile"} ${canMove ? "is-movable" : ""} ${highlightedIndex === index ? "is-recent" : ""}`}
                      key={`x-cell-${index}`}
                      data-tile={tile}
                      aria-label={isBlank ? "Open space in configuration X" : `Tile ${word(tile)} in configuration X${canMove ? ", available to move" : ""}`}
                      disabled={!canMove}
                      onClick={() => moveChallengeTile(index)}
                    >
                      {!isBlank && <KolamArt tile={tile} />}
                    </button>
                  );
                })}
              </div>
              {solved && <div className="success-ribbon" role="status">X matches Y</div>}
            </div>
          </section>

          <section className="comparison-column target-column" aria-labelledby="configuration-y-heading">
            <div className="comparison-heading">
              <div><span className="configuration-letter target-letter">Y</span><h2 id="configuration-y-heading">Fixed target</h2></div>
              <span className="fixed-badge">Reference</span>
            </div>
            <div className="comparison-board target-board">
              <div className="puzzle-grid square-grid" role="group" aria-label="Fixed target configuration Y">
                {targetState.map((tile, index) => (
                  <div
                    className={`puzzle-cell target-cell ${tile === 0 ? "puzzle-blank" : "puzzle-tile"}`}
                    key={`y-cell-${index}`}
                    data-tile={tile}
                    role="img"
                    aria-label={tile === 0 ? `Open space in target cell ${index + 1}` : `Target tile ${word(tile)} in cell ${index + 1}`}
                  >
                    {tile !== 0 && <KolamArt tile={tile} />}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="comparison-actions" aria-label="Challenge controls">
          <button type="button" className="action-button" onClick={() => loadPair(selectedEpsilon)} disabled={isAnimating}>New pair</button>
          <button type="button" className="action-button" onClick={resetChallenge} disabled={isAnimating || sameState(puzzle, startState)}>Reset X</button>
          <button type="button" className="action-button action-example solution-button" onClick={showSolution} disabled={isAnimating || solved}>{isAnimating ? "Showing solution…" : "Show solution"}</button>
        </div>

        <section className="epsilon-card comparison-orbit">
          <div className="epsilon-card-top">
            <div><span className="panel-kicker">Choose an orbit</span><h2>Shared ε value</h2></div>
            <div className="epsilon-toggle" role="group" aria-label="Choose epsilon value for X and Y">
              {([1, -1] as Epsilon[]).map((value) => (
                <button
                  type="button"
                  key={value}
                  className={selectedEpsilon === value ? "is-active" : ""}
                  aria-pressed={selectedEpsilon === value}
                  onClick={() => loadPair(value)}
                  disabled={isAnimating}
                >
                  {value > 0 ? "+1" : "−1"}
                </button>
              ))}
            </div>
          </div>
          <div className="shared-epsilon-readout" aria-live="polite"><span>ε(X) = ε(Y)</span><strong>{selectedEpsilon > 0 ? "+1" : "−1"}</strong><small>Therefore X and Y lie in the same 15-puzzle orbit.</small></div>
        </section>
        <p className="sr-only" aria-live="polite">{announcement}</p>
      </section>
    </>
  );
}

export type LabPage =
  | "landing"
  | "square-challenge"
  | "sandbox-2"
  | "sandbox-3"
  | "square-challenge-embed"
  | "law-of-cosines"
  | "law-of-cosines-embed";

type NavigablePage = Exclude<LabPage, "square-challenge-embed" | "law-of-cosines-embed">;

const labPages: { page: NavigablePage; href: string; number: string; short: string }[] = [
  { page: "landing", href: "/", number: "", short: "Lab home" },
  { page: "square-challenge", href: "/square-kolam-tile-challenge/", number: "01", short: "Build" },
  { page: "sandbox-2", href: "/sandbox-2/", number: "02", short: "Slide" },
  { page: "sandbox-3", href: "/sandbox-3/", number: "03", short: "Match" },
];

function LabNavigation({ active }: { active: NavigablePage }) {
  return (
    <nav className="sandbox-nav" aria-label="Kolam Lab">
      <a className="lab-brand" href="/" aria-label="Go to the Kolam Lab home page">
        <img src="/mathnomad-logo.png" alt="" width="36" height="36" />
        <span>
          <strong>Math Nomad</strong>
          <small>Kolam Lab</small>
        </span>
      </a>
      <div>
        {labPages.slice(1).map((item) => (
          <a
            key={item.page}
            className={active === item.page ? "is-active" : ""}
            aria-current={active === item.page ? "page" : undefined}
            href={item.href}
          >
            <span>{item.number}</span> {item.short}
          </a>
        ))}
      </div>
    </nav>
  );
}

function LawNavigation() {
  return (
    <nav className="sandbox-nav" aria-label="Tessellation Lab">
      <a className="lab-brand" href="/" aria-label="Go to the Math Nomad Lab home page">
        <img src="/mathnomad-logo.png" alt="" width="36" height="36" />
        <span>
          <strong>Math Nomad</strong>
          <small>Tessellation Lab</small>
        </span>
      </a>
      <div>
        <a className="is-active" aria-current="page" href="/law-of-cosines/"><span>01</span> Cosines</a>
      </div>
    </nav>
  );
}

type LabPreviewKind = "build" | "slide" | "match";

function PreviewBoard({ board }: { board: (number | null)[] }) {
  return (
    <div className="lab-preview-board" aria-hidden="true">
      {board.map((tile, index) => (
        <span className={tile === null || tile === 0 ? "is-open" : ""} key={`${tile}-${index}`}>
          {tile !== null && tile !== 0 ? <KolamArt tile={tile} /> : null}
        </span>
      ))}
    </div>
  );
}

function LabCardPreview({ kind }: { kind: LabPreviewKind }) {
  if (kind === "build") {
    const partialBoard = VALID_EXAMPLE.map((tile, index) => (index < 10 ? tile : null));
    return (
      <div className="lab-card-preview preview-build">
        <PreviewBoard board={partialBoard} />
        <div className="preview-tray" aria-hidden="true">
          {VALID_EXAMPLE.slice(10).map((tile) => <KolamArt tile={tile} key={tile} />)}
        </div>
      </div>
    );
  }

  if (kind === "slide") {
    return (
      <div className="lab-card-preview preview-slide">
        <PreviewBoard board={DEFAULT_PUZZLE_STATE} />
        <span className="preview-move" aria-hidden="true">↖</span>
      </div>
    );
  }

  return (
    <div className="lab-card-preview preview-match">
      <PreviewBoard board={PUZZLE_SEEDS[6].state} />
      <span aria-hidden="true">→</span>
      <PreviewBoard board={PUZZLE_SEEDS[8].state} />
    </div>
  );
}

function LabLanding() {
  const cards = [
    {
      href: "/square-kolam-tile-challenge/",
      number: "Sandbox 01",
      title: "Square Kolam Tile Challenge",
      text: "Use all sixteen globally oriented tiles to build one connected nonzero kolam on a 4 × 4 board.",
      action: "Build",
      preview: "build" as LabPreviewKind,
    },
    {
      href: "/sandbox-2/",
      number: "Sandbox 02",
      title: "Slide to a New Kolam",
      text: "Move tiles through the open cell while preserving a correct square kolam, and watch the orbit invariant.",
      action: "Slide",
      preview: "slide" as LabPreviewKind,
    },
    {
      href: "/sandbox-3/",
      number: "Sandbox 03",
      title: "Move X to Y",
      text: "Transform one completed kolam into another and compare two configurations in the same 15-puzzle orbit.",
      action: "Match",
      preview: "match" as LabPreviewKind,
    },
  ];

  return (
    <section className="lab-index" aria-labelledby="lab-index-heading">
      <header>
        <div className="eyebrow"><span>Interactive mathematics</span><span className="eyebrow-line" /></div>
        <h1 id="lab-index-heading">Kolam Lab</h1>
        <p>Three sandboxes for building, moving, and comparing square kolams.</p>
      </header>
      <div className="lab-card-grid">
        {cards.map((card) => (
          <a className="lab-card" href={card.href} key={card.href} aria-label={`Open ${card.title}`}>
            <LabCardPreview kind={card.preview} />
            <span className="lab-card-number">{card.number}</span>
            <h2>{card.title}</h2>
            <p>{card.text}</p>
            <strong>{card.action} <span aria-hidden="true">→</span></strong>
          </a>
        ))}
      </div>
      <section className="cosine-collection" aria-labelledby="tessellation-lab-heading">
        <header>
          <div className="eyebrow"><span>Another collection</span><span className="eyebrow-line" /></div>
          <h2 id="tessellation-lab-heading">Tessellations</h2>
          <p>Explore area identities by laying periodic patterns over one another and watching what overlaps, disappears, or remains uncovered.</p>
        </header>
        <a className="lab-card cosine-landing-card" href="/law-of-cosines/" aria-label="Open the Law of Cosines tessellation">
          <div className="cosine-card-preview" aria-hidden="true">
            <span className="preview-blue" />
            <span className="preview-yellow" />
            <span className="preview-grid" />
          </div>
          <div className="cosine-card-copy">
            <span className="lab-card-number">Tessellation 01</span>
            <h3>The Law of Cosines</h3>
            <p>Move through the moduli space of triangle shapes, then translate a square grid across the two-colour tessellation.</p>
            <strong>Explore <span aria-hidden="true">→</span></strong>
          </div>
        </a>
      </section>
      <a className="mathnomad-return" href="https://mathnomad.in/">Return to Math Nomad <span aria-hidden="true">↗</span></a>
    </section>
  );
}

export default function App({ page }: { page: LabPage }) {
  if (page === "square-challenge-embed") {
    return <main className="page-shell is-embedded"><SandboxOne /></main>;
  }

  if (page === "law-of-cosines-embed") {
    return <main className="page-shell is-embedded"><LawOfCosines embedded /></main>;
  }

  if (page === "landing") {
    return <main className="page-shell"><LabNavigation active="landing" /><LabLanding /></main>;
  }

  if (page === "law-of-cosines") {
    return <main className="page-shell"><LawNavigation /><LawOfCosines /></main>;
  }

  const sandbox = page === "square-challenge"
    ? <SandboxOne />
    : page === "sandbox-2"
      ? <SandboxTwo />
      : <SandboxThree />;

  return (
    <main className="page-shell">
      <LabNavigation active={page} />
      {sandbox}
    </main>
  );
}
