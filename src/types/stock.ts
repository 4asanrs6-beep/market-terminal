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
  earningsDate?: string  // YYYY-MM-DD format
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

export type MarketIndex = 'sp500' | 'nasdaq100' | string  // 'watchlist:wl_1' etc.

export interface WatchlistInfo {
  id: string
  name: string
  symbols: string[]
}

export interface WatchlistsData {
  lists: WatchlistInfo[]
}

export interface QuoteSummary {
  shortName: string
  longName: string
  sector: string
  industry: string
  trailingPE: number | null
  forwardPE: number | null
  priceToBook: number | null
  epsTrailingTwelveMonths: number | null
  epsForward: number | null
  dividendYield: number | null
  trailingAnnualDividendRate: number | null
  fiftyTwoWeekHigh: number | null
  fiftyTwoWeekLow: number | null
  marketCap: number | null
  enterpriseValue: number | null
  revenuePerShare: number | null
  profitMargins: number | null
  returnOnEquity: number | null
  debtToEquity: number | null
  beta: number | null
  longBusinessSummary: string | null
  fullTimeEmployees: number | null
  website: string | null
  country: string | null
  city: string | null
}

export interface IncomeStatement {
  endDate: string
  totalRevenue: number | null
  operatingIncome: number | null
  netIncome: number | null
  grossProfit: number | null
  ebit: number | null
}

export interface FinancialsData {
  annual: IncomeStatement[]
  quarterly: IncomeStatement[]
}

export type SortField = 'symbol' | 'shortName' | 'regularMarketPrice' | 'regularMarketPreviousClose' | 'regularMarketChange' | 'regularMarketChangePercent' | 'regularMarketVolume' | 'fiveDayChangePercent' | 'marketCap' | 'earningsDate'
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
      getSectors: (symbols: string[]) => Promise<Record<string, string>>
      getWatchlists: () => Promise<WatchlistsData>
      createWatchlist: (name: string) => Promise<WatchlistsData>
      renameWatchlist: (id: string, name: string) => Promise<WatchlistsData>
      deleteWatchlist: (id: string) => Promise<WatchlistsData>
      addToWatchlist: (listId: string, ticker: string) => Promise<WatchlistsData>
      removeFromWatchlist: (listId: string, ticker: string) => Promise<WatchlistsData>
      getQuoteSummary: (symbol: string) => Promise<QuoteSummary | null>
      getFinancials: (symbol: string) => Promise<FinancialsData | null>
      getSparklines: (symbols: string[]) => Promise<Record<string, number[]>>
      openChartWindow: (symbol: string) => Promise<void>
      clearCache: () => Promise<void>
    }
  }
}
