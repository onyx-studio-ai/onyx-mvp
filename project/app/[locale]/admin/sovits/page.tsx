'use client';

import { useState, useEffect, useRef } from 'react';
import { Wand2, Upload, AlertCircle, CheckCircle2, Loader2, RefreshCw, Volume2, Download } from 'lucide-react';

// Browser → RunPod direct (bypasses Vercel function 10s timeout on Hobby plan).
const SOVITS_URL = (process.env.NEXT_PUBLIC_SOVITS_API_URL || '').replace(/\/$/, '');
const SOVITS_KEY = process.env.NEXT_PUBLIC_SOVITS_API_KEY || '';

const PRESET_VOICES = [
  { id: 'eric_warm_slow', label: 'Eric · 溫暖慢念' },
  { id: 'eric_warm_fast', label: 'Eric · 溫暖快念' },
  { id: 'eric_serious', label: 'Eric · 嚴肅' },
  { id: 'eric_friendly', label: 'Eric · 親切' },
  { id: 'eric_news', label: 'Eric · 新聞主播' },
  { id: 'eric_narration', label: 'Eric · 旁白' },
  { id: 'eric_default', label: 'Eric · 預設' },
];

interface HealthInfo {
  status: string;
  model?: string;
}

function authHeaders(): Record<string, string> {
  return SOVITS_KEY ? { Authorization: `Bearer ${SOVITS_KEY}` } : {};
}

