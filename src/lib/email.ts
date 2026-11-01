// Server-only: sends mail through Resend's HTTP API (no SDK). Needs RESEND_API_KEY and a verified sender domain.

export const emailConfigured = () => !!process.env.RESEND_API_KEY;

const FROM = () => process.env.DIGEST_FROM ?? "RackTrack <noreply@racktrack.online>";

export async function sendEmail(msg: { to: string; subject: string; html: string; text: string }): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM(), ...msg }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
