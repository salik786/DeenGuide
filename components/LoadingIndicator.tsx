"use client";

import { useEffect, useState } from "react";

// Honest about what might actually be happening — the answer could come
// from the static corpus, a live search of trusted sites, or neither.
const MESSAGES = [
  "Checking verified sources…",
  "Searching trusted sites…",
  "Weighing what's certain…",
  "Preparing your answer…",
];

export function LoadingIndicator() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % MESSAGES.length);
    }, 1600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="msg-in flex items-center gap-2.5 text-sm text-[#145a4499]">
      <span className="spin-star inline-block text-base text-gold-600">✦</span>
      {MESSAGES[index]}
    </div>
  );
}
