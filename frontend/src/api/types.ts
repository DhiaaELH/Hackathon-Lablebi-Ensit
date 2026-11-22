export type Lang = "fr" | "en" | "ar" | "derja";
export type Role = "student" | "senior" | "teacher" | "admin";

export interface Me {
  id: string;
  email: string;
  role: Role;
  username: string;
  display_name: string;
  locale: Lang;
  derja_script: "arabic" | "latin";
  searchable: boolean;
  message_setting: string;
  faculty: string | null;
  interests: string[];
  current_subjects: string[];
  is_demo: boolean;
  bio: string | null;
  show_follows: boolean;
}

export interface Health {
  demo_mode: boolean;
  provider: string;
  model: string;
  tiers?: { fast: string; smart: string };
  embeddings: string;
  resource_finder: boolean;
  min_cohort: number;
}

export interface CourseCard {
  id: string;
  title: string;
  description: string | null;
  language: Lang;
  visibility: "private" | "published";
  status: string;
  is_demo: boolean;
  access: "owner" | "teacher" | "member" | "public" | null;
  chapter_count: number;
  created_at: string;
}

export interface KeyTerm { term: string; definition: string }
export interface Formula { name: string; expression: string; meaning: string }
export interface SectionT {
  id: string;
  title: string;
  content: string;
  objectives: string[];
  key_terms: KeyTerm[];
  formulas: Formula[];
  hard_points: string[];
  citations: string[];
}
export interface ChapterT {
  id: string;
  title: string;
  summary: string | null;
  citations: string[];
  hard_votes: number;
  i_voted_hard: boolean;
  sections: SectionT[];
}
export interface RefT { ref: string; page: number | null; section: string | null; excerpt: string }
export interface ConceptT { id: string; key: string; name: string; description: string; section_id: string | null; citations: string[] }
export interface ResourceT { id: string; filename: string; kind: string; size_bytes: number; page_count: number | null; status: string; notes: string[]; chunks: number | null }

export interface CourseDetail extends CourseCard {
  workflow: { id: string; status: string; demo_mode: boolean } | null;
  analysis_notes: { missing_or_ambiguous: string[]; confidence: number | null } | null;
  resources: ResourceT[];
  chapters: ChapterT[];
  concepts: ConceptT[];
  prerequisites: { concept_id: string; prerequisite_id: string }[];
  refs: Record<string, RefT>;
}

export interface WorkflowStatus {
  id: string;
  course_id: string;
  status: string;
  demo_mode: boolean;
  tasks: { id: string; agent_role: string; status: string; retry_count: number; error: string | null }[];
  events: { id: number; agent_role: string; type: string; message: string; at: string }[];
}

export interface AssessmentCard {
  id: string;
  kind: "exercise" | "chapter_quiz" | "mock_exam";
  title: string;
  chapter_id: string | null;
  section_id: string | null;
  questions: number;
  problems: number;
  quality_status: string;
  agent_role: string;
  best: { score: number; max: number } | null;
}
export interface AssessmentDetail {
  id: string;
  kind: string;
  title: string;
  quality_status: string;
  findings: { severity: string; item: string; issue: string }[];
  questions: {
    id: string; qtype: "mcq" | "open"; prompt: string; choices: string[]; points: number; citations: string[];
    hints: string[]; difficulty: string | null; rubric_size: number; my_last: { answer: string; score: number | null; grading: OpenGradeT; at: string } | null;
  }[];
}
export interface OpenGradeT { score: number; met: string[]; missing: string[]; feedback: string; misconception: string; demo?: boolean; gave_up?: boolean }
export interface SolutionT { solution: string; rubric: string[]; citations: string[] }
export interface Gap { concept_id: string; concept: string; because_of: string[]; evidence: string[]; confidence: string }
export interface AttemptResult {
  attempt_id: string;
  score: number;
  max: number;
  results: { question_id: string; chosen: number | null; correct: boolean; correct_index: number; explanation: string; citations: string[]; misconception: string | null; concept: string | null; community: Community }[];
  gaps: Gap[];
}

export interface Progress {
  criteria: string;
  sections_done: number;
  sections_total: number;
  done_section_ids: string[];
  chapters: { chapter_id: string; title: string; sections_done: number; sections_total: number; best_quiz_ratio: number | null; complete: boolean }[];
  concepts: { concept_id: string; name: string; correct: number; total: number; trend: string; evidence: string }[];
  history: { assessment_id: string; title: string; kind: string; score: number; max: number; at: string }[];
}

