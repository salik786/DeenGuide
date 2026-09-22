import { Download } from "lucide-react";

function buildExportHref(
  format: "csv" | "json",
  props: { accessKey: string; status: string; vote: string; date: string; source: string },
) {
  const qs = new URLSearchParams({ key: props.accessKey, format });
  if (props.status !== "all") qs.set("status", props.status);
  if (props.vote !== "all") qs.set("vote", props.vote);
  if (props.date !== "all") qs.set("date", props.date);
  if (props.source !== "all") qs.set("source", props.source);
  return `/api/insights/export?${qs.toString()}`;
}

/** Downloads exactly the rows the current filters show — the export route
 * applies the same filterInsightsRows() the page itself uses. */
export function ExportButtons(props: {
  accessKey: string;
  status: string;
  vote: string;
  date: string;
  source: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <a
        href={buildExportHref("csv", props)}
        className="flex items-center gap-1.5 rounded-lg border border-[#0f3d3026] bg-white px-2.5 py-1.5 text-sm text-emerald-900 transition hover:border-emerald-600"
      >
        <Download className="h-3.5 w-3.5" />
        CSV
      </a>
      <a
        href={buildExportHref("json", props)}
        className="flex items-center gap-1.5 rounded-lg border border-[#0f3d3026] bg-white px-2.5 py-1.5 text-sm text-emerald-900 transition hover:border-emerald-600"
      >
        <Download className="h-3.5 w-3.5" />
        JSON
      </a>
    </div>
  );
}
