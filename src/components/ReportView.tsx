import React from 'react';
import { Pin } from '../types';
import { format } from 'date-fns';
import { Lock } from 'lucide-react';

interface SignatureInfo {
  data: string;
  locked: boolean;
}

interface ReportViewProps {
  imageUrl: string;
  pins: Pin[];
  printMode: 'all' | 'floorplan' | 'table';
  building?: string;
  floor?: string;
  unit?: string;
  signatures?: Record<string, SignatureInfo>;
  onOpenSignature?: (field: string) => void;
}

const ReportView: React.FC<ReportViewProps> = ({ imageUrl, pins, printMode, building, floor, unit, signatures = {}, onOpenSignature }) => {
  const dateStr = format(new Date(), 'yyyy/MM/dd HH:mm');

  return (
    <div className="bg-white p-8 max-w-5xl mx-auto print-report-root">
      {/*
        Table wrapper for repeating thead / tfoot on every printed page.
        On screen these elements render as normal block divs.
      */}
      <table className="print-page-table">
        {/* ═══ THEAD: Report title — repeats on every printed page ═══ */}
        <thead>
          <tr><td>
            <div className="print-page-header">
              <div className="print-page-header-inner">
                <h1 className="text-3xl font-bold mb-1 print:text-xl">建築驗收缺失報告</h1>
                <p className="text-zinc-500 text-sm print:text-xs">產出日期: {dateStr}</p>
              </div>
              {(building || floor || unit) && (
                <div className="print-page-header-info">
                  <span className="font-bold text-sm">{building} {floor} {unit}</span>
                </div>
              )}
            </div>
          </td></tr>
        </thead>

        {/* ═══ TFOOT: Signature — repeats on every printed page ═══ */}
        <tfoot>
          <tr><td>
            <div className="print-sig-inner">
              {['客戶', '業主', '承商'].map((label) => {
                const sig = signatures[label];
                return (
                  <div key={label} className="print-sig-col">
                    <div className="print-sig-label">{label}</div>
                    <div className="print-sig-img-box">
                      {sig?.data ? (
                        <img src={sig.data} alt={`${label} 簽名`} className="print-sig-img" />
                      ) : (
                        <span className="print-sig-empty">(未簽名)</span>
                      )}
                    </div>
                    <div className="print-sig-line" />
                    <span className="print-sig-stamp">(簽章)</span>
                  </div>
                );
              })}
            </div>
          </td></tr>
        </tfoot>

        {/* ═══ TBODY: Main content ═══ */}
        <tbody>
          <tr><td>
            {/* ── Floor Plan with Pins ── */}
            <section className={`mb-12 print:mb-8 break-inside-avoid text-center ${printMode === 'table' ? 'print:hidden' : ''}`}>
              <h2 className="text-xl font-bold mb-4 border-b-2 border-zinc-900 pb-2 print:text-base text-left">缺失平面圖</h2>
              <div className="inline-block relative border border-zinc-200 rounded-xl overflow-hidden bg-zinc-50 print:border-none shadow-sm max-w-full">
                <div className="relative inline-block">
                  <img 
                    src={imageUrl} 
                    alt="Floor Plan" 
                    className="block max-h-[70vh] print:max-h-[85vh] w-auto h-auto" 
                  />
                  {pins.map((pin, idx) => (
                    <div
                      key={pin.id}
                      className="absolute w-5 h-5 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-md transform -translate-x-1/2 -translate-y-1/2"
                      style={{ 
                        left: `${pin.x * 100}%`, 
                        top: `${pin.y * 100}%`,
                        WebkitPrintColorAdjust: 'exact',
                        printColorAdjust: 'exact'
                      }}
                    >
                      {idx + 1}
                    </div>
                  ))}
                </div>
              </div>
            </section>
            <div className="print:hidden h-4" />

            {/* ── Defect List Table ── */}
            <section className={`${printMode === 'all' ? 'mt-12 print:break-before-page print:pt-4' : ''} ${printMode === 'floorplan' ? 'print:hidden' : ''}`}>
              <h2 className="text-xl font-bold mb-6 border-b-2 border-zinc-900 pb-2 print:text-base print:mb-4">缺失項目總表</h2>
              <div className="overflow-x-auto print-no-overflow">
                <table className="w-full border-collapse border border-zinc-200 text-sm print:text-[12px]">
                  <thead className="bg-zinc-100 text-zinc-900">
                    <tr>
                      <th className="border border-zinc-200 p-2 text-left w-[8%]">編號</th>
                      <th className="border border-zinc-200 p-2 text-left w-[12%]">區域</th>
                      <th className="border border-zinc-200 p-2 text-left w-[12%]">類別</th>
                      <th className="border border-zinc-200 p-2 text-left w-[20%]">項目名稱</th>
                      <th className="border border-zinc-200 p-2 text-left w-[28%]">備註說明</th>
                      <th className="border border-zinc-200 p-2 text-left w-[20%]">照片</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pins.map((pin, pinIdx) => (
                      pin.defects.map(defect => (
                        <tr key={`${pin.id}-${defect.id}`} className="break-inside-avoid hover:bg-zinc-50">
                          <td className="border border-zinc-200 p-2 font-bold text-center">
                            <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] text-white mx-auto" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                              {pinIdx + 1}
                            </div>
                          </td>
                          <td className="border border-zinc-200 p-2 text-zinc-700">
                            {defect.area || '-'}
                          </td>
                          <td className="border border-zinc-200 p-2 text-zinc-500">
                            {defect.category}
                          </td>
                          <td className="border border-zinc-200 p-2 font-bold">
                            {defect.name}
                          </td>
                          <td className="border border-zinc-200 p-2 text-zinc-600 whitespace-pre-wrap leading-relaxed">
                            {defect.description || '-'}
                          </td>
                          <td className="border border-zinc-200 p-2">
                            {defect.photos.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {defect.photos.map((photo, pIdx) => (
                                  <img 
                                    key={pIdx} 
                                    src={photo} 
                                    alt="Defect" 
                                    className="w-16 h-16 object-cover rounded border border-zinc-100" 
                                  />
                                ))}
                              </div>
                            ) : (
                              <span className="text-zinc-400 text-[10px] italic">無照片</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Signature Section - Screen only (full interactive module) */}
            <section className="mt-16 mb-8 break-inside-avoid shadow-sm border border-zinc-100 p-8 rounded-2xl bg-zinc-50/30 no-print-shadow no-print">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                {['客戶', '業主', '承商'].map((label) => {
                  const sig = signatures[label];
                  const isLocked = sig?.locked === true;
                  const hasData = !!sig?.data;

                  return (
                    <div 
                      key={label} 
                      className={`flex flex-col p-2 rounded-xl transition-colors ${
                        isLocked 
                          ? 'bg-green-50/50' 
                          : 'cursor-pointer hover:bg-zinc-100/50 group'
                      }`}
                      onClick={() => {
                        if (!isLocked) {
                          onOpenSignature?.(label);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-zinc-900">{label}</span>
                        {isLocked ? (
                          <span className="flex items-center gap-1 text-[10px] text-green-600 font-bold bg-green-100 px-2 py-0.5 rounded-full">
                            <Lock size={10} />
                            已鎖定
                          </span>
                        ) : hasData ? (
                          <span className="text-[10px] text-blue-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity">點擊重簽</span>
                        ) : null}
                      </div>
                      
                      <div className="h-44 bg-white/50 border-2 border-dashed border-zinc-200 rounded-xl mb-2 flex items-center justify-center overflow-hidden relative">
                        {hasData ? (
                          <img src={sig.data} alt={`${label} 簽名`} className="h-full object-contain mix-blend-multiply" />
                        ) : (
                          <span className="text-xs text-zinc-300 italic">
                            {isLocked ? '(無簽名資料)' : '點擊在此簽名'}
                          </span>
                        )}
                      </div>
                      
                      <div className="border-b-2 border-zinc-300 w-full mb-1"></div>
                      <span className="text-[10px] text-zinc-400 text-right">(簽章)</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="mt-12 text-center text-zinc-400 text-[10px] border-t pt-4 print-footer">
              報告結束 • 建築驗收系統產出
            </div>
          </td></tr>
        </tbody>
      </table>
    </div>
  );
};

export default ReportView;
