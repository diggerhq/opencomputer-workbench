// The result as the client and the server both read it. The schema itself
// lives with the report tool (the agent directory may import nothing from
// outside itself); this module derives the app's parser from that one
// object, so a result read from OpenComputer is validated against exactly
// what the tool promised the model.
import { z } from "zod";
import {
  REPORT_JSON_SCHEMA,
  type Report,
  type ReportStage,
  reportStage,
} from "../../opencomputer/agents/worker/tools/report";

export type { Report, ReportStage };
export { REPORT_JSON_SCHEMA, reportStage };

export const reportSchema = z.fromJSONSchema(
  REPORT_JSON_SCHEMA as unknown as Parameters<typeof z.fromJSONSchema>[0],
) as z.ZodType<Report>;

/**
 * A committed result with its provenance, the one shape both producers
 * return: the server's projection of a session row and the browser's
 * reading of the event log. Flat, so a task row carries it as is.
 */
export type TaskResult = Report & {
  /** The turn that committed it. */
  readonly turnId: string;
  /** That turn's number, one-based in log order; known once the log has replayed. */
  readonly turnNumber?: number;
  /** When it was committed, as the row records it. */
  readonly reportedAt?: string;
  readonly stage: ReportStage;
  /** Whether the reporting turn is the last settled one. */
  readonly fromLastTurn: boolean;
};
