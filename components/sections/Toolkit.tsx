import { Accent } from "@/components/ui/Rich";
import type { ToolkitBlock, Toolkit as ToolkitGlobal } from "@/lib/content/schema";
import { strataShape } from "@/lib/topo";

export function Toolkit({
  block,
  num,
  toolkit,
}: {
  block: ToolkitBlock;
  num: string;
  toolkit: ToolkitGlobal;
}) {
  const layers = toolkit.layers ?? [];
  const n = layers.length;
  return (
    <section className="section gutter" id={block.anchor ?? "toolkit"} style={{ paddingTop: 0 }}>
      <div className="sec-head">
        <p className="eyebrow" data-reveal>
          {num} / {block.label}
        </p>
        <h2 data-split>
          <Accent text={block.heading} />
        </h2>
      </div>
      <div className="strata-wrap">
        <div className="strata-legend" data-reveal>
          <p className="eyebrow">{block.legendLabel}</p>
          {block.note ? <p className="strata-note">{block.note}</p> : null}
          <div className="strata-scale" aria-hidden="true">
            <span>{block.scaleTop}</span>
            <i />
            <span>{block.scaleBottom}</span>
          </div>
        </div>
        <ol
          className="strata"
          aria-label={`${block.label}, from ${block.scaleTop?.toLowerCase()} to ${block.scaleBottom?.toLowerCase()}`}
        >
          {layers.map((layer, i) => {
            const shape = strataShape(`stratum-${i}-${layer.name}`, i === 0);
            const cls = i === 0 ? " is-surface" : i === n - 1 ? " is-core" : "";
            return (
              <li
                className={`stratum${cls}`}
                style={
                  { "--h": (n > 1 ? i / (n - 1) : 0).toFixed(3), "--i": i } as React.CSSProperties
                }
                data-stratum
                key={layer.name}
              >
                <svg
                  className="st-shape"
                  viewBox="0 0 1000 120"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path className="st-fill" d={shape.fill} />
                  <path className="st-edge" d={shape.edge} vectorEffect="non-scaling-stroke" />
                  {shape.lines.map((d) => (
                    <path
                      className="st-line"
                      d={d}
                      vectorEffect="non-scaling-stroke"
                      key={d.slice(0, 16)}
                    />
                  ))}
                </svg>
                <div className="st-meta">
                  <span className="st-depth">−{String(i).padStart(2, "0")}</span>
                  <span className="st-role">{layer.role}</span>
                </div>
                <h3 className="st-name">{layer.name}</h3>
                <ul className="st-items">
                  {layer.tools?.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                <span className="st-count">
                  {String(layer.tools?.length ?? 0).padStart(2, "0")}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
