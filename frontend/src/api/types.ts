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
}

export interface Health {
  demo_mode: boolean;
  provider: string;
  model: string;
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
  questions: { id: string; prompt: string; choices: string[]; points: number; citations: string[] }[];
}
export interface Gap { concept_id: string; concept: string; because_of: string[]; evidence: string[]; confidence: string }
export interface AttemptResult {
  attempt_id: string;
  score: number;
  max: number;
  results: { question_id: string; chosen: number | null; correct: boolean; correct_index: number; explanation: string; citations: string[]; misconception: string | null; concept: string | null }[];
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
export interface ThreadDetail {
  id: string;
  title: string;
  body: string;
  author: { display_name: string; role: Role };
  chapter_id: string;
  can_accept: boolean;
  is_demo: boolean;
  posts: { id: string; body: string; author: { display_name: string; role: Role }; accepted: boolean; score: number; my_vote: number; at: string }[];
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
