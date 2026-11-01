import { redirect } from "next/navigation";

// Short link printed on QR labels (racktrack.online/d/<id>). /app is behind sign-in and checks the workspace.
export default async function DeviceShortLink({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/app/devices/${encodeURIComponent(id)}`);
}
