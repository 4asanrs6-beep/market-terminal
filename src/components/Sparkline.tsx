import { useRef, useEffect } from 'react'

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
}

export function Sparkline({ data, width = 80, height = 30 }: SparklineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || data.length < 2) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    const padding = 2

    const isUp = data[data.length - 1] >= data[0]
    const color = isUp ? '#00c853' : '#ff1744'

    ctx.beginPath()
    ctx.strokeStyle = color
    ctx.lineWidth = 1.2
    ctx.lineJoin = 'round'

    for (let i = 0; i < data.length; i++) {
      const x = padding + (i / (data.length - 1)) * (width - padding * 2)
      const y = padding + (1 - (data[i] - min) / range) * (height - padding * 2)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }, [data, width, height])

  if (!data || data.length < 2) {
    return <canvas ref={canvasRef} width={width} height={height} style={{ width, height, opacity: 0.3 }} />
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, display: 'block' }}
    />
  )
}
