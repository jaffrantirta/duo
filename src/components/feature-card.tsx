import { cn } from "@/lib/utils";

type Props = { emoji: string; title: string; description: string; status: "live" | "soon" };

export function FeatureCard({ emoji, title, description, status }: Props) {
  return (
    <div className="flex gap-4 rounded-3xl bg-card p-5">
      <span className="text-3xl" aria-hidden>
        {emoji}
      </span>
      <div className="flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-lg font-bold">{title}</h3>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              status === "live" ? "bg-mint" : "bg-butter text-foreground/70",
            )}
          >
            {status === "live" ? "Live" : "Coming soon"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
