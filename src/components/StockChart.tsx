import { useEffect, useRef } from 'react'
import { createChart, IChartApi, ISeriesApi, ColorType } from 'lightweight-charts'
import { useChartData } from '../hooks/useMarketData'
import styles from '../styles/StockChart.module.css'

interface StockChartProps {
  symbol: string
  label: string
  period: string
  interval: string
  chartType?: 'candlestick' | 'line'
}

export function StockChart({ symbol, label, period, interval, chartType = 'candlestick' }: StockChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | ISeriesApi<'Line'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)

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

    chart.timeScale().fitContent()
  }, [data, chartType])

  return (
    <div className={styles.chartPanel}>
      <div className={styles.chartLabel}>{label}</div>
      <div className={styles.chartArea} ref={chartContainerRef}>
        {loading && (
          <div className={styles.loading}>読込中...</div>
        )}
      </div>
    </div>
  )
}
