"""LessonForge relational schema (PostgreSQL 16 + pgvector).

Tables marked [deferred API] exist so later phases do not need a breaking migration.
Anonymity note: `confusion_signals` deliberately has NO foreign key to users.
"""
import uuid
from datetime import date, datetime, timezone

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .config import get_settings
from .db import Base

EMB_DIM = get_settings().embedding_dim


def now() -> datetime:
    return datetime.now(timezone.utc)


def uid() -> uuid.UUID:
    return uuid.uuid4()


def pk():
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)


def fk(target: str, nullable: bool = False, ondelete: str = "CASCADE"):
    return mapped_column(UUID(as_uuid=True), ForeignKey(target, ondelete=ondelete), nullable=nullable, index=True)


def ts():
    return mapped_column(DateTime(timezone=True), default=now, nullable=False)


# ---------------------------------------------------------------- identity
class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = pk()
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = ts()
    profile: Mapped["Profile"] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")


class Profile(Base):
    __tablename__ = "profiles"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role: Mapped[str] = mapped_column(String(20), default="student", nullable=False)
    username: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(80), nullable=False)
    searchable: Mapped[bool] = mapped_column(Boolean, default=False)
    message_setting: Mapped[str] = mapped_column(String(20), default="followers")  # everyone|followers|nobody
    locale: Mapped[str] = mapped_column(String(10), default="fr")  # fr|en|ar|derja
    derja_script: Mapped[str] = mapped_column(String(10), default="arabic")  # arabic|latin
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    user: Mapped[User] = relationship(back_populates="profile")
    __table_args__ = (CheckConstraint("role in ('student','senior','teacher','admin')", name="ck_profile_role"),)


class StudentPreferences(Base):
    __tablename__ = "student_preferences"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    faculty: Mapped[str | None] = mapped_column(String(120))
    interests: Mapped[list] = mapped_column(JSONB, default=list)
    current_subjects: Mapped[list] = mapped_column(JSONB, default=list)
    recommendation_settings: Mapped[dict] = mapped_column(JSONB, default=dict)


# ---------------------------------------------------------------- catalogue & sources
class Faculty(Base):
    __tablename__ = "faculties"
    id: Mapped[uuid.UUID] = pk()
    name: Mapped[str] = mapped_column(String(160), unique=True)


class Subject(Base):
    __tablename__ = "subjects"
    id: Mapped[uuid.UUID] = pk()
    faculty_id: Mapped[uuid.UUID] = fk("faculties.id")
    name: Mapped[str] = mapped_column(String(160))
    __table_args__ = (UniqueConstraint("faculty_id", "name"),)


class Course(Base):
    __tablename__ = "courses"
    id: Mapped[uuid.UUID] = pk()
    owner_id: Mapped[uuid.UUID] = fk("users.id")
    subject_id: Mapped[uuid.UUID | None] = fk("subjects.id", nullable=True, ondelete="SET NULL")
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    language: Mapped[str] = mapped_column(String(10), default="fr")
    visibility: Mapped[str] = mapped_column(String(12), default="private")  # private|published
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft|processing|ready|failed
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    outline_digest: Mapped[str | None] = mapped_column(Text)  # stable text block used as a cached prompt prefix
    completion_criteria: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = ts()
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (CheckConstraint("visibility in ('private','published')", name="ck_course_visibility"),)


class CourseMember(Base):
    """Students enrolled in / teachers teaching a course (in addition to the owner)."""
    __tablename__ = "course_members"
    course_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    member_role: Mapped[str] = mapped_column(String(12), default="student")  # student|teacher


class Resource(Base):
    __tablename__ = "resources"
    id: Mapped[uuid.UUID] = pk()
    course_id: Mapped[uuid.UUID] = fk("courses.id")
    owner_id: Mapped[uuid.UUID] = fk("users.id")
    kind: Mapped[str] = mapped_column(String(12))  # pdf|text|pptx|image
    filename: Mapped[str] = mapped_column(String(255))
    mime: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    storage_path: Mapped[str | None] = mapped_column(String(400))
    rights_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    page_count: Mapped[int | None] = mapped_column(Integer)
    extraction_status: Mapped[str] = mapped_column(String(20), default="pending")  # pending|ok|partial|failed
    extraction_notes: Mapped[list] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = ts()


