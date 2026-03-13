import React from 'react';
import { Pin } from '../types';
import { format } from 'date-fns';
import SignaturePad from './SignaturePad';

interface ReportViewProps {
  imageUrl: string;
  pins: Pin[];
  printMode: 'all' | 'floorplan' | 'table';
  building?: string;
  floor?: string;
  unit?: string;
}

const ReportView: React.FC<ReportViewProps> = ({ imageUrl, pins, printMode, building, floor, unit }) => {
  const [signatures, setSignatures] = React.useState<Record<string, string>>({});
  const [activeField, setActiveField] = React.useState<string | null>(null);

  const handleSaveSignature = (dataUrl: string) => {
    if (activeField) {
      setSignatures(prev => ({ ...prev, [activeField]: dataUrl }));
      setActiveField(null);
    }
  };
  return (
    <div className="bg-white p-8 max-w-5xl mx-auto print:p-0 print:max-w-none print:w-full">
      <div className="text-center mb-8 print:mb-6 relative">
        <h1 className="text-3xl font-bold mb-2 print:text-2xl">建築驗收缺失報告</h1>
        <p className="text-zinc-500 text-sm">產出日期: {format(new Date(), 'yyyy/MM/dd HH:mm')}</p>
        {(building || floor || unit) && (
          <div className="absolute top-0 right-0 text-right print:text-sm">
            <span className="font-bold">{building} {floor} {unit}</span>
          </div>
        )}
      </div>

      {/* Floor Plan with Pins */}
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
      <div className="print:hidden h-4" /> {/* Spacer */}

      {/* Defect List Table */}
      <section className={`${printMode === 'all' ? 'mt-12 print:break-before-page print:pt-4' : ''} ${printMode === 'floorplan' ? 'print:hidden' : ''}`}>
        <h2 className="text-xl font-bold mb-6 border-b-2 border-zinc-900 pb-2 print:text-base print:mb-4">缺失項目總表</h2>
          <div className="overflow-x-auto">
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

      {/* Signature Section */}
      <section className="mt-16 mb-8 break-inside-avoid shadow-sm border border-zinc-100 p-8 rounded-2xl bg-zinc-50/30 no-print-shadow">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {['客戶', '業主', '承商'].map((label) => (
            <div 
              key={label} 
              className="flex flex-col cursor-pointer hover:bg-zinc-100/50 p-2 rounded-xl transition-colors group"
              onClick={() => setActiveField(label)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-zinc-900">{label}</span>
                {signatures[label] && (
                  <span className="text-[10px] text-blue-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity">點擊重簽</span>
                )}
              </div>
              <div className="h-44 bg-white/50 border-2 border-dashed border-zinc-200 rounded-xl mb-2 flex items-center justify-center overflow-hidden relative">
                {signatures[label] ? (
                  <img src={signatures[label]} alt={`${label} 簽名`} className="h-full object-contain mix-blend-multiply" />
                ) : (
                  <span className="text-xs text-zinc-300 italic">點擊在此簽名</span>
                )}
              </div>
              <div className="border-b-2 border-zinc-300 w-full mb-1"></div>
              <span className="text-[10px] text-zinc-400 text-right">(簽章)</span>
            </div>
          ))}
        </div>
      </section>

      {activeField && (
        <SignaturePad 
          title={activeField}
          onSave={handleSaveSignature}
          onClose={() => setActiveField(null)}
        />
      )}

      <div className="mt-12 text-center text-zinc-400 text-[10px] border-t pt-4 print:mt-8">
        報告結束 • 建築驗收系統產出
      </div>
    </div>
  );
};

export default ReportView;