export interface Revision {
  revision: {
    summaries: { chapter_title: string; bullets: string[]; citations: string[] }[];
    flashcards: { front: string; back: string; kind: string; citations: string[] }[];
  } | null;
  quality_status: string | null;
  findings: { severity: string; item: string; issue: string }[];
  topic_map: { nodes: { id: string; key: string; label: string; layer: number; section_id: string | null }[]; edges: { from: string; to: string }[] };
}

export interface ProjectT {
  id: string;
  title: string;
  goal: string;
  steps: string[];
  difficulty: string;
  effort_hours: number;
  materials: string[];
  success_criteria: string[];
  status: string | null;
  progress: number;
  quality_status: string;
}
export interface Projects { criteria: string; chapters: { chapter_id: string; chapter: string; unlocked: boolean; projects: ProjectT[] }[] }

export interface NovaReply {
  agent_role: string;
  handoff: string;
  message: string;
  citations: string[];
  supported?: boolean | null;
  method?: string;
  action?: { open: string } | null;
  demo: boolean;
  error?: boolean;
}
export interface NovaHistoryItem { id: number; role: "user" | "assistant"; agent_role: string | null; mode: string | null; content: string; citations: string[]; demo: boolean; at: string }

export interface ThreadCard { id: string; title: string; body: string; author: { display_name: string; role: Role }; replies: number; solved: boolean; pinned: boolean; is_demo: boolean; at: string }
export interface FeedThread extends ThreadCard { last_at: string; course_id: string; course_title: string; chapter_id: string; chapter_title: string }
export interface ThreadDetail {
  id: string;
  title: string;
  body: string;
  author: { display_name: string; role: Role };
  chapter_id: string;
  can_accept: boolean;
  is_demo: boolean;
  posts: { id: string; body: string; author: { display_name: string; role: Role }; accepted: boolean; score: number; my_vote: number; at: string; can_delete?: boolean }[];
  pinned?: boolean;
  can_pin?: boolean;
  can_delete?: boolean;
}

export interface Insights {
  min_cohort: number;
  heatmap: { chapter: string; section_id: string; section: string; students: number | null; suppressed: boolean; reasons: Record<string, number>; top_reason: string | null; hint_students: number | null }[];
  hard_chapters: { chapter_id: string; chapter: string; votes: number | null }[];
  most_failed_questions: { question_id: string; assessment: string; prompt: string; students: number; failure_rate: number }[];
  trend: { week: string; students: number; signals: number }[];
  responses: { id: string; section_id: string | null; kind: string; body: string; created_at: string }[];
  privacy_note: string;
}
export interface NotificationT { id: string; kind: string; title: string; body: string; link: string | null; read: boolean; at: string }
export interface TeacherResponseT { id: string; section_id: string | null; kind: string; body: string; at: string }

