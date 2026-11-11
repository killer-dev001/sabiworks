import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/hooks";
import { SabiLogo } from "@/components/sabi/logo";
import { Button } from "@/components/sabi/primitives";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Find Talent", to: "/creatives" as const },
  { label: "Post Projects", to: "/projects" as const },
  { label: "Brands", to: "/brands" as const },
];

export function PublicHeader() {
  const { userId, ready } = useSession();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="shrink-0">
          <SabiLogo />
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className="text-sm font-semibold text-foreground/80 transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {ready && userId ? (
            <>
              <Button asChild variant="outline" size="sm">
                <Link to="/dashboard">My dashboard</Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={signOut}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/auth" search={{ mode: "login" }}>
                  Log in
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Sign up
                </Link>
              </Button>
            </>
          )}
        </div>

        <button
          className="rounded-lg p-2 hover:bg-secondary md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-card px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-secondary"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex gap-2">
            {ready && userId ? (
              <>
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <Link to="/dashboard" onClick={() => setOpen(false)}>
                    My dashboard
                  </Link>
                </Button>
                <Button variant="soft" size="sm" onClick={signOut}>
                  Log out
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <Link to="/auth" search={{ mode: "login" }} onClick={() => setOpen(false)}>
                    Log in
                  </Link>
                </Button>
                <Button asChild size="sm" className="flex-1">
                  <Link to="/auth" search={{ mode: "signup" }} onClick={() => setOpen(false)}>
                    Sign up
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="grain-panel mt-24 text-cream">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <SabiLogo light />
            <p className="mt-4 max-w-sm text-sm text-cream/75">
              Where African talent meets brands that believe in it. Discover creatives, publish
              briefs, compare proposals and build together.
            </p>
            <div className="mt-5 flex gap-3">
              <span className="h-6 w-6 rounded-full bg-gold/80" aria-hidden />
              <span className="h-6 w-6 rounded-full bg-ember/80" aria-hidden />
              <span className="h-6 w-6 rounded-full bg-coral/80" aria-hidden />
              <span className="h-6 w-6 rounded-full bg-cream/60" aria-hidden />
            </div>
          </div>
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-gold">Marketplace</h4>
            <ul className="mt-4 space-y-2 text-sm text-cream/75">
              <li>
                <Link to="/creatives" className="hover:text-cream">
                  Find talent
                </Link>
              </li>
              <li>
                <Link to="/brands" className="hover:text-cream">
                  Brands
                </Link>
              </li>
              <li>
                <Link to="/projects" className="hover:text-cream">
                  Browse projects
                </Link>
              </li>
              <li>
                <Link to="/auth" search={{ mode: "signup" }} className="hover:text-cream">
                  Create account
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-gold">
              Trust &amp; safety
            </h4>
            <ul className="mt-4 space-y-2 text-sm text-cream/75">
              <li>Verified profiles</li>
              <li>Clear project terms</li>
              <li>Secure sign-in</li>
              <li>Report a concern</li>
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-cream/15 pt-6 text-xs text-cream/60 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Sabi. Skill meets opportunity.</p>
          <p className="italic">Brand and creative profiles shown are demo content.</p>
        </div>
      </div>
    </footer>
  );
}

export function AuthDecor() {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className="pointer-events-none absolute inset-x-0 bottom-0 h-24 overflow-hidden"
      aria-hidden
    >
      <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className="h-full w-full">
        <path
          d="M0 80 Q 180 20 360 70 T 720 60 T 1080 75 T 1440 55 V120 H0 Z"
          className="fill-forest-soft"
        />
        <path d="M0 100 Q 240 55 480 95 T 960 90 T 1440 85 V120 H0 Z" className="fill-gold-soft" />
        <circle cx="120" cy="40" r="10" className="fill-ember/40" />
        <circle cx="1320" cy="35" r="8" className="fill-forest/40" />
        <ellipse cx="700" cy="30" rx="26" ry="14" className="fill-coral/30 leaf-blob" />
      </svg>
    </div>
  );
}

export function cn2(...args: string[]) {
  return cn(...args);
}
