import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col justify-center gap-6">
      <p className="text-6xl" aria-hidden>
        🧭
      </p>
      <h1 className="font-display text-4xl font-bold tracking-tight">This page wandered off</h1>
      <p className="text-lg text-muted-foreground">We could not find what you were looking for.</p>
      <Link href="/" className={cn(buttonVariants({ size: "lg" }), "h-12 rounded-2xl text-base")}>
        Take me home
      </Link>
    </div>
  );
}
