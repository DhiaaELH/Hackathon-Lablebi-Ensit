"""Seed SYNTHETIC demo data. Local use only.

    python -m app.seed            # create demo data if absent
    python -m app.seed --reset    # drop everything and recreate

Demo accounts share the password from LF_DEMO_PASSWORD (default: demo-password-123). Never use in production.
All seeded signals, attempts and posts are synthetic and labelled is_demo / [DÉMO].
"""
import os
import random
import sys
from datetime import date, timedelta

from sqlalchemy import select

from .agents import demo_course
from .db import Base, SessionLocal, get_engine, init_db
from .llm import provider as provider_mod
from .models import (
    Assessment,
    Conversation,
    ConversationParticipant,
    ExamCorrection,
    ExamCorrectionVote,
    ExamPaper,
    Follow,
    Message,
    QuestionEndorsement,
    SharedResource,
    ConfusionSignal,
    Course,
    CourseMember,
    GlossaryTerm,
    HardChapterVote,
    Post,
    Profile,
    Question,
    Resource,
    Section,
    StudentPreferences,
    TeacherResponse,
    Thread,
    User,
    Vote,
)
from .retrieval.chunking import Page
from .security import hash_password, signal_token
from .services.ingest import add_chunks
from .services.learning import score_attempt
from .workflows.jordan import run_workflow, start_workflow

PASSWORD = os.environ.get("LF_DEMO_PASSWORD", "demo-password-123")
ACCOUNTS = [
    ("student@demo.lessonforge.local", "Amira (démo)", "student", "amira", True, "fr"),
    ("senior@demo.lessonforge.local", "Youssef — tuteur (démo)", "senior", "youssef", True, "fr"),
    ("teacher@demo.lessonforge.local", "Pr. Ben Salah (démo)", "teacher", "prof_bensalah", False, "fr"),
    ("moderator@demo.lessonforge.local", "Modération (démo)", "admin", "moderation", False, "en"),
] + [(f"synthetic{i}@demo.lessonforge.local", f"Étudiant synthétique {i}", "student", f"synthetic{i}", False, "fr") for i in range(1, 7)]

# section number -> how many synthetic students signal it (>=5 visible, <5 suppressed on the dashboard)
SIGNAL_PLAN = {"2.3": 6, "2.2": 5, "3.1": 5, "1.3": 4, "3.2": 3, "1.2": 2}
REASON_PLAN = {"2.3": ["missing_prerequisite", "need_example"], "2.2": ["missing_prerequisite", "too_fast"], "3.1": ["need_example", "vocabulary"],
               "1.3": ["vocabulary"], "3.2": ["too_fast"], "1.2": ["vocabulary"]}


def _user(db, email, name, role, username, searchable, locale) -> User:
    u = User(email=email, password_hash=hash_password(PASSWORD))
    db.add(u)
    db.flush()
    db.add(Profile(user_id=u.id, role=role, username=username, display_name=name, searchable=searchable, locale=locale, is_demo=True))
    db.add(StudentPreferences(user_id=u.id, faculty="Faculté des Sciences (démo)", interests=["réseaux"], current_subjects=["Réseaux informatiques"]))
    return u