class SourceChunk(Base):
    """Retrieval unit. `tsv` (generated FTS column) and HNSW index are added in sql/post_schema.sql."""
    __tablename__ = "source_chunks"
    id: Mapped[uuid.UUID] = pk()
    course_id: Mapped[uuid.UUID] = fk("courses.id")
    resource_id: Mapped[uuid.UUID] = fk("resources.id")
    ordinal: Mapped[int] = mapped_column(Integer)
    ref: Mapped[str] = mapped_column(String(16))  # short human citation id, e.g. "S12"
    page: Mapped[int | None] = mapped_column(Integer)  # page or slide number (1-based)
    section_hint: Mapped[str | None] = mapped_column(String(300))
    text: Mapped[str] = mapped_column(Text)
    embedding = mapped_column(Vector(EMB_DIM))
    __table_args__ = (UniqueConstraint("course_id", "ref"),)


class Chapter(Base):
    __tablename__ = "chapters"
    id: Mapped[uuid.UUID] = pk()
    course_id: Mapped[uuid.UUID] = fk("courses.id")
    ordinal: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(300))
    summary: Mapped[str | None] = mapped_column(Text)
    citations: Mapped[list] = mapped_column(JSONB, default=list)


class Section(Base):
    __tablename__ = "sections"
    id: Mapped[uuid.UUID] = pk()
    chapter_id: Mapped[uuid.UUID] = fk("chapters.id")
    course_id: Mapped[uuid.UUID] = fk("courses.id")
    ordinal: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(300))
    content: Mapped[str] = mapped_column(Text, default="")
    objectives: Mapped[list] = mapped_column(JSONB, default=list)
    key_terms: Mapped[list] = mapped_column(JSONB, default=list)
    formulas: Mapped[list] = mapped_column(JSONB, default=list)
    hard_points: Mapped[list] = mapped_column(JSONB, default=list)
    citations: Mapped[list] = mapped_column(JSONB, default=list)


class Concept(Base):
    __tablename__ = "concepts"
    id: Mapped[uuid.UUID] = pk()
    course_id: Mapped[uuid.UUID] = fk("courses.id")
    section_id: Mapped[uuid.UUID | None] = fk("sections.id", nullable=True, ondelete="SET NULL")
    key: Mapped[str] = mapped_column(String(80))  # stable slug used by agents
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    citations: Mapped[list] = mapped_column(JSONB, default=list)
    __table_args__ = (UniqueConstraint("course_id", "key"),)


class ConceptPrerequisite(Base):
    __tablename__ = "concept_prerequisites"
    concept_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("concepts.id", ondelete="CASCADE"), primary_key=True)
    prerequisite_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("concepts.id", ondelete="CASCADE"), primary_key=True)
    __table_args__ = (CheckConstraint("concept_id <> prerequisite_id", name="ck_prereq_no_self"),)


# ---------------------------------------------------------------- workflow & agents
class WorkflowRun(Base):
    __tablename__ = "workflow_runs"
    id: Mapped[uuid.UUID] = pk()
    course_id: Mapped[uuid.UUID] = fk("courses.id")
    user_id: Mapped[uuid.UUID] = fk("users.id")
    language: Mapped[str] = mapped_column(String(10))
    status: Mapped[str] = mapped_column(String(20), default="queued")  # queued|running|done|failed|partial
    demo_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = ts()
    updated_at: Mapped[datetime] = ts()


class AgentTask(Base):
    __tablename__ = "agent_tasks"
    id: Mapped[uuid.UUID] = pk()
    workflow_id: Mapped[uuid.UUID] = fk("workflow_runs.id")
    course_id: Mapped[uuid.UUID] = fk("courses.id")
    agent_role: Mapped[str] = mapped_column(String(20))
    kind: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending|running|done|failed|needs_review
    depends_on: Mapped[list] = mapped_column(JSONB, default=list)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text)
    output: Mapped[dict | None] = mapped_column(JSONB)  # validated AgentEnvelope
    created_at: Mapped[datetime] = ts()
    updated_at: Mapped[datetime] = ts()


class WorkflowEvent(Base):
    __tablename__ = "workflow_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    workflow_id: Mapped[uuid.UUID] = fk("workflow_runs.id")
    task_id: Mapped[uuid.UUID | None] = fk("agent_tasks.id", nullable=True)
    agent_role: Mapped[str] = mapped_column(String(20))
    type: Mapped[str] = mapped_column(String(30))
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = ts()


