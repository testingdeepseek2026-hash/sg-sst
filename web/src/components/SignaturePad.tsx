import { useRef, useEffect, useState } from 'react';

interface SignaturePadProps {
  onSave: (base64: string) => void;
  onCancel: () => void;
  width?: number;
  height?: number;
  penColor?: string;
  penWidth?: number;
}

export default function SignaturePad({ 
  onSave, 
  onCancel, 
  width = 400, 
  height = 200, 
  penColor = '#0f766e', 
  penWidth = 2 
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Configurar canvas para alta resolución (devicePixelRatio)
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Fondo blanco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    // Líneas guía sutiles
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.6);
    ctx.lineTo(width, height * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, height * 0.8);
    ctx.lineTo(width, height * 0.8);
    ctx.stroke();

    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [width, height, penColor, penWidth]);

  const getPoint = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const { x, y } = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const { x, y } = getPoint(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    // Restaurar líneas guía
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.6);
    ctx.lineTo(width, height * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, height * 0.8);
    ctx.lineTo(width, height * 0.8);
    ctx.stroke();
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setHasSignature(false);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const base64 = canvas.toDataURL('image/png');
    onSave(base64);
  };

  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxWidth: '100%' }}>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 'bold', color: '#374151', marginBottom: 8 }}>
          Firma del trabajador (Res. 0312/2019 E19 - Evidencia de entrega)
        </label>
        <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
          Firme en el área punteada. Use mouse, lápiz óptico o dedo en pantalla táctil.
        </p>
      </div>

      <canvas
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
          touchAction: 'none'
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
          onClick={clearCanvas}
          disabled={!hasSignature}
          style={{
            padding: '8px 16px',
            background: hasSignature ? '#fef2f2' : '#f3f4f6',
            color: hasSignature ? '#dc2626' : '#9ca3af',
            border: '1px solid',
            borderColor: hasSignature ? '#fecaca' : '#e5e7eb',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            cursor: hasSignature ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s'
          }}
        >
          🗑️ Limpiar
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
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            flex: 1,
            maxWidth: 140
          }}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={saveSignature}
          disabled={!hasSignature}
          style={{
            padding: '8px 16px',
            background: hasSignature ? '#0f766e' : '#94a3b8',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: hasSignature ? 'pointer' : 'not-allowed',
            flex: 1,
            maxWidth: 140,
            transition: 'background 0.15s'
          }}
        >
          ✅ Guardar firma
        </button>
      </div>

      <details style={{ marginTop: 12, fontSize: 11, color: '#6b7280' }}>
        <summary style={{ cursor: 'pointer' }}>Requisitos legales de la firma</summary>
        <ul style={{ margin: '8px 0 0 18px', padding: 0, lineHeight: 1.6 }}>
          <li>Res. 0312/2019 Estándar E19: "Evidencia de entrega y capacitación" en EPP</li>
          <li>Ley 1581/2012: Consentimiento para tratamiento de datos biométricos (firma)</li>
          <li>La firma se almacena como imagen PNG (base64) en base de datos</li>
          <li>Solo el trabajador dueño (o administrador) puede firmar su entrega</li>
        </ul>
      </details>
    </div>
  );
}