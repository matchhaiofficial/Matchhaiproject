export type ZoneBranchOption = {
  id: string;
  label: string;
};

export function getZoneBranchId(branch: any, index: number) {
  return String(branch?.id || branch?.branchId || `branch_${index + 1}`).trim();
}

export function getZoneBranchDisplayName(branch: any, fallback = "Branch") {
  return String(
    branch?.branchDisplayName ||
    branch?.name ||
    branch?.areaLabel ||
    fallback,
  ).trim();
}

export function getZoneBranchOption(branch: any, index: number): ZoneBranchOption | null {
  if (!branch) return null;
  const id = getZoneBranchId(branch, index);
  const label = getZoneBranchDisplayName(branch, `Branch ${index + 1}`);
  if (!id || !label) return null;
  return { id, label };
}
