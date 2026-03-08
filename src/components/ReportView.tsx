import React from 'react';
import { Pin } from '../types';
import { format } from 'date-fns';

interface ReportViewProps {
  imageUrl: string;
  pins: Pin[];
}

const ReportView: React.FC<ReportViewProps> = ({ imageUrl, pins }) => {
  const allDefects = pins.flatMap(pin => pin.defects.map(d => ({ ...d, pinId: pin.id, pinCoords: `(${pin.x.toFixed(2)}, ${pin.y.toFixed(2)})` })));

  return (
    <div className="bg-white p-8 max-w-5xl mx-auto print:p-0">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-2">建築驗收缺失報告</h1>
        <p className="text-zinc-500">產出日期: {format(new Date(), 'yyyy/MM/dd HH:mm')}</p>
      </div>

      {/* Floor Plan with Pins */}
      <section className="mb-16">
        <h2 className="text-xl font-bold mb-6 border-b-2 border-zinc-900 pb-2">缺失平面圖</h2>
        <div className="relative border border-zinc-200 rounded-xl overflow-hidden bg-zinc-50">
          <img src={imageUrl} alt="Floor Plan" className="w-full h-auto" />
          {pins.map((pin, idx) => (
            <div
              key={pin.id}
              className="absolute w-6 h-6 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-md transform -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
            >
              {idx + 1}
            </div>
          ))}
        </div>
      </section>

      {/* Defect List */}
      <section>
        <h2 className="text-xl font-bold mb-6 border-b-2 border-zinc-900 pb-2">缺失項目清單</h2>
        <div className="space-y-8">
          {pins.map((pin, pinIdx) => (
            <div key={pin.id} className="break-inside-avoid">
              <div className="bg-zinc-100 px-4 py-2 rounded-lg flex justify-between items-center mb-4">
                <span className="font-bold text-zinc-900">標記 #{pinIdx + 1}</span>
                <span className="text-xs text-zinc-500">座標: ({pin.x.toFixed(2)}, {pin.y.toFixed(2)})</span>
              </div>
              
              <div className="space-y-4 pl-4">
                {pin.defects.map((defect) => (
                  <div key={defect.id} className="border-b border-zinc-100 pb-4 last:border-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 uppercase mr-2">[{defect.category}]</span>
                        <span className="font-bold">{defect.name}</span>
                      </div>
                      <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded">待處理</span>
                    </div>
                    
                    {defect.description && (
                      <p className="text-sm text-zinc-600 mb-3 bg-zinc-50 p-2 rounded italic">
                        "{defect.description}"
                      </p>
                    )}

                    {defect.photos.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {defect.photos.map((photo, pIdx) => (
                          <img 
                            key={pIdx} 
                            src={photo} 
                            alt="Defect" 
                            className="w-32 h-32 object-cover rounded-lg border border-zinc-200" 
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-20 text-center text-zinc-400 text-xs border-t pt-8">
        報告結束 • 建築驗收系統產出
      </div>
    </div>
  );
};

export default ReportView;
