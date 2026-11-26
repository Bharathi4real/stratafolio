import { Accent } from "@/components/ui/Rich";
import type { AboutBlock } from "@/lib/content/schema";

export function About({ block, num }: { block: AboutBlock; num: string }) {
  return (
    <section className="section gutter" id={block.anchor ?? "about"}>
      <div className="about-grid">
        <dl className="about-facts" data-reveal>
          <p className="eyebrow accent">
            {num} / {block.label}
          </p>
          {block.facts?.map((f) => (
            <div className="fact" key={f.label}>
              <dt className="eyebrow">{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
        <div className="about-main">
          <p className="about-lead" data-split>
            <Accent text={block.lead} />
          </p>
          <div className="about-body">
            {block.paragraphs?.map((p) => (
              <p data-reveal key={p.text}>
                {p.text}
              </p>
            ))}
          </div>
        </div>
      </div>
      {block.stats?.length ? (
        <div className="stats">
          {block.stats.map((s) => (
            <div className="stat" data-reveal key={s.label}>
              <div className="stat-num">
                <span data-count={s.value}>{s.value}</span>
                {s.suffix ? <sup>{s.suffix}</sup> : null}
              </div>
              <p>{s.label}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
