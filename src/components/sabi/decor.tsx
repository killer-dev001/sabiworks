import { cn } from "@/lib/utils";
import {
  Camera,
  Clapperboard,
  Megaphone,
  PenLine,
  PenTool,
  Sparkles,
  Star,
  MapPin,
  Briefcase,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "pen-tool": PenTool,
  camera: Camera,
  video: Clapperboard,
  megaphone: Megaphone,
  "pen-line": PenLine,
  sparkles: Sparkles,
};

/* Decorative African-modern shapes */

export function LeafShape({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg viewBox="0 0 100 100" className={cn("leaf-blob", className)} style={style} aria-hidden>
      <rect width="100" height="100" fill="currentColor" />
    </svg>
  );
}

export function HalfCircle({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg viewBox="0 0 100 50" className={className} style={style} aria-hidden>
      <path d="M0 50 A50 50 0 0 1 100 50 Z" fill="currentColor" />
    </svg>
  );
}

export function QuarterArc({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden>
      <path d="M0 100 A100 100 0 0 1 100 0 L100 100 Z" fill="currentColor" />
    </svg>
  );
}

export function StripeMotif({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 40" className={className} aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={i * 30}
          y={i % 2 === 0 ? 0 : 10}
          width="16"
          height={i % 2 === 0 ? 20 : 30}
          rx="8"
          fill="currentColor"
        />
      ))}
    </svg>
  );
}

export function RatingStars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", className)}>
      <Star className="h-3.5 w-3.5 fill-gold text-gold" />
      {rating.toFixed(1)}
    </span>
  );
}

export function MetaChip({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5 text-ember" />
      {children}
    </span>
  );
}

export { MapPin, Briefcase, CalendarClock };
