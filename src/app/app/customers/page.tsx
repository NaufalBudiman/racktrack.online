import { redirect } from "next/navigation";

// Customers became Projects (a customer job is a project).
export default function CustomersPage() {
  redirect("/app/projects");
}
