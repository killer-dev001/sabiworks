import { createFileRoute } from "@tanstack/react-router";
import { useWorkspaceContext } from "@/components/sabi/app-shell";
import { PageHeader, RequireWorkspaceType } from "@/components/sabi/page";
import { WorkspaceEditor } from "@/components/sabi/workspace-editor";

export const Route = createFileRoute("/_authenticated/my-brand")({
  head: () => ({ meta: [{ title: "My brand — Sabi" }] }),
  component: Page,
});

function Page() {
  const ws = useWorkspaceContext();
  return (
    <>
      <PageHeader title="My brand" subtitle="Your public brand profile, as creatives see it." />
      <RequireWorkspaceType type="brand">
        <WorkspaceEditor key={ws.id} ws={ws} />
      </RequireWorkspaceType>
    </>
  );
}
