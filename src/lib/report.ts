// The app's parser for the report, built from the schema the report tool
// declares (opencomputer/agents/worker/tools/report.ts). One definition:
// the agent directory holds the JSON Schema because it may import nothing
// from outside itself; the server and the browser parse with zod from that
// same object, so a result read from OpenComputer is validated against
// exactly what the tool promised the model.
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
