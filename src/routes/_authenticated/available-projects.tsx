import { createFileRoute } from "@tanstack/react-router";
import { useWorkspaceContext } from "@/components/sabi/app-shell";
import { ProjectBrowser } from "@/components/sabi/project-browser";
import { PageHeader, RequireWorkspaceType } from "@/components/sabi/page";

export const Route = createFileRoute("/_authenticated/available-projects")({
  head: () => ({ meta: [{ title: "Available projects — Sabi" }] }),
  component: AvailableProjects,
});

function AvailableProjects() {
  const ws = useWorkspaceContext();
  return (
    <>
      <PageHeader title="Available projects" subtitle="Open briefs you can send a proposal to." />
      <RequireWorkspaceType type="creative">
        <ProjectBrowser workspace={ws} />
      </RequireWorkspaceType>
    </>
  );
}
