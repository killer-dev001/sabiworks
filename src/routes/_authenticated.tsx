import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/sabi/app-shell";

// Every page under this layout needs a signed-in user; AppShell enforces that on the
// client and RLS/RPC checks enforce it again on the server for every query.
export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
