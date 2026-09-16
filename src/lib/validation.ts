import { z } from "zod";
import { PLAN_TYPE_SLUGS } from "./plan-types";

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Tell us what to call you")
  .max(40, "Keep it under 40 characters");

export const togetherSinceSchema = z.iso.date("Pick a valid date");

export const planTitleSchema = z
  .string()
  .trim()
  .min(1, "Give it a name")
  .max(80, "Keep it under 80 characters");

export const planTypeSchema = z.enum(PLAN_TYPE_SLUGS, { message: "Pick a type" });

export const planDateSchema = z.iso.date("Pick a valid date");

export const planTimeSchema = z.string().regex(/^\d{2}:\d{2}$/, "Pick a valid time");
