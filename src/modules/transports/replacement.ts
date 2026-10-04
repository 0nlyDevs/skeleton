/**
 * F97 — when lines are interrupted, find another way through the network.
 * Only lines that run (no traffic alert) are used; the answer is the route
 * with the fewest changes, then the fewest stops. Pure functions: the same
 * code runs in the browser on the published lines.
 */

export interface NetworkLine {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly stops: readonly string[];
  readonly alert: string | null;
}

export interface RouteLeg<Line extends NetworkLine = NetworkLine> {
  readonly line: Line;
  readonly from: string;
  readonly to: string;
  /** Stops travelled on this line, both ends included. */
  readonly stops: readonly string[];
}

const MAX_LEGS = 3;

/** A line with a traffic alert is treated as interrupted. */
export function isInterrupted(line: NetworkLine): boolean {
  return Boolean(line.alert?.trim());
}

function ride(line: NetworkLine, from: number, to: number): string[] {
  return from <= to ? line.stops.slice(from, to + 1) : line.stops.slice(to, from + 1).reverse();
}

/** The best route on running lines only, or null when the network cannot make it. */
export function findReplacementRoute<Line extends NetworkLine>(lines: readonly Line[], origin: string, destination: string): RouteLeg<Line>[] | null {
  if (!origin || !destination || origin === destination) return null;
  const running = lines.filter((line) => !isInterrupted(line));
  let best: RouteLeg<Line>[] | null = null;
  const size = (route: readonly RouteLeg[]): number => route.reduce((all, leg) => all + leg.stops.length - 1, 0);

  const explore = (stop: string, legs: RouteLeg<Line>[], used: ReadonlySet<string>): void => {
    if (legs.length >= MAX_LEGS) return;
    for (const line of running) {
      if (used.has(line.id)) continue;
      const at = line.stops.indexOf(stop);
      if (at < 0) continue;
      const end = line.stops.indexOf(destination);
      if (end >= 0) {
        const route = [...legs, { line, from: stop, to: destination, stops: ride(line, at, end) }];
        if (!best || route.length < best.length || (route.length === best.length && size(route) < size(best))) best = route;
        continue;
      }
      // Already have a route with as few changes: no need to go deeper.
      if (best && legs.length + 2 > best.length) continue;
      line.stops.forEach((change, index) => {
        if (index === at) return;
        if (legs.some((leg) => leg.stops.includes(change))) return;
        explore(change, [...legs, { line, from: stop, to: change, stops: ride(line, at, index) }], new Set([...used, line.id]));
      });
    }
  };
  explore(origin, [], new Set());
  return best;
}

export interface LineAlternative<Line extends NetworkLine = NetworkLine> {
  readonly line: Line;
  /** Stops of the interrupted line that this running line also serves. */
  readonly shared: readonly string[];
}

/** Running lines that serve stops of an interrupted line, most shared stops first. */
export function alternativesFor<Line extends NetworkLine>(interrupted: Line, lines: readonly Line[]): LineAlternative<Line>[] {
  return lines
    .filter((line) => line.id !== interrupted.id && !isInterrupted(line))
    .map((line) => ({ line, shared: interrupted.stops.filter((stop) => line.stops.includes(stop)) }))
    .filter((entry) => entry.shared.length > 0)
    .sort((a, b) => b.shared.length - a.shared.length)
    .slice(0, 3);
}

/** Stops of an interrupted line that no running line serves. */
export function strandedStops(interrupted: NetworkLine, lines: readonly NetworkLine[]): string[] {
  const served = new Set(lines.filter((line) => line.id !== interrupted.id && !isInterrupted(line)).flatMap((line) => line.stops));
  return interrupted.stops.filter((stop) => !served.has(stop));
}
