/** Mirror openext-crm-suite SettingService.resolveWonStage */
export function resolveWonStage(stages: readonly string[] | null | undefined): string {
  const list = (Array.isArray(stages) ? stages : [])
    .map((stage) => String(stage || '').trim())
    .filter(Boolean);
  if (!list.length) return 'Won';

  const exact = list.find((stage) => stage.toLowerCase() === 'won');
  if (exact) return exact;

  const lostIndex = list.findIndex((stage) => stage.toLowerCase() === 'lost');
  if (lostIndex > 0) return list[lostIndex - 1];

  return list[list.length - 1];
}

/** Lead convert is allowed only when pipeline stage is the configured Won stage. */
export function isLeadConvertibleStage(
  stage: string | null | undefined,
  stages: readonly string[] | null | undefined
): boolean {
  const current = String(stage || '').trim();
  if (!current) return false;
  return current === resolveWonStage(stages);
}
