import { z } from "zod";

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Tell us what to call you")
  .max(40, "Keep it under 40 characters");

export const togetherSinceSchema = z.iso.date("Pick a valid date");
