"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { switchWorkspace } from "@/app/app/workspace/actions";

const NEW = "__new";

export function WorkspaceSwitcher({
  current,
  workspaces,
}: {
  current: string;
  workspaces: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    if (id === NEW) {
      router.push("/app/team#new");
      return;
    }
    startTransition(async () => {
      const res = await switchWorkspace(id);
      if (!res.ok) alert(res.error);
      // A device page belongs to the old workspace; go back to the list instead.
      if (res.ok && pathname.startsWith("/app/devices/")) router.push("/app/devices");
      else router.refresh();
    });
  }

  return (
    <select
      aria-label="Workspace"
      className="input w-auto min-w-0 max-w-[10rem] truncate py-1.5 font-mono text-xs sm:max-w-[16rem]"
      value={current}
      onChange={onChange}
      disabled={pending}
    >
      {workspaces.map((w) => (
        <option key={w.id} value={w.id}>
          {w.name}
        </option>
      ))}
      <option value={NEW}>+ New workspace…</option>
    </select>
  );
}
