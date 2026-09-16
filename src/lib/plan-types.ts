export const PLAN_TYPES = [
  { slug: "dinner", emoji: "🍜", label: "Dinner" },
  { slug: "movie", emoji: "🎬", label: "Movie" },
  { slug: "trip", emoji: "✈️", label: "Trip" },
  { slug: "stay-home", emoji: "🏠", label: "Stay home" },
  { slug: "weekend", emoji: "🏖️", label: "Weekend" },
  { slug: "birthday", emoji: "🎂", label: "Birthday" },
  { slug: "anniversary", emoji: "💍", label: "Anniversary" },
  { slug: "surprise", emoji: "✨", label: "Surprise" },
] as const;

export type PlanType = (typeof PLAN_TYPES)[number]["slug"];

export const PLAN_TYPE_SLUGS = PLAN_TYPES.map((type) => type.slug) as [PlanType, ...PlanType[]];

// An unknown slug (a renamed type, an old row) renders neutrally instead of crashing.
export function planEmoji(slug: string): string {
  return PLAN_TYPES.find((type) => type.slug === slug)?.emoji ?? "📌";
}
