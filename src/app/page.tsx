import { redirect } from "next/navigation";
import { FeatureCard } from "@/components/feature-card";
import { WaitlistForm } from "@/components/waitlist-form";
import { getCoupleForUser } from "@/lib/couples";
import { getSession } from "@/lib/session";

const FEATURES: { emoji: string; title: string; description: string; status: "live" | "soon" }[] = [
  {
    emoji: "🗓️",
    title: "Our Plans",
    description: "Turn ideas into real plans together, from a dinner reservation to a weekend away.",
    status: "live",
  },
  {
    emoji: "💡",
    title: "Discover & Match",
    description: "You both swipe on date ideas. A mutual ❤️ is a match, and it goes straight into your plans.",
    status: "live",
  },
  {
    emoji: "📸",
    title: "Memories",
    description: "Every plan you finish becomes a memory, building a timeline of your life together.",
    status: "soon",
  },
  {
    emoji: "🐻",
    title: "Shared pet & streaks",
    description: "A little pet you take care of together, growing with everything you do as a couple.",
    status: "soon",
  },
];

export default async function RootPage() {
  const session = await getSession();
  if (session) {
    const couple = await getCoupleForUser(session.user.id);
    redirect(couple ? "/home" : "/onboarding");
  }

  return (
    <div className="flex flex-1 flex-col gap-12 py-4">
      <header className="space-y-6">
        <h1 className="font-display text-7xl font-bold tracking-tight">duo</h1>
        <p className="text-lg text-muted-foreground">A little world for the two of you.</p>
        <WaitlistForm />
      </header>

      <section className="space-y-4">
        <p className="text-center text-sm font-medium text-muted-foreground">
          Discover → Match → Plan → Do → Save Memory
        </p>
        <div className="space-y-3">
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </section>

      <footer className="space-y-4 text-center">
        <p className="font-display text-2xl font-bold">Want in?</p>
        <WaitlistForm />
      </footer>
    </div>
  );
}
