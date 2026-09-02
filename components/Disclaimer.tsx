import { ShieldCheck } from "lucide-react";

export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-xl border border-gold-300/60 bg-gold-100/60 text-emerald-900 ${
        compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm"
      }`}
    >
      <ShieldCheck className={compact ? "h-4 w-4 mt-0.5 shrink-0" : "h-5 w-5 mt-0.5 shrink-0"} />
      <p>
        Answers marked <span className="font-semibold text-emerald-700">Verified</span> are
        grounded in <span className="font-semibold">Sunnah.com (Sahih al-Bukhari)</span> and{" "}
        <span className="font-semibold">Quran.com</span>, with the exact source shown. Anything
        marked <span className="font-semibold text-amber-700">Not verified</span> is general
        information, not checked against those sources. This assistant is not a scholar, so for
        rulings on your personal situation, please ask an imam or volunteer scholar at the event.
      </p>
    </div>
  );
}
