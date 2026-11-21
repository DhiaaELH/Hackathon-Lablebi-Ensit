/**
 * Client-side caching layer (TanStack Query). Course structure, revision material and the topic map are
 * immutable between workflow runs, so they get long stale times and are served instantly from cache when the
 * student switches tabs; volatile data (workflow status, notifications) polls or refetches.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type {
  AssessmentCard, AssessmentDetail, CourseCard, CourseDetail, Health, Insights, Me, NotificationT, NovaHistoryItem,
  Progress, Projects, Revision, TeacherResponseT, ThreadCard, ThreadDetail, WorkflowStatus,
  AdminStats, AdminUser, LlmCost, MemberT,
  ConversationT, DueCards, Suggestion, ExamList, ExamT, GlossaryTermT, GroupT, MessagesPage, PublicProfile, QueueItem, Recs, ReportT, SharedT,
} from "./types";

const MIN = 60_000;

export const qk = {
  me: ["me"] as const,
  health: ["health"] as const,
  courses: ["courses"] as const,
  library: (q: string) => ["library", q] as const,
  course: (id: string) => ["course", id] as const,
  workflow: (id: string) => ["workflow", id] as const,
  assessments: (id: string) => ["assessments", id] as const,
  assessment: (id: string) => ["assessment", id] as const,
  progress: (id: string) => ["progress", id] as const,
  revision: (id: string) => ["revision", id] as const,
  projects: (id: string) => ["projects", id] as const,
  nova: (id: string) => ["nova", id] as const,
  threads: (chapterId: string) => ["threads", chapterId] as const,
  thread: (id: string) => ["thread", id] as const,
  insights: (id: string) => ["insights", id] as const,
  responses: (id: string) => ["responses", id] as const,
  notifications: ["notifications"] as const,
  llmStats: ["llmStats"] as const,
  llmCost: ["llmCost"] as const,
  people: (q: string) => ["people", q] as const,
  profile: (u: string) => ["profile", u] as const,
  conversations: ["conversations"] as const,
  messages: (id: string) => ["messages", id] as const,
  groups: (courseId: string) => ["groups", courseId] as const,
  recs: ["recs"] as const,
  glossary: (courseId: string, q: string) => ["glossary", courseId, q] as const,
  shared: (chapterId: string) => ["shared", chapterId] as const,
  exams: (courseId: string, year: string) => ["exams", courseId, year] as const,
  exam: (id: string) => ["exam", id] as const,
  due: (courseId: string) => ["due", courseId] as const,
  queue: ["queue"] as const,
  reports: ["reports"] as const,
  suggestions: ["suggestions"] as const,
  members: (courseId: string) => ["members", courseId] as const,
  adminUsers: (q: string, role: string) => ["adminUsers", q, role] as const,
  adminStats: ["adminStats"] as const,
};

export const useMe = () =>
  useQuery({ queryKey: qk.me, queryFn: () => api.get<Me>("/api/auth/me"), retry: false, staleTime: 5 * MIN });
export const useHealth = () => useQuery({ queryKey: qk.health, queryFn: () => api.get<Health>("/api/system/health"), staleTime: 10 * MIN });
export const useCourses = () => useQuery({ queryKey: qk.courses, queryFn: () => api.get<CourseCard[]>("/api/courses") });
export const useLibrary = (q: string) =>
  useQuery({ queryKey: qk.library(q), queryFn: () => api.get<CourseCard[]>(`/api/library?q=${encodeURIComponent(q)}`), staleTime: 2 * MIN });
export const useCourse = (id: string) =>
  useQuery({ queryKey: qk.course(id), queryFn: () => api.get<CourseDetail>(`/api/courses/${id}`), staleTime: 10 * MIN });
export const useWorkflow = (id: string | undefined, active: boolean) =>
  useQuery({
    queryKey: qk.workflow(id ?? "none"),
    queryFn: () => api.get<WorkflowStatus>(`/api/workflows/${id}`),
    enabled: !!id,
    refetchInterval: active ? 1500 : false, // polling with graceful fallback, no long-held HTTP request
  });
export const useAssessments = (courseId: string) =>
  useQuery({ queryKey: qk.assessments(courseId), queryFn: () => api.get<AssessmentCard[]>(`/api/courses/${courseId}/assessments`) });
export const useAssessment = (id: string | null) =>
  useQuery({ queryKey: qk.assessment(id ?? ""), queryFn: () => api.get<AssessmentDetail>(`/api/assessments/${id}`), enabled: !!id, staleTime: 30 * MIN });
export const useProgress = (courseId: string) =>
  useQuery({ queryKey: qk.progress(courseId), queryFn: () => api.get<Progress>(`/api/courses/${courseId}/progress`) });
export const useRevision = (courseId: string) =>
  useQuery({ queryKey: qk.revision(courseId), queryFn: () => api.get<Revision>(`/api/courses/${courseId}/revision`), staleTime: 30 * MIN });
export const useProjects = (courseId: string) =>
  useQuery({ queryKey: qk.projects(courseId), queryFn: () => api.get<Projects>(`/api/courses/${courseId}/projects`) });
export const useNovaHistory = (courseId: string) =>
  useQuery({ queryKey: qk.nova(courseId), queryFn: () => api.get<NovaHistoryItem[]>(`/api/courses/${courseId}/nova/history`), staleTime: 30 * MIN });
export const useThreads = (chapterId: string | null) =>
  useQuery({ queryKey: qk.threads(chapterId ?? ""), queryFn: () => api.get<ThreadCard[]>(`/api/chapters/${chapterId}/threads`), enabled: !!chapterId });
export const useThread = (id: string | null) =>
  useQuery({ queryKey: qk.thread(id ?? ""), queryFn: () => api.get<ThreadDetail>(`/api/threads/${id}`), enabled: !!id });
export const useInsights = (courseId: string | null) =>
  useQuery({ queryKey: qk.insights(courseId ?? ""), queryFn: () => api.get<Insights>(`/api/courses/${courseId}/insights`), enabled: !!courseId });
export const useTeacherResponses = (courseId: string) =>
  useQuery({ queryKey: qk.responses(courseId), queryFn: () => api.get<TeacherResponseT[]>(`/api/courses/${courseId}/teacher-responses`) });
export const useNotifications = (enabled: boolean) =>
  useQuery({ queryKey: qk.notifications, queryFn: () => api.get<NotificationT[]>("/api/notifications"), enabled, refetchInterval: enabled ? 30_000 : false });

export const usePeople = (q: string) =>
  useQuery({ queryKey: qk.people(q), queryFn: () => api.get<PublicProfile[]>(`/api/users/search?q=${encodeURIComponent(q)}`), enabled: q.trim().length >= 2 });
export const useConversations = () =>
  useQuery({ queryKey: qk.conversations, queryFn: () => api.get<ConversationT[]>("/api/conversations"), refetchInterval: 15_000 });
export const useMessages = (id: string | null) =>
  useQuery({ queryKey: qk.messages(id ?? ""), queryFn: () => api.get<MessagesPage>(`/api/conversations/${id}/messages`), enabled: !!id, refetchInterval: id ? 5000 : false });
export const useGroups = (courseId: string) => useQuery({ queryKey: qk.groups(courseId), queryFn: () => api.get<GroupT[]>(`/api/courses/${courseId}/groups`) });
export const useRecs = () => useQuery({ queryKey: qk.recs, queryFn: () => api.get<Recs>("/api/recommendations") });
export const useGlossary = (courseId: string, q: string) =>
  useQuery({ queryKey: qk.glossary(courseId, q), queryFn: () => api.get<GlossaryTermT[]>(`/api/courses/${courseId}/glossary?q=${encodeURIComponent(q)}`) });
export const useShared = (chapterId: string | null) =>
  useQuery({ queryKey: qk.shared(chapterId ?? ""), queryFn: () => api.get<SharedT[]>(`/api/chapters/${chapterId}/shared`), enabled: !!chapterId });
export const useExams = (courseId: string, year: string) =>
  useQuery({ queryKey: qk.exams(courseId, year), queryFn: () => api.get<ExamList>(`/api/courses/${courseId}/exams${year ? `?year=${year}` : ""}`) });
export const useExam = (id: string | null) => useQuery({ queryKey: qk.exam(id ?? ""), queryFn: () => api.get<ExamT>(`/api/exams/${id}`), enabled: !!id });
export const useDue = (courseId: string) => useQuery({ queryKey: qk.due(courseId), queryFn: () => api.get<DueCards>(`/api/courses/${courseId}/flashcards/due`) });
export const useQueue = (enabled: boolean) =>
  useQuery({ queryKey: qk.queue, queryFn: () => api.get<{ items: QueueItem[]; min_cohort: number }>("/api/senior/queue"), enabled });
export const useSuggestions = () =>
  useQuery({ queryKey: qk.suggestions, queryFn: () => api.get<Suggestion[]>("/api/users/suggestions"), staleTime: 5 * MIN });
export const useReports = () => useQuery({ queryKey: qk.reports, queryFn: () => api.get<ReportT[]>("/api/admin/reports") });

export const useMembers = (courseId: string) =>
  useQuery({ queryKey: qk.members(courseId), queryFn: () => api.get<MemberT[]>(`/api/courses/${courseId}/members`) });
export const useAdminUsers = (q: string, role: string) =>
  useQuery({ queryKey: qk.adminUsers(q, role), queryFn: () => api.get<AdminUser[]>(`/api/admin/users?q=${encodeURIComponent(q)}&role=${role}`) });
export const useLlmCost = (enabled: boolean) =>
  useQuery({ queryKey: qk.llmCost, queryFn: () => api.get<LlmCost>("/api/system/llm-cost"), enabled, staleTime: MIN });
export const useAdminStats = () => useQuery({ queryKey: qk.adminStats, queryFn: () => api.get<AdminStats>("/api/admin/stats") });

export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: readonly unknown[][]) => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: k })));
}

export { useMutation, useQuery, useQueryClient };
