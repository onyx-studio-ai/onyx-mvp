// Persistent fal speaker embeddings for OUR talents. Created once via fal clone-voice,
// the safetensors stored in our Supabase `tts-embeddings` bucket (permanent, not fal's
// temp URL). Maps a stable voiceId → embedding + the ref transcript.
//
// ⚠️ Flow-test stopgap. Production should move these onto a `talents.tts_embedding_url`
// column so every onboarded talent is generatable. And quality = fal-clone level
// ("像也不像") → swap to BreezyVoice (self-host pod) for production-grade our-voice.
export interface VoiceEmbedding {
  label: string;
  embeddingUrl: string;
  refText: string;
}

export const VOICE_EMBEDDINGS: Record<string, VoiceEmbedding> = {
  'onyx-alpha': {
    label: 'Onyx Alpha (Eric / 楊日漢)',
    embeddingUrl:
      'https://hnblwckpnapsdladcjql.supabase.co/storage/v1/object/public/tts-embeddings/eric_alpha.safetensors',
    refText: '高效防晒喷雾买一送一。提供全方位防护，让您在烈日下依然自信从容。',
  },
  'onyx-bravo': {
    label: 'Onyx Bravo (阿宏 / 呂冠彥)',
    embeddingUrl:
      'https://hnblwckpnapsdladcjql.supabase.co/storage/v1/object/public/tts-embeddings/onyx_bravo.safetensors',
    refText: '你平常最喜欢吃什么台湾小吃啊。',
  },
};

export function getVoiceEmbedding(id: string): VoiceEmbedding | null {
  return VOICE_EMBEDDINGS[id] || null;
}
