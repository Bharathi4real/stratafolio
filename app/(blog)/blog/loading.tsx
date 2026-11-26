import { Sk } from "@/components/ui/Skeleton";

/** Blog index skeleton: hero, featured card, then archive rows. */
export default function Loading() {
  return (
    <div aria-busy="true" role="status" aria-label="Loading posts">
      <section className="page-hero gutter sk-page">
        <Sk w="9rem" h=".7rem" />
        <Sk w="min(36rem, 80%)" h="clamp(3rem, 8vw, 5.5rem)" r=".6rem" />
        <Sk w="min(28rem, 70%)" h="1rem" />
      </section>
      <section className="gutter">
        <Sk h="clamp(16rem, 32vw, 24rem)" r="1.25rem" />
      </section>
      <section className="section gutter sk-rows" style={{ paddingTop: "3rem" }}>
        {[0, 1, 2, 3].map((i) => (
          <div className="sk-row" key={i}>
            <Sk w="5rem" h=".7rem" />
            <div className="sk-col">
              <Sk w="min(30rem, 90%)" h="1.6rem" r=".4rem" />
              <Sk w="min(36rem, 100%)" h=".9rem" />
              <Sk w="min(22rem, 70%)" h=".9rem" />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
