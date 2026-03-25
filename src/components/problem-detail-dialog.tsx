"use client";

import { ProblemCard, type ProblemWithAnswers, type AnswerWithReviews } from "@/components/problem-card";
import type { Problem } from "@/lib/types";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

interface ProblemDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  problem: ProblemWithAnswers | null;
  now: Date;
  onEditProblem: (problem: Problem) => void;
  onEditAnswer: (answer: AnswerWithReviews, problem: ProblemWithAnswers) => void;
  onCheck: (problem: ProblemWithAnswers) => void;
  onDelete?: (id: string) => void;
  onPdfLinked?: (problemId: string) => void;
}

export function ProblemDetailDialog({
  open,
  onOpenChange,
  problem,
  now,
  onEditProblem,
  onEditAnswer,
  onCheck,
  onDelete,
  onPdfLinked,
}: ProblemDetailDialogProps) {
  if (!problem) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="sr-only">
          <DialogTitle>{problem.code} {problem.name}</DialogTitle>
          <DialogDescription>Problem detail</DialogDescription>
        </DialogHeader>
        <ProblemCard
          problem={problem}
          now={now}
          onEditProblem={onEditProblem}
          onEditAnswer={onEditAnswer}
          onCheck={onCheck}
          onDelete={onDelete}
          onPdfLinked={onPdfLinked}
          bare
        />
      </DialogContent>
    </Dialog>
  );
}
