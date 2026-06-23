-- SQL Script to Alter 'resultados' Table with Individual Questionnaire Answer Columns
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- Add columns for Q1 Multiple Choice Options (up to 5 options selected)
ALTER TABLE resultados ADD COLUMN IF NOT EXISTS q1_opcao_1 TEXT;
ALTER TABLE resultados ADD COLUMN IF NOT EXISTS q1_opcao_2 TEXT;
ALTER TABLE resultados ADD COLUMN IF NOT EXISTS q1_opcao_3 TEXT;
ALTER TABLE resultados ADD COLUMN IF NOT EXISTS q1_opcao_4 TEXT;
ALTER TABLE resultados ADD COLUMN IF NOT EXISTS q1_opcao_5 TEXT;

-- Add columns for Q2, Q3, and Q4 Single Choice responses
ALTER TABLE resultados ADD COLUMN IF NOT EXISTS q2_resposta TEXT;
ALTER TABLE resultados ADD COLUMN IF NOT EXISTS q3_resposta TEXT;
ALTER TABLE resultados ADD COLUMN IF NOT EXISTS q4_resposta TEXT;

-- Add columns for Q5 Multiple Choice Options (up to 5 options selected)
ALTER TABLE resultados ADD COLUMN IF NOT EXISTS q5_opcao_1 TEXT;
ALTER TABLE resultados ADD COLUMN IF NOT EXISTS q5_opcao_2 TEXT;
ALTER TABLE resultados ADD COLUMN IF NOT EXISTS q5_opcao_3 TEXT;
ALTER TABLE resultados ADD COLUMN IF NOT EXISTS q5_opcao_4 TEXT;
ALTER TABLE resultados ADD COLUMN IF NOT EXISTS q5_opcao_5 TEXT;

-- Add columns for Q6 to Q14 responses
ALTER TABLE resultados ADD COLUMN IF NOT EXISTS q6_resposta TEXT;
ALTER TABLE resultados ADD COLUMN IF NOT EXISTS q7_resposta TEXT;
ALTER TABLE resultados ADD COLUMN IF NOT EXISTS q8_resposta TEXT;
ALTER TABLE resultados ADD COLUMN IF NOT EXISTS q9_resposta TEXT;
ALTER TABLE resultados ADD COLUMN IF NOT EXISTS q10_resposta TEXT;
ALTER TABLE resultados ADD COLUMN IF NOT EXISTS q11_resposta TEXT;
ALTER TABLE resultados ADD COLUMN IF NOT EXISTS q12_resposta TEXT;
ALTER TABLE resultados ADD COLUMN IF NOT EXISTS q13_resposta TEXT;
ALTER TABLE resultados ADD COLUMN IF NOT EXISTS q14_resposta TEXT;

-- Comments explaining the new structural columns
COMMENT ON COLUMN resultados.q1_opcao_1 IS 'Questão 1 - Seleção de Qualidade 1';
COMMENT ON COLUMN resultados.q1_opcao_2 IS 'Questão 1 - Seleção de Qualidade 2';
COMMENT ON COLUMN resultados.q1_opcao_3 IS 'Questão 1 - Seleção de Qualidade 3';
COMMENT ON COLUMN resultados.q1_opcao_4 IS 'Questão 1 - Seleção de Qualidade 4';
COMMENT ON COLUMN resultados.q1_opcao_5 IS 'Questão 1 - Seleção de Qualidade 5';

COMMENT ON COLUMN resultados.q5_opcao_1 IS 'Questão 5 - Seleção de Virtude 1';
COMMENT ON COLUMN resultados.q5_opcao_2 IS 'Questão 5 - Seleção de Virtude 2';
COMMENT ON COLUMN resultados.q5_opcao_3 IS 'Questão 5 - Seleção de Virtude 3';
COMMENT ON COLUMN resultados.q5_opcao_4 IS 'Questão 5 - Seleção de Virtude 4';
COMMENT ON COLUMN resultados.q5_opcao_5 IS 'Questão 5 - Seleção de Virtude 5';
