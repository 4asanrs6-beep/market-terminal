import { useEffect, useRef, useState } from 'react'
import { createChart, IChartApi, ISeriesApi, ColorType } from 'lightweight-charts'
import type { StockQuote, ChartPeriod, ChartType } from '../types/stock'
import { useChartData } from '../hooks/useMarketData'
import styles from '../styles/StockChart.module.css'

interface StockChartProps {
  symbol: string | null
  quote: StockQuote | null
}

const PERIODS: { value: ChartPeriod; label: string; interval: string }[] = [
  { value: '1d', label: '1日', interval: '5m' },
  { value: '1w', label: '1週', interval: '15m' },
  { value: '1mo', label: '1月', interval: '1d' },
  { value: '3mo', label: '3月', interval: '1d' },
  { value: '6mo', label: '6月', interval: '1d' },
  { value: '1y', label: '1年', interval: '1wk' },
  { value: '5y', label: '5年', interval: '1mo' },
]

function formatNumber(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function StockChart({ symbol, quote }: StockChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | ISeriesApi<'Line'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)

  const [period, setPeriod] = useState<ChartPeriod>('3mo')
  const [chartType, setChartType] = useState<ChartType>('candlestick')

  const selectedPeriod = PERIODS.find(p => p.value === period)!
  const { data, loading } = useChartData(symbol, period, selectedPeriod.interval)

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
        timeVisible: period === '1d' || period === '1w',
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
  }, [])

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
    const volumeSeries = chart.addSeries({
      type: 'Histogram',
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    })
    volumeSeries.setData(
      data.map(d => ({
        time: d.time,
        value: d.volume,
        color: d.close >= d.open ? 'rgba(0,200,83,0.3)' : 'rgba(255,23,68,0.3)',
      }))
    )
    volumeSeriesRef.current = volumeSeries

    if (chartType === 'candlestick') {
      const series = chart.addSeries({
        type: 'Candlestick',
        upColor: '#00c853',
        downColor: '#ff1744',
        borderDownColor: '#ff1744',
        borderUpColor: '#00c853',
        wickDownColor: '#ff1744',
        wickUpColor: '#00c853',
      })
      series.setData(
        data.map(d => ({
          time: d.time,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
        }))
      )
      seriesRef.current = series
    } else {
      const series = chart.addSeries({
        type: 'Line',
        color: '#ff8c00',
        lineWidth: 2,
      })
      series.setData(
        data.map(d => ({
          time: d.time,
          value: d.close,
        }))
      )
      seriesRef.current = series
    }

    chart.timeScale().fitContent()
  }, [data, chartType])

  // Update time scale visibility when period changes
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.applyOptions({
        timeScale: {
          timeVisible: period === '1d' || period === '1w',
        },
      })
    }
  }, [period])

  if (!symbol) {
    return (
      <div className={styles.container}>
        <div className={styles.placeholder}>
          <div className={styles.placeholderIcon}>&#x1F4C8;</div>
          銘柄をクリックしてチャートを表示
        </div>
      </div>
    )
  }

  const isPositive = quote ? quote.regularMarketChange >= 0 : true
  const changeClass = isPositive ? styles.positive : styles.negative

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <div className={styles.tickerInfo}>
          <span className={styles.tickerSymbol}>{symbol}</span>
          {quote && (
            <>
              <span className={styles.tickerName}>{quote.shortName}</span>
              <span className={`${styles.tickerPrice} ${changeClass}`}>
                {formatNumber(quote.regularMarketPrice)}
              </span>
              <span className={`${styles.tickerChange} ${changeClass}`}>
                {isPositive ? '+' : ''}{formatNumber(quote.regularMarketChange)}
                ({isPositive ? '+' : ''}{formatNumber(quote.regularMarketChangePercent)}%)
              </span>
            </>
          )}
        </div>

        <div className={styles.spacer} />

        <div className={styles.periodButtons}>
          {PERIODS.map(p => (
            <button
              key={p.value}
              className={`${styles.periodBtn} ${period === p.value ? styles.active : ''}`}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <button
          className={styles.chartTypeBtn}
          onClick={() => setChartType(t => t === 'candlestick' ? 'line' : 'candlestick')}
        >
          {chartType === 'candlestick' ? 'ローソク' : 'ライン'}
        </button>
      </div>

      <div className={styles.chartArea} ref={chartContainerRef}>
        {loading && (
          <div className={styles.loading}>チャート読込中...</div>
        )}
      </div>
    </div>
  )
}