export default function AdminSovitsPage() {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [healthError, setHealthError] = useState('');
  const [loadingHealth, setLoadingHealth] = useState(true);

  // TTS test form
  const [ttsVoice, setTtsVoice] = useState(PRESET_VOICES[0].id);
  const [ttsText, setTtsText] = useState('您好，我是 Onyx Studios 的 GPT-SoVITS 配音示範。');
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [ttsFormat, setTtsFormat] = useState<'wav' | 'mp3'>('wav');
  const [ttsBusy, setTtsBusy] = useState(false);
  const [ttsAudioUrl, setTtsAudioUrl] = useState('');
  const [ttsError, setTtsError] = useState('');

  // RVC convert form
  const [rvcVoice, setRvcVoice] = useState(PRESET_VOICES[0].id);
  const [rvcFile, setRvcFile] = useState<File | null>(null);
  const [rvcFormat, setRvcFormat] = useState<'wav' | 'mp3'>('wav');
  const [rvcBusy, setRvcBusy] = useState(false);
  const [rvcAudioUrl, setRvcAudioUrl] = useState('');
  const [rvcError, setRvcError] = useState('');
  const rvcFileRef = useRef<HTMLInputElement>(null);

  async function loadHealth() {
    setHealthError('');
    if (!SOVITS_URL) {
      setHealthError('NEXT_PUBLIC_SOVITS_API_URL env var is not set');
      setHealth(null);
      setLoadingHealth(false);
      return;
    }
    try {
      const res = await fetch(`${SOVITS_URL}/health`, { headers: authHeaders() });
      if (!res.ok) {
        setHealthError(`HTTP ${res.status}`);
        setHealth(null);
      } else {
        const data = (await res.json()) as HealthInfo;
        setHealth(data);
      }
    } catch (err) {
      setHealthError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoadingHealth(false);
    }
  }

  useEffect(() => {
    loadHealth();
  }, []);

  async function handleTts() {
    if (!ttsText.trim()) return setTtsError('輸入要念的文字');
    if (!SOVITS_URL) return setTtsError('NEXT_PUBLIC_SOVITS_API_URL 未設定');

    setTtsBusy(true);
    setTtsError('');
    setTtsAudioUrl('');

    try {
      const res = await fetch(`${SOVITS_URL}/v1/audio/speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          model: 'tts-1',
          input: ttsText,
          voice: ttsVoice,
          response_format: ttsFormat,
          speed: ttsSpeed,
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => `HTTP ${res.status}`);
        throw new Error(errText.slice(0, 200) || 'TTS 失敗');
      }
      const blob = await res.blob();
      setTtsAudioUrl(URL.createObjectURL(blob));
    } catch (err) {
      setTtsError(err instanceof Error ? err.message : 'TTS 失敗');
    } finally {
      setTtsBusy(false);
    }
  }

  async function handleRvc(e: React.FormEvent) {
    e.preventDefault();
    if (!rvcFile) return setRvcError('請選音檔');
    if (!SOVITS_URL) return setRvcError('NEXT_PUBLIC_SOVITS_API_URL 未設定');

    setRvcBusy(true);
    setRvcError('');
    setRvcAudioUrl('');

    try {
      const formData = new FormData();
      formData.append('audio', rvcFile, rvcFile.name);
      formData.append('target_voice', rvcVoice);
      formData.append('response_format', rvcFormat);

      const res = await fetch(`${SOVITS_URL}/v1/audio/voice_convert`, {
        method: 'POST',
        headers: authHeaders(), // no Content-Type — browser sets multipart boundary
        body: formData,
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => `HTTP ${res.status}`);
        throw new Error(errText.slice(0, 200) || 'RVC 轉換失敗');
      }
      const blob = await res.blob();
      setRvcAudioUrl(URL.createObjectURL(blob));
    } catch (err) {
      setRvcError(err instanceof Error ? err.message : 'RVC 轉換失敗');
    } finally {
      setRvcBusy(false);
    }
  }

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Wand2 className="w-7 h-7 text-purple-700" />
          GPT-SoVITS — TTS + RVC (Eric)
        </h1>
        <p className="text-gray-600 text-sm mt-1">
          自托管 GPT-SoVITS pod · OpenAI-compatible TTS + 聲音轉換(RVC)
        </p>
      </div>

      {/* Health status */}
      <div className="mb-8 p-4 rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700">Pod 狀態</h2>
          <button
            onClick={loadHealth}
            className="text-gray-500 hover:text-gray-900 p-1"
            title="重新整理"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        {loadingHealth ? (
          <p className="text-gray-500 text-sm">檢查中...</p>
        ) : health ? (
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-green-700">
              <CheckCircle2 className="w-4 h-4" />
              {health.status}
            </span>
            {health.model && <span className="text-gray-600">Model: {health.model}</span>}
          </div>
        ) : (
          <div className="flex items-start gap-2 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <div>
              <p className="font-semibold">GPT-SoVITS pod 不可達</p>
              <p className="text-xs mt-1">{healthError}</p>
              <p className="text-xs mt-2 text-gray-600">
                檢查 Vercel 的 <code>NEXT_PUBLIC_SOVITS_API_URL</code> /{' '}
                <code>NEXT_PUBLIC_SOVITS_API_KEY</code>(改完要 redeploy,build-time 才會 bake)。
                確認 pod <code>a52pzfcunv6ov8</code> 是否在 RunPod console 開機。
              </p>
            </div>
          </div>
        )}
      </div>

      {/* TTS test */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-purple-700" />
          TTS · 文字 → Eric 聲音
        </h2>
        <div className="p-6 rounded-xl border border-gray-200 bg-white space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              預設聲音
            </label>
            <select
              value={ttsVoice}
              onChange={(e) => setTtsVoice(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900"
            >
              {PRESET_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              文字內容
            </label>
            <textarea
              value={ttsText}
              onChange={(e) => setTtsText(e.target.value)}
              rows={3}
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder:text-gray-400"
              placeholder="輸入要念的文字..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                語速 ({ttsSpeed.toFixed(2)}x)
              </label>
              <input
                type="range"
                min={0.5}
                max={2.0}
                step={0.05}
                value={ttsSpeed}
                onChange={(e) => setTtsSpeed(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                輸出格式
              </label>
              <select
                value={ttsFormat}
                onChange={(e) => setTtsFormat(e.target.value as 'wav' | 'mp3')}
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900"
              >
                <option value="wav">WAV (無損)</option>
                <option value="mp3">MP3</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleTts}
              disabled={ttsBusy}
              className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 disabled:bg-gray-400 text-white rounded-lg flex items-center gap-2 transition-colors"
            >
              {ttsBusy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> 合成中...
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" /> 合成
                </>
              )}
            </button>
            {ttsError && (
              <span className="text-red-700 text-sm flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {ttsError}
              </span>
            )}
          </div>

          {ttsAudioUrl && (
            <div className="pt-2 flex items-center gap-3">
              <audio controls src={ttsAudioUrl} className="flex-1" />
              <a
                href={ttsAudioUrl}
                download={`tts-${ttsVoice}.${ttsFormat}`}
                className="text-purple-700 hover:text-purple-900 p-2"
                title="下載"
              >
                <Download className="w-5 h-5" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* RVC convert */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Upload className="w-5 h-5 text-purple-700" />
          RVC · 上傳音檔 → 換成 Eric 聲音
        </h2>
        <p className="text-xs text-gray-600 mb-3">
          已有人聲錄音想換成 Eric 配音 → 上傳音檔(WAV/MP3,任何說話者),pod 會 voice-convert 成所選的 Eric 預設聲。
        </p>
        <form onSubmit={handleRvc} className="p-6 rounded-xl border border-gray-200 bg-white space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              目標聲音
            </label>
            <select
              value={rvcVoice}
              onChange={(e) => setRvcVoice(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900"
            >
              {PRESET_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              來源音檔 <span className="text-red-700">*</span>
            </label>
            <input
              ref={rvcFileRef}
              type="file"
              accept="audio/wav,audio/mpeg,audio/mp3,audio/ogg,audio/flac"
              onChange={(e) => setRvcFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
            />
            {rvcFile && (
              <p className="text-xs text-gray-500 mt-1">
                {rvcFile.name} · {(rvcFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              輸出格式
            </label>
            <select
              value={rvcFormat}
              onChange={(e) => setRvcFormat(e.target.value as 'wav' | 'mp3')}
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900"
            >
              <option value="wav">WAV (無損)</option>
              <option value="mp3">MP3</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={rvcBusy || !rvcFile}
              className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 disabled:bg-gray-400 text-white rounded-lg flex items-center gap-2 transition-colors"
            >
              {rvcBusy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> 轉換中(可能 30-90s)...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" /> 開始轉換
                </>
              )}
            </button>
            {rvcError && (
              <span className="text-red-700 text-sm flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {rvcError}
              </span>
            )}
          </div>

          {rvcAudioUrl && (
            <div className="pt-2 flex items-center gap-3">
              <audio controls src={rvcAudioUrl} className="flex-1" />
              <a
                href={rvcAudioUrl}
                download={`rvc-${rvcVoice}.${rvcFormat}`}
                className="text-purple-700 hover:text-purple-900 p-2"
                title="下載"
              >
                <Download className="w-5 h-5" />
              </a>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
