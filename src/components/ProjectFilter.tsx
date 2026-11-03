"use client";

import { useRouter } from "next/navigation";

/** Activity page: narrow the feed to one project (?project=<id>). Projects come latest-first. */
export function ProjectFilter({ projects, value }: { projects: { id: string; name: string }[]; value: string }) {
  const router = useRouter();
  return (
    <div className="lg lg-dark flex items-center gap-2.5 rounded-[22px] p-2.5">
      <label htmlFor="act-project" className="shrink-0 pl-2 font-mono text-[11px] uppercase tracking-wider text-[#AEB8C5]">
        Project
      </label>
      <select
        id="act-project"
        className="input"
        value={value}
        onChange={(e) => router.push(e.target.value ? `/app/activity?project=${e.target.value}` : "/app/activity")}
      >
        <option value="">All activity</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </div>
  );
}
