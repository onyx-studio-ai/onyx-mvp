/*
  # Seed Singer Talents

  Inserts initial vocal artist data into the talents table.

  1. New Data
    - 6 vocal artists of type 'singer'
    - Anya (female, English/Japanese, Pop/R&B)
    - Marcus (male, English, Soul/Gospel)
    - Lina (female, Chinese Mandarin/English, Ballad/Pop)
    - Kai (male, Korean/English, Hip-Hop/R&B)
    - Sofia (female, English/German, Jazz/Soul)
    - Renjiro (male, Japanese/English, Rock/Alternative)

  2. Notes
    - All talents are set as active and type 'singer'
    - frontend_price is auto-calculated (internal_cost * 1.6)
    - Headshot images use Pexels stock photos
*/

INSERT INTO talents (type, name, languages, category, tags, gender, bio, headshot_url, internal_cost, is_active, sort_order)
VALUES
  (
    'singer',
    'Anya',
    ARRAY['English (US)', 'Japanese'],
    'in_house',
    ARRAY['Pop', 'R&B', 'Warm', 'Versatile'],
    'female',
    'Anya brings a silky, emotive vocal quality to every track. Fluent in English and Japanese, she specializes in pop and R&B with effortless crossover appeal.',
    'https://images.pexels.com/photos/3756616/pexels-photo-3756616.jpeg?auto=compress&cs=tinysrgb&w=400',
    500,
    true,
    1
  ),
  (
    'singer',
    'Marcus',
    ARRAY['English (US)'],
    'in_house',
    ARRAY['Soul', 'Gospel', 'Powerful', 'Baritone'],
    'male',
    'Marcus is a powerhouse vocalist with deep gospel roots. His rich baritone and commanding presence bring soul and authenticity to any production.',
    'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=400',
    600,
    true,
    2
  ),
  (
    'singer',
    'Lina',
    ARRAY['Chinese (Mandarin)', 'English (US)'],
    'in_house',
    ARRAY['Ballad', 'Pop', 'Ethereal', 'Soprano'],
    'female',
    'Lina is a classically trained soprano with a gift for emotional storytelling. Her bilingual range makes her perfect for cross-cultural projects.',
    'https://images.pexels.com/photos/3769021/pexels-photo-3769021.jpeg?auto=compress&cs=tinysrgb&w=400',
    550,
    true,
    3
  ),
  (
    'singer',
    'Kai',
    ARRAY['Korean', 'English (US)'],
    'featured',
    ARRAY['Hip-Hop', 'R&B', 'Smooth', 'Tenor'],
    'male',
    'Kai blends K-Pop precision with American R&B feel. A featured artist known for silky hooks and rhythmic versatility.',
    'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=400',
    700,
    true,
    4
  ),
  (
    'singer',
    'Sofia',
    ARRAY['English (UK)', 'German'],
    'in_house',
    ARRAY['Jazz', 'Soul', 'Warm', 'Alto'],
    'female',
    'Sofia draws from the European jazz tradition with a warm, smoky alto voice. She excels in intimate, atmospheric recordings.',
    'https://images.pexels.com/photos/3785079/pexels-photo-3785079.jpeg?auto=compress&cs=tinysrgb&w=400',
    480,
    true,
    5
  ),
  (
    'singer',
    'Renjiro',
    ARRAY['Japanese', 'English (US)'],
    'featured',
    ARRAY['Rock', 'Alternative', 'Edgy', 'Tenor'],
    'male',
    'Renjiro brings raw energy and grit to every vocal performance. A featured artist specializing in rock and alternative with bilingual lyrics.',
    'https://images.pexels.com/photos/2269872/pexels-photo-2269872.jpeg?auto=compress&cs=tinysrgb&w=400',
    650,
    true,
    6
  );
