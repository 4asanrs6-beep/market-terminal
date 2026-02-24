import { useState } from 'react'
import type { MarketIndex } from './types/stock'
import { useMarketData } from './hooks/useMarketData'
import { Header } from './components/Header'
import { MarketTabs } from './components/MarketTabs'
import { StockTable } from './components/StockTable'
import { StockChart } from './components/StockChart'
import { AddTickerModal } from './components/AddTickerModal'
import styles from './styles/App.module.css'

export default function App() {
  const [activeMarket, setActiveMarket] = useState<MarketIndex>('sp500')
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)

  const { quotes, loading, refresh, addToWatchlist } = useMarketData(activeMarket)

  const selectedQuote = selectedSymbol
    ? quotes.find(q => q.symbol === selectedSymbol) ?? null
    : null

  const handleAddTicker = async (ticker: string) => {
    await addToWatchlist(ticker)
    setActiveMarket('watchlist')
  }

  return (
    <div className={styles.app}>
      <div className={styles.header}>
        <Header searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      </div>

      <div className={styles.sidebar}>
        <MarketTabs
          activeMarket={activeMarket}
          onMarketChange={setActiveMarket}
          onAddTicker={() => setShowAddModal(true)}
        />
      </div>

      <div className={`${styles.main} ${!selectedSymbol ? styles.noChart : ''}`}>
        <div className={styles.tableSection}>
          <StockTable
            quotes={quotes}
            loading={loading}
            searchQuery={searchQuery}
            selectedSymbol={selectedSymbol}
            onSelectStock={setSelectedSymbol}
            onRefresh={refresh}
          />
        </div>

        {selectedSymbol && (
          <div className={styles.chartSection}>
            <StockChart symbol={selectedSymbol} quote={selectedQuote} />
          </div>
        )}
      </div>

      <AddTickerModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddTicker}
      />
    </div>
  )
}
