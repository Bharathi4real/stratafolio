"use client";

import Link from "next/link";
import { useEffect } from "react";
import { humanizeError } from "@/lib/errors";

/** Admin error screen (inside the shell, so navigation still works). */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  // In production Next hides server error messages; show the helpful one when we have it.
  const msg =
    error.message && !/omitted in production/i.test(error.message)
      ? humanizeError(error)
      : "Something went wrong on the server.";
  return (
    <div className="adm-error" role="alert">
      <span className="mono adm-error-k">
        <i aria-hidden="true" /> Error
      </span>
      <h1>
        This page couldn’t <em>load.</em>
      </h1>
      <p>{msg}</p>
      <div className="adm-error-acts">
        <button type="button" className="btn btn-primary" onClick={() => reset()}>
          Try again
        </button>
        <Link href="/admin" className="btn">
          Go to dashboard
        </Link>
      </div>
      {error.digest ? <p className="mono subtle adm-error-ref">Reference {error.digest}</p> : null}
    </div>
  );
}
