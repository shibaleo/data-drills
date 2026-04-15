"use client"

import { useMemo } from "react"
import { useProject } from "./use-project"

/** Shared lookup maps built from useProject data. */
export function useLookupMaps() {
  const { statuses, subjects } = useProject()

  /** answerStatusId → status name (e.g. "Yet", "Done") */
  const statusMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of statuses) m.set(s.id, s.name)
    return m
  }, [statuses])

  /** answerStatusId → point value */
  const statusPointMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of statuses) m.set(s.id, s.point ?? 0)
    return m
  }, [statuses])

  /** subjectId → color hex or null */
  const subjectColorMap = useMemo(() => {
    const m = new Map<string, string | null>()
    for (const s of subjects) m.set(s.id, s.color ?? null)
    return m
  }, [subjects])

  return { statusMap, statusPointMap, subjectColorMap }
}
