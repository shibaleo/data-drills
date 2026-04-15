/** Shared API response types for /problems-detail endpoint */

export interface DDProblem {
  id: string
  code: string
  name: string | null
  subjectId: string | null
  levelId: string | null
  checkpoint: string | null
  standardTime: number | null
  projectId: string
  createdAt: string
  updatedAt: string
}

export interface DDAnswer {
  id: string
  problemId: string
  date: string
  duration: number | null
  answerStatusId: string | null
  createdAt: string
}

export interface DDReview {
  id: string
  answerId: string
  content: string | null
  createdAt: string
}

export interface DDReviewTag {
  reviewId: string
  tagId: string
}

export interface DDTag {
  id: string
  name: string
}

export interface DDProblemFile {
  id: string
  problemId: string
  gdriveFileId: string
  fileName: string | null
  createdAt: string
}

export interface ProblemsDetailResponse {
  problems: DDProblem[]
  answers: DDAnswer[]
  reviews: DDReview[]
  reviewTags: DDReviewTag[]
  tags: DDTag[]
  problemFiles: DDProblemFile[]
}
