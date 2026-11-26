import { Sk } from "@/components/ui/Skeleton";

/** Admin page skeleton shown while an editor or list loads (inside the shell). */
export default function Loading() {
  return (
    <div className="adm-sk" role="status" aria-label="Loading">
      <div className="adm-sk-head">
        <div className="adm-sk-col">
          <Sk w="16rem" h="2.6rem" r=".5rem" />
          <Sk w="26rem" h=".95rem" />
        </div>
        <Sk w="7rem" h="2.1rem" r="99px" />
      </div>
      <div className="adm-sk-grid">
        <Sk h="6.5rem" r=".9rem" />
        <Sk h="6.5rem" r=".9rem" />
        <Sk h="6.5rem" r=".9rem" />
        <Sk h="6.5rem" r=".9rem" />
      </div>
      <div className="adm-sk-card">
        {[0, 1, 2, 3, 4].map((i) => (
          <div className="adm-sk-row" key={i}>
            <Sk w="40%" h="1rem" />
            <Sk w="6rem" h="1.4rem" r="99px" />
            <Sk w="5rem" h=".8rem" />
          </div>
        ))}
      </div>
    </div>
  );
}
