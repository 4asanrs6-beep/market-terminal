export type MarketIndex = 'sp500' | 'nasdaq100'

interface ConstituentInfo {
  symbol: string
  name: string
  sector: string
}

// Full S&P 500 constituents (~503 tickers, as of early 2025)
const SP500_SYMBOLS: string[] = [
  'A','AAL','AAPL','ABBV','ABNB','ABT','ACGL','ACN','ADBE','ADI',
  'ADM','ADP','ADSK','AEE','AEP','AES','AFL','AIG','AIZ','AJG',
  'ALL','ALLE','AMAT','AMCR','AMD','AME','AMGN','AMP','AMT','AMZN',
  'ANET','ANSS','AON','AOS','APA','APD','APH','APO','APTV','ARE',
  'ATO','AVGO','AVB','AVY','AWK','AXON','AXP','AZO',
  'BA','BAC','BAX','BBWI','BBY','BDX','BEN','BF-B','BG','BIIB',
  'BIO','BK','BKNG','BKR','BLDR','BLK','BMY','BR','BRK-B','BRO',
  'BSX','BWA','BX','BXP',
  'C','CAG','CAH','CARR','CAT','CB','CBOE','CBRE','CCI','CCL',
  'CDNS','CDW','CE','CEG','CF','CFG','CHD','CHRW','CHTR','CI',
  'CINF','CL','CLX','CMA','CMCSA','CME','CMG','CMI','CMS','CNC',
  'CNP','COF','COO','COP','COR','COST','CPAY','CPB','CPRT','CPT',
  'CRL','CRM','CRWD','CSCO','CSGP','CSX','CTAS','CTRA','CTSH',
  'CTVA','CVS','CVX','CZR',
  'D','DAL','DAY','DD','DE','DECK','DELL','DFS','DG','DGX','DHI',
  'DHR','DIS','DLTR','DOV','DOW','DPZ','DRI','DTE','DUK','DVA',
  'DVN','DXCM',
  'EA','EBAY','ECL','ED','EFX','EIX','EL','EMN','EMR','ENPH',
  'EOG','EPAM','EQIX','EQR','EQT','ERIE','ES','ESS','ETN','ETR',
  'EVRG','EW','EXC','EXPD','EXPE','EXR',
  'F','FANG','FAST','FBHS','FCX','FDS','FDX','FE','FFIV','FI',
  'FICO','FIS','FISV','FITB','FMC','FOX','FOXA','FRT','FSLR',
  'FTNT','FTV',
  'GD','GDDY','GE','GEHC','GEN','GEV','GILD','GIS','GL','GLW',
  'GM','GNRC','GOOG','GOOGL','GPC','GPN','GRMN','GS','GWW',
  'HAL','HAS','HBAN','HCA','HD','HOLX','HON','HPE','HPQ','HRL',
  'HSIC','HST','HSY','HUBB','HUM','HWM',
  'IBM','ICE','IDXX','IEX','IFF','ILMN','INCY','INTC','INTU',
  'INVH','IP','IPG','IQV','IR','IRM','ISRG','IT','ITW','IVZ',
  'J','JBHT','JBL','JCI','JKHY','JNJ','JNPR','JPM',
  'K','KDP','KEY','KEYS','KHC','KIM','KKR','KLAC','KMB','KMI',
  'KMX','KO','KR','KVUE',
  'L','LDOS','LEN','LH','LHX','LIN','LKQ','LLY','LNG','LRCX',
  'LULU','LUV','LVS','LW','LYB','LYV',
  'MA','MAA','MAR','MAS','MCD','MCHP','MCK','MCO','MDLZ','MDT',
  'MET','META','MGM','MHK','MKC','MKTX','MLM','MMC','MMM','MNST',
  'MO','MOH','MOS','MPC','MPWR','MRK','MRNA','MRVL','MS','MSCI',
  'MSFT','MSI','MTB','MTCH','MTD','MU',
  'NCLH','NDAQ','NDSN','NEE','NEM','NFLX','NI','NKE','NOC','NOW',
  'NRG','NSC','NTAP','NTRS','NUE','NVDA','NVR','NWS','NWSA','NXPI',
  'O','ODFL','OKE','OMC','ON','ORCL','ORLY','OTIS','OXY',
  'PANW','PARA','PAYC','PAYX','PCAR','PCG','PEG','PEP','PFE','PFG',
  'PG','PGR','PH','PHM','PKG','PLD','PLTR','PM','PNC','PNR','PNW',
  'PODD','POOL','PPG','PPL','PRU','PSA','PSX','PTC','PVH','PWR',
  'PYPL',
  'QCOM','QRVO',
  'RCL','REG','REGN','RF','RJF','RL','RMD','ROK','ROL','ROP',
  'ROST','RSG','RTX','RVTY',
  'SBAC','SBUX','SCHW','SEE','SHW','SJM','SLB','SMCI','SNA',
  'SNPS','SO','SOLV','SPG','SPGI','SRE','STE','STLD','STT','STX',
  'STZ','SW','SWK','SWKS','SYF','SYK','SYY',
  'T','TAP','TDG','TDY','TECH','TEL','TER','TFC','TFX','TGT',
  'TJX','TMO','TMUS','TPL','TPR','TRGP','TRMB','TROW','TRV','TSCO',
  'TSLA','TSN','TT','TTWO','TXN','TXT','TYL',
  'UAL','UBER','UDR','UHS','ULTA','UNH','UNP','UPS','URI','USB',
  'V','VICI','VLO','VLTO','VMC','VRSK','VRSN','VRTX','VST','VTR',
  'VTRS','VZ',
  'WAB','WAT','WBA','WBD','WDC','WDAY','WEC','WELL','WFC','WM',
  'WMB','WMT','WRB','WRK','WST','WTW','WY','WYNN',
  'XEL','XOM','XYL',
  'YUM',
  'ZBH','ZBRA','ZTS',
]

