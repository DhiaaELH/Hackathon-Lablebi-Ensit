import { Link, useSearchParams } from "react-router-dom";
import { qk, useCommunityFeed, useCourse, useCourses, useInvalidate } from "../api/hooks";
import { Icon } from "../components/Icon";
import { texToPlain } from "../components/Rich";
import { Empty, ErrorBox, Spinner } from "../components/ui";
import { Community, ThreadView } from "../features/Community";
import { useI18n } from "../i18n/I18n";

const cleanTitle = (s: string) => s.replace("[DÉMO] ", "");

/** Community lives in the main menu: every discussion from the user's courses, or one course's chapters and study groups. */
export function CommunityPage() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const courseId = params.get("course") ?? "";
  const threadId = params.get("thread");
  const courses = useCourses();
  const invalidate = useInvalidate();
  const update = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) if (v) p.set(k, v); else p.delete(k);
    setParams(p);
  };

  if (threadId) {
    return <ThreadView id={threadId} onBack={() => { update({ thread: null }); invalidate([...qk.communityFeed(courseId)]); }} />;
  }
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <header className="page-head">
        <h1>{t("community")}</h1>
        <p>{t("communityIntro")}</p>
      </header>
      <div className="row">
        <select value={courseId} onChange={(e) => update({ course: e.target.value || null, chapter: null })} aria-label={t("communityCourse")} style={{ maxWidth: 460 }}>
          <option value="">{t("allMyCourses")}</option>
          {courses.data?.map((c) => <option key={c.id} value={c.id}>{cleanTitle(c.title)}</option>)}
        </select>
        {courseId && <Link className="btn btn-sm" to={`/courses/${courseId}`}><Icon name="book" size={14} /> {t("openCourse")}</Link>}
      </div>
      {courseId
        ? <CourseCommunity key={courseId} id={courseId} chapter={params.get("chapter")} />
        : <Feed noCourses={courses.data?.length === 0} onOpen={(id) => update({ thread: id })} onPick={(id) => update({ course: id })} />}
    </div>
  );
}

function CourseCommunity({ id, chapter }: { id: string; chapter: string | null }) {
  const course = useCourse(id);
  if (course.isLoading) return <Spinner />;
  if (!course.data) return <ErrorBox error={course.error} />;
  return <Community course={course.data} initialChapter={chapter} />;
}

function Feed({ noCourses, onOpen, onPick }: { noCourses: boolean; onOpen: (id: string) => void; onPick: (courseId: string) => void }) {
  const { t } = useI18n();
  const feed = useCommunityFeed("");
  if (feed.isLoading) return <Spinner />;
  if (feed.error) return <ErrorBox error={feed.error} />;
  if (noCourses) return <Empty>{t("communityNoCourses")}</Empty>;
  return (
    <div className="stack">
      <span className="small muted">{t("communityPickToPost")}</span>
      {feed.data?.length === 0 && <Empty>{t("communityEmpty")}</Empty>}
      {feed.data?.map((th) => (
        <div key={th.id} className="card stack" style={{ gap: "0.35rem" }}>
          <button type="button" className="eyebrow feed-course" onClick={() => onPick(th.course_id)}>
            {cleanTitle(th.course_title)} · {texToPlain(th.chapter_title)}
          </button>
          <button type="button" className="feed-thread" onClick={() => onOpen(th.id)}>
            <strong>{th.pinned && <Icon name="pin" size={14} />} {cleanTitle(th.title)}</strong>
          </button>
          <span className="row small muted">
            {th.author.display_name} · {th.replies} {t("replies")}
            {th.solved && <span className="badge badge-success">{t("solved")}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
