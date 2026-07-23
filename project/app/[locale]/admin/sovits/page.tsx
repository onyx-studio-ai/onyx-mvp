'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Wand2, Upload, AlertCircle, CheckCircle2, Loader2, RefreshCw, Volume2, Download } from 'lucide-react';

// Browser → RunPod direct (bypasses Vercel function 10s timeout on Hobby plan).
const SOVITS_URL = (process.env.NEXT_PUBLIC_SOVITS_API_URL || '').replace(/\/$/, '');
// 安全審計 H-2:API Key 不再走 NEXT_PUBLIC_ 環境變數(會被 inline 進前端 bundle、任何訪客可取),
// 改由 admin 在頁面輸入、只存於本機瀏覽器 localStorage。URL 非機密可留。
const SOVITS_KEY_STORAGE = 'sovits_api_key';

interface VoiceEntry {
  voice_id: string;
  name: string;
  type: string;
}

interface HealthInfo {
  status: string;
  model?: string;
}

function authHeaders(key: string): Record<string, string> {
  return key ? { Authorization: `Bearer ${key}` } : {};
}

export default function AdminSovitsPage() {
  const t = useTranslations('admin.sovits');
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [healthError, setHealthError] = useState('');
  const [loadingHealth, setLoadingHealth] = useState(true);

  // API Key:只存本機 localStorage(見檔頭 H-2 註解)
  const [apiKey, setApiKey] = useState('');
  const [apiKeyLoaded, setApiKeyLoaded] = useState(false);

  function handleApiKeyChange(value: string) {
    setApiKey(value);
    try {
      localStorage.setItem(SOVITS_KEY_STORAGE, value);
    } catch { /* 隱私模式下 localStorage 可能不可寫,忽略 */ }
  }

  // Dynamic voice list from gateway /v1/voices
  const [allVoices, setAllVoices] = useState<VoiceEntry[]>([]);
  const ttsVoices = allVoices.filter((v) => v.type === 'tts');
  const rvcVoices = allVoices.filter((v) => v.type === 'rvc_pipeline');

  // TTS test form
  const [ttsVoice, setTtsVoice] = useState('');
  const [ttsText, setTtsText] = useState(t('ttsDefaultText'));
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [ttsFormat, setTtsFormat] = useState<'wav' | 'mp3'>('wav');
  const [ttsBusy, setTtsBusy] = useState(false);
  const [ttsAudioUrl, setTtsAudioUrl] = useState('');
  const [ttsError, setTtsError] = useState('');

  // RVC convert form
  const [rvcVoice, setRvcVoice] = useState('');
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
      const res = await fetch(`${SOVITS_URL}/health`, { headers: authHeaders(apiKey) });
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

  async function loadVoices() {
    if (!SOVITS_URL) return;
    try {
      const res = await fetch(`${SOVITS_URL}/v1/voices`, { headers: authHeaders(apiKey) });
      if (!res.ok) return;
      const data = (await res.json()) as { data: VoiceEntry[] };
      setAllVoices(data.data || []);
      // 初始化選項:第一個 tts / 第一個 rvc
      const firstTts = data.data?.find((v) => v.type === 'tts');
      const firstRvc = data.data?.find((v) => v.type === 'rvc_pipeline');
      if (firstTts) setTtsVoice(firstTts.voice_id);
      if (firstRvc) setRvcVoice(firstRvc.voice_id);
    } catch (err) {
      // 無聲失敗 — 健康檢查會反映 pod 狀態
    }
  }

  // 先從 localStorage 回填 API Key,再做首次連線(避免用空 key 打健康檢查)
  useEffect(() => {
    try {
      setApiKey(localStorage.getItem(SOVITS_KEY_STORAGE) || '');
    } catch { /* 讀不到就維持空字串 */ }
    setApiKeyLoaded(true);
  }, []);

  useEffect(() => {
    if (!apiKeyLoaded) return;
    loadHealth();
    loadVoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKeyLoaded]);

  async function handleTts() {
    if (!ttsText.trim()) return setTtsError(t('errEnterText'));
    if (!SOVITS_URL) return setTtsError(t('errNoSovitsUrl'));

    setTtsBusy(true);
    setTtsError('');
    setTtsAudioUrl('');

    try {
      const res = await fetch(`${SOVITS_URL}/v1/audio/speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(apiKey) },
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
        throw new Error(errText.slice(0, 200) || t('ttsFailed'));
      }
      const blob = await res.blob();
      setTtsAudioUrl(URL.createObjectURL(blob));
    } catch (err) {
      setTtsError(err instanceof Error ? err.message : t('ttsFailed'));
    } finally {
      setTtsBusy(false);
    }
  }

  async function handleRvc(e: React.FormEvent) {
    e.preventDefault();
    if (!rvcFile) return setRvcError(t('errPickAudio'));
    if (!SOVITS_URL) return setRvcError(t('errNoSovitsUrl'));

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
        headers: authHeaders(apiKey), // no Content-Type — browser sets multipart boundary
        body: formData,
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => `HTTP ${res.status}`);
        throw new Error(errText.slice(0, 200) || t('rvcFailed'));
      }
      const blob = await res.blob();
      setRvcAudioUrl(URL.createObjectURL(blob));
    } catch (err) {
      setRvcError(err instanceof Error ? err.message : t('rvcFailed'));
    } finally {
      setRvcBusy(false);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Wand2 className="w-7 h-7 text-purple-700" />
          GPT-SoVITS — TTS + RVC (Eric)
        </h1>
        <p className="text-gray-600 text-sm mt-1">
          {t('subtitle')}
        </p>
      </div>

      {/* API Key(只存本機瀏覽器,不進 bundle / 不上伺服器) */}
      <div className="mb-8 p-4 rounded-xl border border-gray-200 bg-white">
        <label className="block text-sm font-semibold text-gray-700 mb-2">API Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => handleApiKeyChange(e.target.value)}
          placeholder="輸入 SoVITS 閘道 API Key"
          autoComplete="off"
          className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder:text-gray-400"
        />
        <p className="text-xs text-gray-500 mt-1.5">
          金鑰只儲存在此瀏覽器的 localStorage,不會寫進程式碼或傳回我們的伺服器;填好後點下方狀態卡的重新整理圖示重新連線。
        </p>
        {!apiKey && (
          <p className="text-xs text-amber-700 mt-1.5 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            尚未填入 API Key,連線 SoVITS 服務前請先輸入。
          </p>
        )}
      </div>

      {/* Health status */}
      <div className="mb-8 p-4 rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700">{t('podStatus')}</h2>
          <button
            onClick={loadHealth}
            className="text-gray-500 hover:text-gray-900 p-1"
            title={t('refresh')}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        {loadingHealth ? (
          <p className="text-gray-500 text-sm">{t('checking')}</p>
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
              <p className="font-semibold">{t('podUnreachable')}</p>
              <p className="text-xs mt-1">{healthError}</p>
              <p className="text-xs mt-2 text-gray-600">
                {t('checkEnvPrefix')} <code>NEXT_PUBLIC_SOVITS_API_URL</code> /{' '}
                上方 API Key 欄位{t('checkEnvSuffix')}
                {' '}{t('checkPodPrefix')} <code>a52pzfcunv6ov8</code> {t('checkPodSuffix')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* TTS test */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-purple-700" />
          {t('ttsSectionTitle')}
        </h2>
        <div className="p-6 rounded-xl border border-gray-200 bg-white space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('defaultVoice')}
            </label>
            <select
              value={ttsVoice}
              onChange={(e) => setTtsVoice(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900"
            >
              {ttsVoices.length === 0 && <option value="">{t('loading')}</option>}
              {ttsVoices.map((v) => (
                <option key={v.voice_id} value={v.voice_id}>
                  {v.name} ({v.voice_id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('textContent')}
            </label>
            <textarea
              value={ttsText}
              onChange={(e) => setTtsText(e.target.value)}
              rows={3}
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder:text-gray-400"
              placeholder={t('textPlaceholder')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('speed', { speed: ttsSpeed.toFixed(2) })}
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
                {t('outputFormat')}
              </label>
              <select
                value={ttsFormat}
                onChange={(e) => setTtsFormat(e.target.value as 'wav' | 'mp3')}
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900"
              >
                <option value="wav">{t('wavLossless')}</option>
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
                  <Loader2 className="w-4 h-4 animate-spin" /> {t('synthesizing')}
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" /> {t('synthesize')}
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
                title={t('download')}
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
          {t('rvcSectionTitle')}
        </h2>
        <p className="text-xs text-gray-600 mb-3">
          {t('rvcSectionDesc')}
        </p>
        <form onSubmit={handleRvc} className="p-6 rounded-xl border border-gray-200 bg-white space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('targetVoice')}
            </label>
            <select
              value={rvcVoice}
              onChange={(e) => setRvcVoice(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900"
            >
              {rvcVoices.length === 0 && <option value="">{t('noRvcVoice')}</option>}
              {rvcVoices.map((v) => (
                <option key={v.voice_id} value={v.voice_id}>
                  {v.name} ({v.voice_id})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {t('autoPitchHint')}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('sourceAudio')} <span className="text-red-700">*</span>
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
              {t('outputFormat')}
            </label>
            <select
              value={rvcFormat}
              onChange={(e) => setRvcFormat(e.target.value as 'wav' | 'mp3')}
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900"
            >
              <option value="wav">{t('wavLossless')}</option>
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
                  <Loader2 className="w-4 h-4 animate-spin" /> {t('converting')}
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" /> {t('startConvert')}
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
                title={t('download')}
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
