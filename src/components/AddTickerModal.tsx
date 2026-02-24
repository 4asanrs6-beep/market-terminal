import { useState, useRef, useEffect } from 'react'

interface AddTickerModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (ticker: string) => void
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
}

const modalStyle: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-light)',
  borderRadius: '8px',
  padding: '24px',
  width: '360px',
  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
}

const titleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontWeight: 700,
  fontSize: '14px',
  color: 'var(--accent-orange)',
  marginBottom: '16px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border-light)',
  borderRadius: '4px',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '14px',
  textTransform: 'uppercase',
}

const buttonRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  marginTop: '16px',
  justifyContent: 'flex-end',
}

const btnBase: React.CSSProperties = {
  padding: '8px 20px',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.15s',
}

export function AddTickerModal({ isOpen, onClose, onAdd }: AddTickerModalProps) {
  const [ticker, setTicker] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTicker('')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = ticker.trim().toUpperCase()
    if (trimmed) {
      onAdd(trimmed)
      onClose()
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={titleStyle}>ウォッチリストに追加</div>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            style={inputStyle}
            placeholder="ティッカーを入力 (例: AAPL)"
            value={ticker}
            onChange={e => setTicker(e.target.value)}
          />
          <div style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            marginTop: '8px',
          }}>
            Yahoo Finance のティッカーシンボルを入力してください
          </div>
          <div style={buttonRowStyle}>
            <button
              type="button"
              onClick={onClose}
              style={{
                ...btnBase,
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-secondary)',
              }}
            >
              キャンセル
            </button>
            <button
              type="submit"
              style={{
                ...btnBase,
                background: 'var(--accent-orange)',
                border: '1px solid var(--accent-orange)',
                color: '#000',
              }}
              disabled={!ticker.trim()}
            >
              追加
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
