import React from 'react';
import { Pin } from '../types';
import { format } from 'date-fns';

interface ReportViewProps {
  imageUrl: string;
  pins: Pin[];
  printMode: 'all' | 'floorplan' | 'table';
}

const ReportView: React.FC<ReportViewProps> = ({ imageUrl, pins, printMode }) => {
  return (
    <div className="bg-white p-8 max-w-5xl mx-auto print:p-0">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-2">建築驗收缺失報告</h1>
        <p className="text-zinc-500">產出日期: {format(new Date(), 'yyyy/MM/dd HH:mm')}</p>
      </div>

      {/* Floor Plan with Pins */}
      {(printMode === 'all' || printMode === 'floorplan') && (
        <section className={`mb-16 ${printMode === 'floorplan' ? 'print:block' : ''}`}>
          <h2 className="text-xl font-bold mb-6 border-b-2 border-zinc-900 pb-2 print:text-base print:mb-4">缺失平面圖</h2>
          <div className="relative border border-zinc-200 rounded-xl overflow-hidden bg-zinc-50 print:border-none print:flex print:items-center print:justify-center">
            <img src={imageUrl} alt="Floor Plan" className="w-full h-auto print:max-h-[85vh] print:w-auto print:object-contain" />
            {pins.map((pin, idx) => (
              <div
                key={pin.id}
                className="absolute w-6 h-6 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-md transform -translate-x-1/2 -translate-y-1/2 print:bg-red-500 print:text-white"
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
        </section>
      )}

      {/* Defect List Table */}
      {(printMode === 'all' || printMode === 'table') && (
        <section className={`${printMode === 'all' ? 'break-before-page mt-12 print:mt-0 print:pt-8' : ''}`}>
          <h2 className="text-xl font-bold mb-6 border-b-2 border-zinc-900 pb-2">缺失項目總表</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-zinc-200 text-sm">
              <thead className="bg-zinc-100 text-zinc-900 print:bg-zinc-200">
                <tr>
                  <th className="border border-zinc-200 p-3 text-left w-16">編號</th>
                  <th className="border border-zinc-200 p-3 text-left w-24">區域</th>
                  <th className="border border-zinc-200 p-3 text-left w-24">類別</th>
                  <th className="border border-zinc-200 p-3 text-left w-48">項目名稱</th>
                  <th className="border border-zinc-200 p-3 text-left">備註說明</th>
                  <th className="border border-zinc-200 p-3 text-left w-48">照片</th>
                </tr>
              </thead>
              <tbody>
                {pins.map((pin, pinIdx) => (
                  pin.defects.map(defect => (
                    <tr key={`${pin.id}-${defect.id}`} className="break-inside-avoid hover:bg-zinc-50">
                      <td className="border border-zinc-200 p-3 font-bold text-center">
                        <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-[10px] text-white mx-auto">
                          {pinIdx + 1}
                        </div>
                      </td>
                      <td className="border border-zinc-200 p-3 text-zinc-700">
                        {defect.area || '-'}
                      </td>
                      <td className="border border-zinc-200 p-3 text-zinc-500">
                        {defect.category}
                      </td>
                      <td className="border border-zinc-200 p-3 font-bold">
                        {defect.name}
                      </td>
                      <td className="border border-zinc-200 p-3 text-zinc-600 whitespace-pre-wrap">
                        {defect.description || '-'}
                      </td>
                      <td className="border border-zinc-200 p-3">
                        {defect.photos.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {defect.photos.map((photo, pIdx) => (
                              <img 
                                key={pIdx} 
                                src={photo} 
                                alt="Defect" 
                                className="w-20 h-20 object-cover rounded border border-zinc-200" 
                              />
                            ))}
                          </div>
                        ) : (
                          <span className="text-zinc-400 text-xs italic">無照片</span>
                        )}
                      </td>
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="mt-20 text-center text-zinc-400 text-xs border-t pt-8">
        報告結束 • 建築驗收系統產出
      </div>
    </div>
  );
};

export default ReportView;
