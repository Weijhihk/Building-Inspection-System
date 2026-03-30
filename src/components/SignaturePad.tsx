import React, { useRef, useState, useEffect } from 'react';
import { X, RotateCcw, Check } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';

interface SignaturePadProps {
  title: string;
  onSave: (signatureDataUrl: string) => void;
  onClose: () => void;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ title, onSave, onClose }) => {
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle responsive resizing
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setCanvasSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const clear = () => {
    sigCanvas.current?.clear();
    setHasSignature(false);
  };

  const save = () => {
    if (!hasSignature || !sigCanvas.current) return;
    
    // Get the signature as a base64 DataURL (trimmed to remove empty margins)
    const dataUrl = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div className="flex flex-col">
            <h3 className="text-xl font-bold text-zinc-900">{title} 電子簽名</h3>
            <span className="text-xs text-zinc-400 font-medium">請在下方區域內簽署 (支援貝茲曲線及壓力感應)</span>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-zinc-200 rounded-full transition-colors text-zinc-400 hover:text-zinc-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 bg-white relative p-6 h-[400px]">
          <div 
            ref={containerRef}
            className="w-full h-full border-2 border-dashed border-zinc-300 rounded-3xl overflow-hidden cursor-crosshair relative bg-zinc-50 shadow-inner"
          >
            {!hasSignature && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                <span className="text-2xl font-bold text-zinc-200 uppercase tracking-widest">請在此簽名</span>
              </div>
            )}
            
            <SignatureCanvas 
              ref={sigCanvas}
              penColor="#000000"
              canvasProps={{
                width: canvasSize.width,
                height: canvasSize.height,
                className: 'sigCanvas absolute inset-0 block w-full h-full'
              }}
              onBegin={() => setHasSignature(true)}
              velocityFilterWeight={0.7} // Smoothing parameter
              minWidth={0.5}
              maxWidth={3.0}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-between gap-4">
          <button
            onClick={clear}
            className="flex items-center gap-2 px-6 py-3 text-zinc-600 hover:bg-zinc-200 rounded-2xl transition-all font-bold text-sm"
          >
            <RotateCcw size={18} />
            清除重寫
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-6 py-3 text-zinc-600 font-bold text-sm hover:underline"
            >
              取消
            </button>
            <button
              disabled={!hasSignature}
              onClick={save}
              className={`flex items-center gap-2 px-8 py-3 rounded-2xl transition-all font-bold text-sm shadow-lg ${
                hasSignature 
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200' 
                : 'bg-zinc-200 text-zinc-400 cursor-not-allowed shadow-none'
              }`}
            >
              <Check size={18} />
              確認保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignaturePad;
