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
        This assistant only answers from{" "}
        <span className="font-semibold">Sunnah.com (Sahih al-Bukhari)</span> and{" "}
        <span className="font-semibold">Quran.com</span> for a fixed set of topics, and every
        answer shows its exact source. It is not a scholar, so for rulings on your personal
        situation, please ask an imam or volunteer scholar at the event.
      </p>
    </div>
  );
}
