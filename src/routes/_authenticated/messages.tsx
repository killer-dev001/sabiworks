import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/hooks";
import { timeAgo } from "@/lib/format";
import { Card, PageLoader } from "@/components/sabi/primitives";
import { EmptyState } from "@/components/sabi/cards";
import { Avatar, ErrorNote, PageHeader } from "@/components/sabi/page";
import { MessageThread } from "@/components/sabi/messages";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/messages")({
  validateSearch: z.object({
    project: z.string().uuid().optional().catch(undefined),
    creative: z.string().uuid().optional().catch(undefined),
  }),
  head: () => ({ meta: [{ title: "Messages — Sabi" }] }),
  component: MessagesPage,
});

function MessagesPage() {
  const { project, creative } = Route.useSearch();
  const { userId } = useSession();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["conversations", userId],
    enabled: !!userId,
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_conversations");
      if (error) throw error;
      return data ?? [];
    },
  });
  const selected =
    data?.find((c) => c.project_id === project && c.creative_workspace_id === creative) ?? null;

  return (
    <>
      <PageHeader title="Messages" subtitle="Ask questions and coordinate on projects." />
      {isLoading ? (
        <PageLoader />
      ) : error ? (
        <ErrorNote error={error} retry={() => refetch()} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          title="No conversations yet"
          description="When you send or receive a proposal, you can message the other side here to clarify the brief."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-[320px_1fr]">
          <div className={cn("space-y-2", selected && "hidden md:block")}>
            {data!.map((c) => (
              <Link
                key={`${c.project_id}-${c.creative_workspace_id}`}
                to="/messages"
                search={{ project: c.project_id, creative: c.creative_workspace_id }}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:bg-secondary/50",
                  selected?.project_id === c.project_id &&
                    selected.creative_workspace_id === c.creative_workspace_id &&
                    "ring-2 ring-primary",
                )}
              >
                <Avatar src={c.other_avatar} name={c.other_name} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-bold">{c.other_name}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {timeAgo(c.last_at)}
                    </span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {c.project_title}
                  </span>
                  <span className="block truncate text-xs">{c.last_body ?? "No messages yet"}</span>
                </span>
                {c.unread > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-ember px-1 text-[10px] font-bold text-primary-foreground">
                    {c.unread}
                  </span>
                )}
              </Link>
            ))}
          </div>
          <Card
            className={cn(
              "flex h-[70vh] min-h-96 flex-col overflow-hidden",
              !selected && "hidden md:flex",
            )}
          >
            {selected && userId ? (
              <>
                <div className="flex items-center gap-3 border-b border-border p-3">
                  <Link
                    to="/messages"
                    className="rounded-lg p-2 hover:bg-secondary md:hidden"
                    aria-label="Back to conversations"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                  <Avatar
                    src={selected.other_avatar}
                    name={selected.other_name}
                    className="h-9 w-9"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{selected.other_name}</p>
                    <Link
                      to="/project/$id"
                      params={{ id: selected.project_id }}
                      className="block truncate text-xs text-muted-foreground hover:underline"
                    >
                      {selected.project_title}
                    </Link>
                  </div>
                </div>
                <MessageThread
                  key={`${selected.project_id}-${selected.creative_workspace_id}`}
                  projectId={selected.project_id}
                  creativeWorkspaceId={selected.creative_workspace_id}
                  userId={userId}
                  className="flex-1"
                />
              </>
            ) : (
              <p className="m-auto text-sm text-muted-foreground">Select a conversation.</p>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
