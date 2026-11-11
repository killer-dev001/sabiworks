import logoAsset from "@/assets/logo-mark.png.asset.json";
import { cn } from "@/lib/utils";

export function SabiMark({ className }: { className?: string }) {
  return (
    <img
      src={logoAsset.url}
      alt="Sabi"
      className={cn("h-9 w-9 object-contain", className)}
      loading="lazy"
    />
  );
}

export function SabiLogo({
  className,
  tagline = false,
  light = false,
}: {
  className?: string;
  tagline?: boolean;
  light?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <SabiMark className="h-8 w-8" />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-display text-2xl font-extrabold tracking-tight",
            light ? "text-cream" : "text-foreground",
          )}
        >
          sabi<span className="text-ember">.</span>
        </span>
        {tagline && (
          <span
            className={cn(
              "mt-0.5 text-[10px] font-semibold tracking-wide",
              light ? "text-cream/80" : "text-muted-foreground",
            )}
          >
            Skill meets opportunity.
          </span>
        )}
      </span>
    </span>
  );
}
