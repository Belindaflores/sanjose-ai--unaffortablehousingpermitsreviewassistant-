/** Server-owned timeline so an applicant cannot submit an "approved" history. */
export function buildPermitTimeline(status: string, submittedAt: Date, fireRequired: boolean) {
  const stages = ["Application submitted", "County intake", "Planning review", "Building review", ...(fireRequired ? ["Fire review"] : []), "Final County decision"];
  const current = status === "Approved" || status === "Denied" ? stages.length - 1
    : status === "Fire Review" ? stages.indexOf("Fire review")
    : status === "Building Review" ? stages.indexOf("Building review")
    : status === "Planning Review" ? stages.indexOf("Planning review")
    : status === "New" ? 0 : 1;
  return stages.map((label, index) => ({
    label, status: (index < current ? "completed" : index === current ? "current" : "upcoming") as "completed" | "current" | "upcoming",
    date: index === 0 ? submittedAt.toISOString() : index === current ? new Date().toISOString() : "",
    detail: index === current ? status : index < current ? "Recorded stage" : "Pending authorized staff review",
  }));
}