class AgentArtifact(Base):
    __tablename__ = "agent_artifacts"
    id: Mapped[uuid.UUID] = pk()
    course_id: Mapped[uuid.UUID] = fk("courses.id")
    task_id: Mapped[uuid.UUID | None] = fk("agent_tasks.id", nullable=True, ondelete="SET NULL")
    chapter_id: Mapped[uuid.UUID | None] = fk("chapters.id", nullable=True)
    kind: Mapped[str] = mapped_column(String(30))  # summary|flashcards|topic_map|mock_exam|revision_sheet
    language: Mapped[str] = mapped_column(String(10))
    payload: Mapped[dict] = mapped_column(JSONB)
    quality_status: Mapped[str] = mapped_column(String(20), default="unverified")  # pass|revise|uncertain|unverified
    findings: Mapped[list] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = ts()


class LLMCall(Base):
    """Observability for prompt caching: every model call logs cache read/write tokens."""
    __tablename__ = "llm_calls"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    agent_role: Mapped[str] = mapped_column(String(20))
    provider: Mapped[str] = mapped_column(String(20))
    model: Mapped[str] = mapped_column(String(60))
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cache_read_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cache_write_tokens: Mapped[int] = mapped_column(Integer, default=0)
    app_cache_hit: Mapped[bool] = mapped_column(Boolean, default=False)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = ts()


class LLMResponseCache(Base):
    """Application-level cache of validated structured outputs keyed by a hash of the full prompt."""
    __tablename__ = "llm_response_cache"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    agent_role: Mapped[str] = mapped_column(String(20))
    payload: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime] = ts()


# ---------------------------------------------------------------- learning
class Assessment(Base):
    __tablename__ = "assessments"
    id: Mapped[uuid.UUID] = pk()
    course_id: Mapped[uuid.UUID] = fk("courses.id")
    chapter_id: Mapped[uuid.UUID | None] = fk("chapters.id", nullable=True)
    section_id: Mapped[uuid.UUID | None] = fk("sections.id", nullable=True)
    kind: Mapped[str] = mapped_column(String(20))  # exercise|chapter_quiz|mock_exam
    title: Mapped[str] = mapped_column(String(300))
    agent_role: Mapped[str] = mapped_column(String(20))
    quality_status: Mapped[str] = mapped_column(String(20), default="unverified")
    findings: Mapped[list] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = ts()


class Question(Base):
    __tablename__ = "questions"
    id: Mapped[uuid.UUID] = pk()
    assessment_id: Mapped[uuid.UUID] = fk("assessments.id")
    concept_id: Mapped[uuid.UUID | None] = fk("concepts.id", nullable=True, ondelete="SET NULL")
    ordinal: Mapped[int] = mapped_column(Integer)
    qtype: Mapped[str] = mapped_column(String(12), default="mcq")  # mcq|short
    prompt: Mapped[str] = mapped_column(Text)
    choices: Mapped[list] = mapped_column(JSONB, default=list)
    correct_index: Mapped[int | None] = mapped_column(Integer)
    answer_text: Mapped[str | None] = mapped_column(Text)
    explanation: Mapped[str] = mapped_column(Text, default="")
    distractor_notes: Mapped[list] = mapped_column(JSONB, default=list)  # misconception per wrong choice
    points: Mapped[int] = mapped_column(Integer, default=1)
    citations: Mapped[list] = mapped_column(JSONB, default=list)


class Attempt(Base):
    __tablename__ = "attempts"
    id: Mapped[uuid.UUID] = pk()
    user_id: Mapped[uuid.UUID] = fk("users.id")
    assessment_id: Mapped[uuid.UUID] = fk("assessments.id")
    answers: Mapped[dict] = mapped_column(JSONB)
    per_question: Mapped[list] = mapped_column(JSONB)
    score: Mapped[float] = mapped_column(Float)
    max_score: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = ts()


class ProgressEvent(Base):
    __tablename__ = "progress_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = fk("users.id")
    course_id: Mapped[uuid.UUID] = fk("courses.id")
    kind: Mapped[str] = mapped_column(String(30))  # section_complete|attempt|hint|tutor|project
    ref_id: Mapped[str | None] = mapped_column(String(64))
    data: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = ts()


class ConceptProgress(Base):
    __tablename__ = "concept_progress"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    concept_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("concepts.id", ondelete="CASCADE"), primary_key=True)
    correct: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = ts()


