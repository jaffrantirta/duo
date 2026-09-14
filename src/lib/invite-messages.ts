import type { InviteProblem } from "@/lib/invites";

type Copy = { title: string; body: string; cta: { label: string; href: string } };

export const INVITE_PROBLEM_COPY: Record<InviteProblem, Copy> = {
  not_found: {
    title: "This link doesn't work anymore",
    body: "Ask your partner to send you a fresh one.",
    cta: { label: "Go home", href: "/" },
  },
  expired: {
    title: "This link has expired",
    body: "Invite links last 7 days. Ask your partner for a new one.",
    cta: { label: "Go home", href: "/" },
  },
  used: {
    title: "This link was already used",
    body: "Each invite link works once. If that wasn't you, ask for a new one.",
    cta: { label: "Go home", href: "/" },
  },
  own_invite: {
    title: "This is your own invite",
    body: "Send it to your partner so they can join you.",
    cta: { label: "Back to home", href: "/home" },
  },
  already_paired: {
    title: "You're already paired",
    body: "You're already part of a duo.",
    cta: { label: "Go to your home", href: "/home" },
  },
  couple_full: {
    title: "This duo is already complete",
    body: "This couple already has two people.",
    cta: { label: "Go home", href: "/" },
  },
};
