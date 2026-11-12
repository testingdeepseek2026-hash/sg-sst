import { useEffect, useRef, useState } from 'react';

import { Check, Trash2 } from 'lucide-react';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
  width?: number;
  height?: number;
  hasExistingSignature?: boolean;
}

export function SignaturePad({
  onSave,
  onCancel,
  width = 400,
  height = 200,
  hasExistingSignature = false,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasSignature, setHasSignature] = useState(hasExistingSignature);
  const [isDrawing, setIsDrawing] = useState(false);

  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctxRef.current = ctx;
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPoint = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = ctxRef.current;
    if (!ctx) return;
    const { x, y } = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = ctxRef.current;
    if (!ctx) return;
    const { x, y } = getPoint(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 8,
        padding: 16,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        maxWidth: '100%',
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <label
          htmlFor="signature-canvas"
          style={{
            display: 'block',
            fontSize: 'var(--font-size-label)',
            fontWeight: 'bold',
            color: '#374151',
            marginBottom: 8,
          }}
        >
          Firma del trabajador (Res. 0312/2019 E19 - Evidencia de entrega)
        </label>
        <p style={{ fontSize: 'var(--font-size-caption)', color: '#6b7280', margin: 0 }}>
          Firme en el área punteada. Use mouse, lápiz óptico o dedo en pantalla táctil.
        </p>
      </div>

      <canvas
        id="signature-canvas"
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          border: '1px solid #d1d5db',
          borderRadius: 6,
          background: '#fff',
          cursor: 'crosshair',
          touchAction: 'none',
        }}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="ui-icon-button"
          onClick={clearCanvas}
          disabled={!hasSignature}
          style={{
            padding: '8px 16px',
            background: hasSignature ? '#fef2f2' : '#f3f4f6',
            color: hasSignature ? '#dc2626' : '#9ca3af',
            border: '1px solid',
            borderColor: hasSignature ? '#fecaca' : '#e5e7eb',
            borderRadius: 6,
            fontSize: 'var(--font-size-label)',
            fontWeight: 500,
            cursor: hasSignature ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s',
          }}
        >
          <Trash2 aria-hidden="true" size={16} /> Limpiar
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '8px 16px',
            background: '#e5e7eb',
            color: '#374151',
            border: 'none',
            borderRadius: 6,
            fontSize: 'var(--font-size-label)',
            fontWeight: 500,
            cursor: 'pointer',
            flex: 1,
            maxWidth: 140,
          }}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="ui-icon-button"
          onClick={saveSignature}
          disabled={!hasSignature}
          style={{
            padding: '8px 16px',
            background: hasSignature ? '#0f766e' : '#94a3b8',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 'var(--font-size-label)',
            fontWeight: 600,
            cursor: hasSignature ? 'pointer' : 'not-allowed',
            flex: 1,
            maxWidth: 140,
            transition: 'background 0.15s',
          }}
        >
          <Check aria-hidden="true" size={16} /> Guardar firma
        </button>
      </div>

      <details style={{ marginTop: 12, fontSize: 'var(--font-size-micro)', color: '#6b7280' }}>
        <summary style={{ cursor: 'pointer' }}>Requisitos legales de la firma</summary>
        <ul style={{ margin: '8px 0 0 18px', padding: 0, lineHeight: 1.6 }}>
          <li>Res. 0312/2019 Estándar E19: “Evidencia de entrega y capacitación” en EPP</li>
          <li>Ley 1581/2012: Consentimiento para tratamiento de datos biométricos (firma)</li>
          <li>La firma se almacena como imagen PNG (base64) en base de datos</li>
          <li>Solo el trabajador dueño (o administrador) puede firmar su entrega</li>
        </ul>
      </details>
    </div>
  );
}
