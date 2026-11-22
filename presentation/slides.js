/**
 * Slide content (EN + FR). Every number here is either measured on our own runs
 * (llm_calls table) or a design parameter read from the code — nothing invented.
 * `focus`  : planet id the camera flies to ("sun" = Jordan, null = preset view)
 * `cam`    : preset camera when focus is null
 * `anim`   : scene animation running while the slide is open
 */
export const REPO = "https://github.com/DhiaaELH/Hackathon-Lablebi-Ensit";

export const CHAPTERS = {
  en: ["Intro", "Workflow & agents", "Platform", "Business", "Close"],
  fr: ["Intro", "Workflow & agents", "Plateforme", "Business", "Fin"],
};

export const UI = {
  en: {
    explore: "Explore", present: "Present", prev: "Previous", next: "Next",
    exploreHint: "Drag to orbit · scroll to zoom · click a planet to open its slide · press E to return",
    keys: "← → to navigate · E explore · F fullscreen · P print to PDF",
    open: "Open slide",
    core: "☀ Inside the sun · the platform",
  },
  fr: {
    explore: "Explorer", present: "Présenter", prev: "Précédent", next: "Suivant",
    exploreHint: "Glisse pour tourner · molette pour zoomer · clique une planète pour ouvrir sa slide · E pour revenir",
    keys: "← → pour naviguer · E explorer · F plein écran · P imprimer en PDF",
    open: "Ouvrir la slide",
    core: "☀ Au cœur du soleil · la plateforme",
  },
};

/** Planet catalogue: inner system = course generation, belt = community, outer = live help. */
export const BODIES = {
  sun:   { name: "Jordan", role: { en: "Coordinator · your course", fr: "Coordinateur · ton cours" } },
  clara: { name: "Clara", role: { en: "Course analyst", fr: "Analyste du cours" } },
  quinn: { name: "Quinn", role: { en: "Quizzes & diagnosis", fr: "Quiz & diagnostic" } },
  alex:  { name: "Alex",  role: { en: "Exercises & projects", fr: "Exercices & projets" } },
  sage:  { name: "Sage",  role: { en: "Revision maker", fr: "Fiches de révision" } },
  max:   { name: "Max",   role: { en: "Mock exams", fr: "Examens blancs" } },
  riley: { name: "Riley", role: { en: "Quality checker", fr: "Contrôle qualité" } },
  sam:   { name: "Sam",   role: { en: "Tutor & grader", fr: "Tuteur & correcteur" } },
  nova:  { name: "Nova",  role: { en: "Student liaison", fr: "Ton interlocutrice" } },
  finder:{ name: "Finder", role: { en: "Resource finder", fr: "Chercheur de ressources" } },
};

const flow = (items) =>
  `<ol class="flow">${items.map(([t, d], i) => `<li data-phase="${i}"><span class="dot"></span><div><strong>${t}</strong><span>${d}</span></div></li>`).join("")}</ol>`;
const facts = (items) => `<ul class="facts">${items.map((x) => `<li>${x}</li>`).join("")}</ul>`;
const chips = (items) => `<div class="chips">${items.map((x) => `<span class="chip">${x}</span>`).join("")}</div>`;
const stats = (items) => `<div class="stats">${items.map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join("")}</div>`;
const code = (x) => `<code>${x}</code>`;

/** Big, scannable points: a bold keyword, then a few words. */
const pts = (items) => `<ul class="pts">${items.map(([k, t]) => `<li><b>${k}</b><span>${t}</span></li>`).join("")}</ul>`;
const src = (...x) => `<p class="src">${x.map(code).join(" ")}</p>`;

