// The one source of the result type: the JSON Schema the report tool
// declares to the model, the `Report` type derived from it, and the parser
// the app builds from it (src/shared/report.ts). Agent code may import
// nothing from outside its own directory, not even a package, so this
// module holds the definition and the dependency runs one way: the app
// reads this file, this file reads nothing of the app. The compiler reads
// the schema from the syntax tree, so the literal below holds no
// identifiers, spreads or calls; the patterns are spelled out where they
// are used. A field is verified where it is used: the tool checks the
// fields present against GitHub, the app parses a result before it renders.
//
// Every field is optional because the agent reports what it knows so far and
// calls again as more becomes known; the latest committed call is the
// session's result.
import type { FromSchema } from "json-schema-to-ts";

export const REPORT_JSON_SCHEMA = {
  type: "object",
  description: "What is known about the task so far",
  properties: {
    repo: {
      type: "string",
      pattern: "^[A-Za-z0-9][A-Za-z0-9-]{0,38}/[A-Za-z0-9._-]{1,100}$",
      description: "The repository the other fields refer to, as owner/name",
    },
    baseSha: {
      type: "string",
      pattern: "^[0-9a-f]{40}$",
      description: "The resolved base commit the work started from, as a full sha",
    },
    branch: {
      type: "string",
      minLength: 1,
      maxLength: 255,
      description: "The work branch, task/<task id>",
    },
    commit: {
      type: "string",
      pattern: "^[0-9a-f]{40}$",
      description: "The tested commit at the head of the work branch, as a full sha; it must be pushed",
    },
    pr: {
      type: "object",
      description: "The pull request opened from the work branch",
      properties: {
        number: { type: "integer", minimum: 1, description: "The pull request number" },
        url: { type: "string", format: "uri", description: "The pull request's web URL" },
        draft: { type: "boolean", description: "Whether the pull request is a draft" },
      },
      required: ["number", "url", "draft"],
      additionalProperties: false,
    },
    checks: {
      type: "array",
      maxItems: 10,
      description: "The checks the repository defines, as run and reported by the agent",
      items: {
        type: "object",
        properties: {
          command: { type: "string", minLength: 1, maxLength: 200, description: "The command that was run" },
          passed: { type: "boolean", description: "Whether it passed" },
          summary: { type: "string", maxLength: 200, description: "One line on the outcome" },
        },
        required: ["command", "passed", "summary"],
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
} as const;

export type Report = FromSchema<typeof REPORT_JSON_SCHEMA>;