class ProjectSuggestion(Base):
    __tablename__ = "project_suggestions"
    id: Mapped[uuid.UUID] = pk()
    course_id: Mapped[uuid.UUID] = fk("courses.id")
    chapter_id: Mapped[uuid.UUID | None] = fk("chapters.id", nullable=True)
    payload: Mapped[dict] = mapped_column(JSONB)
    quality_status: Mapped[str] = mapped_column(String(20), default="unverified")


class StudentProjectStatus(Base):
    __tablename__ = "student_project_status"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("project_suggestions.id", ondelete="CASCADE"), primary_key=True)
    status: Mapped[str] = mapped_column(String(12))  # saved|started|completed|dismissed
    progress: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = ts()


class TutorConversation(Base):
    __tablename__ = "tutor_conversations"
    id: Mapped[uuid.UUID] = pk()
    user_id: Mapped[uuid.UUID] = fk("users.id")
    course_id: Mapped[uuid.UUID] = fk("courses.id")
    created_at: Mapped[datetime] = ts()


class TutorMessage(Base):
    __tablename__ = "tutor_messages"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    conversation_id: Mapped[uuid.UUID] = fk("tutor_conversations.id")
    role: Mapped[str] = mapped_column(String(10))  # user|assistant
    agent_role: Mapped[str | None] = mapped_column(String(20))
    mode: Mapped[str | None] = mapped_column(String(20))
    content: Mapped[str] = mapped_column(Text)
    citations: Mapped[list] = mapped_column(JSONB, default=list)
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = ts()


# ---------------------------------------------------------------- class insights (anonymous)
class ConfusionSignal(Base):
    """No user FK by design. `dedupe_token` = HMAC(server key, user|section) enforces one signal per
    student per section; `cohort_token` = HMAC(server key, user|course) lets the server count distinct
    students at chapter/course level. Neither token is ever returned by any API. Only the day is kept."""
    __tablename__ = "confusion_signals"
    id: Mapped[uuid.UUID] = pk()
    course_id: Mapped[uuid.UUID] = fk("courses.id")
    chapter_id: Mapped[uuid.UUID] = fk("chapters.id")
    section_id: Mapped[uuid.UUID] = fk("sections.id")
    reasons: Mapped[list] = mapped_column(JSONB, default=list)
    dedupe_token: Mapped[str] = mapped_column(String(64))
    cohort_token: Mapped[str] = mapped_column(String(64), index=True)
    day: Mapped[date] = mapped_column(Date)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    __table_args__ = (UniqueConstraint("section_id", "dedupe_token", name="uq_signal_once"),)


class InsightSubscription(Base):
    """Students who asked to be notified about teacher responses on a section. Stored separately from
    signals so the teacher-visible data cannot be joined to identities."""
    __tablename__ = "insight_subscriptions"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    section_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sections.id", ondelete="CASCADE"), primary_key=True)


class TeacherResponse(Base):
    __tablename__ = "teacher_responses"
    id: Mapped[uuid.UUID] = pk()
    course_id: Mapped[uuid.UUID] = fk("courses.id")
    section_id: Mapped[uuid.UUID | None] = fk("sections.id", nullable=True)
    teacher_id: Mapped[uuid.UUID] = fk("users.id")
    kind: Mapped[str] = mapped_column(String(20))  # clarification|extra_exercise|next_session|pinned_answer
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = ts()


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[uuid.UUID] = pk()
    user_id: Mapped[uuid.UUID] = fk("users.id")
    kind: Mapped[str] = mapped_column(String(30))
    title: Mapped[str] = mapped_column(String(300))
    body: Mapped[str] = mapped_column(Text, default="")
    link: Mapped[str | None] = mapped_column(String(300))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = ts()


# ---------------------------------------------------------------- community
class Thread(Base):
    __tablename__ = "threads"
    id: Mapped[uuid.UUID] = pk()
    course_id: Mapped[uuid.UUID] = fk("courses.id")
    chapter_id: Mapped[uuid.UUID] = fk("chapters.id")
    author_id: Mapped[uuid.UUID] = fk("users.id")
    title: Mapped[str] = mapped_column(String(300))
    body: Mapped[str] = mapped_column(Text)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = ts()


class Post(Base):
    __tablename__ = "posts"
    id: Mapped[uuid.UUID] = pk()
    thread_id: Mapped[uuid.UUID] = fk("threads.id")
    author_id: Mapped[uuid.UUID] = fk("users.id")
    body: Mapped[str] = mapped_column(Text)
    accepted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = ts()


