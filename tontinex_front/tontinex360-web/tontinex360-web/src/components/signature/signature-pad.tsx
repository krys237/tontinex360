"use client";
import { useRef, useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { Eraser, Check } from "lucide-react";

export interface SignaturePadHandle {
  /** Récupère la signature en base64 (data URL). null si vide. */
  getDataURL: () => string | null;
  /** Efface le canvas. */
  clear: () => void;
  /** Vrai si l'utilisateur n'a rien dessiné. */
  isEmpty: () => boolean;
}

interface SignaturePadProps {
  width?: number;
  height?: number;
  /** Couleur du trait */
  penColor?: string;
  /** Épaisseur du trait */
  penWidth?: number;
  /** Couleur de fond (défaut blanc) */
  bgColor?: string;
  /** Callback à chaque changement (signature actuelle ou null) */
  onChange?: (dataUrl: string | null) => void;
  className?: string;
}

/**
 * Pad de signature manuscrite — fonctionne au doigt (touch) ou à la souris.
 * Trait lissé via interpolation entre points consécutifs.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  function SignaturePad(
    { width = 500, height = 180, penColor = "#1B2838", penWidth = 2.5, bgColor = "#FFFFFF", onChange, className = "" },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawingRef = useRef(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);
    const [hasDrawn, setHasDrawn] = useState(false);

    // Init canvas
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = penWidth;
      ctx.strokeStyle = penColor;
    }, [width, height, penColor, penWidth, bgColor]);

    const getPos = (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      let clientX: number, clientY: number;
      if ("touches" in e) {
        const t = e.touches[0] ?? e.changedTouches[0];
        clientX = t.clientX;
        clientY = t.clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const start = (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      drawingRef.current = true;
      lastPointRef.current = getPos(e);
    };

    const move = (e: React.MouseEvent | React.TouchEvent) => {
      if (!drawingRef.current) return;
      e.preventDefault();
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const pos = getPos(e);
      const last = lastPointRef.current;
      if (!last) {
        lastPointRef.current = pos;
        return;
      }
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      // Lissage quadratique entre points consécutifs
      const midX = (last.x + pos.x) / 2;
      const midY = (last.y + pos.y) / 2;
      ctx.quadraticCurveTo(last.x, last.y, midX, midY);
      ctx.stroke();
      lastPointRef.current = pos;
      if (!hasDrawn) setHasDrawn(true);
    };

    const end = () => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      lastPointRef.current = null;
      if (onChange) {
        const url = canvasRef.current?.toDataURL("image/png") ?? null;
        onChange(url);
      }
    };

    const clear = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = penWidth;
      ctx.strokeStyle = penColor;
      setHasDrawn(false);
      if (onChange) onChange(null);
    };

    useImperativeHandle(ref, () => ({
      getDataURL: () => (hasDrawn ? canvasRef.current?.toDataURL("image/png") ?? null : null),
      clear,
      isEmpty: () => !hasDrawn,
    }), [hasDrawn]);

    return (
      <div className={`inline-block ${className}`}>
        <div className="relative bg-white border-2 border-dashed border-gray-300 rounded-lg overflow-hidden">
          <canvas
            ref={canvasRef}
            onMouseDown={start}
            onMouseMove={move}
            onMouseUp={end}
            onMouseLeave={end}
            onTouchStart={start}
            onTouchMove={move}
            onTouchEnd={end}
            className="block touch-none cursor-crosshair"
            style={{ width, height }}
          />
          {!hasDrawn && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-sm text-gray-300 italic">
                Signer ici avec le doigt ou la souris
              </p>
            </div>
          )}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-2/3 h-px bg-gray-200 pointer-events-none" />
        </div>
        <div className="flex items-center justify-between mt-2">
          <button
            type="button"
            onClick={clear}
            disabled={!hasDrawn}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-gray-600 hover:text-red-600 disabled:opacity-30"
          >
            <Eraser size={12} /> Effacer
          </button>
          <p className="text-[10px] text-gray-400 flex items-center gap-1">
            {hasDrawn ? (
              <><Check size={11} className="text-emerald-600" /> Signature capturée</>
            ) : (
              "En attente de signature"
            )}
          </p>
        </div>
      </div>
    );
  },
);
