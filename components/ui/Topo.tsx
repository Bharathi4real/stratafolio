import { cardTopo, coverTopo, staticTopo } from "@/lib/topo";

export function StaticTopo({
  seed,
  cx,
  cy,
  n,
  w = 1200,
  h = 700,
  step,
  className = "",
}: {
  seed: string | number;
  cx: number;
  cy: number;
  n: number;
  w?: number;
  h?: number;
  step?: number;
  className?: string;
}) {
  return (
    <svg
      className={`static-topo ${className}`.trim()}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke">
        {staticTopo(seed, cx, cy, n, step, w, h).map((p) => (
          <path key={p.d.slice(0, 24)} d={p.d} style={{ opacity: p.opacity.toFixed(2) }} />
        ))}
      </g>
    </svg>
  );
}

export function CardTopo({ seed }: { seed: string | number }) {
  return (
    <svg className="card-topo" viewBox="0 0 420 320" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1">
        {cardTopo(seed).map((d, i) => (
          <path
            key={d.slice(0, 24)}
            pathLength={1}
            style={{ "--i": i } as React.CSSProperties}
            d={d}
          />
        ))}
      </g>
    </svg>
  );
}

export function CoverTopo({
  seed,
  w = 600,
  h = 420,
  cx = 380,
  cy = 330,
  n = 16,
}: {
  seed: string | number;
  w?: number;
  h?: number;
  cx?: number;
  cy?: number;
  n?: number;
}) {
  return (
    <svg
      className="topo"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g fill="none" stroke="currentColor" strokeWidth="1">
        {coverTopo(seed, cx, cy, n, w, h).map((p) => (
          <path key={p.d.slice(0, 24)} d={p.d} style={{ opacity: p.opacity.toFixed(2) }} />
        ))}
      </g>
    </svg>
  );
}
