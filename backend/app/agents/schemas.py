"""Validated agent I/O contracts (Pydantic). Every agent output is wrapped in AgentEnvelope before it is
persisted. Fields are kept JSON-schema-simple so they work with Claude structured outputs."""
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field

AgentRole = Literal["jordan", "clara", "alex", "quinn", "riley", "sam", "sage", "max", "nova", "resource_finder"]


class AgentEnvelope(BaseModel):
    task_id: str
    workflow_id: str | None
    course_id: str
    agent_role: AgentRole
    status: Literal["done", "partial", "failed", "needs_review"]
    payload: dict
    source_citations: list[str] = []
    confidence: float | None = None
    findings: list[dict] = []
    retry_count: int = 0
    demo: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ---------------------------------------------------------------- Clara
class KeyTerm(BaseModel):
    term: str
    definition: str


class Formula(BaseModel):
    name: str
    expression: str
    meaning: str


class SectionOut(BaseModel):
    title: str
    content: str = Field(description="Faithful 2-6 sentence explanation of the section, from the source only")
    objectives: list[str]
    key_terms: list[KeyTerm]
    formulas: list[Formula]
    hard_points: list[str]
    concept_keys: list[str]
    citations: list[str] = Field(description="Passage refs, e.g. S3")


class ChapterOut(BaseModel):
    title: str
    summary: str
    sections: list[SectionOut]
    citations: list[str]


class ConceptOut(BaseModel):
    key: str = Field(description="lowercase slug, unique")
    name: str
    description: str
    section_title: str
    prerequisites: list[str] = Field(description="keys of concepts that must be understood first")
    citations: list[str]


class CourseStructure(BaseModel):
    chapters: list[ChapterOut]
    concepts: list[ConceptOut]
    missing_or_ambiguous: list[str]
    confidence: float


# ---------------------------------------------------------------- Quinn / Alex / Max
class QuestionOut(BaseModel):
    concept_key: str
    prompt: str
    choices: list[str] = Field(description="exactly 4 options")
    correct_index: int
    explanation: str
    distractor_notes: list[str] = Field(description="for each choice, the misconception it reveals ('' for the correct one)")
    citations: list[str]
    points: int = 1


class ChapterQuiz(BaseModel):
    chapter_title: str
    questions: list[QuestionOut]


class QuizSet(BaseModel):
    quizzes: list[ChapterQuiz]


class OpenProblem(BaseModel):
    """A full TD-style exercise answered in free text (not multiple choice)."""
    concept_key: str
    statement: str = Field(description="complete exercise statement, may contain several numbered sub-questions; LaTeX in $...$")
    difficulty: Literal["easy", "medium", "hard"]
    hints: list[str] = Field(description="2-3 progressive hints, from a gentle nudge to an almost-complete step")
    worked_solution: str = Field(description="complete step-by-step solution a teacher would accept")
    rubric: list[str] = Field(description="3-5 key points a correct answer must contain")
    citations: list[str]


class SectionExercises(BaseModel):
    section_title: str
    questions: list[QuestionOut]
    problems: list[OpenProblem] = Field(description="open-ended exercises; [] if the section has nothing to practise")


class ExerciseSet(BaseModel):
    exercises: list[SectionExercises]


class MockExam(BaseModel):
    title: str
    duration_minutes: int
    questions: list[QuestionOut]


class ProjectIdea(BaseModel):
    title: str
    goal: str
    concept_keys: list[str]
    steps: list[str]
    difficulty: Literal["beginner", "intermediate", "advanced"]
    effort_hours: int
    materials: list[str]
    success_criteria: list[str]


class ProjectSet(BaseModel):
    projects: list[ProjectIdea]


# ---------------------------------------------------------------- Sage
class ChapterSummary(BaseModel):
    chapter_title: str
    bullets: list[str]
    citations: list[str]


class Flashcard(BaseModel):
    front: str
    back: str
    kind: Literal["term", "formula", "concept"]
    citations: list[str]


class RevisionPack(BaseModel):
    summaries: list[ChapterSummary]
    flashcards: list[Flashcard]


# ---------------------------------------------------------------- Riley
class Finding(BaseModel):
    severity: Literal["low", "medium", "high"]
    item: str
    issue: str


class QualityReport(BaseModel):
    verdict: Literal["pass", "revise", "uncertain"]
    findings: list[Finding]


# ---------------------------------------------------------------- Sam / Nova
TutorMode = Literal["socratic", "hint", "answer", "alternate", "explain_mistake", "mini_lesson", "ask"]


class TutorReply(BaseModel):
    message: str
    citations: list[str] = Field(description="refs of passages that support the message")
    supported_by_course: bool
    method: str = Field(description="teaching method used, e.g. analogy, worked example, step-by-step")
    follow_up_question: str


class OpenGrade(BaseModel):
    score: int = Field(description="0-100")
    met: list[str] = Field(description="rubric points the answer satisfies")
    missing: list[str] = Field(description="rubric points missing or wrong")
    feedback: str = Field(description="2-4 sentences: what is right, what to fix, next step; no full solution")
    misconception: str = Field(description="the misconception behind the main error, or ''")


class RouteDecision(BaseModel):
    targets: list[Literal["clara", "sam", "alex", "quinn", "sage", "max", "resource_finder", "jordan", "riley"]]
    rationale: str
