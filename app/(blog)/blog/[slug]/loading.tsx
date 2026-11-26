import { Sk } from "@/components/ui/Skeleton";

/** Article skeleton: meta, title, cover, then paragraphs. */
export default function Loading() {
  return (
    <article className="gutter sk-article" aria-busy="true" aria-label="Loading post">
      <Sk w="12rem" h=".7rem" />
      <Sk w="min(44rem, 95%)" h="clamp(2.5rem, 6vw, 4.5rem)" r=".5rem" />
      <Sk w="min(30rem, 70%)" h="1.1rem" />
      <Sk h="clamp(12rem, 28vw, 20rem)" r="1.25rem" />
      <div className="sk-col sk-prose">
        {["96%", "100%", "88%", "92%", "60%", "100%", "84%"].map((w, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder lines
          <Sk key={i} w={w} h=".95rem" />
        ))}
      </div>
    </article>
  );
}
