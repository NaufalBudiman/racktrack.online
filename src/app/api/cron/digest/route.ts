import { NextResponse } from "next/server";
import { buildDigests } from "@/lib/digest";
import { emailConfigured, sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron calls this daily (vercel.json) with `Authorization: Bearer $CRON_SECRET`.
 * `?dry=1`, or no RESEND_API_KEY yet, returns what would be sent without sending.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const emails = await buildDigests();
  const dry = new URL(req.url).searchParams.has("dry") || !emailConfigured();
  if (dry) {
    return NextResponse.json({
      dry: true,
      reason: emailConfigured() ? "dry run requested" : "RESEND_API_KEY is not set",
      count: emails.length,
      emails: emails.map((e) => ({ workspace: e.workspace, subject: e.subject, text: e.text })),
    });
  }

  let sent = 0;
  const failed: string[] = [];
  for (const e of emails) {
    try {
      await sendEmail(e);
      sent++;
    } catch (err) {
      failed.push(err instanceof Error ? err.message : String(err));
    }
  }
  return NextResponse.json({ sent, failed: failed.length, errors: failed.slice(0, 3) }, { status: failed.length ? 207 : 200 });
}
