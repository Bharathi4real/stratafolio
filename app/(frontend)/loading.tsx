import { Sk } from "@/components/ui/Skeleton";

/** Generic page skeleton (eyebrow, big heading, intro, a block of content). */
export default function Loading() {
  return (
    <section className="page-hero gutter sk-page" aria-busy="true" aria-label="Loading">
      <Sk w="11rem" h=".7rem" />
      <Sk w="min(42rem, 80%)" h="clamp(3rem, 8vw, 6rem)" r=".6rem" />
      <Sk w="min(30rem, 70%)" h="1rem" />
      <Sk w="min(24rem, 55%)" h="1rem" />
      <div className="sk-cards">
        <Sk h="12rem" r="1rem" />
        <Sk h="12rem" r="1rem" />
        <Sk h="12rem" r="1rem" />
      </div>
    </section>
  );
}