// ---------------------------------------------------------------- social / knowledge / growth
export interface PublicProfile {
  username: string; display_name: string; role: Role; bio: string | null; is_me: boolean; following: boolean; follows_you: boolean;
  blocked_by_me: boolean; accepted_answers: number; can_message: boolean; badge: string | null; followers?: number; following_count?: number;
}
export interface ConversationT {
  id: string; is_group: boolean; title: string; members: { username: string; display_name: string; role: Role }[];
  course_id: string | null; exam_date: string | null; last: { body: string; at: string } | null; unread: number;
}
export interface MessagesPage { conversation: ConversationT; has_more: boolean; messages: { id: string; body: string; mine: boolean; at: string; sender: string }[] }
export interface GroupT { id: string; title: string; members: number; exam_date: string | null; joined: boolean }
export interface RecItem { id: string; type: "concept" | "section" | "course"; reason: string; reason_code?: string; reason_args?: Record<string, string | number>; score: number; saved: boolean; course_id: string; section_id?: string | null; title: string }
export interface Recs { items: RecItem[]; settings: { review: boolean; next_steps: boolean; library: boolean }; how: string }
export interface GlossaryTermT { id: string; term_fr: string; term_ar: string | null; term_derja: string | null; term_en: string | null; explanation: string; example: string | null; review_state: string; contributor: string }
export interface SharedT { id: string; kind: string; title: string; body: string | null; url: string | null; author: string; helpful: number; not_helpful: number; my_rating: boolean | null; mine: boolean; at: string }
export interface FinderResult { available: boolean; reason: string | null; results: { title: string; url: string; provider: string; reason: string; topic: string }[] }
export interface ExamT {
  id: string; faculty: string; subject: string; year: number; session: string; title: string; chapter_ids: string[]; uploader: string; is_demo: boolean; corrections: number;
  content?: string; correction_list?: { id: string; body: string; author: string; score: number; my_vote: number; mine: boolean; at: string }[];
}
export interface ExamList { exams: ExamT[]; chapter_frequency: { chapter_id: string; chapter: string; papers: number }[] }
export interface Community {
  endorsements: number; i_endorsed: boolean; verified_by_students: boolean; corrected_by_students: boolean; note: string;
  corrections: { id: string; body: string; status: string; votes: number; author: string; i_voted: boolean; at: string }[];
}
export interface DueCard { front: string; back: string; kind: string; citations: string[]; key: string; reps: number; due: string; new: boolean }
export interface DueCards { due: DueCard[]; upcoming: number; total: number; next_due: string | null }
export interface QueueItem { course_id: string; course: string; chapter_id: string; chapter: string; section_id: string; section: string; students: number; top_reason: string | null }
export interface ReportT { id: string; target_type: string; target_id: string; reason: string; status: string; preview: string | null; at: string }
export interface Suggestion extends PublicProfile { reason: string; reasons: { code: string; args: Record<string, string | number> }[]; score: number }

export interface MemberT { username: string; display_name: string; role: Role; member_role: "student" | "teacher" }
export interface AdminUser { username: string; display_name: string; email: string; role: Role; is_demo: boolean; courses: number; created_at: string }
export interface LlmCostModel {
  provider: string; model: string; calls: number; input_tokens: number; output_tokens: number; cache_read_tokens: number; cache_write_tokens: number;
  cost_usd: number | null; price: { input: number; output: number; cache_read: number; cache_write: number } | null;
}
export interface LlmCost {
  currency: "USD"; prices_as_of: string; since: string | null; calls: number; unpriced_models: string[];
  totals: { all: number; month: number; last_30d: number; today: number };
  by_model: LlmCostModel[]; daily: { day: string; cost_usd: number }[];
}
export interface LevelT { level: number; xp: number; level_start: number; next_level_at: number }
export interface ChallengeSubmissionT { id: string; status: "graded" | "pending"; score: number; passed: boolean; xp_awarded: number; answer: string; link: string | null; grading: OpenGradeT; at: string }
export interface ChallengeT {
  id: string; course_id: string; course_title: string; chapter_id: string | null; chapter_title: string | null;
  kind: "task" | "project"; grading_mode: "ai" | "manual"; title: string; instructions: string; criteria: string[]; xp: number; due_at: string | null; created_at: string;
  author: { display_name: string; role: Role }; mine: boolean; can_manage: boolean; attempts: number; attempts_left: number;
  best_score: number | null; passed: boolean; xp_earned: number; pending: boolean; my_submissions: ChallengeSubmissionT[];
  submissions_count: number | null; pending_count: number | null;
}
export interface ChallengeList { me: LevelT & { passed: number }; can_publish: boolean; pass_score: number; max_attempts: number; challenges: ChallengeT[] }
export interface ChallengeResult extends OpenGradeT { pending: boolean; passed: boolean; xp_awarded: number; xp_gained: number; attempts_left: number; me: LevelT }
export interface PublishableCourse { id: string; title: string; chapters: { id: string; title: string }[] }
export interface LeaderRow { rank: number | null; me: boolean; display_name: string | null; username: string | null; role: Role; xp: number; passed: number; level: number }
export interface Leaderboard { top: LeaderRow[]; me: LeaderRow; players: number }
export interface ChallengeSubmissionAdmin { id: string; student: { display_name: string; role: Role }; status: "graded" | "pending"; reviewed_by: string | null; score: number; passed: boolean; xp_awarded: number; answer: string; link: string | null; feedback: string; at: string }
export interface AdminStats { users: Record<Role, number>; courses: number; published: number; attempts: number; open_reports: number }
