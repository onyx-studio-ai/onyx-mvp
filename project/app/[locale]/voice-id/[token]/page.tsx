'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Upload, Mic, CheckCircle, AlertTriangle, Shield, Loader2, Eraser, PenTool, FileText, ChevronDown, ChevronUp, CreditCard } from 'lucide-react';

type PageState = 'loading' | 'valid' | 'invalid' | 'expired' | 'already_submitted' | 'uploading' | 'success';

// English by default; Chinese only for zh locales. (The binding agreement body
// stays English — authoritative — per legal review.)
const mkTx = (locale: string) => (tw: string, cn: string, en: string) =>
  locale === 'zh-CN' ? cn : locale.startsWith('zh') ? tw : en;

function SignaturePad({ onSignatureChange }: { onSignatureChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const tx = mkTx(useLocale());

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const endDraw = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setHasSignature(true);
    const dataUrl = canvasRef.current?.toDataURL('image/png') || null;
    onSignatureChange(dataUrl);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onSignatureChange(null);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 600;
    canvas.height = 200;
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PenTool className="w-4 h-4 text-green-400" />
          <h3 className="text-white font-semibold text-sm">{tx('電子簽名', '电子签名', 'Electronic Signature')}</h3>
        </div>
        {hasSignature && (
          <button
            type="button"
            onClick={clearSignature}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
          >
            <Eraser className="w-3.5 h-3.5" /> {tx('清除', '清除', 'Clear')}
          </button>
        )}
      </div>
      <p className="text-gray-500 text-xs">{tx('在下方簽名,確認您的身分並授權本協議。', '在下方签名,确认您的身分并授权本协议。', 'Sign below to confirm your identity and authorize the agreement.')}</p>
      <div className="relative rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-900/50 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-[120px] sm:h-[150px] cursor-crosshair touch-none"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-zinc-600 text-sm">{tx('用手指或滑鼠在此簽名', '用手指或鼠标在此签名', 'Sign here with your finger or mouse')}</p>
          </div>
        )}
        <div className="absolute bottom-3 left-4 right-4 border-t border-zinc-700" />
      </div>
    </div>
  );
}

