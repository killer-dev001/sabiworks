import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useSession } from "@/lib/hooks";
import { SabiLogo } from "@/components/sabi/logo";
import { AuthDecor } from "@/components/sabi/public-chrome";
import { Button, Input, Label } from "@/components/sabi/primitives";
import heroAsset from "@/assets/hero-creative.jpg.asset.json";

const searchSchema = z.object({
  mode: z.enum(["login", "signup"]).catch("login").optional(),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign up or log in — Sabi" },
      {
        name: "description",
        content: "Join Sabi to discover African creative talent or showcase your own skills.",
      },
      { property: "og:title", content: "Sign up or log in — Sabi" },
      { property: "og:description", content: "Join Sabi — skill meets opportunity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: ({ search }) => {
    if (typeof window !== "undefined") {
      // Client-side session check happens after hydration in the component.
      void search;
    }
  },
  component: AuthPage,
});

type Mode = "login" | "signup" | "forgot";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3a7.2 7.2 0 0 1-10.8-3.8H1.2v3.1A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.2a12 12 0 0 0 0 10.8l4.1-3.1Z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.5-3.5A12 12 0 0 0 1.2 6.6l4.1 3.1A7.2 7.2 0 0 1 12 4.8Z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-foreground" aria-hidden>
      <path d="M16.4 12.8c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3.1 2.4 1.2 0 1.7-.8 3.2-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.7-1-2.7-3.9ZM14 4.6c.7-.8 1.1-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4Z" />
    </svg>
  );
}

function AuthPage() {
  const { mode: searchMode } = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const { redirect: redirectTo } = Route.useSearch();
  const { userId, ready } = useSession();
  // Only follow same-site redirects ("/x"), never "//evil.com" or absolute URLs.
  const safeRedirect =
    redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : null;
  const [mode, setMode] = useState<Mode>(searchMode === "signup" ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [sentReset, setSentReset] = useState(false);

  useEffect(() => {
    setMode(searchMode === "signup" ? "signup" : "login");
  }, [searchMode]);

  useEffect(() => {
    if (ready && userId) {
      if (safeRedirect) router.history.replace(safeRedirect);
      else navigate({ to: searchMode === "signup" ? "/workspace" : "/dashboard", replace: true });
    }
  }, [ready, userId, navigate, router, searchMode, safeRedirect]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        if (signUpData.session) {
          navigate({ to: "/workspace", replace: true });
          return;
        }
        setAwaitingConfirmation(true);
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (safeRedirect) router.history.replace(safeRedirect);
        else navigate({ to: "/dashboard", replace: true });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSentReset(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSocial(provider: "google" | "apple") {
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Could not start sign-in. Please try again.");
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/workspace", replace: true });
    } catch {
      toast.error("Could not start sign-in. Please try again.");
    }
  }

  const isSignup = mode === "signup";

  return (
    <div className="relative flex min-h-screen flex-col lg:grid lg:grid-cols-2">
      {/* Illustrated panel (desktop) */}
      <div className="relative hidden overflow-hidden bg-forest-deep lg:block">
        <img
          src={heroAsset.url}
          alt="African creative professional"
          className="absolute inset-0 h-full w-full object-cover opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-forest-deep/95 via-forest-deep/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-10 text-cream">
          <p className="font-display text-3xl font-extrabold leading-tight">
            Skill meets opportunity.
          </p>
          <p className="mt-2 max-w-md text-sm text-cream/80">
            Where African talent meets brands that believe in it. Join thousands of creatives and
            brands building together on Sabi.
          </p>
          <div className="mt-6 flex gap-2">
            <span className="h-2 w-10 rounded-full bg-gold" />
            <span className="h-2 w-10 rounded-full bg-ember" />
            <span className="h-2 w-10 rounded-full bg-coral" />
          </div>
        </div>
      </div>

      {/* Auth panel */}
      <div className="relative flex flex-1 flex-col items-center justify-center bg-background px-4 py-10">
        <AuthDecor />
        <div className="relative z-10 w-full max-w-md">
          <Link to="/" className="mb-8 flex justify-center">
            <SabiLogo tagline />
          </Link>

          {awaitingConfirmation ? (
            <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-card">
              <h1 className="font-display text-2xl font-bold">Check your email</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We sent a confirmation link to <strong>{email}</strong>. Click it to activate your
                account, then come back to log in.
              </p>
              <Button variant="outline" className="mt-6 w-full" onClick={() => setMode("login")}>
                Back to log in
              </Button>
            </div>
          ) : sentReset ? (
            <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-card">
              <h1 className="font-display text-2xl font-bold">Reset link sent</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                If <strong>{email}</strong> matches an account, a password reset link is on its way.
              </p>
              <Button variant="outline" className="mt-6 w-full" onClick={() => setMode("login")}>
                Back to log in
              </Button>
            </div>
          ) : (
            <div className="rounded-3xl border border-border bg-card p-6 shadow-card sm:p-8">
              <h1 className="text-center font-display text-2xl font-bold">
                {isSignup ? "Create your account" : "Welcome back"}
              </h1>
              <p className="mt-1 text-center text-sm text-muted-foreground">
                {isSignup
                  ? "Join a community of talented creatives and forward-thinking brands."
                  : "Log in to your Sabi account."}
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {isSignup && (
                  <div>
                    <Label htmlFor="fullName">Full name</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Amara Okonkwo"
                      autoComplete="name"
                      required
                    />
                  </div>
                )}
                <div>
                  <Label htmlFor="email">{isSignup ? "Email" : "Email or phone number"}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </div>
                {mode !== "forgot" && (
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={isSignup ? "At least 8 characters" : "Your password"}
                        autoComplete={isSignup ? "new-password" : "current-password"}
                        className="pr-11"
                        minLength={isSignup ? 8 : undefined}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {!isSignup && (
                      <button
                        type="button"
                        onClick={() => setMode("forgot")}
                        className="mt-2 text-xs font-semibold text-ember hover:underline"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {mode === "signup"
                    ? "Create account"
                    : mode === "login"
                      ? "Log in"
                      : "Send reset link"}
                </Button>
              </form>

              {mode !== "forgot" && (
                <>
                  <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="h-px flex-1 bg-border" />
                    or continue with
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  <div className="grid gap-2.5">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => handleSocial("google")}
                    >
                      <GoogleIcon /> Continue with Google
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => handleSocial("apple")}
                    >
                      <AppleIcon /> Continue with Apple
                    </Button>
                  </div>
                </>
              )}

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {isSignup ? (
                  <>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("login")}
                      className="font-bold text-primary hover:underline"
                    >
                      Log in
                    </button>
                  </>
                ) : (
                  <>
                    Don't have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("signup")}
                      className="font-bold text-primary hover:underline"
                    >
                      Sign up
                    </button>
                  </>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
