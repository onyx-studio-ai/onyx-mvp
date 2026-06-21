'use client';

/*
  Talent-facing live human-verification page. The talent reads ONE language-matched
  sentence (chosen server-side, shown here) and records it LIVE in the browser —
  there is deliberately NO file upload, so an AI-generated clip can't be submitted.
  The recording is filed privately; an admin later confirms by ear vs the demo.
*/

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Mic, Square, RotateCcw, Check, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';

type State = 'loading' | 'invalid' | 'ready' | 'recording' | 'recorded' | 'submitting' | 'done' | 'unsupported';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-lg">{children}</div>
    </main>
  );
}

export default function VerifyVoicePage() {
  const params = useParams();
  const token = String(params?.token || '');
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);

  const [state, setState] = useState<State>('loading');
  const [name, setName] = useState('');
  const [sentence, setSentence] = useState('');
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState('');

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!token) { setState('invalid'); return; }
    fetch(`/api/liveness/info?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (!r.ok) { setState('invalid'); return; }
        const d = await r.json();
        if (d.alreadySubmitted) { setState('done'); return; }
        setName(d.name || '');
        setSentence(d.sentence || '');
        if (typeof window !== 'undefined' && (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined')) {
          setState('unsupported');
        } else {
          setState('ready');
        }
      })
      .catch(() => setState('invalid'));
  }, [token]);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const startRecording = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = ['audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        blobRef.current = blob;
        setAudioUrl(URL.createObjectURL(blob));
        cleanupStream();
        setState('recorded');
      };
      mediaRef.current = mr;
      mr.start();
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => {
        if (s >= 30) { mr.state !== 'inactive' && mr.stop(); return s; } // hard stop at 30s
        return s + 1;
      }), 1000);
      setState('recording');
    } catch {
      setError(tx('無法使用麥克風,請允許瀏覽器存取麥克風後再試。', '无法使用麦克风,请允许浏览器访问麦克风后再试。', "Couldn't access the microphone — please allow mic access and try again."));
    }
  };

  const stopRecording = () => {
    if (mediaRef.current && mediaRef.current.state !== 'inactive') mediaRef.current.stop();
  };

  const reset = () => {
    blobRef.current = null;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl('');
    setSeconds(0);
    setState('ready');
  };

  const submit = async () => {
    if (!blobRef.current) return;
    setState('submitting');
    setError('');
    try {
      const ext = (blobRef.current.type.split('/')[1] || 'webm').split(';')[0];
      const form = new FormData();
      form.append('token', token);
      form.append('audio', blobRef.current, `liveness.${ext}`);
      const r = await fetch('/api/liveness/submit', { method: 'POST', body: form });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || 'submit_failed');
      }
      setState('done');
    } catch {
      setError(tx('送出失敗,請重試。', '提交失败,请重试。', 'Submission failed — please try again.'));
      setState('recorded');
    }
  };

  useEffect(() => () => cleanupStream(), [cleanupStream]);

  if (state === 'loading') {
    return <Shell><p className="text-gray-500 text-sm text-center">{tx('載入中…', '加载中…', 'Loading…')}</p></Shell>;
  }
  if (state === 'invalid') {
    return (
      <Shell>
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <h1 className="text-xl font-bold mb-2">{tx('連結無效或已過期', '链接无效或已过期', 'Invalid or expired link')}</h1>
          <p className="text-gray-400 text-sm">{tx('請使用我們最新寄給您的驗證連結,或直接回信與我們聯繫。', '请使用我们最新发给您的验证链接,或直接回信与我们联系。', 'Please use the latest verification link we sent you, or reply to our email.')}</p>
        </div>
      </Shell>
    );
  }
  if (state === 'unsupported') {
    return (
      <Shell>
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold mb-2">{tx('此瀏覽器不支援錄音', '此浏览器不支持录音', 'Recording not supported here')}</h1>
          <p className="text-gray-400 text-sm">{tx('請改用 Safari 或 Chrome 最新版(手機或電腦皆可),並確認網址為 https。', '请改用 Safari 或 Chrome 最新版(手机或电脑均可),并确认网址为 https。', 'Please open this in an up-to-date Safari or Chrome (phone or computer) over https.')}</p>
        </div>
      </Shell>
    );
  }
  if (state === 'done') {
    return (
      <Shell>
        <div className="text-center py-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-4">
            <Check className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2">{tx('已收到,謝謝你!', '已收到,谢谢你!', 'Got it — thank you!')}</h1>
          <p className="text-gray-400 text-sm leading-relaxed">{tx('我們已收到你的聲音驗證,會盡快確認。完成後就不用再做這一步了。', '我们已收到你的声音验证,会尽快确认。完成后就不用再做这一步了。', "We've received your voice verification and will confirm it shortly. You're done here.")}</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-xs tracking-widest text-amber-300 mb-1">{tx('ONYX · 真人聲音驗證', 'ONYX · 真人声音验证', 'ONYX · Voice verification')}</p>
      <h1 className="text-2xl font-bold mb-1">{name ? tx(`${name},一分鐘驗證`, `${name},一分钟验证`, `${name}, a one-minute check`) : tx('一分鐘聲音驗證', '一分钟声音验证', 'A one-minute voice check')}</h1>
      <p className="text-sm text-gray-400 mb-6">{tx('請現場唸出下面這句話 —— 不需上傳檔案,我們用來確認你本人的聲音。', '请现场朗读下面这句话 —— 无需上传文件,我们用来确认你本人的声音。', 'Read the sentence below out loud — no upload, just to confirm your own voice.')}</p>

      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-5 mb-5">
        <p className="text-xs text-amber-300/80 mb-2 flex items-center gap-1.5"><Mic className="w-3.5 h-3.5" /> {tx('請唸這句', '请读这句', 'Read this aloud')}</p>
        <p className="text-lg text-white leading-relaxed font-medium">{sentence || '—'}</p>
      </div>

      {(state === 'ready') && (
        <button onClick={startRecording} className="w-full h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold flex items-center justify-center gap-2 transition-colors">
          <Mic className="w-5 h-5" /> {tx('開始錄音', '开始录音', 'Start recording')}
        </button>
      )}

      {state === 'recording' && (
        <button onClick={stopRecording} className="w-full h-12 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold flex items-center justify-center gap-2 transition-colors">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <Square className="w-4 h-4" /> {tx('停止錄音', '停止录音', 'Stop')} · {seconds}s
        </button>
      )}

      {(state === 'recorded' || state === 'submitting') && (
        <div className="space-y-4">
          {audioUrl && <audio controls src={audioUrl} className="w-full" />}
          <label className="flex items-start gap-2.5 text-sm text-gray-300 cursor-pointer">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 accent-amber-500" />
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0" />{tx('我確認這是我本人、現在現場錄製的真實聲音。', '我确认这是我本人、现在现场录制的真实声音。', 'I confirm this is my own real voice, recorded live just now.')}</span>
          </label>
          <div className="flex gap-3">
            <button onClick={reset} disabled={state === 'submitting'} className="flex-1 h-11 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50">
              <RotateCcw className="w-4 h-4" /> {tx('重錄', '重录', 'Re-record')}
            </button>
            <button onClick={submit} disabled={!agreed || state === 'submitting'} className="flex-1 h-11 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
              {state === 'submitting' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {tx('送出驗證', '提交验证', 'Submit')}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-red-400 text-sm mt-4 text-center">{error}</p>}
    </Shell>
  );
}