// Full NASDAQ 100 constituents (~101 tickers, as of early 2025)
const NASDAQ100_SYMBOLS: string[] = [
  'AAPL','ABNB','ADBE','ADI','ADP','ADSK','AEP','AMAT','AMGN','AMZN',
  'ANSS','APP','ARM','ASML','AVGO','AZN',
  'BIIB','BKNG','BKR',
  'CDNS','CDW','CEG','CHTR','CMCSA','COIN','COST','CPRT','CRWD','CSCO',
  'CSGP','CTAS','CTSH',
  'DASH','DDOG','DLTR','DXCM',
  'EA','EXC',
  'FANG','FAST','FTNT',
  'GEHC','GFS','GILD','GOOG','GOOGL',
  'HON',
  'IDXX','ILMN','INTC','INTU','ISRG',
  'KDP','KHC','KLAC',
  'LIN','LRCX','LULU',
  'MAR','MCHP','MDB','MDLZ','MELI','META','MNST','MRNA','MRVL','MSFT',
  'MSTR','MU',
  'NFLX','NVDA','NXPI',
  'ODFL','ON','ORLY',
  'PANW','PAYX','PCAR','PDD','PEP','PLTR','PYPL',
  'QCOM',
  'REGN','ROST','ROP',
  'SBUX','SMCI','SNPS',
  'TEAM','TMUS','TSLA','TTD','TTWO','TXN',
  'VRSK','VRTX',
  'WBD','WDAY',
  'XEL',
  'ZS',
]

function symbolsToConstituents(symbols: string[]): ConstituentInfo[] {
  return symbols.map(symbol => ({ symbol, name: symbol, sector: '' }))
}

export function getConstituents(market: MarketIndex): ConstituentInfo[] {
  switch (market) {
    case 'sp500':
      return symbolsToConstituents(SP500_SYMBOLS)
    case 'nasdaq100':
      return symbolsToConstituents(NASDAQ100_SYMBOLS)
    default:
      return []
  }
}
