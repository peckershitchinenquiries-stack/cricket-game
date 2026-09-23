-- ═══════════════════════════════════════════════════════════════════════
-- CrickTap — initial schema
-- All game reads/writes go through Next.js API routes using the service
-- role key. The anon key is only used for admin sign-in, so anon/authenticated
-- roles get NO direct table access — in particular, correct answers
-- (questions.correct_lat/lng) are never readable from the browser.
-- ═══════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Questions ──────────────────────────────────────────────────────────
CREATE TABLE questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_text TEXT NOT NULL,
  hint TEXT,
  correct_lat DOUBLE PRECISION NOT NULL CHECK (correct_lat BETWEEN -90 AND 90),
  correct_lng DOUBLE PRECISION NOT NULL CHECK (correct_lng BETWEEN -180 AND 180),
  correct_label TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  created_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_questions_active ON questions(is_active);

-- ── Daily rounds — which 5 questions are served on which UTC date ────────
CREATE TABLE daily_rounds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  round_date DATE NOT NULL UNIQUE,
  question_ids UUID[] NOT NULL CHECK (array_length(question_ids, 1) = 5),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_daily_rounds_date ON daily_rounds(round_date);
CREATE INDEX idx_daily_rounds_question_ids ON daily_rounds USING GIN (question_ids);

-- ── Per-question answers (server-scored; powers anti-cheat + stats) ─────
CREATE TABLE answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  round_date DATE NOT NULL,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  position SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 5),
  guess_lat DOUBLE PRECISION NOT NULL,
  guess_lng DOUBLE PRECISION NOT NULL,
  distance_km DOUBLE PRECISION NOT NULL,
  points INTEGER NOT NULL CHECK (points >= 0),
  max_points INTEGER NOT NULL CHECK (max_points > 0),
  color TEXT NOT NULL CHECK (color IN ('green', 'yellow', 'orange', 'red')),
  answered_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (device_id, round_date, question_id)
);

CREATE INDEX idx_answers_device_date ON answers(device_id, round_date);
CREATE INDEX idx_answers_question ON answers(question_id);

-- ── Player scores ──────────────────────────────────────────────────────
CREATE TABLE scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  round_date DATE NOT NULL,
  total_score INTEGER NOT NULL CHECK (total_score BETWEEN 0 AND 1000),
  question_scores INTEGER[] NOT NULL,
  accuracy_colors TEXT[] NOT NULL,
  played_at TIMESTAMPTZ DEFAULT now(),
  is_pro BOOLEAN DEFAULT false,
  user_id UUID,
  UNIQUE (device_id, round_date)
);

CREATE INDEX idx_scores_round_date ON scores(round_date);

-- ── Future: user accounts (schema only, not used in v1) ────────────────
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE,
  display_name TEXT,
  is_pro BOOLEAN DEFAULT false,
  pro_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Row Level Security ─────────────────────────────────────────────────
-- RLS on, no policies for anon/authenticated = no direct access.
-- The service role (API routes) bypasses RLS.
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ── Stats ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION score_stats_by_day(p_from DATE, p_to DATE)
RETURNS TABLE (round_date DATE, plays BIGINT, average NUMERIC)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT s.round_date, COUNT(*)::BIGINT, ROUND(AVG(s.total_score))
  FROM scores s
  WHERE s.round_date BETWEEN p_from AND p_to
  GROUP BY s.round_date
  ORDER BY s.round_date;
$$;

CREATE OR REPLACE VIEW question_stats
WITH (security_invoker = true) AS
SELECT
  q.id,
  q.question_text,
  q.correct_label,
  COUNT(a.id) AS attempts,
  AVG(a.points::DOUBLE PRECISION / a.max_points) AS avg_pct,
  AVG(a.distance_km) AS avg_distance_km
FROM questions q
LEFT JOIN answers a ON a.question_id = q.id
GROUP BY q.id;

-- ── Round generation ───────────────────────────────────────────────────
-- Picks 5 random active questions per date: at most one per ~1° location
-- cell (so Lord's doesn't appear twice), avoiding questions used in the
-- previous 7 days where possible, ordered easy → hard.
CREATE OR REPLACE FUNCTION generate_daily_rounds(p_start DATE, p_days INTEGER, p_overwrite BOOLEAN DEFAULT false)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  d DATE;
  ids UUID[];
  created INTEGER := 0;
BEGIN
  FOR i IN 0 .. p_days - 1 LOOP
    d := p_start + i;
    CONTINUE WHEN NOT p_overwrite AND EXISTS (SELECT 1 FROM daily_rounds WHERE round_date = d);

    SELECT array_agg(id ORDER BY
             CASE difficulty WHEN 'easy' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, r)
      INTO ids
      FROM (
        SELECT id, difficulty, r FROM (
          SELECT DISTINCT ON (round(correct_lat), round(correct_lng))
                 q.id, q.difficulty,
                 random() + CASE WHEN EXISTS (
                   SELECT 1 FROM daily_rounds dr
                   WHERE dr.round_date BETWEEN d - 7 AND d - 1 AND q.id = ANY (dr.question_ids)
                 ) THEN 1 ELSE 0 END AS r
          FROM questions q
          WHERE q.is_active
          ORDER BY round(correct_lat), round(correct_lng), random()
        ) per_location
        ORDER BY r
        LIMIT 5
      ) picked;

    IF ids IS NULL OR array_length(ids, 1) < 5 THEN
      RAISE EXCEPTION 'Not enough distinct active questions to build a round for %', d;
    END IF;

    INSERT INTO daily_rounds (round_date, question_ids) VALUES (d, ids)
    ON CONFLICT (round_date) DO UPDATE SET question_ids = EXCLUDED.question_ids;
    created := created + 1;
  END LOOP;
  RETURN created;
END;
$$;

REVOKE ALL ON FUNCTION generate_daily_rounds(DATE, INTEGER, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION score_stats_by_day(DATE, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON question_stats FROM anon, authenticated;
