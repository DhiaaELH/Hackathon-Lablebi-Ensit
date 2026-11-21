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
  },
  fr: {
    explore: "Explorer", present: "Présenter", prev: "Précédent", next: "Suivant",
    exploreHint: "Glisse pour tourner · molette pour zoomer · clique une planète pour ouvrir sa slide · E pour revenir",
    keys: "← → pour naviguer · E explorer · F plein écran · P imprimer en PDF",
    open: "Ouvrir la slide",
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

export const SLIDES = [
  // ───────────────────────────── INTRO
  {
    id: "title", chapter: 0, focus: null, cam: "hero", anim: "workflow",
    en: {
      eyebrow: "LessonForge · ENSIT hackathon",
      title: "Your course notes, <em>finally</em> alive.",
      body: `<p class="lead">Ten AI agents orbit one thing: <strong>your course</strong>. Upload a PDF, a photo of your notes or a YouTube lecture — LessonForge structures it, trains you with real exercises, explains in Derja, French, English or Arabic, and shows the class where it gets stuck without ever exposing who.</p>
      ${chips(["COMPRENDRE", "ENRICHIR", "AMÉLIORER"])}
      <p class="hint">Press <kbd>→</kbd> to start · <kbd>E</kbd> to explore the system yourself</p>`,
    },
    fr: {
      eyebrow: "LessonForge · Hackathon ENSIT",
      title: "Tes notes de cours, <em>enfin</em> vivantes.",
      body: `<p class="lead">Dix agents IA gravitent autour d'une seule chose : <strong>ton cours</strong>. Importe un PDF, une photo de tes notes ou un cours YouTube — LessonForge le structure, t'entraîne avec de vrais exercices, t'explique en Derja, français, anglais ou arabe, et montre à la classe où ça bloque sans jamais exposer qui.</p>
      ${chips(["COMPRENDRE", "ENRICHIR", "AMÉLIORER"])}
      <p class="hint">Appuie sur <kbd>→</kbd> pour commencer · <kbd>E</kbd> pour explorer le système</p>`,
    },
  },
  {
    id: "problem", chapter: 0, focus: null, cam: "far", anim: null,
    en: {
      eyebrow: "The problem",
      title: "A dense PDF is not a <em>lesson</em>.",
      body: `${facts([
        "<strong>Polycopiés without practice.</strong> Most courses arrive as slides or scanned notes with few corrected exercises.",
        "<strong>Taught in French, thought in Derja.</strong> Students often understand the concept faster in the language they actually think in.",
        "<strong>Nobody wants to be the one who asks.</strong> The teacher only discovers what the class missed at the exam.",
        "<strong>Generic chatbots hallucinate.</strong> They answer from the internet, not from <em>your</em> teacher's course, and cite nothing.",
      ])}
      <p class="muted small">We did not run a survey, so this deck contains no invented user statistics.</p>`,
    },
    fr: {
      eyebrow: "Le problème",
      title: "Un PDF dense n'est pas une <em>leçon</em>.",
      body: `${facts([
        "<strong>Des polycopiés sans pratique.</strong> La plupart des cours arrivent en slides ou en notes scannées, avec peu d'exercices corrigés.",
        "<strong>Enseigné en français, pensé en Derja.</strong> On comprend souvent plus vite dans la langue dans laquelle on pense.",
        "<strong>Personne ne veut être celui qui demande.</strong> L'enseignant découvre ce que la classe n'a pas compris… à l'examen.",
        "<strong>Les chatbots génériques hallucinent.</strong> Ils répondent depuis internet, pas depuis le cours de <em>ton</em> enseignant, sans citer de source.",
      ])}
      <p class="muted small">Nous n'avons pas mené d'enquête : cette présentation ne contient aucune statistique utilisateur inventée.</p>`,
    },
  },
  {
    id: "system", chapter: 0, focus: null, cam: "top", anim: "workflow",
    en: {
      eyebrow: "The system",
      title: "Everything <em>orbits</em> your course.",
      body: `<p>Each planet is a specialist agent with one job and a validated output schema. Their distance from the sun follows the order they act in.</p>
      <div class="legend">
        <div><span class="sw" style="--c:#f2b45a"></span><strong>Sun — Jordan</strong><span>coordinates every agent, holds the course source</span></div>
        <div><span class="sw" style="--c:#5fb3a8"></span><strong>Inner orbits</strong><span>Clara · Quinn · Alex · Sage · Max · Riley build the course</span></div>
        <div><span class="sw" style="--c:#9aa7a3"></span><strong>Asteroid belt</strong><span>the community: students, questions, resources, signals</span></div>
        <div><span class="sw" style="--c:#7aa7dc"></span><strong>Outer orbits</strong><span>Sam, Nova and the resource finder help you live</span></div>
      </div>
      <p class="muted small">In the app only Nova and Sam appear by name; the others are shown by what they do. Click any planet — or press <kbd>E</kbd> — to fly there.</p>`,
    },
    fr: {
      eyebrow: "Le système",
      title: "Tout <em>gravite</em> autour de ton cours.",
      body: `<p>Chaque planète est un agent spécialisé avec une seule mission et un format de sortie validé. Leur distance au soleil suit l'ordre dans lequel ils agissent.</p>
      <div class="legend">
        <div><span class="sw" style="--c:#f2b45a"></span><strong>Soleil — Jordan</strong><span>coordonne tous les agents, porte la source du cours</span></div>
        <div><span class="sw" style="--c:#5fb3a8"></span><strong>Orbites internes</strong><span>Clara · Quinn · Alex · Sage · Max · Riley construisent le cours</span></div>
        <div><span class="sw" style="--c:#9aa7a3"></span><strong>Ceinture d'astéroïdes</strong><span>la communauté : étudiants, questions, ressources, signaux</span></div>
        <div><span class="sw" style="--c:#7aa7dc"></span><strong>Orbites externes</strong><span>Sam, Nova et le chercheur de ressources t'aident en direct</span></div>
      </div>
      <p class="muted small">Dans l'application, seuls Nova et Sam apparaissent par leur nom ; les autres sont présentés par ce qu'ils font. Clique une planète — ou appuie sur <kbd>E</kbd> — pour y voler.</p>`,
    },
  },

  // ───────────────────────────── WORKFLOW & AGENTS
  {
    id: "workflow", chapter: 1, focus: null, cam: "workflow", anim: "workflow",
    en: {
      eyebrow: "The workflow",
      title: "From upload to a full course in <em>~25 s</em>.",
      body: `${flow([
        ["Upload", "PDF, DOCX, pasted text, photo or scan (OCR), YouTube transcript"],
        ["Index", "chunked, embedded and stored in PostgreSQL + pgvector"],
        ["Clara", "chapters, objectives, concepts, prerequisite graph — all cited"],
        ["Quinn · Alex · Sage · Max", "run in parallel: quizzes, full exercises, revision, mock exam"],
        ["Riley", "rule checks, then an independent AI review"],
        ["Published", "the whole class learns from it — generated once"],
      ])}
      <p class="muted small">25 s measured end-to-end on our test course with Gemini; the comets show it live.</p>`,
    },
    fr: {
      eyebrow: "Le workflow",
      title: "De l'import au cours complet en <em>~25 s</em>.",
      body: `${flow([
        ["Import", "PDF, DOCX, texte collé, photo ou scan (OCR), transcription YouTube"],
        ["Indexation", "découpé, vectorisé et stocké dans PostgreSQL + pgvector"],
        ["Clara", "chapitres, objectifs, concepts, graphe de prérequis — tout cité"],
        ["Quinn · Alex · Sage · Max", "en parallèle : quiz, exercices complets, révision, examen blanc"],
        ["Riley", "contrôles par règles, puis relecture IA indépendante"],
        ["Publié", "toute la classe en profite — généré une seule fois"],
      ])}
      <p class="muted small">25 s mesurées de bout en bout sur notre cours de test avec Gemini ; les comètes le montrent en direct.</p>`,
    },
  },
  {
    id: "jordan", chapter: 1, focus: "sun", anim: "workflow",
    en: {
      eyebrow: "Agent 1 · Jordan — coordinator",
      title: "The sun is <em>plain code</em>.",
      body: `<p>Jordan is deliberately not an LLM: orchestration is deterministic Python, so it costs zero tokens and never improvises.</p>
      ${facts([
        "Persists every run, task and event — the UI shows each agent's live status.",
        "Runs Clara first, then four agents in parallel, then Riley.",
        "Retries transient errors with exponential backoff that honours the provider's <em>retry-after</em>.",
        "A failed agent never breaks the course: the run is marked <em>partial</em> and only the failed agents are retried.",
        "Answers Nova when you ask “is my course ready?”.",
      ])}
      <p class="src">${code("backend/app/workflows/jordan.py")}</p>`,
    },
    fr: {
      eyebrow: "Agent 1 · Jordan — coordinateur",
      title: "Le soleil, c'est du <em>code simple</em>.",
      body: `<p>Jordan n'est volontairement pas un LLM : l'orchestration est du Python déterministe, donc zéro token et aucune improvisation.</p>
      ${facts([
        "Enregistre chaque exécution, tâche et événement — l'interface montre le statut de chaque agent en direct.",
        "Lance Clara d'abord, puis quatre agents en parallèle, puis Riley.",
        "Réessaie les erreurs passagères avec un délai exponentiel qui respecte le <em>retry-after</em> du fournisseur.",
        "Un agent en échec ne casse jamais le cours : l'exécution passe en <em>partielle</em> et seuls les agents échoués sont relancés.",
        "Répond à Nova quand tu demandes « mon cours est prêt ? ».",
      ])}
      <p class="src">${code("backend/app/workflows/jordan.py")}</p>`,
    },
  },
  {
    id: "clara", chapter: 1, focus: "clara", anim: null,
    en: {
      eyebrow: "Agent 2 · Clara — course analyst",
      title: "Turns a PDF into a <em>map</em>.",
      body: `${facts([
        "Chapters, sections, learning objectives and key concepts.",
        "A prerequisite graph between concepts (cycle-safe) that powers the interactive topic map and gap diagnosis.",
        "Every item carries citations like <span class=\"cite\">[S4]</span>; references that don't exist in your course are thrown away.",
        "Reads the whole course once, as a cached block shared with every other agent.",
      ])}
      <p class="src">${code("agents/prompts.py · clara")} ${code("jordan.persist_structure")}</p>`,
    },
    fr: {
      eyebrow: "Agent 2 · Clara — analyste du cours",
      title: "Transforme un PDF en <em>carte</em>.",
      body: `${facts([
        "Chapitres, sections, objectifs d'apprentissage et concepts clés.",
        "Un graphe de prérequis entre concepts (sans cycles) qui alimente la carte interactive et le diagnostic des lacunes.",
        "Chaque élément porte des citations comme <span class=\"cite\">[S4]</span> ; les références absentes du cours sont rejetées.",
        "Lit le cours entier une seule fois, dans un bloc mis en cache partagé avec tous les autres agents.",
      ])}
      <p class="src">${code("agents/prompts.py · clara")} ${code("jordan.persist_structure")}</p>`,
    },
  },
  {
    id: "quinn", chapter: 1, focus: "quinn", anim: null,
    en: {
      eyebrow: "Agent 3 · Quinn — quizzes & diagnosis",
      title: "Every wrong answer <em>teaches</em> something.",
      body: `${facts([
        "Multiple-choice questions per section, each distractor tied to a real misconception.",
        "Your answers feed a plain-code walk of Clara's prerequisite graph to find the likely gap.",
        "You get the evidence and a short mini-lesson — never a label like “weak student”.",
        "Keyboard-friendly practice with instant feedback, read-aloud and an optional countdown that auto-submits.",
      ])}
      <p class="src">${code("services/learning.py · diagnose_gaps")}</p>`,
    },
    fr: {
      eyebrow: "Agent 3 · Quinn — quiz & diagnostic",
      title: "Chaque erreur <em>apprend</em> quelque chose.",
      body: `${facts([
        "Des QCM par section, chaque mauvais choix lié à une vraie confusion fréquente.",
        "Tes réponses alimentent un parcours en code simple du graphe de prérequis de Clara pour trouver la lacune probable.",
        "Tu reçois la preuve et une mini-leçon — jamais une étiquette « élève faible ».",
        "Entraînement au clavier avec retour immédiat, lecture à voix haute et compte à rebours optionnel qui soumet automatiquement.",
      ])}
      <p class="src">${code("services/learning.py · diagnose_gaps")}</p>`,
    },
  },
  {
    id: "alex", chapter: 1, focus: "alex", anim: null,
    en: {
      eyebrow: "Agent 4 · Alex — exercises & projects",
      title: "Real exercises, not just <em>quizzes</em>.",
      body: `${facts([
        "Per section: two quick MCQs plus one full TD-style problem with a statement, progressive hints and a rubric.",
        "You write your own solution; Sam grades it against the rubric and your course passages, with a score out of 100 and feedback.",
        "The reference solution stays on the server until you give up.",
        "When you finish a lesson, Alex proposes applied projects: goal, steps, difficulty, effort, tools and success criteria — save, start, complete or dismiss.",
      ])}
      <p class="src">${code("POST /questions/{id}/open-answer")} ${code("roles.grade_open")}</p>`,
    },
    fr: {
      eyebrow: "Agent 4 · Alex — exercices & projets",
      title: "De vrais exercices, pas que des <em>quiz</em>.",
      body: `${facts([
        "Par section : deux QCM rapides et un vrai problème type TD avec énoncé, indices progressifs et barème.",
        "Tu rédiges ta solution ; Sam la corrige selon le barème et les passages du cours, avec une note sur 100 et un retour.",
        "La correction de référence reste sur le serveur jusqu'à ce que tu abandonnes.",
        "À la fin d'une leçon, Alex propose des projets appliqués : objectif, étapes, difficulté, effort, outils et critères de réussite.",
      ])}
      <p class="src">${code("POST /questions/{id}/open-answer")} ${code("roles.grade_open")}</p>`,
    },
  },
  {
    id: "sage", chapter: 1, focus: "sage", anim: null,
    en: {
      eyebrow: "Agent 5 · Sage — revision maker",
      title: "Revise like you <em>planned</em> it.",
      body: `${facts([
        "Section summaries with math rendered properly (KaTeX) and a downloadable PDF study pack.",
        "3D flip flashcards with SM-2 spaced repetition: cards come back exactly when you're about to forget them.",
        "An interactive topic map built from the prerequisite graph.",
        "A study planner that spreads sections up to your exam date.",
      ])}
      <p class="src">${code("services/pdf.py")} ${code("api/growth.py · SM-2")}</p>`,
    },
    fr: {
      eyebrow: "Agent 5 · Sage — fiches de révision",
      title: "Réviser comme si tu l'avais <em>planifié</em>.",
      body: `${facts([
        "Résumés par section avec les maths bien rendues (KaTeX) et un pack PDF téléchargeable.",
        "Flashcards 3D avec répétition espacée SM-2 : chaque carte revient juste avant que tu l'oublies.",
        "Une carte des notions interactive construite à partir du graphe de prérequis.",
        "Un planning de révision réparti jusqu'à ta date d'examen.",
      ])}
      <p class="src">${code("services/pdf.py")} ${code("api/growth.py · SM-2")}</p>`,
    },
  },
  {
    id: "max", chapter: 1, focus: "max", anim: null,
    en: {
      eyebrow: "Agent 6 · Max — mock exams",
      title: "Sit the exam <em>before</em> the exam.",
      body: `${facts([
        "A timed mock paper of 8–10 questions covering every chapter, weighted by how much material each chapter has.",
        "Points, explanations and notes on why each wrong option is tempting — with the same citations and quality gate as everything else.",
        "For written practice, each section also has Alex's full problems.",
        "Next to the community exam archive: past papers by faculty, subject, year and session, with student corrections.",
      ])}`,
    },
    fr: {
      eyebrow: "Agent 6 · Max — examens blancs",
      title: "Passer l'examen <em>avant</em> l'examen.",
      body: `${facts([
        "Une épreuve chronométrée de 8 à 10 questions sur tous les chapitres, pondérée selon le volume de chaque chapitre.",
        "Barème, explications et notes sur pourquoi chaque mauvaise option est tentante — avec les mêmes citations et le même contrôle qualité.",
        "Pour l'entraînement rédigé, chaque section a aussi les problèmes complets d'Alex.",
        "À côté de l'archive d'examens de la communauté : anciens sujets par faculté, matière, année et session, avec corrections d'étudiants.",
      ])}`,
    },
  },
  {
    id: "riley", chapter: 1, focus: "riley", anim: null,
    en: {
      eyebrow: "Agent 7 · Riley — quality checker",
      title: "Nothing ships <em>unchecked</em>.",
      body: `${facts([
        "<strong>Rules first</strong>, free and instant: 4 distinct choices, a valid answer key that isn't leaked in the question, real citations, known concepts, and every problem has a worked solution and a rubric.",
        "<strong>Then an independent AI review</strong> of what passed, acting separately from the agent that wrote it.",
        "Checks terminology against the reviewed multilingual glossary.",
        "Students can still endorse or correct any question; a teacher's single vote accepts a correction.",
      ])}
      <p class="src">${code("roles.riley_rules")} ${code("roles.riley_review")}</p>`,
    },
    fr: {
      eyebrow: "Agent 7 · Riley — contrôle qualité",
      title: "Rien ne sort sans <em>vérification</em>.",
      body: `${facts([
        "<strong>Les règles d'abord</strong>, gratuites et instantanées : 4 choix distincts, une bonne réponse valide et non dévoilée dans l'énoncé, de vraies citations, des concepts connus, et chaque problème a une solution rédigée et un barème.",
        "<strong>Puis une relecture IA indépendante</strong> de ce qui a passé, séparée de l'agent qui l'a écrit.",
        "Vérifie la terminologie avec le glossaire multilingue relu.",
        "Les étudiants peuvent toujours valider ou corriger une question ; un seul vote d'enseignant accepte une correction.",
      ])}
      <p class="src">${code("roles.riley_rules")} ${code("roles.riley_review")}</p>`,
    },
  },
  {
    id: "nova", chapter: 1, focus: "nova", anim: "nova",
    en: {
      eyebrow: "Agents 8 & 10 · Nova & the resource finder",
      title: "One voice, the <em>right</em> specialist.",
      body: `${facts([
        "Nova is the conversation you see. She routes each message to the one agent that owns it — and shows it: “Checking this with Sam…”.",
        "Routing uses keyword rules in French, English, Arabic and Derja: <strong>zero tokens</strong>, instant.",
        "Status questions go to Jordan; she never pretends a specialist answered.",
        "The resource finder (Nova's moon) suggests videos and links via Google Search grounding — only links actually returned, then checked. If search is unavailable, it says so instead of inventing URLs.",
      ])}
      <p class="src">${code("api/nova.py · ROUTES")} ${code("services/gemini_media.py")}</p>`,
    },
    fr: {
      eyebrow: "Agents 8 & 10 · Nova & le chercheur de ressources",
      title: "Une seule voix, le <em>bon</em> spécialiste.",
      body: `${facts([
        "Nova, c'est la conversation que tu vois. Elle envoie chaque message à l'agent responsable — et le montre : « Je vérifie avec Sam… ».",
        "Le routage utilise des règles de mots-clés en français, anglais, arabe et Derja : <strong>zéro token</strong>, instantané.",
        "Les questions de statut vont à Jordan ; elle ne fait jamais semblant qu'un spécialiste a répondu.",
        "Le chercheur de ressources (la lune de Nova) propose vidéos et liens via Google Search — uniquement des liens réellement renvoyés, puis vérifiés. Sinon, il le dit au lieu d'inventer des URLs.",
      ])}
      <p class="src">${code("api/nova.py · ROUTES")} ${code("services/gemini_media.py")}</p>`,
    },
  },
  {
    id: "sam", chapter: 1, focus: "sam", anim: "rag",
    en: {
      eyebrow: "Agent 9 · Sam — tutor",
      title: "A tutor that asks <em>first</em>.",
      body: `${facts([
        "<strong>Socratic by default:</strong> what do you think? → hint 1 → hint 2 → the answer, only if you ask.",
        "<strong>Explain my mistake</strong> after a wrong answer — it sees what you picked and why it's tempting.",
        "<strong>“I still don't get it”</strong> forces a materially different method, not the same words again.",
        "Answers in your language and script — Derja in Arabic letters or Arabizi included.",
        "Grounded in your course passages with citations; if the course doesn't cover it, Sam says so.",
      ])}
      ${stats([["~2–4 s", "tutor reply, fast tier"], ["5", "course passages per answer"], ["20", "turn history window"]])}`,
    },
    fr: {
      eyebrow: "Agent 9 · Sam — tuteur",
      title: "Un tuteur qui demande <em>d'abord</em>.",
      body: `${facts([
        "<strong>Socratique par défaut :</strong> qu'en penses-tu ? → indice 1 → indice 2 → la réponse, seulement si tu la demandes.",
        "<strong>Explique mon erreur</strong> après une mauvaise réponse — il voit ce que tu as choisi et pourquoi c'est tentant.",
        "<strong>« Je ne comprends toujours pas »</strong> impose une méthode vraiment différente, pas les mêmes mots.",
        "Répond dans ta langue et ton écriture — Derja en lettres arabes ou en Arabizi compris.",
        "Ancré dans les passages de ton cours avec citations ; si le cours ne le couvre pas, Sam le dit.",
      ])}
      ${stats([["~2–4 s", "réponse du tuteur, tier rapide"], ["5", "passages du cours par réponse"], ["20", "tours d'historique gardés"]])}`,
    },
  },
  {
    id: "rag", chapter: 1, focus: "sam", anim: "rag", camVariant: "wide",
    en: {
      eyebrow: "Under the hood · hybrid RAG",
      title: "Answers come from <em>your</em> course.",
      body: `<div class="rag">
        <div class="rag-row"><span class="rag-step">Index</span><span>chunks of ~900 characters (120 overlap, headings kept) → 384-d vectors → PostgreSQL</span></div>
        <div class="rag-split">
          <div><b>Keyword search</b><span>tsvector + GIN index, top 24</span></div>
          <div><b>Vector search</b><span>pgvector HNSW, cosine, top 24</span></div>
        </div>
        <div class="rag-row"><span class="rag-step">Fuse</span><span>Reciprocal Rank Fusion: Σ 1 / (60 + rank) → top 5 passages</span></div>
        <div class="rag-row"><span class="rag-step">Answer</span><span>passages tagged <span class="cite">[S3]</span> → LLM → any citation not in your course is removed</span></div>
      </div>
      ${facts([
        "One SQL query, no extra vector database. Searches are scoped to courses you're allowed to see.",
        "Used by the tutor (top 5) and the exercise grader (top 3). Course generation reads the full course instead, so its prompt can be cached.",
      ])}
      <p class="src">${code("retrieval/search.py · hybrid_search")}</p>`,
    },
    fr: {
      eyebrow: "Sous le capot · RAG hybride",
      title: "Les réponses viennent de <em>ton</em> cours.",
      body: `<div class="rag">
        <div class="rag-row"><span class="rag-step">Index</span><span>morceaux d'environ 900 caractères (120 de chevauchement, titres gardés) → vecteurs 384-d → PostgreSQL</span></div>
        <div class="rag-split">
          <div><b>Recherche par mots</b><span>tsvector + index GIN, top 24</span></div>
          <div><b>Recherche vectorielle</b><span>pgvector HNSW, cosinus, top 24</span></div>
        </div>
        <div class="rag-row"><span class="rag-step">Fusion</span><span>Reciprocal Rank Fusion : Σ 1 / (60 + rang) → 5 meilleurs passages</span></div>
        <div class="rag-row"><span class="rag-step">Réponse</span><span>passages étiquetés <span class="cite">[S3]</span> → LLM → toute citation absente du cours est supprimée</span></div>
      </div>
      ${facts([
        "Une seule requête SQL, pas de base vectorielle en plus. La recherche est limitée aux cours que tu as le droit de voir.",
        "Utilisé par le tuteur (top 5) et le correcteur d'exercices (top 3). La génération lit le cours entier, pour que son prompt soit mis en cache.",
      ])}
      <p class="src">${code("retrieval/search.py · hybrid_search")}</p>`,
    },
  },

  // ───────────────────────────── PLATFORM
  {
    id: "community", chapter: 2, focus: null, cam: "belt", anim: "belt",
    en: {
      eyebrow: "The asteroid belt · community",
      title: "Students <em>enrich</em> every course.",
      body: `<div class="cols">
        ${facts([
          "Chapter threads with votes and accepted answers",
          "“This chapter is hard” votes",
          "Shared notes and resources with ratings",
          "Multilingual glossary FR / AR / Derja, reviewed",
          "Exam archive with community corrections",
        ])}
        ${facts([
          "People search, follow, private messages",
          "Study groups with an exam date",
          "Who-to-follow suggestions with their reasons",
          "Peer tutors answer a queue of stuck topics",
          "Delete your own posts, resources or courses; reports, blocks and moderation",
        ])}
      </div>
      <p class="muted small">Privacy by default: only opt-in profile fields are searchable, and progress is never public.</p>`,
    },
    fr: {
      eyebrow: "La ceinture d'astéroïdes · communauté",
      title: "Les étudiants <em>enrichissent</em> chaque cours.",
      body: `<div class="cols">
        ${facts([
          "Discussions par chapitre avec votes et réponses acceptées",
          "Votes « ce chapitre est difficile »",
          "Notes et ressources partagées, notées",
          "Glossaire multilingue FR / AR / Derja, relu",
          "Archive d'examens avec corrections de la communauté",
        ])}
        ${facts([
          "Recherche de profils, abonnements, messages privés",
          "Groupes d'étude avec date d'examen",
          "Suggestions de profils à suivre, avec la raison",
          "Les tuteurs pairs répondent aux sujets bloqués",
          "Supprimer ses messages, ressources ou cours ; signalements, blocages et modération",
        ])}
      </div>
      <p class="muted small">Confidentialité par défaut : seuls les champs de profil choisis sont cherchables, et la progression n'est jamais publique.</p>`,
    },
  },
  {
    id: "insights", chapter: 2, focus: null, cam: "belt", anim: "insights",
    en: {
      eyebrow: "Class insights",
      title: "The class speaks. <em>Nobody</em> is exposed.",
      body: `${facts([
        "A student taps “I didn't understand this part” and picks a reason — anonymously.",
        "Signals are stored with no link to the user: an HMAC token prevents double counting, timestamps keep only the day.",
        "The database itself only returns a count once <strong>at least 5 different students</strong> contributed — the lone dots in the belt stay dark, groups of 5+ light up.",
        "Teachers see a confusion heatmap, top reasons, a weekly trend and the most-missed questions — then post a clarification or extra exercise, and opted-in students are notified. A Class tab manages the roster, co-teachers and announcements.",
        "Topics where ≥ 5 students are stuck and no teacher answered within 24 h go to the peer-tutor queue.",
      ])}
      <p class="src">${code("sql/post_schema.sql · HAVING ≥ greatest(p_min, 5)")}</p>`,
    },
    fr: {
      eyebrow: "Indicateurs de classe",
      title: "La classe parle. <em>Personne</em> n'est exposé.",
      body: `${facts([
        "Un étudiant touche « je n'ai pas compris cette partie » et choisit une raison — anonymement.",
        "Les signaux sont stockés sans lien avec l'utilisateur : un jeton HMAC évite le double comptage, la date ne garde que le jour.",
        "La base elle-même ne renvoie un chiffre qu'à partir de <strong>5 étudiants différents</strong> — les points isolés de la ceinture restent sombres, les groupes de 5+ s'allument.",
        "L'enseignant voit une carte de confusion, les raisons principales, l'évolution par semaine et les questions les plus ratées — puis publie une clarification ou un exercice, et les étudiants abonnés sont notifiés. Un onglet Classe gère la liste des étudiants, les co-enseignants et les annonces.",
        "Les sujets où ≥ 5 étudiants bloquent sans réponse d'enseignant en 24 h vont à la file des tuteurs pairs.",
      ])}
      <p class="src">${code("sql/post_schema.sql · HAVING ≥ greatest(p_min, 5)")}</p>`,
    },
  },
  {
    id: "experience", chapter: 2, focus: null, cam: "orbit", anim: null,
    en: {
      eyebrow: "The experience",
      title: "Built for how Tunisian students <em>actually</em> learn.",
      body: `<div class="grid2">
        <div class="tile"><b>4 languages</b><span>French, English, Arabic and Derja, with full right-to-left layout</span></div>
        <div class="tile"><b>Real math</b><span>LaTeX rendered with KaTeX, converted to words for audio and to text in the PDF</span></div>
        <div class="tile"><b>Read aloud</b><span>clear female voice, speed 0.75× to 1.5×, formulas spoken as words</span></div>
        <div class="tile"><b>Private progress</b><span>per-section progress, gap diagnosis, recommendations with a reason</span></div>
        <div class="tile"><b>Any source</b><span>PDF, DOCX, scans via OCR, pasted text, YouTube lectures</span></div>
        <div class="tile"><b>Playful login</b><span>an interactive constellation of concepts — link two from the same subject</span></div>
      </div>`,
    },
    fr: {
      eyebrow: "L'expérience",
      title: "Pensé pour la façon dont les étudiants tunisiens apprennent <em>vraiment</em>.",
      body: `<div class="grid2">
        <div class="tile"><b>4 langues</b><span>français, anglais, arabe et Derja, avec mise en page de droite à gauche</span></div>
        <div class="tile"><b>De vraies maths</b><span>LaTeX rendu avec KaTeX, converti en mots pour l'audio et en texte dans le PDF</span></div>
        <div class="tile"><b>Lecture à voix haute</b><span>voix féminine claire, vitesse 0,75× à 1,5×, formules lues en mots</span></div>
        <div class="tile"><b>Progression privée</b><span>progression par section, diagnostic des lacunes, recommandations expliquées</span></div>
        <div class="tile"><b>Toute source</b><span>PDF, DOCX, scans via OCR, texte collé, cours YouTube</span></div>
        <div class="tile"><b>Connexion ludique</b><span>une constellation interactive de concepts — relie deux notions de la même matière</span></div>
      </div>`,
    },
  },
  {
    id: "roles", chapter: 2, focus: null, cam: "top", anim: null,
    en: {
      eyebrow: "Who does what",
      title: "Four roles, <em>one</em> privacy rule.",
      body: `<table class="roles">
        <thead><tr><th></th><th>Student</th><th>Peer tutor</th><th>Teacher</th><th>Moderator</th></tr></thead>
        <tbody>
          <tr><td>Courses, agents, tutor, practice, community</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
          <tr><td>Approve glossary terms</td><td></td><td>✓</td><td>✓</td><td>✓</td></tr>
          <tr><td>Stuck-topics queue</td><td></td><td>✓</td><td>✓</td><td>✓</td></tr>
          <tr><td>Class insights & clarifications</td><td></td><td></td><td>✓</td><td>✓</td></tr>
          <tr><td>Accept answers (never your own) & pin threads</td><td>own question</td><td>✓</td><td>✓</td><td>✓</td></tr>
          <tr><td>One vote accepts a correction of AI content</td><td></td><td></td><td>✓</td><td>✓</td></tr>
          <tr><td>Class roster, co-teachers, announcements</td><td></td><td></td><td>✓</td><td></td></tr>
          <tr><td>Moderation, accounts & roles, platform stats</td><td></td><td></td><td></td><td>✓</td></tr>
        </tbody>
      </table>
      <p class="muted small">Teachers never see who sent a signal, nor any student's individual progress.</p>`,
    },
    fr: {
      eyebrow: "Qui fait quoi",
      title: "Quatre rôles, <em>une</em> règle de confidentialité.",
      body: `<table class="roles">
        <thead><tr><th></th><th>Étudiant</th><th>Tuteur pair</th><th>Enseignant</th><th>Modérateur</th></tr></thead>
        <tbody>
          <tr><td>Cours, agents, tuteur, pratique, communauté</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
          <tr><td>Valider le glossaire</td><td></td><td>✓</td><td>✓</td><td>✓</td></tr>
          <tr><td>File des sujets bloqués</td><td></td><td>✓</td><td>✓</td><td>✓</td></tr>
          <tr><td>Indicateurs de classe & clarifications</td><td></td><td></td><td>✓</td><td>✓</td></tr>
          <tr><td>Accepter une réponse (jamais la sienne) & épingler</td><td>sa question</td><td>✓</td><td>✓</td><td>✓</td></tr>
          <tr><td>Un vote suffit pour valider une correction de l'IA</td><td></td><td></td><td>✓</td><td>✓</td></tr>
          <tr><td>Liste de classe, co-enseignants, annonces</td><td></td><td></td><td>✓</td><td></td></tr>
          <tr><td>Modération, comptes & rôles, statistiques</td><td></td><td></td><td></td><td>✓</td></tr>
        </tbody>
      </table>
      <p class="muted small">L'enseignant ne voit jamais qui a envoyé un signal, ni la progression individuelle d'un étudiant.</p>`,
    },
  },

  // ───────────────────────────── BUSINESS
  {
    id: "levers", chapter: 3, focus: null, cam: "far", anim: null,
    en: {
      eyebrow: "Business · LLM cost",
      title: "Every token has to <em>earn</em> its place.",
      body: `<div class="levers">
        <section><h3><span>0</span>Don't call the model</h3>${facts([
          "Jordan orchestration, Nova routing, gap diagnosis, recommendations, SM-2 — plain code",
          "Riley's rule checks run before any AI review",
          "Embeddings offline, speech in the browser, math rendered client-side",
          "Demo mode: the whole app runs with no API key",
        ])}</section>
        <section><h3><span>1×</span>Call it once</h3>${facts([
          "A course is generated once and shared by the whole class",
          "Response cache: SHA-256 of the full prompt → validated output reused",
          "Only failed agents are retried, never the whole run",
        ])}</section>
        <section><h3><span>↓</span>Call it small</h3>${facts([
          "RAG: 5 passages instead of the whole course for every tutor turn",
          "Two tiers: a fast, low-thinking model for the tutor and grader; the smart model only for generation",
          "20-turn history window, output caps, schema-validated outputs",
        ])}</section>
        <section><h3><span>⟲</span>Call it cached</h3>${facts([
          "Stable-first prompts: policy → course block → role, so the same bytes are reused by all six generation agents",
          "Anthropic <code>cache_control</code> breakpoints and byte-identical history replay; Gemini implicit caching",
          "Every call logs input, output and cache tokens + latency",
        ])}</section>
      </div>`,
    },
    fr: {
      eyebrow: "Business · coût LLM",
      title: "Chaque token doit <em>mériter</em> sa place.",
      body: `<div class="levers">
        <section><h3><span>0</span>Ne pas appeler le modèle</h3>${facts([
          "Orchestration de Jordan, routage de Nova, diagnostic, recommandations, SM-2 — du code simple",
          "Les règles de Riley passent avant toute relecture IA",
          "Vecteurs calculés hors ligne, voix dans le navigateur, maths rendues côté client",
          "Mode démo : toute l'application tourne sans clé API",
        ])}</section>
        <section><h3><span>1×</span>L'appeler une fois</h3>${facts([
          "Un cours est généré une fois et partagé par toute la classe",
          "Cache de réponses : SHA-256 du prompt complet → sortie validée réutilisée",
          "Seuls les agents en échec sont relancés, jamais toute l'exécution",
        ])}</section>
        <section><h3><span>↓</span>L'appeler en petit</h3>${facts([
          "RAG : 5 passages au lieu du cours entier à chaque tour du tuteur",
          "Deux niveaux : un modèle rapide à réflexion faible pour tuteur et correcteur ; le modèle « smart » seulement pour générer",
          "Fenêtre de 20 tours, sorties plafonnées et validées par schéma",
        ])}</section>
        <section><h3><span>⟲</span>L'appeler en cache</h3>${facts([
          "Prompts « stable d'abord » : règles → bloc du cours → rôle, les mêmes octets réutilisés par les six agents",
          "Points de cache <code>cache_control</code> Anthropic et historique rejoué à l'identique ; cache implicite Gemini",
          "Chaque appel enregistre tokens d'entrée, de sortie, de cache + latence",
        ])}</section>
      </div>`,
    },
  },
  {
    id: "calculator", chapter: 3, focus: null, cam: "far", anim: null, calculator: true,
    en: {
      eyebrow: "Business · what it costs",
      title: "Cents per student, <em>per month</em>.",
      body: `<div id="calc"></div>`,
    },
    fr: {
      eyebrow: "Business · ce que ça coûte",
      title: "Quelques centimes par étudiant, <em>par mois</em>.",
      body: `<div id="calc"></div>`,
    },
  },
  {
    id: "production", chapter: 3, focus: null, cam: "orbit", anim: "workflow",
    en: {
      eyebrow: "Production ready",
      title: "Built to stay up when the <em>API</em> doesn't.",
      body: `<div class="grid2">
        <div class="tile"><b>Reliability</b><span>model fallback chain, backoff honouring retry-after, max 2 concurrent Gemini calls, timeouts, partial runs + retry</span></div>
        <div class="tile"><b>Provider-agnostic</b><span>Anthropic, Gemini or demo, chosen per tier with <code>LLM_FAST</code> / <code>LLM_SMART</code></span></div>
        <div class="tile"><b>Observability</b><span>per-call token, cache and latency log, <code>/api/system/llm-stats</code>, health check showing active tiers</span></div>
        <div class="tile"><b>Security</b><span>httpOnly JWT cookie, CSRF header, rate limits, bcrypt, no account enumeration, prompt-injection policy for uploaded files</span></div>
        <div class="tile"><b>Privacy</b><span>anonymity enforced in SQL, private progress, blocks, opt-in public fields</span></div>
        <div class="tile"><b>Quality</b><span>33 backend tests + 15 end-to-end browser tests run by GitHub Actions on every push; strict TypeScript; schema-validated AI outputs</span></div>
      </div>`,
    },
    fr: {
      eyebrow: "Prêt pour la production",
      title: "Conçu pour tenir quand l'<em>API</em> lâche.",
      body: `<div class="grid2">
        <div class="tile"><b>Fiabilité</b><span>chaîne de modèles de secours, délai qui respecte retry-after, 2 appels Gemini simultanés max, timeouts, exécutions partielles + relance</span></div>
        <div class="tile"><b>Multi-fournisseur</b><span>Anthropic, Gemini ou démo, choisi par niveau avec <code>LLM_FAST</code> / <code>LLM_SMART</code></span></div>
        <div class="tile"><b>Observabilité</b><span>journal de tokens, cache et latence par appel, <code>/api/system/llm-stats</code>, health check des niveaux actifs</span></div>
        <div class="tile"><b>Sécurité</b><span>cookie JWT httpOnly, en-tête CSRF, limites de débit, bcrypt, pas d'énumération de comptes, politique anti-injection pour les fichiers importés</span></div>
        <div class="tile"><b>Confidentialité</b><span>anonymat imposé en SQL, progression privée, blocages, champs publics au choix</span></div>
        <div class="tile"><b>Qualité</b><span>33 tests backend + 15 tests navigateur de bout en bout lancés par GitHub Actions à chaque push ; TypeScript strict ; sorties IA validées par schéma</span></div>
      </div>`,
    },
  },
  {
    id: "model", chapter: 3, focus: null, cam: "hero", anim: null,
    en: {
      eyebrow: "Business model · honest limits",
      title: "Free for students, <em>valuable</em> for faculties.",
      body: `<div class="cols">
        <div>
          <h3 class="h3">How it sustains itself</h3>
          ${facts([
            "<strong>Student freemium:</strong> core learning free; heavier use (more tutor turns, mock exams, study packs) in a low-cost plan.",
            "<strong>Faculty / university licence:</strong> class insights, teacher dashboards and course hosting for a whole department.",
            "Low cost per student is what makes the free tier possible.",
          ])}
        </div>
        <div>
          <h3 class="h3">What we don't hide</h3>
          ${facts([
            "<strong>Hallucinations</strong> are reduced by citations, Riley and community corrections — not eliminated.",
            "<strong>OCR and Derja</strong> accuracy depend on the scan and the model.",
            "<strong>Cheating:</strong> solutions stay hidden until you give up, and the tutor is Socratic.",
            "<strong>Small classes</strong> under 5 students get no insights, by design.",
            "<strong>Free API tiers</strong> rate-limit; we back off and retry, but paid quotas are needed at scale.",
          ])}
        </div>
      </div>`,
    },
    fr: {
      eyebrow: "Modèle économique · limites honnêtes",
      title: "Gratuit pour les étudiants, <em>précieux</em> pour les facultés.",
      body: `<div class="cols">
        <div>
          <h3 class="h3">Comment il se finance</h3>
          ${facts([
            "<strong>Freemium étudiant :</strong> l'essentiel gratuit ; un usage intensif (plus de tours de tuteur, examens blancs, packs PDF) dans une offre à petit prix.",
            "<strong>Licence faculté / université :</strong> indicateurs de classe, tableaux de bord enseignants et hébergement des cours pour tout un département.",
            "C'est le faible coût par étudiant qui rend l'offre gratuite possible.",
          ])}
        </div>
        <div>
          <h3 class="h3">Ce qu'on ne cache pas</h3>
          ${facts([
            "<strong>Les hallucinations</strong> sont réduites par les citations, Riley et les corrections — pas supprimées.",
            "<strong>L'OCR et la Derja</strong> dépendent de la qualité du scan et du modèle.",
            "<strong>La triche :</strong> les solutions restent cachées jusqu'à l'abandon, et le tuteur est socratique.",
            "<strong>Les petites classes</strong> de moins de 5 étudiants n'ont pas d'indicateurs, volontairement.",
            "<strong>Les offres API gratuites</strong> limitent le débit ; on réessaie, mais il faut des quotas payants à grande échelle.",
          ])}
        </div>
      </div>`,
    },
  },

  // ───────────────────────────── CLOSE
  {
    id: "close", chapter: 4, focus: null, cam: "hero", anim: "workflow",
    en: {
      eyebrow: "LessonForge",
      title: "Comprendre. Enrichir. <em>Améliorer.</em>",
      body: `<div class="triad">
        <div><b>COMPRENDRE</b><span>Clara's structure, Sam's Socratic tutor in your language, Sage's revision</span></div>
        <div><b>ENRICHIR</b><span>Alex's exercises and projects, shared resources, glossary, exam archive</span></div>
        <div><b>AMÉLIORER</b><span>Quinn's diagnosis, Riley's checks, community corrections, anonymous class insights</span></div>
      </div>
      <div class="cta">
        <a class="btn primary" href="${REPO}" target="_blank" rel="noopener">View the code on GitHub</a>
        <span class="muted small">React + TypeScript · FastAPI · PostgreSQL + pgvector · Gemini / Claude</span>
      </div>`,
    },
    fr: {
      eyebrow: "LessonForge",
      title: "Comprendre. Enrichir. <em>Améliorer.</em>",
      body: `<div class="triad">
        <div><b>COMPRENDRE</b><span>la structure de Clara, le tuteur socratique de Sam dans ta langue, les révisions de Sage</span></div>
        <div><b>ENRICHIR</b><span>les exercices et projets d'Alex, les ressources partagées, le glossaire, l'archive d'examens</span></div>
        <div><b>AMÉLIORER</b><span>le diagnostic de Quinn, les contrôles de Riley, les corrections, les indicateurs anonymes</span></div>
      </div>
      <div class="cta">
        <a class="btn primary" href="${REPO}" target="_blank" rel="noopener">Voir le code sur GitHub</a>
        <span class="muted small">React + TypeScript · FastAPI · PostgreSQL + pgvector · Gemini / Claude</span>
      </div>`,
    },
  },
];
