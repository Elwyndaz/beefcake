import type { BodyWeight, Exercise, ExerciseHistory, Session, Template } from '../models'

export interface SnapshotData {
  templates: Template[]
  exercises: Exercise[]
  sessions: Session[]
  exerciseHistory: ExerciseHistory[]
  /** Valfri i indata (äldre snapshots saknar den), alltid en lista efter validateSnapshot */
  bodyWeight: BodyWeight[]
}

export function selectAuthoritativeSnapshot(
  local: SnapshotData,
  server: SnapshotData | null
): SnapshotData {
  return server ?? local
}
