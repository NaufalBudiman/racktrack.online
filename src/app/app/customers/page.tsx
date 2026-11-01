import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/access";
import { listDevices } from "@/lib/devices";
import { CustomerList } from "@/components/CustomerList";

export const dynamic = "force-dynamic";

// Customers are derived from devices (name only for now), so there's nothing extra to store.
export default async function CustomersPage() {
  const ctx = await getAppContext();
  if (!ctx) redirect("/");
  const { workspace } = ctx;

  const devices = await listDevices(workspace.workspaceId);
  return <CustomerList devices={devices} workspaceName={workspace.name} />;
}
