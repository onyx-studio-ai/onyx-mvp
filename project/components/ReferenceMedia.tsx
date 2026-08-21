'use client';

/** 參考素材單檔渲染:依副檔名決定音檔 / 影片 / 圖片 / 一般檔案(下載卡)。
    以前一律用 <audio>,遇到 xls、zip、pdf 會顯示「錯誤」。 */

const extOf = (u: string) => (u.split('?')[0].split('.').pop() || '').toLowerCase();
const AUDIO = ['wav', 'wave', 'mp3', 'm4a', 'aac', 'ogg', 'flac'];
const VIDEO = ['mp4', 'mov', 'webm', 'm4v'];
const IMAGE = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'];

export type RefFile = { name?: string; url: string };

export function ReferenceMedia({ file, dark = true, downloadLabel = '下載' }: { file: RefFile; dark?: boolean; downloadLabel?: string }) {
  const ext = extOf(file.url);
  const label = file.name || decodeURIComponent(file.url.split('/').pop() || '檔案');
  const sub = dark ? 'text-gray-300' : 'text-gray-600';

  if (AUDIO.includes(ext)) return (
    <div>
      {file.name && <span className={`text-xs ${sub} block mb-0.5`}>{file.name}</span>}
      <audio controls src={file.url} className="w-full h-9" />
    </div>
  );

  if (VIDEO.includes(ext)) return (
    <div>
      {file.name && <span className={`text-xs ${sub} block mb-0.5`}>{file.name}</span>}
      <video controls preload="metadata" src={file.url} className="w-full max-h-72 rounded-lg border border-white/10 bg-black" />
    </div>
  );

  if (IMAGE.includes(ext)) return (
    <a href={file.url} target="_blank" rel="noopener noreferrer" className="block">
      {file.name && <span className={`text-xs ${sub} block mb-0.5`}>{file.name}</span>}
      <img src={file.url} alt={label} className="max-h-40 rounded-lg border border-white/10" />
    </a>
  );

  // 文件、壓縮檔等:給下載卡,不要塞進播放器
  return (
    <a href={file.url} target="_blank" rel="noopener noreferrer" download
      className={`flex items-center gap-2 rounded-lg px-3 py-2 border transition ${dark ? 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
      <span className={`text-[11px] uppercase font-mono shrink-0 ${dark ? 'text-amber-300' : 'text-amber-600'}`}>{ext || 'file'}</span>
      <span className={`text-xs truncate flex-1 ${dark ? 'text-gray-200' : 'text-gray-700'}`}>{label}</span>
      <span className={`text-[11px] shrink-0 ${dark ? 'text-sky-300' : 'text-sky-600'}`}>{downloadLabel}</span>
    </a>
  );
}
