import { CalendarIcon, CapIcon, PinIcon } from "@/components/ui/Icons";
import { Accent, Bold } from "@/components/ui/Rich";
import { CardTopo } from "@/components/ui/Topo";
import type { ExperienceBlock, Experience as Role } from "@/lib/content/schema";
import { fmtMonth } from "@/lib/time";
import { Duration, ExperienceRail, Tenure } from "./ExperienceClient";

const yy = (d: string) => `’${String(new Date(d).getUTCFullYear()).slice(2)}`;

export function Experience({
  block,
  num,
  roles,
}: {
  block: ExperienceBlock;
  num: string;
  roles: Role[];
}) {
  const jobs = roles.filter((r) => r.type !== "education");
  const edu = roles.filter((r) => r.type === "education");
  const firstStart = jobs.map((r) => r.start).sort()[0];
  const all = [...jobs, ...edu];

  return (
    <section
      className="section gutter exp"
      id={block.anchor ?? "experience"}
      style={{ paddingTop: 0 }}
    >
      <div className="exp-grid">
        <div className="exp-side">
          <div className="exp-side-inner">
            <p className="eyebrow" data-reveal>
              {num} / {block.label}
            </p>
            <h2 data-split>
              <Accent text={block.heading} emClassName="muted" />
            </h2>
            {block.intro ? <p data-reveal>{block.intro}</p> : null}
            {block.summary?.length ? (
              <div className="exp-summary" data-reveal>
                {block.summary.map((s) => (
                  <div key={s.label}>
                    {s.liveTenure && firstStart ? (
                      <Tenure start={firstStart} />
                    ) : (
                      <strong>{s.value}</strong>
                    )}
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <ExperienceRail>
          {all.map((r, i) => {
            const current = r.type !== "education" && !r.end;
            const last = i === all.length - 1;
            if (r.type === "education")
              return (
                <article
                  className="role role-edu"
                  data-reveal
                  style={last ? { marginBottom: 0 } : undefined}
                  key={r.id}
                >
                  <span className="node" aria-hidden="true">
                    <CapIcon />
                  </span>
                  <div className="edu">
                    <CardTopo seed={`edu-${r.id}`} />
                    <span className="logo" aria-hidden="true">
                      <CapIcon width={1.5} />
                    </span>
                    <div>
                      <p className="eyebrow accent" style={{ margin: "0 0 .4rem" }}>
                        Education
                      </p>
                      <h3>{r.title}</h3>
                      <p>{r.company}</p>
                    </div>
                    {r.score ? (
                      <div className="cgpa">
                        {r.score}
                        <span>CGPA</span>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            return (
              <article
                className="role"
                data-reveal
                style={last ? { marginBottom: 0 } : undefined}
                key={r.id}
              >
                <span className={`node${current ? " is-now" : ""}`} aria-hidden="true">
                  {yy(r.start)}
                </span>
                <div className={`role-card${current ? " is-current" : ""}`}>
                  <CardTopo seed={`role-${r.company}`} />
                  <span className="role-year" aria-hidden="true">
                    {new Date(r.start).getUTCFullYear()}
                  </span>
                  <div className="role-head">
                    <span className={`logo${i % 2 ? " alt" : ""}`} aria-hidden="true">
                      {r.logo}
                    </span>
                    <div>
                      <h3 className="role-company">{r.company}</h3>
                      <div className="role-title">
                        {r.title}{" "}
                        {current ? (
                          <span className="badge">
                            <span className="dot" />
                            Now
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="role-sub">
                    <span>
                      <CalendarIcon />
                      {fmtMonth(r.start)} – {r.end ? fmtMonth(r.end) : "Present"}{" "}
                      <Duration start={r.start} end={r.end} />
                    </span>
                    {r.location ? (
                      <span>
                        <PinIcon />
                        {r.location}
                      </span>
                    ) : null}
                  </div>
                  {r.kpis?.length ? (
                    <div className="kpis">
                      {r.kpis.map((k) => (
                        <div className="kpi" key={k.label}>
                          <strong>
                            {k.value}
                            {k.suffix ? <sup>{k.suffix}</sup> : null}
                          </strong>
                          <span>{k.label}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {r.bullets?.length ? (
                    <ul>
                      {r.bullets.map((b) => (
                        <li key={b}>
                          <Bold text={b} />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {r.tags?.length ? (
                    <div className="tags">
                      {r.tags.map((t) => (
                        <span className="tag" key={t}>
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </ExperienceRail>
      </div>
    </section>
  );
}