export const SLIDES = [
  // ───────────────────────────── INTRO
  {
    id: "title", chapter: 0, focus: null, cam: "hero", anim: "workflow",
    en: {
      eyebrow: "LessonForge · ENSIT hackathon",
      title: "Your course notes, <em>finally</em> alive.",
      body: `<p class="lead">10 AI agents turn any course into lessons, exercises and a tutor — in <strong>Derja, French, English or Arabic</strong>.</p>
      ${chips(["COMPRENDRE", "ENRICHIR", "AMÉLIORER"])}
      <p class="hint"><kbd>→</kbd> next · <kbd>E</kbd> explore</p>`,
    },
    fr: {
      eyebrow: "LessonForge · Hackathon ENSIT",
      title: "Tes notes de cours, <em>enfin</em> vivantes.",
      body: `<p class="lead">10 agents IA transforment n'importe quel cours en leçons, exercices et tuteur — en <strong>Derja, français, anglais ou arabe</strong>.</p>
      ${chips(["COMPRENDRE", "ENRICHIR", "AMÉLIORER"])}
      <p class="hint"><kbd>→</kbd> suivant · <kbd>E</kbd> explorer</p>`,
    },
  },
  {
    id: "problem", chapter: 0, focus: null, cam: "far", anim: null,
    en: {
      eyebrow: "The problem",
      title: "A dense PDF is not a <em>lesson</em>.",
      body: pts([["No practice", "few corrected exercises"], ["Wrong language", "taught in French, thought in Derja"], ["Silent classes", "nobody dares to ask"], ["Generic chatbots", "answer from the internet, cite nothing"]]),
    },
    fr: {
      eyebrow: "Le problème",
      title: "Un PDF dense n'est pas une <em>leçon</em>.",
      body: pts([["Pas de pratique", "peu d'exercices corrigés"], ["Mauvaise langue", "enseigné en français, pensé en Derja"], ["Classes muettes", "personne n'ose demander"], ["Chatbots génériques", "répondent d'internet, sans source"]]),
    },
  },
  {
    id: "system", chapter: 0, focus: null, cam: "top", anim: "workflow",
    en: {
      eyebrow: "The system",
      title: "Everything <em>orbits</em> your course.",
      body: `<div class="legend">
        <div><span class="sw" style="--c:#f2b45a"></span><strong>Sun · Jordan</strong><span>coordinates everything</span></div>
        <div><span class="sw" style="--c:#8f7be8"></span><strong>Inner orbits</strong><span>6 agents build the course</span></div>
        <div><span class="sw" style="--c:#9aa7a3"></span><strong>Asteroid belt</strong><span>the community</span></div>
        <div><span class="sw" style="--c:#7aa7dc"></span><strong>Outer orbits</strong><span>Sam & Nova help you live</span></div>
      </div>
      <p class="hint">Click a planet to fly there.</p>`,
    },
    fr: {
      eyebrow: "Le système",
      title: "Tout <em>gravite</em> autour de ton cours.",
      body: `<div class="legend">
        <div><span class="sw" style="--c:#f2b45a"></span><strong>Soleil · Jordan</strong><span>coordonne tout</span></div>
        <div><span class="sw" style="--c:#8f7be8"></span><strong>Orbites internes</strong><span>6 agents construisent le cours</span></div>
        <div><span class="sw" style="--c:#9aa7a3"></span><strong>Ceinture</strong><span>la communauté</span></div>
        <div><span class="sw" style="--c:#7aa7dc"></span><strong>Orbites externes</strong><span>Sam & Nova t'aident en direct</span></div>
      </div>
      <p class="hint">Clique une planète pour y voler.</p>`,
    },
  },

  // ───────────────────────────── WORKFLOW & AGENTS
  {
    id: "workflow", chapter: 1, focus: null, cam: "workflow", anim: "workflow",
    en: {
      eyebrow: "The workflow",
      title: "Upload → full course in <em>25 s</em>.",
      body: `${flow([["Upload", "PDF · DOCX · scan · YouTube"], ["Index", "chunks + vectors in Postgres"], ["Clara", "chapters & concepts, cited"], ["Quinn · Alex · Sage · Max", "all 4 in parallel"], ["Riley", "quality check"], ["Published", "shared with the whole class"]])}
      <p class="hint">Measured end-to-end on our test course.</p>`,
    },
    fr: {
      eyebrow: "Le workflow",
      title: "Import → cours complet en <em>25 s</em>.",
      body: `${flow([["Import", "PDF · DOCX · scan · YouTube"], ["Indexation", "morceaux + vecteurs dans Postgres"], ["Clara", "chapitres & concepts, cités"], ["Quinn · Alex · Sage · Max", "les 4 en parallèle"], ["Riley", "contrôle qualité"], ["Publié", "partagé avec toute la classe"]])}
      <p class="hint">Mesuré de bout en bout sur notre cours de test.</p>`,
    },
  },
  {
    id: "jordan", chapter: 1, focus: "sun", anim: "workflow",
    en: {
      eyebrow: "Agent 1 · Jordan",
      title: "The sun is <em>plain code</em>.",
      body: `${pts([["0 tokens", "orchestration is Python, not an LLM"], ["Parallel", "Clara → 4 agents at once → Riley"], ["Resilient", "backoff, and only failed agents retry"]])}${src("workflows/jordan.py")}`,
    },
    fr: {
      eyebrow: "Agent 1 · Jordan",
      title: "Le soleil, c'est du <em>code simple</em>.",
      body: `${pts([["0 token", "l'orchestration est du Python, pas un LLM"], ["Parallèle", "Clara → 4 agents en même temps → Riley"], ["Robuste", "délais progressifs, seuls les échecs sont relancés"]])}${src("workflows/jordan.py")}`,
    },
  },
  {
    id: "clara", chapter: 1, focus: "clara", anim: null,
    en: {
      eyebrow: "Agent 2 · Clara",
      title: "Turns a PDF into a <em>map</em>.",
      body: pts([["Structure", "chapters, objectives, concepts"], ["Prerequisites", "a graph linking the concepts"], ["Citations", "every item points to a source <span class=\"cite\">[S4]</span>"]]),
    },
    fr: {
      eyebrow: "Agent 2 · Clara",
      title: "Transforme un PDF en <em>carte</em>.",
      body: pts([["Structure", "chapitres, objectifs, concepts"], ["Prérequis", "un graphe qui relie les notions"], ["Citations", "chaque élément pointe vers une source <span class=\"cite\">[S4]</span>"]]),
    },
  },
  {
    id: "quinn", chapter: 1, focus: "quinn", anim: null,
    en: {
      eyebrow: "Agent 3 · Quinn",
      title: "Every mistake <em>teaches</em>.",
      body: pts([["Quizzes", "each wrong option = a real misconception"], ["Diagnosis", "finds the missing prerequisite"], ["Mini-lesson", "never “weak student”"], ["Timer", "optional countdown"]]),
    },
    fr: {
      eyebrow: "Agent 3 · Quinn",
      title: "Chaque erreur <em>apprend</em>.",
      body: pts([["Quiz", "chaque mauvais choix = une vraie confusion"], ["Diagnostic", "trouve le prérequis manquant"], ["Mini-leçon", "jamais « élève faible »"], ["Chrono", "compte à rebours optionnel"]]),
    },
  },
  {
    id: "alex", chapter: 1, focus: "alex", anim: null,
    en: {
      eyebrow: "Agent 4 · Alex",
      title: "Real exercises, not just <em>quizzes</em>.",
      body: pts([["TD problems", "statement, hints, rubric"], ["AI grading", "score /100 + feedback"], ["Projects", "unlocked when the lesson is done"]]),
    },
    fr: {
      eyebrow: "Agent 4 · Alex",
      title: "De vrais exercices, pas que des <em>quiz</em>.",
      body: pts([["Problèmes de TD", "énoncé, indices, barème"], ["Correction IA", "note /100 + retour"], ["Projets", "débloqués à la fin de la leçon"]]),
    },
  },
  {
    id: "sage", chapter: 1, focus: "sage", anim: null,
    en: {
      eyebrow: "Agent 5 · Sage",
      title: "Revise like you <em>planned</em> it.",
      body: pts([["Summaries", "+ a PDF study pack"], ["Flashcards", "SM-2 spaced repetition"], ["Topic map", "+ a study planner to exam day"]]),
    },
    fr: {
      eyebrow: "Agent 5 · Sage",
      title: "Réviser comme si tu l'avais <em>planifié</em>.",
      body: pts([["Résumés", "+ un pack PDF"], ["Flashcards", "répétition espacée SM-2"], ["Carte des notions", "+ un planning jusqu'à l'examen"]]),
    },
  },
  {
    id: "max", chapter: 1, focus: "max", anim: null,
    en: {
      eyebrow: "Agent 6 · Max",
      title: "The exam <em>before</em> the exam.",
      body: pts([["Timed mock", "8–10 questions, all chapters"], ["Weighted", "by chapter size"], ["Archive", "past papers + student corrections"]]),
    },
    fr: {
      eyebrow: "Agent 6 · Max",
      title: "L'examen <em>avant</em> l'examen.",
      body: pts([["Épreuve chronométrée", "8–10 questions, tous les chapitres"], ["Pondérée", "selon la taille des chapitres"], ["Archive", "anciens sujets + corrections"]]),
    },
  },
  {
    id: "riley", chapter: 1, focus: "riley", anim: null,
    en: {
      eyebrow: "Agent 7 · Riley",
      title: "Nothing ships <em>unchecked</em>.",
      body: pts([["Rules first", "free, instant checks"], ["Then AI review", "independent of the author"], ["Community", "students correct, a teacher validates"]]),
    },
    fr: {
      eyebrow: "Agent 7 · Riley",
      title: "Rien ne sort sans <em>vérification</em>.",
      body: pts([["Règles d'abord", "contrôles gratuits et instantanés"], ["Puis relecture IA", "indépendante de l'auteur"], ["Communauté", "les étudiants corrigent, l'enseignant valide"]]),
    },
  },
  {
    id: "nova", chapter: 1, focus: "nova", anim: "nova",
    en: {
      eyebrow: "Agents 8 & 10 · Nova + Finder",
      title: "One voice, the <em>right</em> expert.",
      body: pts([["Routing", "keywords in 4 languages · 0 tokens"], ["Visible", "“Checking with Sam…”"], ["Finder", "real, verified links only"]]),
    },
    fr: {
      eyebrow: "Agents 8 & 10 · Nova + Finder",
      title: "Une voix, le <em>bon</em> expert.",
      body: pts([["Routage", "mots-clés en 4 langues · 0 token"], ["Transparent", "« Je vérifie avec Sam… »"], ["Finder", "uniquement des liens réels et vérifiés"]]),
    },
  },
  {
    id: "sam", chapter: 1, focus: "sam", anim: "rag",
    en: {
      eyebrow: "Agent 9 · Sam",
      title: "A tutor that asks <em>first</em>.",
      body: `${pts([["Socratic", "question → hint → hint → answer"], ["Explain my mistake", "after a wrong answer"], ["“Still don't get it”", "a different method"]])}
      ${stats([["2–4 s", "per reply"], ["5", "course passages"], ["4", "languages"]])}`,
    },
    fr: {
      eyebrow: "Agent 9 · Sam",
      title: "Un tuteur qui demande <em>d'abord</em>.",
      body: `${pts([["Socratique", "question → indice → indice → réponse"], ["Explique mon erreur", "après une mauvaise réponse"], ["« Toujours pas compris »", "une autre méthode"]])}
      ${stats([["2–4 s", "par réponse"], ["5", "passages du cours"], ["4", "langues"]])}`,
    },
  },
  {
    id: "rag", chapter: 1, focus: "sam", anim: "rag", camVariant: "wide",
    en: {
      eyebrow: "Under the hood · RAG",
      title: "Answers come from <em>your</em> course.",
      body: `<div class="rag">
        <div class="rag-row"><span class="rag-step">1</span><span>Course → 900-char chunks → vectors</span></div>
        <div class="rag-split"><div><b>Keywords</b><span>Postgres full-text</span></div><div><b>Meaning</b><span>pgvector, cosine</span></div></div>
        <div class="rag-row"><span class="rag-step">2</span><span>Fused with RRF → <strong>top 5</strong> passages</span></div>
        <div class="rag-row"><span class="rag-step">3</span><span>Cited <span class="cite">[S3]</span> · fake citations removed</span></div>
      </div>
      <p class="hint">One SQL query · no extra database</p>`,
    },
    fr: {
      eyebrow: "Sous le capot · RAG",
      title: "Les réponses viennent de <em>ton</em> cours.",
      body: `<div class="rag">
        <div class="rag-row"><span class="rag-step">1</span><span>Cours → morceaux de 900 caractères → vecteurs</span></div>
        <div class="rag-split"><div><b>Mots-clés</b><span>plein texte Postgres</span></div><div><b>Sens</b><span>pgvector, cosinus</span></div></div>
        <div class="rag-row"><span class="rag-step">2</span><span>Fusion RRF → <strong>5 meilleurs</strong> passages</span></div>
        <div class="rag-row"><span class="rag-step">3</span><span>Cité <span class="cite">[S3]</span> · fausses citations supprimées</span></div>
      </div>
      <p class="hint">Une seule requête SQL · aucune base en plus</p>`,
    },
  },

  // ───────────────────────────── PLATFORM (inside the sun — see inner.js)
  {
    id: "community", chapter: 2, focus: null, cam: "belt", anim: null,
    en: {
      eyebrow: "Inside the sun · community",
      title: "Students <em>help</em> students.",
      body: `<p class="lead"><strong>Click a student</strong> — watch the question travel until a tutor answers.</p>
      <div class="play">
        <button type="button" class="pbtn" data-act="ask">Ask a question</button>
        <button type="button" class="pbtn ghost" data-act="follows" aria-pressed="false">Show follows</button>
      </div>
      <p class="pstat"><b data-stat="asked">0</b> asked · <b data-stat="answered">0</b> answered <span class="keys"><i style="--c:#efe6d6"></i>student <i style="--c:#a78bfa"></i>tutor <i style="--c:#f2b45a"></i>teacher</span></p>
      ${chips(["Q&A threads", "Votes", "Shared notes", "Glossary FR/AR/Derja", "Exam archive", "Messages", "Study groups"])}`,
    },
    fr: {
      eyebrow: "Au cœur du soleil · communauté",
      title: "Les étudiants <em>s'entraident</em>.",
      body: `<p class="lead"><strong>Clique un étudiant</strong> — sa question voyage jusqu'à la réponse d'un tuteur.</p>
      <div class="play">
        <button type="button" class="pbtn" data-act="ask">Poser une question</button>
        <button type="button" class="pbtn ghost" data-act="follows" aria-pressed="false">Voir les abonnements</button>
      </div>
      <p class="pstat"><b data-stat="asked">0</b> posées · <b data-stat="answered">0</b> résolues <span class="keys"><i style="--c:#efe6d6"></i>étudiant <i style="--c:#a78bfa"></i>tuteur <i style="--c:#f2b45a"></i>enseignant</span></p>
      ${chips(["Questions-réponses", "Votes", "Notes partagées", "Glossaire FR/AR/Derja", "Archive d'examens", "Messages", "Groupes d'étude"])}`,
    },
  },
  {
    id: "insights", chapter: 2, focus: null, cam: "belt", anim: null,
    en: {
      eyebrow: "Inside the sun · class insights",
      title: "The class speaks. <em>Nobody</em> is exposed.",
      body: `<p class="lead"><strong>Click a pillar</strong> to signal “I'm lost here”. It shows only at <strong>5+ students</strong>.</p>
      <div class="play">
        <button type="button" class="pbtn" data-act="signal">New student</button>
        <button type="button" class="pbtn ghost" data-act="again">Same student again</button>
        <button type="button" class="pbtn ghost" data-act="clarify">Teacher clarifies</button>
        <button type="button" class="pbtn ghost" data-act="reset">Reset</button>
      </div>
      <p class="pstat"><b data-stat="sent">0</b> signals · <b data-stat="visible">0</b> visible to the teacher</p>
      <p class="pmsg" data-stat="msg" aria-live="polite"></p>`,
    },
    fr: {
      eyebrow: "Au cœur du soleil · indicateurs",
      title: "La classe parle. <em>Personne</em> n'est exposé.",
      body: `<p class="lead"><strong>Clique un pilier</strong> pour dire « je suis perdu ici ». Visible seulement à <strong>5+ étudiants</strong>.</p>
      <div class="play">
        <button type="button" class="pbtn" data-act="signal">Nouvel étudiant</button>
        <button type="button" class="pbtn ghost" data-act="again">Le même, encore</button>
        <button type="button" class="pbtn ghost" data-act="clarify">L'enseignant clarifie</button>
        <button type="button" class="pbtn ghost" data-act="reset">Réinitialiser</button>
      </div>
      <p class="pstat"><b data-stat="sent">0</b> signaux · <b data-stat="visible">0</b> visibles par l'enseignant</p>
      <p class="pmsg" data-stat="msg" aria-live="polite"></p>`,
    },
  },
  {
    id: "experience", chapter: 2, focus: null, cam: "orbit", anim: null,
    en: {
      eyebrow: "Inside the sun · the experience",
      title: "Made for how you <em>learn</em>.",
      body: `<p class="lead"><strong>Click a crystal</strong> or a card to try it.</p>
      <div class="grid2">
        <button type="button" class="tile" data-act="feat" data-feat="lang"><b>4 languages</b><span>incl. Derja, right-to-left</span></button>
        <button type="button" class="tile" data-act="feat" data-feat="math"><b>Real math</b><span>rendered, not raw LaTeX</span></button>
        <button type="button" class="tile" data-act="feat" data-feat="voice"><b>Read aloud ▸</b><span>female voice, 0.75–1.5×</span></button>
        <button type="button" class="tile" data-act="feat" data-feat="progress"><b>Private progress</b><span>only you see it</span></button>
        <button type="button" class="tile" data-act="feat" data-feat="sources"><b>Any source</b><span>PDF · DOCX · scan · YouTube</span></button>
        <button type="button" class="tile" data-act="feat" data-feat="login"><b>Playful login</b><span>link the concepts</span></button>
      </div>`,
    },
    fr: {
      eyebrow: "Au cœur du soleil · l'expérience",
      title: "Pensé pour ta façon d'<em>apprendre</em>.",
      body: `<p class="lead"><strong>Clique un cristal</strong> ou une carte pour l'essayer.</p>
      <div class="grid2">
        <button type="button" class="tile" data-act="feat" data-feat="lang"><b>4 langues</b><span>dont la Derja, de droite à gauche</span></button>
        <button type="button" class="tile" data-act="feat" data-feat="math"><b>De vraies maths</b><span>rendues, pas du LaTeX brut</span></button>
        <button type="button" class="tile" data-act="feat" data-feat="voice"><b>Voix ▸</b><span>voix féminine, 0,75–1,5×</span></button>
        <button type="button" class="tile" data-act="feat" data-feat="progress"><b>Progression privée</b><span>toi seul la vois</span></button>
        <button type="button" class="tile" data-act="feat" data-feat="sources"><b>Toute source</b><span>PDF · DOCX · scan · YouTube</span></button>
        <button type="button" class="tile" data-act="feat" data-feat="login"><b>Connexion ludique</b><span>relie les notions</span></button>
      </div>`,
    },
  },
  {
    id: "roles", chapter: 2, focus: null, cam: "top", anim: null,
    en: {
      eyebrow: "Inside the sun · roles",
      title: "Four roles, <em>one</em> privacy rule.",
      body: `<div class="role-pick">
        <button type="button" data-act="role" data-role="0" style="--c:#efe6d6">Student</button>
        <button type="button" data-act="role" data-role="1" style="--c:#a78bfa">Tutor</button>
        <button type="button" data-act="role" data-role="2" style="--c:#f2b45a">Teacher</button>
        <button type="button" data-act="role" data-role="3" style="--c:#f08ac8">Moderator</button>
      </div>
      <table class="roles">
        <thead><tr><th></th><th>Stud.</th><th>Tutor</th><th>Teach.</th><th>Mod.</th></tr></thead>
        <tbody>
          <tr><td>Learn & community</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
          <tr><td>Glossary approval</td><td></td><td>✓</td><td>✓</td><td>✓</td></tr>
          <tr><td>Stuck-topics queue</td><td></td><td>✓</td><td>✓</td><td>✓</td></tr>
          <tr><td>Class insights</td><td></td><td></td><td>✓</td><td>✓</td></tr>
          <tr><td>Accept & pin answers</td><td>own</td><td>✓</td><td>✓</td><td>✓</td></tr>
          <tr><td>Validate AI corrections</td><td></td><td></td><td>✓</td><td>✓</td></tr>
          <tr><td>Class roster</td><td></td><td></td><td>✓</td><td></td></tr>
          <tr><td>Moderation & accounts</td><td></td><td></td><td></td><td>✓</td></tr>
        </tbody>
      </table>
      <p class="hint">Teachers never see who signalled, nor anyone's progress.</p>`,
    },
    fr: {
      eyebrow: "Au cœur du soleil · rôles",
      title: "Quatre rôles, <em>une</em> règle de confidentialité.",
      body: `<div class="role-pick">
        <button type="button" data-act="role" data-role="0" style="--c:#efe6d6">Étudiant</button>
        <button type="button" data-act="role" data-role="1" style="--c:#a78bfa">Tuteur</button>
        <button type="button" data-act="role" data-role="2" style="--c:#f2b45a">Enseignant</button>
        <button type="button" data-act="role" data-role="3" style="--c:#f08ac8">Modérateur</button>
      </div>
      <table class="roles">
        <thead><tr><th></th><th>Étud.</th><th>Tuteur</th><th>Ens.</th><th>Mod.</th></tr></thead>
        <tbody>
          <tr><td>Apprendre & communauté</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
          <tr><td>Valider le glossaire</td><td></td><td>✓</td><td>✓</td><td>✓</td></tr>
          <tr><td>Sujets bloqués</td><td></td><td>✓</td><td>✓</td><td>✓</td></tr>
          <tr><td>Indicateurs de classe</td><td></td><td></td><td>✓</td><td>✓</td></tr>
          <tr><td>Accepter & épingler</td><td>les siennes</td><td>✓</td><td>✓</td><td>✓</td></tr>
          <tr><td>Valider les corrections IA</td><td></td><td></td><td>✓</td><td>✓</td></tr>
          <tr><td>Liste de classe</td><td></td><td></td><td>✓</td><td></td></tr>
          <tr><td>Modération & comptes</td><td></td><td></td><td></td><td>✓</td></tr>
        </tbody>
      </table>
      <p class="hint">L'enseignant ne voit jamais qui a signalé, ni la progression de quiconque.</p>`,
    },
  },

  // ───────────────────────────── BUSINESS (ASCII terminal mode — see main.js)
  {
    id: "levers", chapter: 3, focus: null, cam: "far", anim: null, term: "levers",
    en: {
      eyebrow: "Business · LLM cost",
      title: "Every token <em>earns</em> its place.",
      body: `<div class="levers">
        <section><h3><span>0</span>Skip the model</h3><p>Jordan, routing, diagnosis, SM-2 = <b>plain code</b></p></section>
        <section><h3><span>1×</span>Call it once</h3><p><b>1 generation per class</b>, not per student</p></section>
        <section><h3><span>↓</span>Call it small</h3><p>RAG: <b>5 passages</b>, not the whole course</p></section>
        <section><h3><span>⟲</span>Call it cached</h3><p>one course block <b>reused by 6 agents</b></p></section>
      </div>`,
    },
    fr: {
      eyebrow: "Business · coût LLM",
      title: "Chaque token <em>mérite</em> sa place.",
      body: `<div class="levers">
        <section><h3><span>0</span>Pas de modèle</h3><p>Jordan, routage, diagnostic, SM-2 = <b>code simple</b></p></section>
        <section><h3><span>1×</span>Une seule fois</h3><p><b>1 génération par classe</b>, pas par étudiant</p></section>
        <section><h3><span>↓</span>En petit</h3><p>RAG : <b>5 passages</b>, pas tout le cours</p></section>
        <section><h3><span>⟲</span>En cache</h3><p>un bloc de cours <b>réutilisé par 6 agents</b></p></section>
      </div>`,
    },
  },
  {
    id: "calculator", chapter: 3, focus: null, cam: "far", anim: null, calculator: true, term: "cost",
    en: { eyebrow: "Business · what it costs", title: "Cents per student, <em>per month</em>.", body: `<div id="calc"></div>` },
    fr: { eyebrow: "Business · ce que ça coûte", title: "Quelques centimes par étudiant, <em>par mois</em>.", body: `<div id="calc"></div>` },
  },
  {
    id: "production", chapter: 3, focus: null, cam: "orbit", anim: "workflow", term: "health",
    en: {
      eyebrow: "Production ready",
      title: "Built to <em>stay up</em>.",
      body: `<div class="grid2">
        <div class="tile"><b>Reliable</b><span>fallback models · retries</span></div>
        <div class="tile"><b>Any provider</b><span>Claude · Gemini · demo</span></div>
        <div class="tile"><b>Observable</b><span>tokens, latency & $ cost per call</span></div>
        <div class="tile"><b>Secure</b><span>JWT cookie · CSRF · rate limits</span></div>
        <div class="tile"><b>Private</b><span>anonymity enforced in SQL</span></div>
        <div class="tile"><b>Validated</b><span>schema-checked AI output · strict TypeScript</span></div>
      </div>`,
    },
    fr: {
      eyebrow: "Prêt pour la production",
      title: "Conçu pour <em>tenir</em>.",
      body: `<div class="grid2">
        <div class="tile"><b>Fiable</b><span>modèles de secours · relances</span></div>
        <div class="tile"><b>Multi-fournisseur</b><span>Claude · Gemini · démo</span></div>
        <div class="tile"><b>Observable</b><span>tokens, latence & coût en $ par appel</span></div>
        <div class="tile"><b>Sécurisé</b><span>cookie JWT · CSRF · limites</span></div>
        <div class="tile"><b>Confidentiel</b><span>anonymat imposé en SQL</span></div>
        <div class="tile"><b>Validé</b><span>sorties IA vérifiées par schéma · TypeScript strict</span></div>
      </div>`,
    },
  },
  {
    id: "model", chapter: 3, focus: null, cam: "hero", anim: null, term: "plan",
    en: {
      eyebrow: "Business model",
      title: "Free for students, <em>paid by faculties</em>.",
      body: `${pts([["Students", "freemium — core learning free"], ["Faculties", "licence: insights + teacher tools"], ["Why it works", "~$0.04 of LLM cost per student"]])}
      <p class="limits"><b>Honest limits:</b> AI can still err · OCR & Derja vary · under 5 students = no insights</p>`,
    },
    fr: {
      eyebrow: "Modèle économique",
      title: "Gratuit pour les étudiants, <em>payé par les facultés</em>.",
      body: `${pts([["Étudiants", "freemium — l'essentiel gratuit"], ["Facultés", "licence : indicateurs + outils enseignants"], ["Pourquoi ça tient", "~0,04 $ de LLM par étudiant"]])}
      <p class="limits"><b>Limites honnêtes :</b> l'IA peut se tromper · OCR & Derja variables · moins de 5 étudiants = pas d'indicateurs</p>`,
    },
  },

  // ───────────────────────────── CLOSE
  {
    id: "close", chapter: 4, focus: null, cam: "hero", anim: "workflow",
    en: {
      eyebrow: "LessonForge",
      title: "Comprendre. Enrichir. <em>Améliorer.</em>",
      body: `<div class="triad">
        <div><b>COMPRENDRE</b><span>structure, tutor in your language, revision</span></div>
        <div><b>ENRICHIR</b><span>exercises, projects, community resources</span></div>
        <div><b>AMÉLIORER</b><span>diagnosis, quality checks, class insights</span></div>
      </div>
      <div class="cta"><a class="btn primary" href="${REPO}" target="_blank" rel="noopener">View the code on GitHub</a></div>`,
    },
    fr: {
      eyebrow: "LessonForge",
      title: "Comprendre. Enrichir. <em>Améliorer.</em>",
      body: `<div class="triad">
        <div><b>COMPRENDRE</b><span>structure, tuteur dans ta langue, révisions</span></div>
        <div><b>ENRICHIR</b><span>exercices, projets, ressources partagées</span></div>
        <div><b>AMÉLIORER</b><span>diagnostic, contrôles qualité, indicateurs</span></div>
      </div>
      <div class="cta"><a class="btn primary" href="${REPO}" target="_blank" rel="noopener">Voir le code sur GitHub</a></div>`,
    },
  },
];
