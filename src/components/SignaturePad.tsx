import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X, RotateCcw, Check } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';

interface SignaturePadProps {
  title: string;
  onSave: (signatureDataUrl: string) => void;
  onClose: () => void;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ title, onSave, onClose }) => {
  const sigCanvas = useRef<SignatureCanvas>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number } | null>(null);

  const measureAndSet = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setCanvasSize({ width: rect.width, height: rect.height });
        return true;
      }
    }
    return false;
  }, []);

  useEffect(() => {
    // Try immediately, then retry with delays until we get a valid size
    if (measureAndSet()) return;

    const timers = [
      setTimeout(() => measureAndSet(), 50),
      setTimeout(() => measureAndSet(), 150),
      setTimeout(() => measureAndSet(), 300),
      setTimeout(() => measureAndSet(), 500),
    ];

    return () => timers.forEach(clearTimeout);
  }, [measureAndSet]);

  const clear = () => {
    sigCanvas.current?.clear();
    setHasSignature(false);
  };

  const save = () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
      setHasSignature(false);
      return;
    }
    const dataUrl = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div>
            <h3 className="text-xl font-bold text-zinc-900">{title} 電子簽名</h3>
            <p className="text-xs text-zinc-400 mt-0.5">請在下方空白區域內簽署</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-zinc-200 rounded-full transition-colors text-zinc-400 hover:text-zinc-600"
          >
            <X size={22} />
          </button>
        </div>

        {/* Canvas Area — uses fixed min-height, NOT flex-1 */}
        <div className="bg-white px-6 py-4">
          <div 
            ref={containerRef}
            className="relative border-2 border-dashed border-zinc-300 rounded-2xl overflow-hidden cursor-crosshair bg-zinc-50 shadow-inner"
            style={{ width: '100%', height: '300px' }}
          >
            {/* Placeholder text */}
            {!hasSignature && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                <span className="text-xl font-bold text-zinc-200 uppercase tracking-widest">請在此簽名</span>
              </div>
            )}

            {/* Signature Canvas */}
            {canvasSize ? (
              <SignatureCanvas
                ref={sigCanvas}
                penColor="#000000"
                canvasProps={{
                  width: canvasSize.width,
                  height: canvasSize.height,
                  className: 'absolute inset-0 block',
                  style: { width: '100%', height: '100%' }
                }}
                onBegin={() => setHasSignature(true)}
                velocityFilterWeight={0.7}
                minWidth={0.8}
                maxWidth={3}
                dotSize={1.5}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm text-zinc-300">載入中...</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-between gap-4">
          <button
            onClick={clear}
            className="flex items-center gap-2 px-5 py-2.5 text-zinc-600 hover:bg-zinc-200 rounded-xl transition-all font-bold text-sm"
          >
            <RotateCcw size={16} />
            清除重寫
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-zinc-500 font-bold text-sm hover:underline"
            >
              取消
            </button>
            <button
              disabled={!hasSignature}
              onClick={save}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl transition-all font-bold text-sm shadow-lg ${
                hasSignature 
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200' 
                : 'bg-zinc-200 text-zinc-400 cursor-not-allowed shadow-none'
              }`}
            >
              <Check size={16} />
              確認保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignaturePad;
