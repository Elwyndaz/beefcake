/**
 * Nästa pass i rotationen, härlett ur historiken: appen har inget rotationsbegrepp,
 * den tar de tre senast körda programmen och sätter det som väntat längst först.
 * Enda stället för regeln: Hem-kortet "Nästa pass" och loggvyns förval läser båda härifrån.
 */
export interface NextProgram {
  name: string
  /** Senaste datum programmet kördes, YYYY-MM-DD */
  date: string
}

const ROTATION_SIZE = 3

export function nextPrograms(sessions: readonly { templateName: string; date: string }[]): NextProgram[] {
  const newestFirst = [...sessions].sort((a, b) => b.date.localeCompare(a.date))
  const lastRun = new Map<string, string>()
  for (const s of newestFirst) {
    if (!lastRun.has(s.templateName)) lastRun.set(s.templateName, s.date)
    if (lastRun.size >= ROTATION_SIZE) break
  }
  return [...lastRun].map(([name, date]) => ({ name, date })).sort((a, b) => a.date.localeCompare(b.date))
}
