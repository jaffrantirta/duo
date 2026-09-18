-- Custom SQL migration file, put your code below! --

INSERT INTO discover_cards (id, couple_id, type, title, description, created_by, created_at) VALUES
  ('seed-01', NULL, 'dinner', 'Try a new restaurant', 'Pick a place neither of you has been to and split three dishes.', NULL, now()),
  ('seed-02', NULL, 'dinner', 'Cook a recipe you''ve never made', 'Choose something a little ambitious and cook it together.', NULL, now()),
  ('seed-03', NULL, 'dinner', 'Picnic, anywhere', 'A park bench counts as a picnic spot.', NULL, now()),
  ('seed-04', NULL, 'movie', 'Rewatch your first movie together', 'The one you saw on an early date — see how it holds up.', NULL, now()),
  ('seed-05', NULL, 'movie', 'Movie marathon, no phones', 'Pick a trilogy or a director and watch back to back.', NULL, now()),
  ('seed-06', NULL, 'movie', 'See something in a language neither of you speaks', 'Subtitles on, guess the ending before it happens.', NULL, now()),
  ('seed-07', NULL, 'trip', 'Day trip somewhere you''ve never been', 'Anywhere within two hours counts.', NULL, now()),
  ('seed-08', NULL, 'trip', 'Camp out for a night', 'Backyard counts if the weather doesn''t cooperate.', NULL, now()),
  ('seed-09', NULL, 'trip', 'Road trip with no destination', 'Pick a direction and turn off when something looks interesting.', NULL, now()),
  ('seed-10', NULL, 'trip', 'Visit a museum or gallery you keep meaning to go to', 'The one that''s been on the list for a year.', NULL, now()),
  ('seed-11', NULL, 'stay-home', 'Board game night', 'Loser does dishes for a week.', NULL, now()),
  ('seed-12', NULL, 'stay-home', 'Build a blanket fort', 'Watch something inside it. No adult reason needed.', NULL, now()),
  ('seed-13', NULL, 'stay-home', 'Cook breakfast for dinner', 'Pancakes at 7pm, no judgment.', NULL, now()),
  ('seed-14', NULL, 'weekend', 'Explore a neighborhood you''ve never walked', 'Pick a random spot on the map and wander it for an afternoon.', NULL, now()),
  ('seed-15', NULL, 'weekend', 'Farmers market morning', 'Buy only things you''ve never cooked with.', NULL, now()),
  ('seed-16', NULL, 'weekend', 'Spa day at home', 'Face masks, playlist, phones in another room.', NULL, now()),
  ('seed-17', NULL, 'birthday', 'Plan a surprise for their next birthday', 'Start early — the good surprises take lead time.', NULL, now()),
  ('seed-18', NULL, 'anniversary', 'Recreate your first date', 'Same place if it still exists, same order if you remember it.', NULL, now()),
  ('seed-19', NULL, 'surprise', 'Leave a note somewhere they''ll find it', 'No occasion required.', NULL, now()),
  ('seed-20', NULL, 'surprise', 'Plan a surprise ''no plans'' day', 'Clear the calendar and don''t say why.', NULL, now())
ON CONFLICT (id) DO NOTHING;