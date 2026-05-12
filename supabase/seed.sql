-- IRON_TRACK — Bibliothèque d'exercices de base
-- Coller dans Supabase Studio > SQL Editor après le schema.sql

insert into public.exercises (name, muscle_group, equipment_needed) values
  -- Pectoraux
  ('Développé couché barre',       'Pectoraux',  'barre'),
  ('Développé couché haltères',    'Pectoraux',  'haltères'),
  ('Développé incliné barre',      'Pectoraux',  'barre'),
  ('Écarté poulie basse',          'Pectoraux',  'machines'),
  ('Dips',                         'Pectoraux',  'bodyweight'),
  ('Pompes',                       'Pectoraux',  'bodyweight'),

  -- Dos
  ('Tractions',                    'Dos',        'bodyweight'),
  ('Rowing barre',                 'Dos',        'barre'),
  ('Rowing haltère unilatéral',    'Dos',        'haltères'),
  ('Tirage vertical poulie',       'Dos',        'machines'),
  ('Tirage horizontal assis',      'Dos',        'machines'),
  ('Soulevé de terre',             'Dos',        'barre'),

  -- Épaules
  ('Développé militaire barre',    'Épaules',    'barre'),
  ('Développé militaire haltères', 'Épaules',    'haltères'),
  ('Élévations latérales',         'Épaules',    'haltères'),
  ('Oiseau penché',                'Épaules',    'haltères'),
  ('Face pull poulie',             'Épaules',    'machines'),

  -- Biceps
  ('Curl barre',                   'Biceps',     'barre'),
  ('Curl haltères alternés',       'Biceps',     'haltères'),
  ('Curl marteau',                 'Biceps',     'haltères'),
  ('Curl poulie basse',            'Biceps',     'machines'),

  -- Triceps
  ('Extension poulie haute',       'Triceps',    'machines'),
  ('Skull crusher',                'Triceps',    'barre'),
  ('Dips banc',                    'Triceps',    'bodyweight'),
  ('Extension haltère unilatéral', 'Triceps',    'haltères'),

  -- Jambes
  ('Squat barre',                  'Jambes',     'barre'),
  ('Leg press',                    'Jambes',     'machines'),
  ('Fentes marchées haltères',     'Jambes',     'haltères'),
  ('Leg curl allongé',             'Jambes',     'machines'),
  ('Leg extension',                'Jambes',     'machines'),
  ('Hip thrust barre',             'Jambes',     'barre'),
  ('Mollets debout',               'Jambes',     'machines'),
  ('Soulevé de terre jambes tendues', 'Jambes',  'barre'),

  -- Abdominaux
  ('Crunch',                       'Abdominaux', 'bodyweight'),
  ('Gainage planche',              'Abdominaux', 'bodyweight'),
  ('Relevé de jambes suspendu',    'Abdominaux', 'bodyweight'),
  ('Ab wheel',                     'Abdominaux', 'bodyweight')
ON CONFLICT (name) DO NOTHING;
