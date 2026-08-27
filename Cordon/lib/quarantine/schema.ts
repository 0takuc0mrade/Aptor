import { z } from "zod";

export const identifierSchema = z.string().uuid("Invalid Cordon identifier.");

export const executionPlanRequestSchema = z.object({
  mode: z.enum(["install", "script", "probe"]),
  scriptName: z.string().max(100).optional(),
  networkPolicy: z.enum(["disabled", "allowlist"]).default("disabled"),
}).strict().superRefine((value, context) => {
  if (value.mode === "script" && !value.scriptName) context.addIssue({ code: "custom", path: ["scriptName"], message: "Select a script from package.json." });
  if (value.mode !== "script" && value.scriptName) context.addIssue({ code: "custom", path: ["scriptName"], message: "A script name is valid only in script mode." });
  if (value.networkPolicy === "allowlist" && value.mode !== "install") context.addIssue({ code: "custom", path: ["networkPolicy"], message: "Registry access is available only for dependency installation." });
});

export const startRunRequestSchema = z.object({ planId: identifierSchema, retry: z.boolean().optional().default(false) }).strict();
