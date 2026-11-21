-- Applied after SQLAlchemy create_all. Idempotent.

-- Full-text search column for hybrid retrieval ('simple' config: language-agnostic, works for FR/EN/AR).
ALTER TABLE source_chunks
  ADD COLUMN IF NOT EXISTS tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce(section_hint,'') || ' ' || text)) STORED;
CREATE INDEX IF NOT EXISTS ix_source_chunks_tsv ON source_chunks USING gin (tsv);

-- Approximate nearest-neighbour index for dense retrieval (cosine distance).
CREATE INDEX IF NOT EXISTS ix_source_chunks_embedding ON source_chunks USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS ix_signals_course_day ON confusion_signals (course_id, day);
CREATE INDEX IF NOT EXISTS ix_attempts_user_assessment ON attempts (user_id, assessment_id);
CREATE INDEX IF NOT EXISTS ix_progress_user_course ON progress_events (user_id, course_id, created_at);

-- Cohort-protected aggregate: distinct students per section, rows below the threshold are never returned.
CREATE OR REPLACE FUNCTION insight_section_counts(p_course uuid, p_min int)
RETURNS TABLE(section_id uuid, students bigint) LANGUAGE sql STABLE AS $$
  SELECT s.section_id, count(DISTINCT s.cohort_token) AS students
  FROM confusion_signals s
  WHERE s.course_id = p_course
  GROUP BY s.section_id
  HAVING count(DISTINCT s.cohort_token) >= greatest(p_min, 5)
$$;

-- Distinct students per (section, reason), suppressed below threshold.
CREATE OR REPLACE FUNCTION insight_reason_counts(p_course uuid, p_min int)
RETURNS TABLE(section_id uuid, reason text, students bigint) LANGUAGE sql STABLE AS $$
  SELECT s.section_id, r.reason, count(DISTINCT s.cohort_token)
  FROM confusion_signals s, jsonb_array_elements_text(s.reasons) AS r(reason)
  WHERE s.course_id = p_course
  GROUP BY s.section_id, r.reason
  HAVING count(DISTINCT s.cohort_token) >= greatest(p_min, 5)
$$;

-- Weekly trend at course level, suppressed below threshold.
CREATE OR REPLACE FUNCTION insight_weekly_trend(p_course uuid, p_min int)
RETURNS TABLE(week date, students bigint, signals bigint) LANGUAGE sql STABLE AS $$
  SELECT date_trunc('week', s.day)::date, count(DISTINCT s.cohort_token), count(*)
  FROM confusion_signals s
  WHERE s.course_id = p_course
  GROUP BY 1
  HAVING count(DISTINCT s.cohort_token) >= greatest(p_min, 5)
  ORDER BY 1
$$;
