import { createFileRoute } from "@tanstack/react-router";
import { useWorkspaceContext } from "@/components/sabi/app-shell";
import { PageHeader, RequireWorkspaceType } from "@/components/sabi/page";
import { WorkspaceEditor } from "@/components/sabi/workspace-editor";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "My profile — Sabi" }] }),
  component: Page,
});

function Page() {
  const ws = useWorkspaceContext();
  return (
    <>
      <PageHeader
        title="My profile"
        subtitle="Your public profile is what brands see before they hire you."
      />
      <RequireWorkspaceType type="creative">
        <WorkspaceEditor key={ws.id} ws={ws} />
      </RequireWorkspaceType>
    </>
  );
}
