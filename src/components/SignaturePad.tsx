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
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize size after mount and animation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (containerRef.current) {
        setCanvasSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    }, 100); // Wait for modal animation

    const handleResize = () => {
      // We don't want to re-render and clear the canvas during a drawing session
      // But if the user rotates their phone, we should probably warn or handle it.
      // For now, let's just use the initial stable size or provide a way to re-init.
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const clear = () => {
    sigCanvas.current?.clear();
    setHasSignature(false);
  };

  const save = () => {
    if (!hasSignature || !sigCanvas.current) return;
    
    // Check if empty before saving
    if (sigCanvas.current.isEmpty()) {
       setHasSignature(false);
       return;
    }
    
    // Get the signature as a base64 DataURL (trimmed to remove empty margins)
    const dataUrl = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div 
        className="bg-white w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div className="flex flex-col">
            <h3 className="text-2xl font-black text-zinc-900 tracking-tight">{title} 數位簽章</h3>
            <p className="text-sm text-zinc-400 font-medium mt-1">請在下方感應區域內建立您的手寫簽名</p>
          </div>
          <button 
            onClick={onClose}
            className="p-3 hover:bg-zinc-200 rounded-full transition-all text-zinc-400 hover:text-zinc-900 hover:rotate-90 duration-300"
          >
            <X size={28} />
          </button>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 bg-white relative p-8 h-[450px]">
          <div 
            ref={containerRef}
            className="w-full h-full border-2 border-zinc-100 rounded-[2rem] overflow-hidden cursor-crosshair relative bg-zinc-50/50 shadow-inner group"
          >
            {!hasSignature && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none opacity-40 group-hover:opacity-60 transition-opacity">
                <span className="text-3xl font-black text-zinc-200 uppercase tracking-[0.3em]">SIGN HERE</span>
                <span className="text-xs text-zinc-300 mt-2 font-bold">(滑鼠左鍵或手指觸控繪製)</span>
              </div>
            )}
            
            {canvasSize && (
              <SignatureCanvas 
                ref={sigCanvas}
                penColor="#000000"
                canvasProps={{
                  width: canvasSize.width,
                  height: canvasSize.height,
                  className: 'sigCanvas absolute inset-0 block w-full h-full'
                }}
                onBegin={() => setHasSignature(true)}
                velocityFilterWeight={0.7}
                minWidth={1.2}
                maxWidth={3.5}
                dotSize={2}
              />
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-8 py-8 border-t border-zinc-100 bg-zinc-50/50 flex flex-col sm:flex-row items-center justify-between gap-6">
          <button
            onClick={clear}
            className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 text-zinc-500 hover:text-zinc-900 hover:bg-white border border-transparent hover:border-zinc-200 rounded-2xl transition-all font-bold text-sm"
          >
            <RotateCcw size={20} className="transition-transform group-hover:-rotate-45" />
            重寫 / 清除畫布
          </button>
          
          <div className="w-full sm:w-auto flex items-center gap-4">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-8 py-4 text-zinc-400 font-black text-sm hover:text-zinc-900 transition-colors"
            >
              取消
            </button>
            <button
              disabled={!hasSignature}
              onClick={save}
              className={`w-full sm:w-auto flex items-center justify-center gap-3 px-10 py-4 rounded-2xl transition-all font-black text-sm shadow-xl transform active:scale-95 ${
                hasSignature 
                ? 'bg-zinc-900 text-white hover:bg-blue-600 shadow-zinc-200 active:shadow-inner' 
                : 'bg-zinc-200 text-zinc-400 cursor-not-allowed shadow-none'
              }`}
            >
              <Check size={20} />
              完成並保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignaturePad;
