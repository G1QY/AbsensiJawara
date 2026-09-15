export type BranchLocation = { name?: string; city_name?: string };
export function branchLabel(branch?: BranchLocation | null): string {
  if (!branch) return '';
  const city = branch.city_name?.trim();
  return city && city.toLowerCase() !== branch.name?.trim().toLowerCase() ? [city,branch.name].filter(Boolean).join(' / ') : branch.name || city || '';
}
export function locationLabel(name?: string, branch?: BranchLocation | null): string {
  return [name,branchLabel(branch)].filter(Boolean).join(' · ');
}
