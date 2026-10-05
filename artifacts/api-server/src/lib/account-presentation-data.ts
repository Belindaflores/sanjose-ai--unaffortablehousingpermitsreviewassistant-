import type { AccountDocument, AccountTimelineEvent } from "@workspace/db";

export const presentationDate = "2026-10-04T12:00:00.000Z";
// Metadata only: no object-storage paths, signatures, private plans, or file bytes.
export const opalDocuments: AccountDocument[] = [
  { name: "Architectural plans", fileName: "Opal_Drive_ADU_Architectural_Plans.pdf", category: "Architectural", required: true, fileSize: 2457600 },
  { name: "Structural plans", fileName: "Opal_Drive_ADU_Structural_Plans.pdf", category: "Structural", required: true, fileSize: 1843200 },
  { name: "Site plan and survey", fileName: "Opal_Drive_ADU_Site_Plan_and_Survey.pdf", category: "Site", required: true, fileSize: 921600 },
  { name: "Title 24 energy forms", fileName: "Opal_Drive_ADU_Title_24_Energy_Forms.pdf", category: "Energy", required: true, fileSize: 614400 },
  { name: "Owner authorization", fileName: "Opal_Drive_ADU_Owner_Authorization.pdf", category: "Ownership", required: true, fileSize: 204800 },
  { name: "Fire and life safety plan", fileName: "Opal_Drive_ADU_Fire_and_Life_Safety_Plan.pdf", category: "Safety", required: false, fileSize: 819200 },
  { name: "Planning / zoning forms", fileName: "Opal_Drive_ADU_Planning_and_Zoning_Forms.pdf", category: "Planning", required: false, fileSize: 409600 },
].map(document => ({
  ...document, uploadStatus: "Received", uploadDate: presentationDate,
  fileType: "application/pdf", synthetic: true,
}));

export const opalTimeline: AccountTimelineEvent[] = [
  { label: "Application started", date: presentationDate, status: "complete" },
  { label: "Application information completed", date: presentationDate, status: "complete" },
  { label: "Required documents received", date: presentationDate, status: "complete" },
  { label: "Application submitted", date: presentationDate, status: "complete" },
  { label: "Under initial review", date: null, status: "upcoming" },
];