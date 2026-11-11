import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAction } from "@/lib/actions";
import { timeAgo } from "@/lib/format";
import { Button, PageLoader, Textarea } from "@/components/sabi/primitives";
import { ErrorNote } from "@/components/sabi/page";
import { cn } from "@/lib/utils";

export function MessageThread({
  projectId,
  creativeWorkspaceId,
  userId,
  className,
}: {
  projectId: string;
  creativeWorkspaceId: string;
  userId: string;
  className?: string;
}) {
  const qc = useQueryClient();
  const { run, isBusy } = useAction();
  const [body, setBody] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["messages", projectId, creativeWorkspaceId],
    refetchInterval: 6000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("project_id", projectId)
        .eq("creative_workspace_id", creativeWorkspaceId)
        .order("created_at", { ascending: true })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });
  const count = data?.length ?? 0;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
    if (data) {
      supabase
        .rpc("mark_conversation_read", {
          p_project_id: projectId,
          p_creative_workspace_id: creativeWorkspaceId,
        })
        .then(() => {
          qc.invalidateQueries({ queryKey: ["conversations"] });
          qc.invalidateQueries({ queryKey: ["notifications"] });
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, projectId, creativeWorkspaceId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    const ok = await run("send", () =>
      supabase.rpc("send_message", {
        p_project_id: projectId,
        p_creative_workspace_id: creativeWorkspaceId,
        p_body: text,
      }),
    );
    if (ok) setBody("");
  }

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4" aria-live="polite">
        {isLoading ? (
          <PageLoader />
        ) : error ? (
          <ErrorNote error={error} retry={() => refetch()} />
        ) : count === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No messages yet. Say hello and clarify the details.
          </p>
        ) : (
          data!.map((m) => {
            const mine = m.sender_user_id === userId;
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2 text-sm",
                    mine ? "bg-primary text-primary-foreground" : "bg-secondary",
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p
                    className={cn(
                      "mt-1 text-[10px]",
                      mine ? "text-primary-foreground/70" : "text-muted-foreground",
                    )}
                  >
                    {timeAgo(m.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="flex items-end gap-2 border-t border-border p-3">
        <Textarea
          aria-label="Message"
          className="min-h-11 flex-1 resize-none py-2.5"
          rows={1}
          value={body}
          maxLength={4000}
          placeholder="Write a message…"
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <Button type="submit" disabled={isBusy("send") || !body.trim()} aria-label="Send message">
          {isBusy("send") ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
