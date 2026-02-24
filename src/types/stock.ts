export interface StockQuote {
  symbol: string
  shortName: string
  sector: string
  regularMarketPrice: number
  regularMarketChange: number
  regularMarketChangePercent: number
  regularMarketVolume: number
  regularMarketPreviousClose: number
  regularMarketOpen: number
  regularMarketDayHigh: number
  regularMarketDayLow: number
  fiftyTwoWeekHigh: number
  fiftyTwoWeekLow: number
  marketCap: number
  fiveDayChangePercent?: number
}

export interface ChartPoint {
  time: string | number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface ConstituentInfo {
  symbol: string
  name: string
  sector: string
}

export type MarketIndex = 'sp500' | 'nasdaq100' | 'watchlist'

export type SortField = 'symbol' | 'shortName' | 'regularMarketPrice' | 'regularMarketPreviousClose' | 'regularMarketChange' | 'regularMarketChangePercent' | 'regularMarketVolume' | 'fiveDayChangePercent'
export type SortDirection = 'asc' | 'desc'

export type ChartPeriod = '1d' | '1w' | '1mo' | '3mo' | '6mo' | '1y' | '5y'
export type ChartType = 'candlestick' | 'line'

declare global {
  interface Window {
    electronAPI: {
      getConstituents: (market: string) => Promise<ConstituentInfo[]>
      getStockQuotes: (symbols: string[]) => Promise<StockQuote[]>
      getChartData: (symbol: string, period: string, interval: string) => Promise<ChartPoint[]>
      get5DayChanges: (symbols: string[]) => Promise<Record<string, number>>
      getWatchlist: () => Promise<string[]>
      addToWatchlist: (ticker: string) => Promise<string[]>
      removeFromWatchlist: (ticker: string) => Promise<string[]>
    }
  }
}
