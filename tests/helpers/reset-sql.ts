// `plans`, `discover_cards`, and `discover_swipes` aren't listed below — each has a cascading FK
// into `couples` (discover_swipes cascades via discover_cards, which cascades via couples), so
// `TRUNCATE ... CASCADE` on `couples` already empties them. Adding them explicitly would be
// redundant, not wrong.
export const RESET_SQL =
  'TRUNCATE couple_invites, couple_members, couples, session, account, verification, "user", waitlist CASCADE';