def seed(reset: bool = False) -> None:
    if reset:
        Base.metadata.drop_all(get_engine())
    init_db()
    with SessionLocal() as db:
        if db.scalar(select(Course).where(Course.is_demo.is_(True))):
            print("Demo data already present (use --reset to recreate).")
            return
        users = {a[3]: _user(db, *a) for a in ACCOUNTS}
        teacher = users["prof_bensalah"]
        course = Course(owner_id=teacher.id, title=demo_course.DEMO_TITLE, description=demo_course.DEMO_DESCRIPTION, language="fr",
                        visibility="published", is_demo=True)
        db.add(course)
        db.flush()
        from datetime import datetime, timezone
        course.published_at = datetime.now(timezone.utc)
        for uname, u in users.items():
            if uname != "prof_bensalah":
                db.add(CourseMember(course_id=course.id, user_id=u.id, member_role="student"))
        res = Resource(course_id=course.id, owner_id=teacher.id, kind="text", filename="reseaux-demo.txt", mime="text/plain",
                       size_bytes=sum(len(p) for p in demo_course.SOURCE_PAGES), rights_confirmed=True, page_count=len(demo_course.SOURCE_PAGES), extraction_status="ok")
        db.add(res)
        db.flush()
        add_chunks(db, course, res, [Page(i + 1, p) for i, p in enumerate(demo_course.SOURCE_PAGES)])
        db.commit()
        course_id, teacher_id = course.id, teacher.id
        user_ids = {k: v.id for k, v in users.items()}

    # Run the real workflow code with fixture outputs (no API call), so the seed exercises Jordan end to end.
    saved = provider_mod._provider
    provider_mod._provider = provider_mod.DemoProvider()
    try:
        with SessionLocal() as db:
            wf = start_workflow(db, db.get(Course, course_id), teacher_id, "fr", demo=True)
            wf_id = wf.id
        run_workflow(wf_id)
    finally:
        provider_mod._provider = saved

    with SessionLocal() as db:
        course = db.get(Course, course_id)
        sections = {s.title.split(" ")[0]: s for s in db.scalars(select(Section).where(Section.course_id == course_id))}
        rng = random.Random(42)
        synthetic = [user_ids[f"synthetic{i}"] for i in range(1, 7)]
        n_signals = 0
        for num, count in SIGNAL_PLAN.items():
            s = sections[num]
            for uid in synthetic[:count]:
                reasons = rng.sample(REASON_PLAN[num], k=rng.randint(1, len(REASON_PLAN[num])))
                if num in ("2.3", "2.2"):
                    reasons = sorted(set(reasons) | {REASON_PLAN[num][0]})
                db.add(ConfusionSignal(course_id=course_id, chapter_id=s.chapter_id, section_id=s.id, reasons=sorted(reasons),
                                       dedupe_token=signal_token(uid, s.id), cohort_token=signal_token(uid, course_id),
                                       day=date.today() - timedelta(days=rng.randint(0, 20)), is_demo=True))
                n_signals += 1
        ch2 = sections["2.1"].chapter_id
        for uid in synthetic[:5]:
            db.add(HardChapterVote(user_id=uid, chapter_id=ch2))
        db.commit()

        # Synthetic quiz attempts on chapter 2 so "most-missed questions" has >= 5 students.
        quiz = db.scalar(select(Assessment).where(Assessment.course_id == course_id, Assessment.kind == "chapter_quiz", Assessment.chapter_id == ch2))
        qs = db.scalars(select(Question).where(Question.assessment_id == quiz.id).order_by(Question.ordinal)).all()
        for i, uid in enumerate(synthetic):
            answers = {}
            for j, q in enumerate(qs):
                wrong = (j == 0 and i < 4) or (j == 1 and i < 2)  # 2^h - 2 is the classic mistake
                answers[str(q.id)] = (q.correct_index + 1) % 4 if wrong else q.correct_index
            score_attempt(db, uid, quiz, answers)

        amira, youssef = user_ids["amira"], user_ids["youssef"]
        t = Thread(course_id=course_id, chapter_id=ch2, author_id=amira, is_demo=True, title="[DÉMO] Pourquoi on retire 2 dans 2^h − 2 ?",
                   body="Je ne comprends pas pourquoi un /26 donne 62 hôtes et pas 64.")
        db.add(t)
        db.flush()
        p1 = Post(thread_id=t.id, author_id=youssef, accepted=True,
                  body="Dans chaque sous-réseau, la première adresse (tous les bits d'hôte à 0) est l'adresse du réseau et la dernière (tous à 1) est la diffusion. Aucune des deux ne peut être donnée à une machine : 64 − 2 = 62. Voir section 2.3.")
        p2 = Post(thread_id=t.id, author_id=synthetic[0], body="Merci ! Le schéma avec .0 et .63 m'a aidé.")
        db.add_all([p1, p2])
        db.flush()
        for uid in synthetic[:4]:
            db.add(Vote(user_id=uid, post_id=p1.id, value=1))
        t2 = Thread(course_id=course_id, chapter_id=sections["3.1"].chapter_id, author_id=synthetic[1], is_demo=True,
                    title="[DÉMO] Plus long préfixe : un exemple ?", body="Quelqu'un a un exemple de table de routage avec deux entrées qui se chevauchent ?")
        db.add(t2)
        for fr, ar, derja, en, expl in [
            ("Masque de sous-réseau", "قناع الشبكة الفرعية", "الماسك", "Subnet mask", "Indique quels bits de l'adresse forment la partie réseau."),
            ("Passerelle par défaut", "البوابة الافتراضية", "الپاسرال", "Default gateway", "Routeur utilisé pour joindre les autres réseaux."),
            ("Diffusion", "البث", "البرودكاست", "Broadcast", "Adresse qui atteint toutes les machines du réseau."),
        ]:
            db.add(GlossaryTerm(course_id=course_id, term_fr=fr, term_ar=ar, term_derja=derja, term_en=en, explanation=expl, review_state="reviewed", contributor_id=youssef))
        db.add(TeacherResponse(course_id=course_id, section_id=sections["2.2"].id, teacher_id=teacher_id, kind="next_session",
                               body="[DÉMO] Nous referons la conversion binaire au tableau en début de prochaine séance."))
        # --- social / community extras (all synthetic) ---
        bios = {"synthetic1": "Passionnée de réseaux et de cybersécurité.", "synthetic2": "En L1 info, j'aime les maths et l'algorithmique.",
                "synthetic3": "Je révise les sous-réseaux tous les jeudis."}
        for uname, bio in bios.items():
            prof = db.get(Profile, user_ids[uname])
            prof.searchable, prof.bio, prof.message_setting = True, bio, "everyone"
        tutor = db.get(Profile, youssef)
        tutor.show_follows, tutor.bio = True, "Tuteur pair en réseaux (M1). Posez vos questions !"
        db.add(Follow(follower_id=youssef, followee_id=synthetic[1]))
        db.add_all([Follow(follower_id=amira, followee_id=youssef), Follow(follower_id=youssef, followee_id=amira)])
        dm = Conversation(is_group=False, created_by=amira)
        db.add(dm)
        db.flush()
        db.add_all([ConversationParticipant(conversation_id=dm.id, user_id=amira), ConversationParticipant(conversation_id=dm.id, user_id=youssef)])
        db.add(Message(conversation_id=dm.id, sender_id=amira, body="[DÉMO] Salut Youssef, tu peux m'expliquer le plus long préfixe ?"))
        db.add(Message(conversation_id=dm.id, sender_id=youssef, body="[DÉMO] Bien sûr ! Le routeur choisit l'entrée la plus spécifique : /16 avant /8."))
        grp = Conversation(is_group=True, title="[DÉMO] Révision réseaux — L1", course_id=course_id, created_by=youssef, exam_date=date.today() + timedelta(days=12))
        db.add(grp)
        db.flush()
        for uid in (youssef, synthetic[0], synthetic[1]):
            db.add(ConversationParticipant(conversation_id=grp.id, user_id=uid))
        db.add(Message(conversation_id=grp.id, sender_id=youssef, body="[DÉMO] On fait une séance sous-réseaux jeudi à 14h ?"))
        db.add(SharedResource(course_id=course_id, chapter_id=ch2, author_id=youssef, kind="solved_exercise", rights_confirmed=True,
                              title="[DÉMO] Méthode rapide pour découper un /24",
                              body="1. Trouver le pas : 256 − dernier octet du masque.\n2. Les sous-réseaux commencent à 0, pas, 2×pas…\n3. Diffusion = début du suivant − 1."))
        exam = ExamPaper(course_id=course_id, faculty="Faculté des Sciences (démo)", subject="Réseaux informatiques", year=2025, session="principale",
                         title="[DÉMO] Examen fictif — session principale 2025", uploader_id=youssef, rights_confirmed=True, is_demo=True,
                         content="Exercice 1 (6 pts) : Découper 172.16.0.0/16 en 8 sous-réseaux. Donner masque, adresses réseau et diffusion.\n"
                                 "Exercice 2 (4 pts) : Comparer TCP et UDP pour la voix sur IP.",
                         chapter_tags=[str(ch2), str(sections["3.2"].chapter_id)])
        db.add(exam)
        db.add(ExamPaper(course_id=course_id, faculty="Faculté des Sciences (démo)", subject="Réseaux informatiques", year=2024, session="contrôle",
                         title="[DÉMO] Examen fictif — session de contrôle 2024", uploader_id=amira, rights_confirmed=True, is_demo=True,
                         content="Exercice 1 : Citer les 7 couches OSI et le PDU de chacune.\nExercice 2 : Combien d'hôtes dans un /27 ?",
                         chapter_tags=[str(sections["1.1"].chapter_id), str(ch2)]))
        db.flush()
        corr = ExamCorrection(exam_id=exam.id, author_id=youssef, body="Ex.1 : 3 bits empruntés → /19, masque 255.255.224.0, pas de 32 sur le 3e octet : 172.16.0.0, 172.16.32.0, …")
        db.add(corr)
        db.flush()
        for uid in synthetic[:3]:
            db.add(ExamCorrectionVote(user_id=uid, correction_id=corr.id, value=1))
        for q in qs[:2]:  # synthetic students endorse the first two chapter-2 questions -> "verified by students"
            for uid in synthetic[:3]:
                db.add(QuestionEndorsement(user_id=uid, question_id=q.id))
        db.commit()
        print(f"Seeded synthetic course '{course.title}' with {n_signals} anonymous demo signals across {len(synthetic)} synthetic students.")
        print("Demo accounts (password from LF_DEMO_PASSWORD, default 'demo-password-123'):")
        for a in ACCOUNTS[:4]:
            print(f"  {a[2]:8s} {a[0]}")
        print("  teacher invite code for new teacher sign-ups: TEACHER_INVITE_CODE (default 'demo-teacher-code')")


if __name__ == "__main__":
    seed(reset="--reset" in sys.argv)
