"use client";

import { useEffect, useState } from "react";

const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

/** Timestamp in the viewer's timezone. Renders UTC until mounted to avoid a hydration mismatch. */
export function LocalTime({ iso }: { iso: string }) {
  const [text, setText] = useState(() => `${iso.slice(0, 16).replace("T", " ")} UTC`);
  useEffect(() => setText(fmt.format(new Date(iso))), [iso]);
  return <time dateTime={iso}>{text}</time>;
}
