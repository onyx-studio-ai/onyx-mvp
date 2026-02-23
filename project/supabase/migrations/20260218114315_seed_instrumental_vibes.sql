/*
  # Seed Instrumental Vibes

  Inserts initial instrumental music catalog data into the vibes table.

  1. New Data
    - 6 instrumental vibes across different genres
    - Each has title, genre, description, image_url, and audio_url
    - Genres: Lo-Fi, Cinematic, Pop, Hip-Hop, Jazz, Electronic

  2. Notes
    - Images use Pexels stock photos
    - Audio URLs reference local demo files
*/

INSERT INTO vibes (title, genre, description, image_url, audio_url)
VALUES
  (
    'Midnight Bloom',
    'Lo-Fi / Chill',
    'Warm, dreamy lo-fi textures perfect for late-night moods and reflective content. Gentle keys over a slow, dusty beat.',
    'https://images.pexels.com/photos/1626481/pexels-photo-1626481.jpeg?auto=compress&cs=tinysrgb&w=600',
    '/demos/en_female_1.mp3'
  ),
  (
    'Iron Horizon',
    'Cinematic / Epic',
    'Sweeping orchestral arrangement with thundering percussion. Built for trailers, brand films, and dramatic storytelling.',
    'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?auto=compress&cs=tinysrgb&w=600',
    '/demos/en_male_1.mp3'
  ),
  (
    'Neon Pulse',
    'Pop / Synth',
    'Bright, energetic synth-pop instrumental with driving rhythm and catchy hooks. Great for commercials and upbeat content.',
    'https://images.pexels.com/photos/1694900/pexels-photo-1694900.jpeg?auto=compress&cs=tinysrgb&w=600',
    '/demos/ko_female_1.mp3'
  ),
  (
    'Gold Chain',
    'Hip-Hop / Trap',
    'Hard-hitting 808s with atmospheric pads and a crisp hi-hat pattern. Street-ready production with a premium polish.',
    'https://images.pexels.com/photos/1389429/pexels-photo-1389429.jpeg?auto=compress&cs=tinysrgb&w=600',
    '/demos/ko_male_1.mp3'
  ),
  (
    'Velvet Room',
    'Jazz / Soul',
    'Smooth jazz arrangement with muted trumpet, upright bass, and brushed drums. Sophisticated and intimate.',
    'https://images.pexels.com/photos/164821/pexels-photo-164821.jpeg?auto=compress&cs=tinysrgb&w=600',
    '/demos/ja_female_1.mp3'
  ),
  (
    'Digital Rain',
    'Electronic / Ambient',
    'Atmospheric electronic textures with glitchy percussion and evolving synth pads. Perfect for tech brands and digital media.',
    'https://images.pexels.com/photos/1309766/pexels-photo-1309766.jpeg?auto=compress&cs=tinysrgb&w=600',
    '/demos/zh_male_1.mp3'
  );
