-- IRON_TRACK — Bibliothèque d'exercices étendue (machines + variations)
-- Exécuter dans Supabase Studio > SQL Editor

INSERT INTO public.exercises (name, muscle_group, equipment_needed) VALUES

  -- Pectoraux — machines / smith / câble
  ('Écarté debout poulie',                      'Pectoraux',  'machines'),
  ('Développé incliné smith machine',           'Pectoraux',  'machines'),
  ('Écarté machine',                            'Pectoraux',  'machines'),
  ('Écarté debout poulie basse',                'Pectoraux',  'machines'),
  ('Développé décliné smith machine',           'Pectoraux',  'machines'),
  ('Développé couché machine',                  'Pectoraux',  'machines'),
  ('Développé incliné haltères',                'Pectoraux',  'haltères'),
  ('Développé décliné barre',                   'Pectoraux',  'barre'),
  ('Pull-over poulie haute',                    'Pectoraux',  'machines'),
  ('Pull-over haltère',                         'Pectoraux',  'haltères'),
  ('Cable crossover',                           'Pectoraux',  'machines'),
  ('Pec deck machine',                          'Pectoraux',  'machines'),

  -- Dos — machines / câble
  ('Tirage vertical prise pronation poulie haute', 'Dos',     'machines'),
  ('Rowing machine prise pronation',            'Dos',        'machines'),
  ('Tirage horizontal poulie prise neutre',     'Dos',        'machines'),
  ('Rowing T-bar',                              'Dos',        'barre'),
  ('Tirage vertical prise supination',          'Dos',        'machines'),
  ('Tirage vertical prise neutre',              'Dos',        'machines'),
  ('Rowing assis machine',                      'Dos',        'machines'),
  ('Hyperextension',                            'Dos',        'bodyweight'),
  ('Tirage nuque poulie haute',                 'Dos',        'machines'),

  -- Épaules — machines / câble / smith
  ('Élévation latérale machine',                'Épaules',    'machines'),
  ('Élévation postérieure croisée poulie haute','Épaules',    'machines'),
  ('Développé Arnold',                          'Épaules',    'haltères'),
  ('Développé militaire machine',               'Épaules',    'machines'),
  ('Développé vertical smith machine',          'Épaules',    'machines'),
  ('Élévations latérales poulie basse',         'Épaules',    'machines'),
  ('Élévations frontales barre',                'Épaules',    'barre'),
  ('Élévations frontales haltères',             'Épaules',    'haltères'),
  ('Shrugs barre',                              'Épaules',    'barre'),
  ('Shrugs haltères',                           'Épaules',    'haltères'),
  ('Rowing menton barre',                       'Épaules',    'barre'),

  -- Biceps — machines / câble / variations
  ('Curl pupitre machine prise supination',     'Biceps',     'machines'),
  ('Curl poulie prise marteau',                 'Biceps',     'machines'),
  ('Curl incliné haltères',                     'Biceps',     'haltères'),
  ('Curl concentration haltère',                'Biceps',     'haltères'),
  ('Curl barre EZ',                             'Biceps',     'barre'),
  ('Curl pupitre barre EZ',                     'Biceps',     'barre'),
  ('Curl câble barre droite',                   'Biceps',     'machines'),

  -- Triceps — machines / câble / variations
  ('Extension poulie haute barre',              'Triceps',    'machines'),
  ('Pushdown corde poulie',                     'Triceps',    'machines'),
  ('Kickback poulie',                           'Triceps',    'machines'),
  ('Extension overhead haltère',                'Triceps',    'haltères'),
  ('Extension overhead poulie corde',           'Triceps',    'machines'),
  ('Dips parallèles',                           'Triceps',    'bodyweight'),

  -- Jambes — machines / variations
  ('Leg curl assis',                            'Jambes',     'machines'),
  ('Hack squat',                                'Jambes',     'machines'),
  ('Presse à cuisses inclinée',                 'Jambes',     'machines'),
  ('Adduction machine',                         'Jambes',     'machines'),
  ('Extension mollets debout machine',          'Jambes',     'machines'),
  ('Squat gobelet',                             'Jambes',     'haltères'),
  ('Squat bulgare haltères',                    'Jambes',     'haltères'),
  ('Romanian deadlift haltères',                'Jambes',     'haltères'),
  ('Hip thrust machine',                        'Jambes',     'machines'),
  ('Hip abduction machine',                     'Jambes',     'machines'),
  ('Fentes avant barre',                        'Jambes',     'barre'),
  ('Step-up haltères',                          'Jambes',     'haltères'),
  ('Mollets assis machine',                     'Jambes',     'machines'),
  ('Deadlift roumain barre',                    'Jambes',     'barre'),
  ('Sumo squat barre',                          'Jambes',     'barre'),
  ('Soulevé de terre jambes tendues barre',     'Jambes',     'barre'),

  -- Abdominaux — machines / variations
  ('Crunch poulie basse',                       'Abdominaux', 'machines'),
  ('Russian twist',                             'Abdominaux', 'bodyweight'),
  ('Crunch machine',                            'Abdominaux', 'machines'),
  ('Planche latérale',                          'Abdominaux', 'bodyweight'),
  ('Relevé de jambes allongé',                  'Abdominaux', 'bodyweight'),
  ('Dragon flag',                               'Abdominaux', 'bodyweight'),
  ('Crunch obliques',                           'Abdominaux', 'bodyweight')

ON CONFLICT (name) DO NOTHING;
