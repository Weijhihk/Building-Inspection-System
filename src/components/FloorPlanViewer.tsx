import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Circle, Group, Text } from 'react-konva';
import useImage from 'use-image';
import { Pin } from '../types';

interface FloorPlanViewerProps {
  imageUrl: string;
  pins: Pin[];
  onAddPin: (x: number, y: number) => void;
  onSelectPin: (pin: Pin) => void;
}

const FloorPlanViewer: React.FC<FloorPlanViewerProps> = ({ imageUrl, pins, onAddPin, onSelectPin }) => {
  const [image, status] = useImage(imageUrl);
  const stageRef = useRef<any>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
  // Drag-to-add pin state
  const [isDraggingNewPin, setIsDraggingNewPin] = useState(false);
  const [newPinPos, setNewPinPos] = useState({ x: 0, y: 0 });

  // Realtime refs for synchronous updates during fast gestures
  const scaleRef = useRef(1);
  const posRef = useRef({ x: 0, y: 0 });
  const layerRef = useRef<any>(null);

  // Touch state for pinch-to-zoom
  const lastCenter = useRef<{ x: number, y: number } | null>(null);
  const lastDist = useRef<number>(0);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth || window.innerWidth,
          height: containerRef.current.offsetHeight || window.innerHeight - 100, // Fallback height
        });
      }
    };
    
    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    updateSize();
    return () => observer.disconnect();
  }, []);

  // Center image initially when loaded
  useEffect(() => {
    if (status === 'loaded' && image && image.width > 0 && image.height > 0 && dimensions.width > 0 && dimensions.height > 0) {
      const scaleX = dimensions.width / image.width;
      const scaleY = dimensions.height / image.height;
      const initialScale = Math.min(scaleX, scaleY, 1) * 0.9;
      
      const newX = (dimensions.width - image.width * initialScale) / 2;
      const newY = (dimensions.height - image.height * initialScale) / 2;
      const finalScale = isNaN(initialScale) ? 1 : initialScale;
      const finalPos = {
        x: isNaN(newX) ? 0 : newX,
        y: isNaN(newY) ? 0 : newY,
      };

      scaleRef.current = finalScale;
      posRef.current = finalPos;
      setScale(finalScale);
      setPosition(finalPos);
    }
  }, [status, image, dimensions.width, dimensions.height]);

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const layer = layerRef.current;
    if (!stage || !layer) return;

    const oldScale = layer.scaleX();
    const oldPosition = layer.position();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - oldPosition.x) / oldScale,
      y: (pointer.y - oldPosition.y) / oldScale,
    };

    const speed = 1.1;
    const newScale = e.evt.deltaY < 0 ? oldScale * speed : oldScale / speed;
    const finalScale = Math.max(0.05, Math.min(newScale, 20));

    const newX = pointer.x - mousePointTo.x * finalScale;
    const newY = pointer.y - mousePointTo.y * finalScale;

    // Direct mutation for 60fps performance without React batch lag
    layer.scale({ x: finalScale, y: finalScale });
    layer.position({ x: newX, y: newY });
    layer.batchDraw();

    // Sync ref
    scaleRef.current = finalScale;
    posRef.current = { x: newX, y: newY };

    // Debounce react state sync
    if ((window as any).wheelTimeout) clearTimeout((window as any).wheelTimeout);
    (window as any).wheelTimeout = setTimeout(() => {
      setScale(finalScale);
      setPosition({ x: newX, y: newY });
    }, 200);
  };

  function getDistance(p1: { x: number, y: number }, p2: { x: number, y: number }) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }

  function getCenter(p1: { x: number, y: number }, p2: { x: number, y: number }) {
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
    };
  }

  const handleTouchStart = (e: any) => {
    const touches = e.evt.touches;
    if (touches.length === 2) {
      const p1 = { x: touches[0].clientX, y: touches[0].clientY };
      const p2 = { x: touches[1].clientX, y: touches[1].clientY };
      lastDist.current = getDistance(p1, p2);
      lastCenter.current = getCenter(p1, p2);
    }
  };

  const handleTouchMove = (e: any) => {
    // If dragging new pin (1 finger), don't perform zoom/pan
    if (isDraggingNewPin) return;

    const touches = e.evt.touches;
    const layer = layerRef.current;
    const stage = stageRef.current;

    // MANDATORY: Only 2 fingers can pan/zoom
    if (touches.length === 2 && layer && stage) {
      e.evt.preventDefault();
      
      const p1 = { x: touches[0].clientX, y: touches[0].clientY };
      const p2 = { x: touches[1].clientX, y: touches[1].clientY };
      
      const dist = getDistance(p1, p2);
      const center = getCenter(p1, p2);

      if (!lastDist.current || !lastCenter.current) {
        lastDist.current = dist;
        lastCenter.current = center;
        return;
      }

      const oldScale = layer.scaleX();
      const oldPosition = layer.position();

      // 1. Calculate new scale (Zoom)
      const distDiff = dist / lastDist.current;
      const newScale = oldScale * distDiff;
      const finalScale = Math.max(0.05, Math.min(newScale, 20));

      // 2. Calculate point to zoom towards (last center relative to layer)
      const pointTo = {
        x: (lastCenter.current.x - oldPosition.x) / oldScale,
        y: (lastCenter.current.y - oldPosition.y) / oldScale,
      };

      // 3. Calculate Pan translation (Movement of center point)
      const dx = center.x - lastCenter.current.x;
      const dy = center.y - lastCenter.current.y;

      // 4. Update position based on both Zoom anchor and Pan translation
      const newX = center.x - pointTo.x * finalScale;
      const newY = center.y - pointTo.y * finalScale;

      layer.scale({ x: finalScale, y: finalScale });
      layer.position({ x: newX, y: newY });
      layer.batchDraw();

      scaleRef.current = finalScale;
      posRef.current = { x: newX, y: newY };

      lastDist.current = dist;
      lastCenter.current = center;
    }
  };

  const handleTouchEnd = () => {
    lastDist.current = 0;
    lastCenter.current = null;
    
    if (layerRef.current) {
      setScale(layerRef.current.scaleX());
      setPosition(layerRef.current.position());
    }
  };

  // Drag pin logic
  const handleStartDragNewPin = (e: any) => {
    setIsDraggingNewPin(true);
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    setNewPinPos({ x: clientX, y: clientY });
  };

  const handleGlobalMove = useCallback((e: any) => {
    if (!isDraggingNewPin) return;
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    setNewPinPos({ x: clientX, y: clientY });
  }, [isDraggingNewPin]);

  const handleGlobalUp = useCallback((e: any) => {
    if (!isDraggingNewPin) return;
    setIsDraggingNewPin(false);

    const stage = stageRef.current;
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (image && pointer) {
      const x = (pointer.x - position.x) / (image.width * scale);
      const y = (pointer.y - position.y) / (image.height * scale);
      
      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
        onAddPin(x, y);
      }
    }
  }, [isDraggingNewPin, image, position, scale, onAddPin]);

  useEffect(() => {
    if (isDraggingNewPin) {
      window.addEventListener('mousemove', handleGlobalMove);
      window.addEventListener('mouseup', handleGlobalUp);
      window.addEventListener('touchmove', handleGlobalMove, { passive: false });
      window.addEventListener('touchend', handleGlobalUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('mouseup', handleGlobalUp);
      window.removeEventListener('touchmove', handleGlobalMove);
      window.removeEventListener('touchend', handleGlobalUp);
    };
  }, [isDraggingNewPin, handleGlobalMove, handleGlobalUp]);

  const handleStageClick = (e: any) => {
    // If clicked on a pin, select it
    // Pin addition is now handled via drag-and-drop
    return;
  };

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full bg-zinc-200 overflow-hidden cursor-crosshair relative"
      style={{ touchAction: 'none' }}
    >
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400 bg-zinc-100 z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 mb-4"></div>
          <p>載入底圖中...</p>
        </div>
      )}

      {status === 'failed' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-100 z-10 p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
            <span className="text-red-500 font-bold text-2xl">!</span>
          </div>
          <h3 className="text-lg font-bold text-zinc-900 mb-2">找不到平面圖檔案</h3>
          <p className="text-zinc-500 mb-4 max-w-md">
            系統嘗試自動載入檔案：<br/>
            <code className="bg-zinc-200 px-2 py-1 rounded text-zinc-800 font-mono text-sm mt-2 block select-all">
              {imageUrl}
            </code>
          </p>
          <div className="bg-white border border-zinc-200 p-4 rounded-xl text-sm text-left max-w-md w-full shadow-sm text-zinc-600">
            <strong className="block text-zinc-900 mb-1">如何解決？</strong>
            1. 請將該戶的平面圖檔案準備好 (JPG 格式)<br/>
            2. 將檔名命名為上述紅字部分 (例如 KY85_A_2F_01.jpg)<br/>
            3. 將該檔案放入專案的 <code className="bg-zinc-100 px-1 rounded">public/floorplans/</code> 資料夾中<br/>
            4. 重新整理本網頁
          </div>
        </div>
      )}

      <Stage
        width={dimensions.width}
        height={dimensions.height}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        ref={stageRef}
        onClick={handleStageClick}
        onTap={handleStageClick}
        className={status === 'loaded' ? 'opacity-100' : 'opacity-0'}
      >
        <Layer
          ref={layerRef}
          x={position.x}
          y={position.y}
          scaleX={scale}
          scaleY={scale}
          draggable={false}
        >
          {image && status === 'loaded' && <KonvaImage image={image} />}
          {image && status === 'loaded' && pins.map((pin, index) => (
            <Group
              key={pin.id}
              x={pin.x * image.width}
              y={pin.y * image.height}
              onClick={(e) => {
                e.cancelBubble = true;
                onSelectPin(pin);
              }}
              onTap={(e) => {
                e.cancelBubble = true;
                onSelectPin(pin);
              }}
              onMouseEnter={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'pointer';
              }}
              onMouseLeave={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'crosshair';
              }}
            >
              {/* Hit area for better touch targets */}
              <Circle
                radius={30 / scale}
                fill="transparent"
              />
              <Circle
                radius={12 / scale}
                fill="#ef4444"
                stroke="white"
                strokeWidth={2 / scale}
                shadowBlur={5 / scale}
              />
              <Text
                text={(index + 1).toString()}
                fontSize={10 / scale}
                fill="white"
                x={-4 / scale}
                y={-5 / scale}
                fontStyle="bold"
                align="center"
              />
            </Group>
          ))}
        </Layer>
      </Stage>
      <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur px-3 py-1 rounded-full text-xs text-zinc-600 shadow-sm pointer-events-none flex flex-col gap-1 z-20">
        <span>滾輪縮放 • 拖曳移動 • 拖曳右上方圖釘至定點標記</span>
        <span className="text-[10px] opacity-50">
          Status: {status} | Dim: {Math.round(dimensions.width)}x{Math.round(dimensions.height)} | 
          Scale: {scale.toFixed(2)} | Pos: {Math.round(position.x)},{Math.round(position.y)}
        </span>
      </div>

      {/* Toolbox Pin */}
      <div 
        className="absolute top-6 right-6 z-30 flex flex-col items-center gap-2"
      >
        <div 
          onMouseDown={handleStartDragNewPin}
          onTouchStart={handleStartDragNewPin}
          className="w-14 h-14 bg-red-500 rounded-2xl flex items-center justify-center text-white shadow-xl cursor-grab active:cursor-grabbing hover:scale-105 transition-transform border-4 border-white"
          title="拖曳標記缺失"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
        </div>
        <span className="text-[10px] font-bold text-zinc-500 bg-white/80 px-2 py-0.5 rounded-full shadow-sm uppercase tracking-tighter">拖曳標記</span>
      </div>

      {/* Ghost Pin during dragging */}
      {isDraggingNewPin && (
        <div 
          className="fixed w-8 h-8 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-white shadow-2xl pointer-events-none z-[100] transform -translate-x-1/2 -translate-y-1/2"
          style={{ 
            left: newPinPos.x, 
            top: newPinPos.y,
          }}
        >
          <div className="w-1 h-1 bg-white rounded-full"></div>
        </div>
      )}
    </div>
  );
};

export default FloorPlanViewer;
