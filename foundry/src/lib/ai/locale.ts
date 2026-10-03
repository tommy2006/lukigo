// Server-side: turn a project location into instructions every AI prompt gets.
export interface Ctx { project?: string | null; location?: string | null; cause?: string | null }

export function localeInstructions(ctx?: Ctx | null) {
  const loc = ctx?.location?.trim();
  if (!loc) return "";
  return `\n\nLOCAL CONTEXT: The project is based in ${loc.slice(0, 120)}. Tailor everything to that place: name real local organizations, ` +
    `sponsors, grant programs, suppliers and merch makers that operate there; the social platforms people there actually use; ` +
    `local laws, permits, school and child-safety rules; typical prices in the local currency; local holidays, seasons and culture. ` +
    `Do not assume the United States unless the location is in the US. If you are unsure whether something exists locally, say so.`;
}
