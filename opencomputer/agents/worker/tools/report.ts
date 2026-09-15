// The one source of the result type. The `report` tool's input and output
// are this schema; the app imports the `Report` type from here and validates
// a session's result against the same schema at its boundary. Agent code may
// not import outside its own directory, so the dependency runs one way: the
// app reads this file, this file reads nothing of the app.
//
// Every field is optional because the agent reports what it knows so far and
// calls again as more becomes known; the latest committed call is the
// session's result. The tool verifies the fields present against GitHub
// before it returns (W4); `checks` stays the agent's claim, tied to the
// command it names.
import { z } from "zod";

const sha = z
  .string()
  .regex(/^[0-9a-f]{40}$/, "a full 40-character commit sha")
  .describe("A full commit sha");

export const reportSchema = z
  .object({
    baseSha: sha.optional().describe("The resolved base commit the work started from"),
    branch: z.string().min(1).max(255).optional().describe("The work branch, task/<task id>"),
    commit: sha.optional().describe("The tested commit at the head of the work branch; it must be pushed"),
    pr: z
      .object({
        number: z.number().int().positive(),
        url: z.string().url(),
        draft: z.boolean(),
      })
      .strict()
      .optional()
      .describe("The pull request opened from the work branch"),
    checks: z
      .array(
        z
          .object({
            command: z.string().min(1).max(500).describe("The command that was run"),
            passed: z.boolean(),
            summary: z.string().max(500).describe("One line on the outcome, as reported by the agent"),
          })
          .strict(),
      )
      .max(20)
      .optional()
      .describe("The checks the repository defines, as run and reported by the agent"),
  })
  .strict();

export type Report = z.infer<typeof reportSchema>;

/** The JSON Schema the tool declares for its input and output. */
export const reportJsonSchema = z.toJSONSchema(reportSchema) as Record<string, unknown>;

/**
 * The stage a report has reached: nothing yet, the base only, tested changes
 * on a pushed branch, or a published pull request. The app's result facet.
 */
export type ReportStage = "none" | "base" | "changes" | "published";

export function reportStage(report: Report | undefined): ReportStage {
  if (!report) return "none";
  if (report.pr) return "published";
  if (report.commit) return "changes";
  if (report.baseSha) return "base";
  return "none";
}
