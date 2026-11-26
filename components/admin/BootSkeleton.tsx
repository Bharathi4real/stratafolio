import { Sk } from "@/components/ui/Skeleton";

/** Sidebar + page skeleton while the signed-in admin shell streams in. */
export function AdminBootSkeleton() {
  return (
    <div className="adm-boot" role="status" aria-label="Loading the admin">
      <aside className="adm-boot-side" aria-hidden="true">
        <Sk w="9rem" h="1.5rem" r=".4rem" />
        <Sk h="2.4rem" r=".7rem" />
        {Array.from({ length: 9 }, (_, i) => (
          <Sk key={i} w={`${60 + ((i * 17) % 30)}%`} h=".95rem" />
        ))}
      </aside>
      <div className="adm-boot-main" aria-hidden="true">
        <Sk w="14rem" h="1rem" />
        <Sk w="18rem" h="2.6rem" r=".5rem" />
        <Sk w="28rem" h=".95rem" />
        <div className="adm-boot-grid">
          <Sk h="6.5rem" r=".9rem" />
          <Sk h="6.5rem" r=".9rem" />
          <Sk h="6.5rem" r=".9rem" />
        </div>
        <Sk h="16rem" r="1rem" />
      </div>
    </div>
  );
}
