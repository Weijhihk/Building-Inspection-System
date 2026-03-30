import React, { useRef, useState, useEffect } from 'react';
import { X, RotateCcw, Check } from 'lucide-react';

interface SignaturePadProps {
  title: string;
  onSave: (signatureDataUrl: string) => void;
  onClose: () => void;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ title, onSave, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Adjust canvas size to match display size
    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        
        // Initial setup for smoothing
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 3;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
        }
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const getPointerPos = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Capture pointer to continue drawing even if mouse/finger moves outside
    canvas.setPointerCapture(e.pointerId);
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getPointerPos(e);
    
    // Explicitly set styles at the start of every stroke
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    
    // Immediate dot for single taps/clicks
    ctx.lineTo(pos.x + 0.1, pos.y + 0.1);
    ctx.stroke();
    
    setIsDrawing(true);
    setHasSignature(true);
  };

  const draw = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getPointerPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const endDrawing = (e: React.PointerEvent) => {
    if (isDrawing && canvasRef.current) {
      canvasRef.current.releasePointerCapture(e.pointerId);
    }
    setIsDrawing(false);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const save = () => {
    if (!hasSignature) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Get the data URL
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div className="flex flex-col">
            <h3 className="text-xl font-bold text-zinc-900">{title} 電子簽名</h3>
            <span className="text-xs text-zinc-400">請在下方空白區域內簽署</span>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-zinc-200 rounded-full transition-colors text-zinc-400 hover:text-zinc-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 bg-white relative p-6 h-[400px] sm:h-[500px]">
          <div className="w-full h-full border-2 border-dashed border-zinc-300 rounded-3xl overflow-hidden cursor-crosshair relative bg-zinc-50 shadow-inner">
            {!hasSignature && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                <span className="text-2xl font-bold text-zinc-200 uppercase tracking-widest">請在此簽名</span>
              </div>
            )}
            <canvas
              ref={canvasRef}
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={endDrawing}
              onPointerLeave={endDrawing}
              onPointerCancel={endDrawing}
              className="absolute inset-0 block w-full h-full"
              style={{ touchAction: 'none' }}
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
