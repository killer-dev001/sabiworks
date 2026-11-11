import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/hooks";
import { useAction } from "@/lib/actions";
import { useWorkspaceContext } from "@/components/sabi/app-shell";
import { ACTIVE_WORKSPACE_KEY } from "@/lib/sabi";
import { errMessage } from "@/lib/errors";
import { Button, Input, PageLoader } from "@/components/sabi/primitives";
import { Avatar, Field, PageHeader, SectionCard } from "@/components/sabi/page";
import { useMyWorkspaces } from "@/lib/hooks";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Sabi" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { userId } = useSession();
  const active = useWorkspaceContext();
  const navigate = useNavigate();
  const { data: workspaces } = useMyWorkspaces(userId);
  const { run, isBusy } = useAction();
  const profile = useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [{ data: p, error }, { data: u }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId!).maybeSingle(),
        supabase.auth.getUser(),
      ]);
      if (error) throw error;
      return { profile: p, email: u.user?.email ?? "" };
    },
  });
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  useEffect(() => {
    if (profile.data?.profile) setName(profile.data.profile.full_name);
  }, [profile.data]);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) {
      toast.error("Use at least 8 characters.");
      return;
    }
    if (pw !== pw2) {
      toast.error("Passwords don't match.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) {
      toast.error(errMessage(error));
      return;
    }
    toast.success("Password updated.");
    setPw("");
    setPw2("");
  }

  if (profile.isLoading) return <PageLoader />;
  return (
    <>
      <PageHeader title="Settings" subtitle="Your account and workspaces." />
      <div className="space-y-6">
        <SectionCard title="Account">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim().length < 1) {
                toast.error("Enter your name.");
                return;
              }
              void run(
                "name",
                () =>
                  supabase
                    .from("profiles")
                    .update({ full_name: name.trim().slice(0, 100) })
                    .eq("id", userId!),
                "Name updated.",
              );
            }}
          >
            <Field label="Full name" htmlFor="st-name">
              <Input
                id="st-name"
                value={name}
                maxLength={100}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Email" htmlFor="st-email" hint="Sign-in email can't be changed here.">
              <Input id="st-email" value={profile.data?.email ?? ""} readOnly disabled />
            </Field>
            <Button type="submit" disabled={isBusy("name")}>
              {isBusy("name") && <Loader2 className="h-4 w-4 animate-spin" />}Save
            </Button>
          </form>
        </SectionCard>
        <SectionCard title="Change password">
          <form className="space-y-4" onSubmit={changePassword}>
            <Field label="New password" htmlFor="st-pw">
              <Input
                id="st-pw"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
              />
            </Field>
            <Field label="Confirm new password" htmlFor="st-pw2">
              <Input
                id="st-pw2"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
              />
            </Field>
            <Button type="submit" variant="outline">
              Update password
            </Button>
          </form>
        </SectionCard>
        <SectionCard
          title="Workspaces"
          action={
            <Button asChild size="sm" variant="outline">
              <Link to="/workspace">Add workspace</Link>
            </Button>
          }
        >
          <ul className="space-y-2">
            {(workspaces ?? []).map((w) => (
              <li
                key={w.id}
                className="flex items-center gap-3 rounded-xl border border-border p-3"
              >
                <Avatar src={w.avatar_url ?? w.logo_url} name={w.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{w.name}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {w.type}
                    {w.id === active.id ? " · active" : ""}
                    {w.suspended ? " · suspended" : ""}
                  </p>
                </div>
                {w.id !== active.id && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      localStorage.setItem(ACTIVE_WORKSPACE_KEY, w.id);
                      navigate({ to: "/dashboard" });
                      location.reload();
                    }}
                  >
                    Switch
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title="Session">
          <Button
            variant="outline"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/" });
            }}
          >
            Log out
          </Button>
        </SectionCard>
      </div>
    </>
  );
}
