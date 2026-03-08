import React, { useState, useRef, useEffect } from 'react';
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
      
      setScale(isNaN(initialScale) ? 1 : initialScale);
      setPosition({
        x: isNaN(newX) ? 0 : newX,
        y: isNaN(newY) ? 0 : newY,
      });
    }
  }, [status, image, dimensions.width, dimensions.height]);

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = scale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - position.x) / oldScale,
      y: (pointer.y - position.y) / oldScale,
    };

    const speed = 1.1;
    const newScale = e.evt.deltaY < 0 ? oldScale * speed : oldScale / speed;
    const finalScale = Math.max(0.05, Math.min(newScale, 20));

    const newX = pointer.x - mousePointTo.x * finalScale;
    const newY = pointer.y - mousePointTo.y * finalScale;

    setScale(isNaN(finalScale) ? 1 : finalScale);
    setPosition({
      x: isNaN(newX) ? position.x : newX,
      y: isNaN(newY) ? position.y : newY,
    });
  };

  const handleStageClick = (e: any) => {
    // If clicked on a pin, don't add a new one
    if (e.target !== e.target.getStage() && e.target.className !== 'Image' && e.target.className !== 'Rect') {
      return;
    }

    const stage = stageRef.current;
    const pointer = stage.getPointerPosition();
    
    if (image && pointer) {
      const x = (pointer.x - position.x) / (image.width * scale);
      const y = (pointer.y - position.y) / (image.height * scale);
      
      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
        onAddPin(x, y);
      }
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-400 bg-zinc-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 mb-4"></div>
        <p>載入底圖中...</p>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="flex items-center justify-center h-full text-red-500 bg-zinc-100">
        底圖載入失敗，請重新上傳。
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full bg-zinc-200 overflow-hidden cursor-crosshair relative">
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        onWheel={handleWheel}
        ref={stageRef}
        onClick={handleStageClick}
        onTap={handleStageClick}
      >
        <Layer
          x={position.x}
          y={position.y}
          scaleX={scale}
          scaleY={scale}
          draggable
          onDragEnd={(e) => setPosition({ x: e.target.x(), y: e.target.y() })}
        >
          {image && <KonvaImage image={image} />}
          {image && pins.map((pin) => (
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
              className="cursor-pointer"
            >
              <Circle
                radius={12 / scale}
                fill="#ef4444"
                stroke="white"
                strokeWidth={2 / scale}
                shadowBlur={5 / scale}
              />
              <Text
                text={pin.defects.length.toString()}
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
      <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur px-3 py-1 rounded-full text-xs text-zinc-600 shadow-sm pointer-events-none flex flex-col gap-1">
        <span>滾輪縮放 • 拖曳移動 • 點擊標記</span>
        <span className="text-[10px] opacity-50">
          Status: {status} | Dim: {Math.round(dimensions.width)}x{Math.round(dimensions.height)} | 
          Img: {image ? `${image.width}x${image.height}` : 'none'} | 
          Scale: {scale.toFixed(2)} | Pos: {Math.round(position.x)},{Math.round(position.y)}
        </span>
      </div>
    </div>
  );
};

export default FloorPlanViewer;
