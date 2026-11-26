export function StatusTag({
  label,
  value,
  kicker = true,
}: {
  label?: string;
  value: string;
  kicker?: boolean;
}) {
  return (
    <span className="status" role="status">
      <span className="dot" aria-hidden="true" />
      {kicker ? (
        <>
          <span className="status-k">{label ?? "Status"}</span>
          <span className="status-rule" aria-hidden="true" />
        </>
      ) : null}
      <span className="status-v">{value}</span>
    </span>
  );
}
