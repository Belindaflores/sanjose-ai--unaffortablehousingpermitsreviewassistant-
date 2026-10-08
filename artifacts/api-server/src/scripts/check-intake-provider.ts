import { strict as assert } from "node:assert";
import { CreatePermitApplicationResponse, screenApplication } from "@workspace/api-zod";
import { analyzeIntake } from "../lib/intake-analysis";
import { logger } from "../lib/logger";

const application = CreatePermitApplicationResponse.parse(screenApplication({
  id: "provider-smoke-only", applicantName: "Synthetic Applicant", companyName: "Synthetic Developer",
  email: "test@example.com", projectName: "Synthetic AI check", projectAddress: "123 Main St, San Jose, CA",
  projectType: "Multifamily housing", permitType: "Building permit", housingUnits: 120, estimatedCost: 100,
  description: "New construction of 120 residential units, including 120 affordable units. APN 123-45-678. Applicant requests SB 35. There are 3 buildings, 6 stories, 150000 square feet, and 80 parking spaces.",
  affordableHousing: true, underservedCommunity: false, documents: [], notes: [], timeline: [],
  submittedAt: new Date().toISOString(), assignedDepartment: "Building", reviewStatus: "New",
}));
const analysis = await analyzeIntake(application);
assert.equal(analysis.status, "completed", analysis.error ?? "AI provider did not complete");
assert.equal(analysis.fields.find(field => field.key === "apn")?.value, "123-45-678");
assert.equal(analysis.fields.find(field => field.key === "affordableUnits")?.value, "120");
assert.equal(analysis.fields.find(field => field.key === "affordablePercentage")?.value, "100%");
assert.match(analysis.fields.find(field => field.key === "housingProcess")?.value ?? "", /Potential SB\s*35/);
logger.info({ findings: analysis.fields.length, status: analysis.status }, "Managed AI provider smoke check passed; no database records created");
