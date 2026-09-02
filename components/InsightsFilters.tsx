"use client";

function Select({
  name,
  defaultValue,
  options,
}: {
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className="rounded-lg border border-emerald-900/15 bg-white px-2.5 py-1.5 text-sm text-emerald-950 outline-none focus:border-emerald-600"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function InsightsFilters({
  accessKey,
  status,
  vote,
  date,
}: {
  accessKey: string;
  status: string;
  vote: string;
  date: string;
}) {
  return (
    <form method="get" className="mb-6 flex flex-wrap items-center gap-2">
      <input type="hidden" name="key" value={accessKey} />
      <Select
        name="status"
        defaultValue={status}
        options={[
          { value: "all", label: "All statuses" },
          { value: "verified", label: "Verified" },
          { value: "unverified", label: "Not verified" },
          { value: "declined", label: "Declined" },
        ]}
      />
      <Select
        name="vote"
        defaultValue={vote}
        options={[
          { value: "all", label: "All feedback" },
          { value: "up", label: "👍 Thumbs up" },
          { value: "down", label: "👎 Thumbs down" },
          { value: "none", label: "No feedback" },
        ]}
      />
      <Select
        name="date"
        defaultValue={date}
        options={[
          { value: "all", label: "All time" },
          { value: "today", label: "Today" },
          { value: "7d", label: "Last 7 days" },
          { value: "30d", label: "Last 30 days" },
        ]}
      />
      <noscript>
        <button type="submit" className="rounded-lg bg-emerald-800 px-3 py-1.5 text-sm text-white">
          Apply
        </button>
      </noscript>
    </form>
  );
}