export default function VoiceIdUploadPage() {
  const params = useParams();
  const token = params.token as string;
  const tx = mkTx(useLocale());

  const [pageState, setPageState] = useState<PageState>('loading');
  const [talentName, setTalentName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [vidNumber, setVidNumber] = useState('');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showFullAgreement, setShowFullAgreement] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [paymentDetails, setPaymentDetails] = useState({
    paypal_email: '', bank_name: '', bank_code: '',
    account_name: '', account_number: '', swift_code: '',
    bank_country: '', notes: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/voice-id/upload?token=${token}`)
      .then(async r => {
        const data = await r.json();
        if (r.ok && data.valid) {
          setTalentName(data.talentName || '');
          setPageState('valid');
        } else if (r.status === 410) {
          setPageState('expired');
        } else if (r.status === 400 && data.error?.includes('already')) {
          setPageState('already_submitted');
        } else {
          setPageState('invalid');
          setErrorMsg(data.error || tx('連結無效', '链接无效', 'Invalid token'));
        }
      })
      .catch(() => {
        setPageState('invalid');
        setErrorMsg(tx('無法驗證連結', '无法验证链接', 'Unable to validate token'));
      });
  }, [token]);

  const handleUpload = useCallback(async () => {
    if (!file || !token || !signatureDataUrl || !paymentMethod) return;

    // Necessary payment fields must be filled; optional ones may stay blank.
    if (paymentMethod === 'paypal' && !paymentDetails.paypal_email.trim()) {
      setErrorMsg(tx('請填寫 PayPal 電子郵件。', '请填写 PayPal 电子邮件。', 'Please enter your PayPal email.'));
      return;
    }
    if (paymentMethod === 'bank_transfer') {
      const d = paymentDetails;
      if (!d.account_name.trim() || !d.bank_name.trim() || !d.account_number.trim() || !d.swift_code.trim()) {
        setErrorMsg(tx(
          '請填寫銀行轉帳必填欄位:帳戶名稱、銀行名稱、帳號 / IBAN、SWIFT / BIC。',
          '请填写银行转账必填项:账户名称、银行名称、账号 / IBAN、SWIFT / BIC。',
          'Please complete the required bank fields: account holder name, bank name, account number / IBAN, and SWIFT / BIC.',
        ));
        return;
      }
    }
    setErrorMsg('');
    setPageState('uploading');

    try {
      const form = new FormData();
      form.append('token', token);
      form.append('file', file);
      form.append('signature', signatureDataUrl);
      form.append('payment_method', paymentMethod);
      form.append('payment_details', JSON.stringify(paymentDetails));

      const res = await fetch('/api/voice-id/upload', { method: 'POST', body: form });
      const data = await res.json();

      if (res.ok && data.success) {
        setVidNumber(data.vidNumber || '');
        setPageState('success');
      } else {
        setPageState('valid');
        setErrorMsg(data.error || tx('上傳失敗', '上传失败', 'Upload failed'));
      }
    } catch {
      setPageState('valid');
      setErrorMsg(tx('上傳失敗,請再試一次。', '上传失败,请再试一次。', 'Upload failed. Please try again.'));
    }
  }, [file, token, signatureDataUrl, paymentMethod, paymentDetails]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) validateAndSetFile(f);
  }, []);

  const validateAndSetFile = (f: File) => {
    setErrorMsg('');
    const allowedTypes = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/x-wav', 'audio/wave'];
    if (!allowedTypes.includes(f.type)) {
      setErrorMsg(tx('請上傳 WAV 或 MP3 檔。', '请上传 WAV 或 MP3 文件。', 'Please upload a WAV or MP3 file.'));
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setErrorMsg(tx('檔案需小於 10MB。', '文件需小于 10MB。', 'File must be under 10MB.'));
      return;
    }
    setFile(f);
  };

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-green-400 animate-spin" />
          <p className="text-gray-400 text-sm">{tx('驗證連結中…', '验证链接中…', 'Verifying your link...')}</p>
        </div>
      </div>
    );
  }

  if (pageState === 'invalid' || pageState === 'expired' || pageState === 'already_submitted') {
    const configs = {
      invalid: {
        icon: <AlertTriangle className="w-12 h-12 text-red-400" />,
        title: tx('連結無效', '链接无效', 'Invalid Link'),
        desc: tx('此聲音 ID 連結無效或已被撤銷。若您認為這是錯誤,請聯絡 Onyx Studios。', '此声音 ID 链接无效或已被撤销。若您认为这是错误,请联系 Onyx Studios。', 'This Voice ID link is invalid or has been revoked. Please contact Onyx Studios if you believe this is an error.'),
      },
      expired: {
        icon: <AlertTriangle className="w-12 h-12 text-amber-400" />,
        title: tx('連結已過期', '链接已过期', 'Link Expired'),
        desc: tx('此聲音 ID 連結已過期。請聯絡 Onyx Studios 重新取得。', '此声音 ID 链接已过期。请联系 Onyx Studios 重新取得。', 'This Voice ID link has expired. Please contact Onyx Studios to request a new one.'),
      },
      already_submitted: {
        icon: <CheckCircle className="w-12 h-12 text-green-400" />,
        title: tx('已提交', '已提交', 'Already Submitted'),
        desc: tx('您的聲音 ID 已成功提交,無需再處理。', '您的声音 ID 已成功提交,无需再处理。', 'Your Voice ID has already been submitted successfully. No further action is needed.'),
      },
    };
    const c = configs[pageState];

    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">{c.icon}</div>
          <h1 className="text-2xl font-bold text-white">{c.title}</h1>
          <p className="text-gray-400 text-sm leading-relaxed">{c.desc}</p>
          <a href="mailto:support@onyxstudios.ai" className="inline-block text-green-400 text-sm hover:underline">
            {tx('聯絡客服', '联系客服', 'Contact Support')}
          </a>
        </div>
      </div>
    );
  }

  if (pageState === 'success') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">{tx('聲音 ID 已提交', '声音 ID 已提交', 'Voice ID Submitted')}</h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            {tx(`${talentName || ''} 您好,我們已收到您的聲音 ID 錄音,正在處理中。`, `${talentName || ''} 您好,我们已收到您的声音 ID 录音,正在处理中。`, `Thank you, ${talentName || 'Talent'}. Your Voice ID recording has been received and is being processed.`)}
          </p>
          {vidNumber && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">{tx('參考編號', '参考编号', 'Reference Number')}</p>
              <p className="text-green-400 text-lg font-mono font-bold">{vidNumber}</p>
            </div>
          )}
          <p className="text-gray-500 text-xs">{tx('您可以安全關閉此頁面。', '您可以安全关闭此页面。', 'You can safely close this page.')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-full px-4 py-1.5 text-xs text-gray-400 uppercase tracking-wider">
            <Shield className="w-3.5 h-3.5 text-green-400" />
            {tx('安全驗證', '安全验证', 'Secure Verification')}
          </div>
          <h1 className="text-3xl font-bold text-white">
            <span className="text-green-400">{tx('聲音 ID', '声音 ID', 'Voice ID')}</span> {tx('驗證', '验证', 'Verification')}
          </h1>
          <p className="text-gray-400 text-sm">
            {tx('您好 ', '您好 ', 'Welcome, ')}<span className="text-white font-medium">{talentName || 'Talent'}</span>{tx(',請於下方上傳您的聲音 ID 錄音。', ',请于下方上传您的声音 ID 录音。', '. Please upload your Voice ID recording below.')}
          </p>
        </div>

        {/* Instructions Card */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center justify-center">
              <Mic className="w-4 h-4 text-green-400" />
            </div>
            <h2 className="text-white font-semibold">{tx('錄音說明', '录音说明', 'Recording Instructions')}</h2>
          </div>
          <ol className="space-y-2 text-sm text-gray-400 list-decimal list-inside">
            <li>{tx('找一個安靜、無背景雜音的空間', '找一个安静、无背景杂音的空间', 'Find a quiet room with no background noise')}</li>
            <li>{tx('用您自然的聲音清楚唸出', '用您自然的声音清楚念出', 'Speak clearly in your natural voice')}</li>
            <li>{tx('唸出:', '念出:', 'Say: ')}<span className="text-white italic">{tx('「我,[您的全名],確認這是我本人的真實聲音。我在此授權 Onyx Studios 依雙方簽署之協議,製作並商業管理我的 AI 聲音分身,日期為 [今日日期]。」', '「我,[您的全名],确认这是我本人的真实声音。我在此授权 Onyx Studios 依双方签署之协议,制作并商业管理我的 AI 声音分身,日期为 [今日日期]。」', '“I, [Your Full Name], confirm this is my own biological voice. I hereby authorize Onyx Studios to create and commercially manage an AI digital twin of my voice under our signed agreement, on this date, [Today’s Date].”')}</span></li>
            <li>{tx('以 WAV 或 MP3 儲存(最大 10MB)', '以 WAV 或 MP3 保存(最大 10MB)', 'Save as WAV or MP3 (max 10MB)')}</li>
          </ol>
        </div>

        {/* Agreement Section */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowFullAgreement(!showFullAgreement)}
            className="w-full flex items-center justify-between p-6 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h2 className="text-white font-semibold">{tx('配音員合作協議', '配音员合作协议', 'Talent Engagement Agreement')}</h2>
                <p className="text-gray-500 text-xs mt-0.5">{tx('簽署前請詳閱完整協議(以英文版為準)', '签署前请详阅完整协议(以英文版为准)', 'Review the full agreement before signing')}</p>
              </div>
            </div>
            {showFullAgreement ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </button>

          {showFullAgreement && (
            <div className="px-6 pb-6">
              <div className="max-h-[500px] overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-xl p-5 text-sm text-gray-300 leading-relaxed space-y-5 scrollbar-thin">
                <h3 className="text-white font-bold text-lg border-b border-zinc-800 pb-3">Onyx Studios — Talent Engagement Agreement</h3>

                <p className="text-gray-500 text-xs">Last Updated: February 23, 2026 &middot; 30 Clauses</p>

                {/* Part I */}
                <h4 className="text-green-400 font-bold text-sm uppercase tracking-wider pt-2">Part I: Basic Terms</h4>

                <div>
                  <h4 className="text-white font-semibold mb-1">1. Parties &amp; Recitals</h4>
                  <p><strong className="text-white">Party A:</strong> Fine Entertainment | 凡音文化有限公司, d/b/a Onyx Studios (Unified Business No.: 24312593)</p>
                  <p><strong className="text-white">Party B:</strong> {talentName || '[Talent Full Legal Name]'}</p>
                  <p>Talent possesses professional vocal performance capabilities. Onyx operates an AI-powered audio production platform. Both parties agree to collaborate under the following terms.</p>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-1">2. Definitions</h4>
                  <ul className="list-disc list-inside space-y-1 text-gray-400">
                    <li><strong className="text-gray-200">&ldquo;AI Twin&rdquo;</strong> — The AI voice model trained by Onyx using Training Materials provided by the Talent.</li>
                    <li><strong className="text-gray-200">&ldquo;Training Materials&rdquo;</strong> — Original audio recordings made by the Talent specifically for Onyx&apos;s AI model training purposes.</li>
                    <li><strong className="text-gray-200">&ldquo;Asset&rdquo;</strong> — Any digital audio file generated using the AI Twin or produced by the Talent under this Agreement.</li>
                    <li><strong className="text-gray-200">&ldquo;Micro-Patch&rdquo;</strong> — A request for the Talent to re-record a specific segment of an AI-generated Asset with their natural voice.</li>
                    <li><strong className="text-gray-200">&ldquo;License Certificate&rdquo;</strong> — The formal authorization document issued by Onyx to its Clients.</li>
                    <li><strong className="text-gray-200">&ldquo;Archive Status&rdquo;</strong> — A model state in which the AI Twin ceases commercial generation but is retained for license validation and legal compliance.</li>
                    <li><strong className="text-gray-200">&ldquo;Biological Digital Signature&rdquo;</strong> — The Voice ID recording that serves as a biometric voice print for identity authentication and rights verification.</li>
                    <li><strong className="text-gray-200">&ldquo;Neighboring Rights&rdquo;</strong> — Performers&apos; rights as recognized under the WIPO Performances and Phonograms Treaty, including rights of fixation, reproduction, and distribution.</li>
                    <li><strong className="text-gray-200">&ldquo;Moral Rights&rdquo;</strong> — The non-economic rights of attribution (<em>droit de paternit&eacute;</em>) and integrity (<em>droit au respect</em>) as recognized under applicable copyright law.</li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-1">3. Engagement Type</h4>
                  <p>Talent is engaged as an <strong className="text-white">Independent Contractor</strong>, not an employee. All approved work is performed on a Work Made for Hire basis. This Agreement does not create a partnership, joint venture, or employer-employee relationship.</p>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-1">4. Term</h4>
                  <p><strong className="text-white">Initial Term:</strong> From the date of execution for a period of 12 months. <strong className="text-white">Auto-Renewal:</strong> Unless either party provides 30 days&apos; written notice prior to expiration. <strong className="text-white">Immediate Termination:</strong> Material breach, illegal conduct, or actions causing serious harm to the Onyx brand reputation.</p>
                </div>

                {/* Part II */}
                <h4 className="text-green-400 font-bold text-sm uppercase tracking-wider pt-2">Part II: AI Twin Program</h4>

                <div>
                  <h4 className="text-white font-semibold mb-1">5. Training Data Obligation</h4>
                  <p>Talent agrees to provide a minimum of <strong className="text-white">1 hour</strong> of clean, home-studio quality audio based on scripts provided by Onyx. Onyx bears all model training costs. Delivery standard: Dry audio, no background noise, 48kHz/24bit.</p>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-1">6. Exclusive AI License</h4>
                  <p>Talent grants Onyx the <strong className="text-white">exclusive</strong> right to manage and commercialize their AI Twin. Talent shall not license Training Materials or the AI Twin to any third-party platform. <strong className="text-white">Reservation of Rights:</strong> Talent retains the right to use their natural voice for entirely new recordings on other platforms. This exclusivity applies solely to Onyx&apos;s Training Materials and the resulting AI Twin model.</p>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-1">7. AI Model Weights &amp; IP Ownership</h4>
                  <p>Talent <strong className="text-white">retains</strong> their natural vocal identity and Right of Publicity. Onyx <strong className="text-white">owns</strong> all AI model weights, training pipeline, algorithms, and related source code. Talent shall not request extraction, copying, reverse engineering, or delivery of model weights. Clients acquire a commercial use license, not ownership of the model.</p>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-1">8. Royalty</h4>
                  <p>Onyx shall pay Talent a royalty of <strong className="text-white">25%</strong> of the final sale price for each pure-AI generation. Monthly settlement with payment by the 31st of the following month via bank transfer or PayPal. Onyx shall provide monthly statements. Tax responsibility lies solely with Talent.</p>
                </div>

                {/* Part III */}
                <h4 className="text-green-400 font-bold text-sm uppercase tracking-wider pt-2">Part III: Service Obligations</h4>

                <div>
                  <h4 className="text-white font-semibold mb-1">9. Micro-Patch Protocol</h4>
                  <p>Voice Actor: <strong className="text-white">US$10</strong> per request. Singer (up to 4 bars): <strong className="text-white">US$15</strong> per request. Delivery within <strong className="text-white">48 hours</strong>. Short-Term Absence (up to 14 days): deadline suspended, fulfill upon return. Extended Absence (over 14 days): Onyx may use AI alternative or substitute Talent.</p>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-1">10. Traditional Recording Rates</h4>
                  <p>Rates per the Talent&apos;s rate card submitted at the time of application. All traditional recording work is performed on a Work Made for Hire basis.</p>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-1">10A. Commission Payments</h4>
                  <p>Commission payments are processed <strong className="text-white">monthly</strong> via the Talent&apos;s designated payment method (PayPal or bank transfer) as provided during onboarding. Onyx is not responsible for transaction fees imposed by third-party payment processors or financial institutions. Tax obligations arising from commission income are the <strong className="text-white">sole responsibility of the Talent</strong>.</p>
                </div>

                {/* Part IV */}
                <h4 className="text-green-400 font-bold text-sm uppercase tracking-wider pt-2">Part IV: Rights Transfer</h4>

                <div>
                  <h4 className="text-white font-semibold mb-1">11. Rights Transfer</h4>
                  <p>All approved works are <strong className="text-white">irrevocably</strong> transferred to Onyx: (a) <strong className="text-gray-200">Master Recording Rights</strong> (sound recording copyright), (b) <strong className="text-gray-200">Composition Rights</strong> (limited to portions created by the Talent), (c) <strong className="text-gray-200">Neighboring Rights</strong> (performers&apos; rights under WIPO Performances and Phonograms Treaty, including rights of fixation, reproduction, and distribution). This transfer is <strong className="text-white">perpetual, worldwide, and irrevocable</strong>.</p>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-1">12. Moral Rights Waiver</h4>
                  <p>To the fullest extent permitted by applicable law, Talent irrevocably waives and agrees not to assert any <strong className="text-gray-200">Moral Rights</strong> (<em>droits moraux</em>) against Onyx or its licensees, including but not limited to: (a) <strong className="text-gray-200">Right of Attribution</strong> (<em>droit de paternit&eacute;</em>) — the right to be identified as the author or performer; (b) <strong className="text-gray-200">Right of Integrity</strong> (<em>droit au respect</em>) — the right to object to modifications, distortions, or adaptations. Clients are free to edit, remix, adapt, truncate, or incorporate the work into derivative works without restriction.</p>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-1">13. Voice ID Affidavit &amp; Biological Digital Signature</h4>
                  <p>Talent agrees to provide a <strong className="text-white">10-second Voice ID recording</strong> that serves as a <strong className="text-gray-200">Biological Digital Signature</strong> — a biometric voice print confirming the Talent&apos;s identity, the authenticity of submitted Training Materials, and the lawful, irrevocable transfer of rights under this Agreement. The Voice ID is cryptographically linked to all License Certificates issued by Onyx and constitutes legally binding biometric authentication equivalent to a handwritten signature. Recorded once, used permanently.</p>
                </div>

                {/* Part V */}
                <h4 className="text-green-400 font-bold text-sm uppercase tracking-wider pt-2">Part V: Termination &amp; Departure</h4>

                <div>
                  <h4 className="text-white font-semibold mb-1">14. Termination</h4>
                  <p>Either party may terminate with <strong className="text-white">30 days&apos;</strong> written notice. Grounds for immediate termination: material breach not cured within 15 days, violation of law, conduct causing serious damage to Onyx&apos;s brand reputation.</p>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-1">15. Transition Period</h4>
                  <p>A 30-day transition period begins from the effective date of termination notice. Talent shall complete all pending Micro-Patch requests. After the transition period, Onyx will not assign new requests.</p>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-1">16. Non-Retroactive Departure</h4>
                  <p>Termination shall <strong className="text-white">not affect</strong> any License Certificates issued prior to the effective termination date. All legacy Assets remain fully and perpetually licensed to existing Clients. Talent irrevocably agrees not to make any claim against Onyx or its Clients regarding such Assets.</p>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-1">17. Post-Departure Archival Rights</h4>
                  <p>Upon termination, the AI Twin enters <strong className="text-white">Archive Status</strong>: (a) no longer used for new commercial generation, (b) no longer available for new client orders, (c) retained solely for validation and authenticity verification of existing License Certificates, (d) retained for copyright inquiries and legal compliance. Archival is <strong className="text-white">permanent and irrevocable</strong>. Legal basis: <strong className="text-gray-200">Legitimate Interests</strong> under GDPR Article 6(1)(f) — specifically, the protection of contractual obligations owed to existing licensees. Talent acknowledges that deletion of the archived model would undermine the legal validity of previously issued License Certificates and harm the legitimate interests of Onyx&apos;s Clients.</p>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-1">18. Legacy Protection</h4>
                  <p>This Agreement is binding upon the Talent&apos;s heirs, executors, administrators, and assigns. Clients are protected against claims from the Talent&apos;s estate regarding right of publicity or post-mortem likeness rights.</p>
                </div>

                {/* Part VI */}
                <h4 className="text-green-400 font-bold text-sm uppercase tracking-wider pt-2">Part VI: General Terms</h4>

                <div>
                  <h4 className="text-white font-semibold mb-1">19. Confidentiality</h4>
                  <p>Talent shall not disclose Onyx&apos;s technical details, model architecture, training methods, or client information. This obligation survives termination for <strong className="text-white">3 years</strong>.</p>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-1">20. Non-Solicitation</h4>
                  <p>During the term and for <strong className="text-white">24 months</strong> thereafter, Talent shall not directly or indirectly solicit Onyx&apos;s Clients or circumvent the Platform to engage privately with Clients.</p>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-1">21. Non-Disparagement</h4>
                  <p>During and after the term, neither party shall make defamatory or disparaging remarks about the other party.</p>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-1">22. Representations &amp; Warranties</h4>
                  <p>Talent represents and warrants that: (a) all submitted audio features their own natural voice without synthetic generation or voice cloning; (b) submissions do not infringe any third-party IP rights; (c) Talent is at least <strong className="text-white">18 years of age</strong> with full legal capacity; (d) Talent is not restricted by any other contractual obligation; (e) Talent is not subject to international sanctions or export controls.</p>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-1">23. Indemnification</h4>
                  <p>Talent shall indemnify and hold Onyx harmless from any third-party claims arising from breach of the Talent&apos;s representations or warranties.</p>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-1">24. Limitation of Liability</h4>
                  <p>In no event shall Onyx&apos;s aggregate, cumulative liability to Talent under or in connection with this Agreement exceed the <strong className="text-white">total commissions and royalties actually paid to Talent during the twelve (12) months immediately preceding the event giving rise to the claim</strong>. Neither party shall be liable for any indirect, incidental, consequential, special, or punitive damages, including but not limited to loss of revenue, loss of profits, loss of business opportunity, or reputational harm, even if advised of the possibility of such damages.</p>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-1">25. Data Protection</h4>
                  <p>Onyx warrants that Talent&apos;s raw biometric data (including voice recordings, Voice ID, and electronic signatures) will be used <strong className="text-white">solely for AI model generation and identity verification</strong>, and will not be shared with unauthorized third parties. Compliant with Taiwan PDPA, GDPR, and applicable international data protection laws. Talent has the right to request access to and correction of personal data (model archival rights are not affected).</p>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-1">26. Taxes</h4>
                  <p>Talent is solely responsible for tax reporting and payment on royalty income. Onyx does not withhold taxes unless required by local law.</p>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-1">27. Governing Law &amp; Dispute Resolution</h4>
                  <p>Governed by the laws of <strong className="text-white">Taiwan (Republic of China)</strong>. Exclusive jurisdiction: <strong className="text-white">New Taipei District Court</strong>. International Talent: good-faith negotiation for 30 days before court proceedings.</p>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-1">28. Severability</h4>
                  <p>If any provision is found unenforceable, the remaining provisions remain in full force and effect.</p>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-1">29. Entire Agreement</h4>
                  <p>This Agreement constitutes the entire agreement between the parties. No oral statements, WhatsApp/WeChat messages, or prior correspondence shall have legal effect. Amendments require written consent of both parties.</p>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-1">30. Execution</h4>
                  <p>Signatures of both parties + Date. Electronic signatures are legally equivalent to physical signatures under the <strong className="text-white">Electronic Signatures Act of Taiwan (R.O.C.)</strong>.</p>
                </div>
              </div>
            </div>
          )}

          <div className="px-6 pb-5">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-green-500 focus:ring-green-500 focus:ring-offset-0 cursor-pointer"
              />
              <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
                {tx('我已閱讀並同意 ', '我已阅读并同意 ', 'I have read and agree to the ')}<button type="button" onClick={() => setShowFullAgreement(true)} className="text-green-400 hover:underline">{tx('配音員合作協議', '配音员合作协议', 'Talent Engagement Agreement')}</button>{tx('。我了解我的電子簽名與聲音 ID 錄音構成具法律約束力的同意。', '。我了解我的电子签名与声音 ID 录音构成具法律约束力的同意。', '. I understand that my electronic signature and Voice ID recording constitute a legally binding consent.')}
              </span>
            </label>
          </div>
        </div>

        {/* Upload Area */}
        <div
          className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
            dragOver
              ? 'border-green-400 bg-green-500/5'
              : file
              ? 'border-green-500/40 bg-green-500/5'
              : 'border-zinc-700 hover:border-zinc-500'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".wav,.mp3,audio/wav,audio/mpeg"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) validateAndSetFile(f);
            }}
          />
          {file ? (
            <div className="space-y-2">
              <CheckCircle className="w-10 h-10 text-green-400 mx-auto" />
              <p className="text-white font-medium">{file.name}</p>
              <p className="text-gray-500 text-sm">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              <p className="text-green-400 text-xs">{tx('點擊更換檔案', '点击更换文件', 'Click to change file')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <Upload className="w-10 h-10 text-gray-500 mx-auto" />
              <p className="text-gray-300">{tx('將錄音拖放到這裡', '将录音拖放到这里', 'Drag & drop your recording here')}</p>
              <p className="text-gray-500 text-sm">{tx('或點擊選擇 · WAV 或 MP3 · 最大 10MB', '或点击选择 · WAV 或 MP3 · 最大 10MB', 'or click to browse · WAV or MP3 · max 10MB')}</p>
            </div>
          )}
        </div>

        {/* Signature Pad */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
          <SignaturePad onSignatureChange={setSignatureDataUrl} />
        </div>

        {/* Payment Information */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-5 h-5 text-green-400" />
            <h3 className="text-white font-semibold">{tx('收款資訊', '收款信息', 'Payment Information')}</h3>
            <span className="text-xs text-amber-400 ml-auto">{tx('必填', '必填', 'Required')}</span>
          </div>
          <p className="text-gray-500 text-xs leading-relaxed">
            {tx('此資訊僅用於支付您的分潤。雙方各自負擔自身的交易手續費(Onyx 負擔匯出費、配音員負擔收款費)。稅務由配音員自行負責。', '此信息仅用于支付您的分润。双方各自负担自身的交易手续费(Onyx 负担汇出费、配音员负担收款费)。税务由配音员自行负责。', 'This information is used solely for commission payments. Each party bears its own transaction fees (sender fees by Onyx, receiving fees by Talent). Tax obligations are the sole responsibility of the Talent.')}
          </p>

          <div>
            <label className="block text-sm text-gray-300 mb-1.5">{tx('收款方式', '收款方式', 'Payment Method')}</label>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-green-500/50 transition-colors"
            >
              <option value="">{tx('— 選擇收款方式 —', '— 选择收款方式 —', '— Select payment method —')}</option>
              <option value="paypal">PayPal</option>
              <option value="bank_transfer">{tx('銀行轉帳', '银行转账', 'Bank Transfer')}</option>
            </select>
          </div>

          {paymentMethod === 'paypal' && (
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">{tx('PayPal 電子郵件', 'PayPal 电子邮件', 'PayPal Email')}</label>
              <input
                type="email"
                placeholder="your@email.com"
                value={paymentDetails.paypal_email}
                onChange={e => setPaymentDetails(p => ({ ...p, paypal_email: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-green-500/50 transition-colors"
              />
            </div>
          )}

          {paymentMethod === 'bank_transfer' && (
            <div className="space-y-3">
              <p className="text-[11px] text-gray-500 leading-relaxed">
                {tx('支援全球銀行匯款(美國 / 英國 / 歐洲 / 台灣等)。標 * 為必填,其餘可留空。',
                    '支持全球银行汇款(美国 / 英国 / 欧洲 / 台湾等)。标 * 为必填,其余可留空。',
                    'Supports bank transfers worldwide (US / UK / EU / Taiwan, etc.). Fields marked * are required; the rest are optional.')}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{tx('帳戶名稱', '账户名称', 'Account Holder Name')} <span className="text-amber-400">*</span></label>
                  <input
                    placeholder={tx('帳戶全名', '账户全名', 'Full name on account')}
                    value={paymentDetails.account_name}
                    onChange={e => setPaymentDetails(p => ({ ...p, account_name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-green-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{tx('銀行名稱', '银行名称', 'Bank Name')} <span className="text-amber-400">*</span></label>
                  <input
                    placeholder={tx('例如:HSBC、Bank of America、中國信託', '例如:HSBC、Bank of America、中国信托', 'e.g. HSBC, Bank of America')}
                    value={paymentDetails.bank_name}
                    onChange={e => setPaymentDetails(p => ({ ...p, bank_name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-green-500/50"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{tx('帳號 / IBAN', '账号 / IBAN', 'Account Number / IBAN')} <span className="text-amber-400">*</span></label>
                  <input
                    placeholder={tx('帳號或 IBAN', '账号或 IBAN', 'Account number or IBAN')}
                    value={paymentDetails.account_number}
                    onChange={e => setPaymentDetails(p => ({ ...p, account_number: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-green-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">SWIFT / BIC <span className="text-amber-400">*</span></label>
                  <input
                    placeholder={tx('例如:CTCBTWTP、CHASUS33', '例如:CTCBTWTP、CHASUS33', 'e.g. CHASUS33, HBUKGB4B')}
                    value={paymentDetails.swift_code}
                    onChange={e => setPaymentDetails(p => ({ ...p, swift_code: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-green-500/50"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{tx('Routing / Sort / 分行代碼', 'Routing / Sort / 分行代码', 'Routing / Sort / Branch Code')}</label>
                  <input
                    placeholder={tx('美國 ABA、英國 Sort、台灣分行(若有)', '美国 ABA、英国 Sort、台湾分行(若有)', 'US ABA / UK sort / branch (if any)')}
                    value={paymentDetails.bank_code}
                    onChange={e => setPaymentDetails(p => ({ ...p, bank_code: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-green-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{tx('銀行所在國家', '银行所在国家', 'Bank Country')}</label>
                  <input
                    placeholder={tx('例如:United Kingdom', '例如:United Kingdom', 'e.g. United Kingdom')}
                    value={paymentDetails.bank_country}
                    onChange={e => setPaymentDetails(p => ({ ...p, bank_country: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-green-500/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{tx('備註(選填)', '备注(选填)', 'Notes (optional)')}</label>
                <input
                  placeholder={tx('中介行、分行地址等(若需要)', '中介行、分行地址等(若需要)', 'Intermediary bank, branch address, etc. (if needed)')}
                  value={paymentDetails.notes}
                  onChange={e => setPaymentDetails(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-green-500/50"
                />
              </div>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {errorMsg}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleUpload}
          disabled={!file || !signatureDataUrl || !agreedToTerms || !paymentMethod || pageState === 'uploading'}
          className="w-full py-3.5 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {pageState === 'uploading' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {tx('上傳中…', '上传中…', 'Uploading...')}
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              {tx('提交聲音 ID 與簽名', '提交声音 ID 与签名', 'Submit Voice ID & Signature')}
            </>
          )}
        </button>

        {(!file || !signatureDataUrl || !agreedToTerms || !paymentMethod) && (
          <div className="text-center text-xs space-y-1">
            {!agreedToTerms && <p className="text-amber-400">{tx('請詳閱並同意配音員合作協議。', '请详阅并同意配音员合作协议。', 'Please review and agree to the Talent Engagement Agreement.')}</p>}
            {!file && <p className="text-amber-400">{tx('請上傳您的聲音 ID 錄音。', '请上传您的声音 ID 录音。', 'Please upload your Voice ID recording.')}</p>}
            {!signatureDataUrl && <p className="text-amber-400">{tx('請在上方簽名以完成提交。', '请在上方签名以完成提交。', 'Please sign above to complete your submission.')}</p>}
            {!paymentMethod && <p className="text-amber-400">{tx('請選擇分潤的收款方式。', '请选择分润的收款方式。', 'Please select a payment method for commission payments.')}</p>}
          </div>
        )}

        <p className="text-center text-gray-600 text-xs leading-relaxed">
          {tx('提交即表示您確認此錄音為您本人的真實聲音,且您的電子簽名構成依您與 Onyx Studios 簽署之配音員協議下「聲音 ID 聲明」的合法同意。', '提交即表示您确认此录音为您本人的真实声音,且您的电子签名构成依您与 Onyx Studios 签署之配音员协议下「声音 ID 声明」的合法同意。', 'By submitting, you confirm this recording is your genuine biological voice and your electronic signature serves as lawful consent for the Voice ID Affidavit under your signed talent agreement with Onyx Studios.')}
        </p>
      </div>
    </div>
  );
}
