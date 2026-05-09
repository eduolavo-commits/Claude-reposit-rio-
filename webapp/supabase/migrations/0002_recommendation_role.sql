-- Adiciona campo opcional usado na frase final da Carta de Recomendação:
--   "...recomendamos como uma ótima contratação para estágio ou função de {recommendation_role}."
-- Quando vazio, a carta cai para o título do curso.

alter table courses
  add column if not exists recommendation_role text;

comment on column courses.recommendation_role is
  'Cargo/função usado na carta de recomendação (ex.: "Auxiliar de Veterinário"). Se nulo, usa o título do curso.';
