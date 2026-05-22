'use client';

import { useState, useEffect, useRef } from 'react';
import { Mic, Upload, Play, Pause, Trash2, AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

interface VoiceInfo {
  voice_id: string;
  has_transcript: boolean;
  size_bytes: number;
}

interface HealthInfo {
  status: string;
  model: string;
  sample_rate: number;
  voices: string[];
}

export default function AdminVoicesPage() {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [healthError, setHealthError] = useState('');
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

  // Upload form
  const [voiceId, setVoiceId] = useState('');
  const [transcript, setTranscript] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Test synth
  const [testVoice, setTestVoice] = useState('');
  const [testText, setTestText] = useState('您好，我是 Onyx Studios 的 AI 配音示範。');
  const [testInstruction, setTestInstruction] = useState('');
  const [testing, setTesting] = useState(false);
  const [testAudioUrl, setTestAudioUrl] = useState('');
  const [testError, setTestError] = useState('');

  async function loadHealth() {
    setHealthError('');
    try {
      const res = await fetch('/api/voice/cosyvoice/health');
      const data = await res.json();
      if (!res.ok) {
        setHealthError(data.error || `HTTP ${res.status}`);
        setHealth(null);
      } else {
        setHealth(data);
      }
    } catch (err) {
      setHealthError(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  async function loadVoices() {
    try {
      const res = await fetch('/api/voice/cosyvoice/voices');
      const data = await res.json();
      setVoices(data.voices || []);
    } catch (err) {
      console.error('Failed to load voices:', err);
    }
  }

  useEffect(() => {
    Promise.all([loadHealth(), loadVoices()]).finally(() => setLoading(false));
  }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setUploadError('');
    setUploadSuccess('');

    if (!voiceId.trim()) return setUploadError('Voice ID is required');
    if (!transcript.trim()) return setUploadError('Transcript is required');
    if (!audioFile) return setUploadError('Audio file is required');

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('voice_id', voiceId.trim());
      formData.append('transcript', transcript.trim());
      formData.append('audio', audioFile, audioFile.name);

      const res = await fetch('/api/voice/cosyvoice/upload-reference', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      setUploadSuccess(`✅ Voice "${data.voice_id}" uploaded (transcript ${data.transcript_len} chars)`);
      setVoiceId('');
      setTranscript('');
      setAudioFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadVoices();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleTest() {
    if (!testVoice) return setTestError('Pick a voice first');
    if (!testText.trim()) return setTestError('Enter some text');

    setTesting(true);
    setTestError('');
    setTestAudioUrl('');

    try {
      const res = await fetch('/api/voice/cosyvoice/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: testText,
          voiceId: testVoice,
          instruction: testInstruction,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errData.error || 'Synthesis failed');
      }

      const audioBlob = await res.blob();
      const url = URL.createObjectURL(audioBlob);
      setTestAudioUrl(url);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Synthesis failed');
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Mic className="w-7 h-7 text-purple-700" />
          CosyVoice 2 — Voice Library
        </h1>
        <p className="text-gray-600 text-sm mt-1">
          Manage reference voices on the self-hosted CosyVoice 2 server (RunPod)
        </p>
      </div>

      {/* Health status */}
      <div className="mb-8 p-4 rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700">Server Status</h2>
          <button
            onClick={() => Promise.all([loadHealth(), loadVoices()])}
            className="text-gray-500 hover:text-gray-900 p-1"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        {loading ? (
          <p className="text-gray-500 text-sm">Checking...</p>
        ) : health ? (
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-green-700">
              <CheckCircle2 className="w-4 h-4" />
              {health.status}
            </span>
            <span className="text-gray-600">Model: {health.model}</span>
            <span className="text-gray-600">Sample rate: {health.sample_rate} Hz</span>
            <span className="text-gray-600">{voices.length} reference voice(s)</span>
          </div>
        ) : (
          <div className="flex items-start gap-2 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <div>
              <p className="font-semibold">CosyVoice server unreachable</p>
              <p className="text-xs mt-1">{healthError}</p>
              <p className="text-xs mt-2 text-gray-600">
                Check <code>COSYVOICE_API_URL</code> env var in Vercel.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Existing voices */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Available voices</h2>
        {voices.length === 0 ? (
          <div className="p-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 text-center text-gray-500 text-sm">
            No reference voices uploaded yet. Upload one below to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {voices.map((v) => (
              <div
                key={v.voice_id}
                className="p-4 rounded-xl border border-gray-200 bg-white hover:border-gray-400 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{v.voice_id}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {(v.size_bytes / 1024 / 1024).toFixed(2)} MB
                      {!v.has_transcript && (
                        <span className="ml-2 text-amber-700">⚠ no transcript</span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => setTestVoice(v.voice_id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      testVoice === v.voice_id
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    {testVoice === v.voice_id ? 'Selected' : 'Test'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload new reference */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Upload reference voice</h2>
        <form onSubmit={handleUpload} className="p-6 rounded-xl border border-gray-200 bg-white space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Voice ID <span className="text-red-700">*</span>
            </label>
            <input
              type="text"
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              placeholder="e.g. eric_zh, wing_yue, james_en"
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:border-purple-500 focus:outline-none"
              disabled={uploading}
            />
            <p className="text-xs text-gray-500 mt-1.5">
              Short identifier. Lowercase, underscores OK. This is what /synthesize will receive as
              voice_id.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reference transcript <span className="text-red-700">*</span>
            </label>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={3}
              placeholder="Exact text spoken in the audio file (Chinese OK)"
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:border-purple-500 focus:outline-none resize-y"
              disabled={uploading}
            />
            <p className="text-xs text-gray-500 mt-1.5">
              CosyVoice 2 uses this to anchor the speaker embedding. Must match audio precisely.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Audio file <span className="text-red-700">*</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/wav,audio/wave,.wav"
              onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-gray-300 file:bg-gray-100 file:text-gray-700 file:font-medium hover:file:bg-gray-200 file:cursor-pointer"
              disabled={uploading}
            />
            <p className="text-xs text-gray-500 mt-1.5">
              5–30 second WAV recommended. Clean recording, no background noise.
            </p>
            {audioFile && (
              <p className="text-xs text-green-700 mt-1.5">
                Selected: {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          {uploadError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {uploadError}
            </div>
          )}
          {uploadSuccess && (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
              {uploadSuccess}
            </div>
          )}

          <button
            type="submit"
            disabled={uploading || !health}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {uploading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
            ) : (
              <><Upload className="w-4 h-4" /> Upload to CosyVoice</>
            )}
          </button>
        </form>
      </div>

      {/* Test synthesis */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Test synthesis</h2>
        <div className="p-6 rounded-xl border border-gray-200 bg-white space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Voice</label>
            <select
              value={testVoice}
              onChange={(e) => setTestVoice(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:border-purple-500 focus:outline-none"
            >
              <option value="">— Pick a voice —</option>
              {voices.map((v) => (
                <option key={v.voice_id} value={v.voice_id}>{v.voice_id}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Text to synthesize</label>
            <textarea
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              rows={3}
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:border-purple-500 focus:outline-none resize-y"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Instruction (optional)
            </label>
            <input
              type="text"
              value={testInstruction}
              onChange={(e) => setTestInstruction(e.target.value)}
              placeholder="e.g. 興奮, 嘆息, 用粵語慢慢念, 加上呼吸聲"
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:border-purple-500 focus:outline-none"
            />
            <p className="text-xs text-gray-500 mt-1.5">
              CosyVoice 2 instruction-control prompt. Wrapped in angle brackets at inference time.
            </p>
          </div>

          {testError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {testError}
            </div>
          )}

          <button
            onClick={handleTest}
            disabled={testing || !testVoice || !health}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {testing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Synthesizing... (5–30s)</>
            ) : (
              <><Play className="w-4 h-4" /> Generate</>
            )}
          </button>

          {testAudioUrl && (
            <div className="p-3 rounded-lg bg-gray-100 border border-gray-200">
              <p className="text-xs font-medium text-gray-700 mb-2">Generated audio:</p>
              <audio controls src={testAudioUrl} className="w-full" />
              <a
                href={testAudioUrl}
                download={`cosyvoice-${testVoice}-${Date.now()}.wav`}
                className="inline-block mt-2 text-xs text-purple-700 hover:text-purple-900"
              >
                Download WAV
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
