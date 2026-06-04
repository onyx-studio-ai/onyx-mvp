'use client';

/**
 * /apply/studio/test-spec — TTS-grade studio test recording spec.
 *
 * Onyx-branded version of the standard test-recording protocol Onyx uses
 * to evaluate prospective studio partners. The spec itself is industry-
 * standard (48k / 24-bit / mono / no-processing / room-tone + speech +
 * clap test) — derived from what our high-end AI buyers require us to
 * deliver downstream, so any studio that meets this spec can pass the
 * downstream client's QA.
 *
 * Linked from /apply/studio Section 07 (Sample work) — applicants
 * record per this spec, upload one .wav, paste the URL in the form.
 *
 * Reads as a reference doc, not a marketing page — terse, technical,
 * scannable.
 */

import { motion } from 'framer-motion';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, Mic, Wind, Hand, Package, AlertCircle } from 'lucide-react';
import Footer from '@/components/landing/Footer';

export default function StudioTestSpecPage() {
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);

  return (
    <main className="min-h-screen bg-[#050505] text-white overflow-x-hidden pt-28">

      {/* HERO */}
      <section className="px-4 sm:px-6 lg:px-8 pb-8">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/apply/studio"
            className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition mb-6"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {tx('回錄音室申請', '回录音室申请', 'Back to studio application')}
          </Link>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-500/[0.08] px-4 py-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse" />
            <span className="text-xs tracking-wide text-gray-100 font-medium">
              {tx('錄音室測試規格', '录音室测试规格', 'Studio Test Spec')}
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3 tracking-tight">
            {tx(
              'TTS 級錄音室測試規格',
              'TTS 级录音室测试规格',
              'TTS-Grade Studio Test Spec'
            )}
          </h1>
          <p className="text-gray-400 leading-relaxed">
            {tx(
              '請依以下規格錄製一段測試音檔,合併為單一 .wav 檔上傳。Onyx 製作團隊會以這份音檔評估錄音室是否符合 TTS / AI 語音資料案件的交付標準。',
              '请依以下规格录制一段测试音档,合并为单一 .wav 档上传。Onyx 制作团队会以这份音档评估录音室是否符合 TTS / AI 语音资料项目的交付标准。',
              'Record a single test clip following the spec below and upload it as one .wav file. The Onyx production team uses this clip to evaluate whether your studio meets the delivery standard for TTS / AI voice-data projects.'
            )}
          </p>
        </div>
      </section>

      {/* Section 1 — Format / environment */}
      <section className="px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto rounded-2xl bg-white/[0.03] border border-white/[0.08] p-7"
        >
          <div className="flex items-center gap-3 mb-4">
            <Wind className="w-5 h-5 text-amber-300" />
            <h2 className="text-lg font-bold tracking-tight">
              {tx('錄音規格與環境', '录音规格与环境', 'Recording spec & environment')}
            </h2>
          </div>
          <ul className="space-y-2 text-sm text-gray-300 leading-relaxed list-disc list-inside marker:text-amber-300/60">
            <li>{tx('採樣率 48 kHz / 位元深度 24-bit / mono channel', '采样率 48 kHz / 位元深度 24-bit / mono channel', 'Sample rate 48 kHz / 24-bit / mono channel')}</li>
            <li>{tx('Line-in 直錄', 'Line-in 直录', 'Line-in direct recording')}</li>
            <li>{tx('完全無後製 — 不加 EQ、不加壓縮、不加 plug-in、不降噪', '完全无后制 — 不加 EQ、不加压缩、不加 plug-in、不降噪', 'No processing — no EQ, compression, plug-ins, or noise reduction')}</li>
            <li>{tx('關閉冷氣、手機、所有可能的噪音源', '关闭冷气、手机、所有可能的噪音源', 'Turn off air conditioner, mobile phone, and any other noise sources')}</li>
            <li>{tx('確認 sound card driver / export 設定正確', '确认 sound card driver / export 设定正确', 'Verify sound card driver and export settings are correct')}</li>
          </ul>
        </motion.div>
      </section>

      {/* Section 2 — Content (3 parts) */}
      <section className="px-4 sm:px-6 lg:px-8 py-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto"
        >
          <h2 className="text-lg font-bold mb-3 tracking-tight">
            {tx(
              '測試錄音內容 — 三段合併為單一檔案',
              '测试录音内容 — 三段合并为单一档案',
              'Test content — three parts, combined into one file'
            )}
          </h2>

          <div className="space-y-3">
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-5">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-xs tracking-[0.25em] text-amber-300/70">A</span>
                <Mic className="w-4 h-4 text-amber-300" />
                <h3 className="font-bold text-base tracking-tight">
                  {tx('人聲片段', '人声片段', 'Speech segment')}
                </h3>
              </div>
              <ul className="space-y-1.5 text-sm text-gray-300 leading-relaxed list-disc list-inside marker:text-amber-300/60 pl-1">
                <li>{tx('任何內容,自然朗讀即可', '任何内容,自然朗读即可', 'Any content, read naturally')}</li>
                <li>{tx('句子之間間隔 ≥ 2 秒', '句子之间间隔 ≥ 2 秒', 'Pause ≥ 2 seconds between sentences')}</li>
                <li>{tx('人聲音量建議在 -9 ~ -3 dB 範圍', '人声音量建议在 -9 ~ -3 dB 范围', 'Target speech volume: -9 ~ -3 dB')}</li>
              </ul>
            </div>

            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-5">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-xs tracking-[0.25em] text-amber-300/70">B</span>
                <Wind className="w-4 h-4 text-amber-300" />
                <h3 className="font-bold text-base tracking-tight">
                  {tx('Room tone(環境底噪)', 'Room tone(环境底噪)', 'Room tone')}
                </h3>
              </div>
              <ul className="space-y-1.5 text-sm text-gray-300 leading-relaxed list-disc list-inside marker:text-amber-300/60 pl-1">
                <li>{tx('10–15 秒環境音', '10–15 秒环境音', '10–15 seconds of room ambience')}</li>
                <li>{tx('說話者離開錄音室,不發聲', '说话者离开录音室,不发声', 'Speaker leaves the room — no voice')}</li>
                <li>{tx('Gain / 設定與人聲段相同', 'Gain / 设定与人声段相同', 'Same gain and settings as the speech segment')}</li>
              </ul>
            </div>

            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-5">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-xs tracking-[0.25em] text-amber-300/70">C</span>
                <Hand className="w-4 h-4 text-amber-300" />
                <h3 className="font-bold text-base tracking-tight">
                  {tx('拍手測試(reverb / 殘響檢測)', '拍手测试(reverb / 残响检测)', 'Clap test (reverb check)')}
                </h3>
              </div>
              <ul className="space-y-1.5 text-sm text-gray-300 leading-relaxed list-disc list-inside marker:text-amber-300/60 pl-1">
                <li>{tx('距離麥克風約 20 cm 處', '距离麦克风约 20 cm 处', 'About 20 cm from the microphone')}</li>
                <li>{tx('清楚拍掌 3 次以上', '清楚拍掌 3 次以上', 'At least 3 clear claps')}</li>
                <li>{tx('每次拍手之間約 2 秒間隔', '每次拍手之间约 2 秒间隔', 'About 2 seconds between claps')}</li>
                <li>{tx('避免削波(clipping)', '避免削波(clipping)', 'Avoid clipping')}</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Section 3 — Delivery */}
      <section className="px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto rounded-2xl bg-white/[0.03] border border-white/[0.08] p-7"
        >
          <div className="flex items-center gap-3 mb-4">
            <Package className="w-5 h-5 text-amber-300" />
            <h2 className="text-lg font-bold tracking-tight">
              {tx('交付規格', '交付规格', 'Delivery spec')}
            </h2>
          </div>
          <ul className="space-y-2 text-sm text-gray-300 leading-relaxed list-disc list-inside marker:text-amber-300/60">
            <li>{tx('單一 .wav 檔(A + B + C 合併為一軌)', '单一 .wav 档(A + B + C 合并为一轨)', 'Single .wav file (A + B + C combined as one track)')}</li>
            <li>{tx('48 kHz / 24-bit / mono PCM', '48 kHz / 24-bit / mono PCM', '48 kHz / 24-bit / mono PCM')}</li>
            <li>{tx('上傳到 Drive / 雲端,在申請表貼 URL', '上传到 Drive / 云盘,在申请表贴 URL', 'Upload to Drive / cloud storage and paste the URL in the application form')}</li>
          </ul>
        </motion.div>
      </section>

      {/* Section 4 — Troubleshooting */}
      <section className="px-4 sm:px-6 lg:px-8 py-4 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto"
        >
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-5 h-5 text-amber-300" />
            <h2 className="text-lg font-bold tracking-tight">
              {tx('常見問題排查', '常见问题排查', 'Troubleshooting')}
            </h2>
          </div>

          <div className="space-y-3">
            <Issue
              title={tx('沒高頻 / 高頻被截掉', '没高频 / 高频被截掉', 'No high frequencies / high freq cut off')}
              fixes={[
                tx('檢查 export 格式 — 確認是 48 kHz / 24-bit / mono PCM .wav', '检查 export 格式 — 确认是 48 kHz / 24-bit / mono PCM .wav', 'Check export format — confirm 48 kHz / 24-bit / mono PCM .wav'),
                tx('檢查 sound card driver 設定;沒裝就裝(對應你的 sound card 型號)', '检查 sound card driver 设定;没装就装(对应你的 sound card 型号)', 'Check sound card driver settings; install if missing (matching your sound card model)'),
              ]}
              tx={tx}
            />
            <Issue
              title={tx('底噪明顯', '底噪明显', 'Background noise obvious')}
              fixes={[
                tx('讓說話者靠近麥克風 — 提高 SNR(訊噪比)', '让说话者靠近麦克风 — 提高 SNR(讯噪比)', 'Move speaker closer to mic to improve SNR'),
                tx('用吸音板把麥克風與說話者隔離', '用吸音板把麦克风与说话者隔离', 'Use absorption boards to isolate mic from speaker'),
                tx('找出噪音源(冷氣出風口、手機等)排除後再測', '找出噪音源(冷气出风口、手机等)排除后再测', 'Locate the noise source (AC vent, phone, etc.) and retest after removal'),
              ]}
              tx={tx}
            />
            <Issue
              title={tx('殘響(reverberation)明顯', '残响(reverberation)明显', 'Reverberation obvious')}
              fixes={[tx('加吸音板隔離麥克風與說話者', '加吸音板隔离麦克风与说话者', 'Add absorption boards between mic and speaker')]}
              tx={tx}
            />
            <Issue
              title={tx('線性噪音(linear noise — 頻譜上的橫線)', '线性噪音(linear noise — 频谱上的横线)', 'Linear noise (horizontal lines on spectrogram)')}
              fixes={[
                tx('檢查並更換設備線材', '检查并更换设备线材', 'Check and replace equipment cables'),
                tx('重啟設備,並關掉所有電器(電燈、冷氣等)後再測', '重启设备,并关掉所有电器(电灯、冷气等)后再测', 'Restart equipment; turn off all electronics (lights, AC, etc.) and retest'),
              ]}
              tx={tx}
            />
          </div>
        </motion.div>
      </section>

      <Footer />
    </main>
  );
}

function Issue({
  title,
  fixes,
  tx,
}: {
  title: string;
  fixes: string[];
  tx: (tw: string, cn: string, en: string) => string;
}) {
  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-5">
      <h3 className="font-bold text-base text-white mb-2 tracking-tight">{title}</h3>
      <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">
        {tx('解法', '解法', 'Fix')}
      </p>
      <ul className="space-y-1.5 text-sm text-gray-300 leading-relaxed list-disc list-inside marker:text-amber-300/60 pl-1">
        {fixes.map((f, i) => <li key={i}>{f}</li>)}
      </ul>
    </div>
  );
}