class Vote(Base):
    __tablename__ = "votes"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    post_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True)
    value: Mapped[int] = mapped_column(Integer)
    __table_args__ = (CheckConstraint("value in (-1, 1)", name="ck_vote_value"),)


class HardChapterVote(Base):
    __tablename__ = "hard_chapter_votes"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    chapter_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("chapters.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = ts()


class SharedResource(Base):  # [deferred API]
    __tablename__ = "shared_resources"
    id: Mapped[uuid.UUID] = pk()
    chapter_id: Mapped[uuid.UUID] = fk("chapters.id")
    author_id: Mapped[uuid.UUID] = fk("users.id")
    kind: Mapped[str] = mapped_column(String(20))  # note|summary|solved_exercise|video_url
    title: Mapped[str] = mapped_column(String(300))
    body: Mapped[str | None] = mapped_column(Text)
    url: Mapped[str | None] = mapped_column(String(1000))
    rights_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = ts()


class ResourceRating(Base):  # [deferred API]
    __tablename__ = "resource_ratings"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    resource_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shared_resources.id", ondelete="CASCADE"), primary_key=True)
    helpful: Mapped[bool] = mapped_column(Boolean)


class GlossaryTerm(Base):
    __tablename__ = "glossary_terms"
    id: Mapped[uuid.UUID] = pk()
    course_id: Mapped[uuid.UUID | None] = fk("courses.id", nullable=True)
    term_fr: Mapped[str] = mapped_column(String(200))
    term_ar: Mapped[str | None] = mapped_column(String(200))
    term_derja: Mapped[str | None] = mapped_column(String(200))
    term_en: Mapped[str | None] = mapped_column(String(200))
    explanation: Mapped[str] = mapped_column(Text, default="")
    example: Mapped[str | None] = mapped_column(Text)
    contributor_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    review_state: Mapped[str] = mapped_column(String(12), default="pending")  # pending|reviewed


class ExamPaper(Base):  # [deferred API]
    __tablename__ = "exam_papers"
    id: Mapped[uuid.UUID] = pk()
    subject_id: Mapped[uuid.UUID | None] = fk("subjects.id", nullable=True)
    year: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(300))
    uploader_id: Mapped[uuid.UUID] = fk("users.id")
    rights_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    chapter_tags: Mapped[list] = mapped_column(JSONB, default=list)


class ExamCorrection(Base):  # [deferred API]
    __tablename__ = "exam_corrections"
    id: Mapped[uuid.UUID] = pk()
    exam_id: Mapped[uuid.UUID] = fk("exam_papers.id")
    author_id: Mapped[uuid.UUID] = fk("users.id")
    body: Mapped[str] = mapped_column(Text)
    score: Mapped[int] = mapped_column(Integer, default=0)


class ContentReport(Base):
    __tablename__ = "content_reports"
    id: Mapped[uuid.UUID] = pk()
    reporter_id: Mapped[uuid.UUID] = fk("users.id")
    target_type: Mapped[str] = mapped_column(String(20))
    target_id: Mapped[str] = mapped_column(String(64))
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(12), default="open")
    created_at: Mapped[datetime] = ts()


# ---------------------------------------------------------------- social [deferred API: Phase 3]
class Follow(Base):
    __tablename__ = "follows"
    follower_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    followee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = ts()


class Block(Base):
    __tablename__ = "blocks"
    blocker_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    blocked_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)


class Conversation(Base):
    __tablename__ = "conversations"
    id: Mapped[uuid.UUID] = pk()
    created_at: Mapped[datetime] = ts()


class ConversationParticipant(Base):
    __tablename__ = "conversation_participants"
    conversation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[uuid.UUID] = pk()
    conversation_id: Mapped[uuid.UUID] = fk("conversations.id")
    sender_id: Mapped[uuid.UUID] = fk("users.id")
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = ts()


class Recommendation(Base):  # [deferred API: Phase 3]
    __tablename__ = "recommendations"
    id: Mapped[uuid.UUID] = pk()
    user_id: Mapped[uuid.UUID] = fk("users.id")
    target_type: Mapped[str] = mapped_column(String(20))
    target_id: Mapped[str] = mapped_column(String(64))
    reason: Mapped[str] = mapped_column(Text)
    score: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = ts()


class RecommendationFeedback(Base):  # [deferred API: Phase 3]
    __tablename__ = "recommendation_feedback"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    recommendation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("recommendations.id", ondelete="CASCADE"), primary_key=True)
    action: Mapped[str] = mapped_column(String(12))  # saved|dismissed|tuned
