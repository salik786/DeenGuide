"use client";

import { useEffect, useState } from "react";
import { getGregorianDateString, getHijriDateString } from "@/lib/hijri";

export function DateBadge({ className }: { className?: string }) {
  const [dates, setDates] = useState<{ hijri: string | null; gregorian: string } | null>(null);

  useEffect(() => {
    // Computed post-mount, not during render, to avoid an SSR/client
    // markup mismatch (the server and browser clocks can disagree by a day
    // around midnight) — a legitimate exception to the "no setState in
    // effects" rule, same as the localStorage hydration read elsewhere.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDates({ hijri: getHijriDateString(), gregorian: getGregorianDateString() });
  }, []);

  if (!dates) return null;

  return (
    <p className={className}>
      {dates.hijri ? (
        <>
          {dates.hijri}
          <span className="opacity-40"> · </span>
        </>
      ) : null}
      {dates.gregorian}
    </p>
  );
}
