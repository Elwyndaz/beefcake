import type { Exercise, ExerciseHistory, Session, Template } from '../models'

export interface SnapshotData {
  templates: Template[]
  exercises: Exercise[]
  sessions: Session[]
  exerciseHistory: ExerciseHistory[]
}

export function selectAuthoritativeSnapshot(
  local: SnapshotData,
  server: SnapshotData | null
): SnapshotData {
  return server ?? local
}
