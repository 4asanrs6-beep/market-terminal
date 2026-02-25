import { useState, useEffect } from 'react'
import styles from '../styles/Header.module.css'

interface HeaderProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  aiActive?: boolean
  onToggleAI?: () => void
}

export function Header({ searchQuery, onSearchChange, aiActive, onToggleAI }: HeaderProps) {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const nyTime = time.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const jpTime = time.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  // Check if US market is open (9:30-16:00 ET, Mon-Fri)
  const nyNow = new Date(time.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = nyNow.getDay()
  const hours = nyNow.getHours()
  const minutes = nyNow.getMinutes()
  const marketMinutes = hours * 60 + minutes
  const isMarketOpen = day >= 1 && day <= 5 && marketMinutes >= 570 && marketMinutes < 960

  return (
    <div className={styles.header}>
      <div className={styles.logo}>
        <div className={styles.logoIcon} />
        MARKET TERMINAL
      </div>

      <div className={styles.searchContainer}>
        <span className={styles.searchIcon}>&#x1F50D;</span>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="ティッカー・銘柄名で検索..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className={styles.spacer} />

      <div className={styles.marketStatus}>
        <div className={`${styles.statusDot} ${isMarketOpen ? '' : styles.closed}`} />
        {isMarketOpen ? '取引中' : '取引時間外'}
      </div>

      <button
        className={`${styles.aiBtn} ${aiActive ? styles.aiBtnActive : ''}`}
        onClick={onToggleAI}
        title="AI Market Brief"
      >
        AI
      </button>

      <div className={styles.clock}>
        NY {nyTime} | TKY {jpTime}
      </div>
    </div>
  )
}
