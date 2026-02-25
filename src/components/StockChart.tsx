import { useEffect, useRef } from 'react'
import { createChart, IChartApi, ISeriesApi, ColorType } from 'lightweight-charts'
import type { ChartPoint } from '../types/stock'
import { useChartData } from '../hooks/useMarketData'
import styles from '../styles/StockChart.module.css'

interface StockChartProps {
  symbol: string
  label: string
  period: string
  interval: string
  chartType?: 'candlestick' | 'line'
  maPeriods?: number[]
}

// SMA (Simple Moving Average) calculation
function calculateSMA(data: ChartPoint[], period: number): { time: any; value: number }[] {
  const result: { time: any; value: number }[] = []
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close
    }
    result.push({ time: data[i].time, value: sum / period })
  }
  return result
}

const MA_COLORS: Record<number, string> = {
  25: '#FFD700',   // gold
  75: '#00BFFF',   // sky blue
  200: '#FF69B4',  // pink
  13: '#FFD700',   // weekly equivalents
  26: '#00BFFF',
  52: '#FF69B4',
}

export function StockChart({
  symbol,
  label,
  period,
  interval,
  chartType = 'candlestick',
  maPeriods,
}: StockChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | ISeriesApi<'Line'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const maSeriesRefs = useRef<ISeriesApi<'Line'>[]>([])

  const { data, loading } = useChartData(symbol, period, interval)

  const isIntraday = period === '1d' || period === '1w'

  // Create chart
  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0a0a0a' },
        textColor: '#999',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#1a1a1a' },
        horzLines: { color: '#1a1a1a' },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: '#ff8c00', width: 1, style: 2, labelBackgroundColor: '#ff8c00' },
        horzLine: { color: '#ff8c00', width: 1, style: 2, labelBackgroundColor: '#ff8c00' },
      },
      rightPriceScale: {
        borderColor: '#2a2a2a',
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
      timeScale: {
        borderColor: '#2a2a2a',
        timeVisible: isIntraday,
      },
      handleScale: true,
      handleScroll: true,
    })

    chartRef.current = chart

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        })
      }
    }

    const observer = new ResizeObserver(handleResize)
    observer.observe(chartContainerRef.current)

    return () => {
      observer.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
      volumeSeriesRef.current = null
      maSeriesRefs.current = []
    }
  }, [isIntraday])

  // Update series when data or chart type changes
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !data.length) return

    // Remove existing series
    if (seriesRef.current) {
      chart.removeSeries(seriesRef.current)
      seriesRef.current = null
    }
    if (volumeSeriesRef.current) {
      chart.removeSeries(volumeSeriesRef.current)
      volumeSeriesRef.current = null
    }
    for (const s of maSeriesRefs.current) {
      chart.removeSeries(s)
    }
    maSeriesRefs.current = []

    // Volume histogram
    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    })
    volumeSeries.setData(
      data.map(d => ({
        time: d.time as any,
        value: d.volume,
        color: d.close >= d.open ? 'rgba(0,200,83,0.3)' : 'rgba(255,23,68,0.3)',
      }))
    )
    volumeSeriesRef.current = volumeSeries

    if (chartType === 'candlestick') {
      const series = chart.addCandlestickSeries({
        upColor: '#00c853',
        downColor: '#ff1744',
        borderDownColor: '#ff1744',
        borderUpColor: '#00c853',
        wickDownColor: '#ff1744',
        wickUpColor: '#00c853',
      })
      series.setData(
        data.map(d => ({
          time: d.time as any,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
        }))
      )
      seriesRef.current = series
    } else {
      const series = chart.addLineSeries({
        color: '#ff8c00',
        lineWidth: 2,
      })
      series.setData(
        data.map(d => ({
          time: d.time as any,
          value: d.close,
        }))
      )
      seriesRef.current = series
    }

    // Moving averages
    if (maPeriods && maPeriods.length > 0) {
      for (const p of maPeriods) {
        if (data.length < p) continue // not enough data
        const maData = calculateSMA(data, p)
        const color = MA_COLORS[p] || '#888'
        const maSeries = chart.addLineSeries({
          color,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        })
        maSeries.setData(maData)
        maSeriesRefs.current.push(maSeries)
      }
    }

    chart.timeScale().fitContent()
  }, [data, chartType, maPeriods])

  // Build MA legend text
  const maLegend = maPeriods && maPeriods.length > 0
    ? maPeriods.map(p => {
        const color = MA_COLORS[p] || '#888'
        return `<span style="color:${color}">MA${p}</span>`
      }).join(' ')
    : ''

  return (
    <div className={styles.chartPanel}>
      <div className={styles.chartLabel}>
        {label}
        {maLegend && (
          <span
            className={styles.maLegend}
            dangerouslySetInnerHTML={{ __html: maLegend }}
          />
        )}
      </div>
      <div className={styles.chartArea} ref={chartContainerRef}>
        {loading && (
          <div className={styles.loading}>読込中...</div>
        )}
      </div>
    </div>
  )
}
