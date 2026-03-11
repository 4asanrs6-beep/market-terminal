import { useState, useRef, useEffect, useCallback } from 'react'
import type { SearchResult } from '../types/stock'

interface AddFuturesModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (entry: { symbol: string; name: string; sector: string }) => void
  existingSymbols: Set<string>
}

const SECTOR_OPTIONS = [
  '株価指数', 'ボラティリティ', 'エネルギー', '貴金属',
  '農産物', '畜産', '債券', '通貨', '暗号資産', 'その他',
]

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
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
  width: '440px',
  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border-light)',
  borderRadius: '4px',
  color: 'var(--text-primary)',
  fontSize: '13px',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  color: 'var(--text-muted)',
  marginBottom: '4px',
  marginTop: '12px',
}

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0, right: 0,
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border-light)',
  borderRadius: '0 0 4px 4px',
  maxHeight: '200px',
  overflowY: 'auto',
  zIndex: 10,
}

const dropdownItemStyle: React.CSSProperties = {
  padding: '6px 12px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '12px',
  transition: 'background 0.1s',
}

export function AddFuturesModal({ isOpen, onClose, onAdd, existingSymbols }: AddFuturesModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const [symbol, setSymbol] = useState('')
  const [name, setName] = useState('')
  const [sector, setSector] = useState('その他')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const doSearch = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setSearchResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await window.electronAPI.searchTickers(query.trim())
        setSearchResults(results)
      } catch {
        setSearchResults([])
      }
      setSearching(false)
    }, 300)
  }, [])

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setHighlightIndex(-1)
    doSearch(value)
  }

  const selectFromSearch = (result: SearchResult) => {
    setSymbol(result.symbol)
    setName(result.shortName)
    setSearchQuery('')
    setSearchResults([])
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (searchResults.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex(prev => Math.min(prev + 1, searchResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightIndex >= 0 && highlightIndex < searchResults.length) {
        selectFromSearch(searchResults[highlightIndex])
      }
    }
  }

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('')
      setSearchResults([])
      setSymbol('')
      setName('')
      setSector('その他')
      setTimeout(() => searchInputRef.current?.focus(), 100)
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [isOpen])

  if (!isOpen) return null

  const alreadyExists = existingSymbols.has(symbol.toUpperCase())
  const canSubmit = symbol.trim().length > 0 && name.trim().length > 0 && !alreadyExists

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    onAdd({ symbol: symbol.trim().toUpperCase(), name: name.trim(), sector })
    onClose()
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          fontSize: '14px',
          color: 'var(--accent-orange)',
          marginBottom: '16px',
        }}>
          先物・指数を追加
        </div>

        <form onSubmit={handleSubmit}>
          {/* Search */}
          <div style={{ position: 'relative', marginBottom: '4px' }}>
            <span style={{
              position: 'absolute', left: '9px', top: '50%',
              transform: 'translateY(-50%)', color: 'var(--text-muted)',
              fontSize: '12px', pointerEvents: 'none',
            }}>&#x1F50D;</span>
            <input
              ref={searchInputRef}
              type="text"
              style={{ ...inputStyle, paddingLeft: '28px' }}
              placeholder="銘柄名・シンボルで検索..."
              value={searchQuery}
              onChange={e => handleSearchChange(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
            {(searchResults.length > 0 || searching) && searchQuery && (
              <div style={dropdownStyle}>
                {searching && searchResults.length === 0 ? (
                  <div style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    検索中...
                  </div>
                ) : (
                  searchResults.map((r, i) => {
                    const exists = existingSymbols.has(r.symbol.toUpperCase())
                    return (
                      <div
                        key={r.symbol}
                        style={{
                          ...dropdownItemStyle,
                          background: i === highlightIndex ? 'var(--border-light)' : 'transparent',
                          opacity: exists ? 0.4 : 1,
                        }}
                        onMouseEnter={() => setHighlightIndex(i)}
                        onClick={() => !exists && selectFromSearch(r)}
                      >
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontWeight: 700,
                          color: 'var(--accent-orange)', minWidth: '80px',
                        }}>
                          {r.symbol}
                        </span>
                        <span style={{
                          flex: 1, color: 'var(--text-secondary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {r.shortName}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {r.exchange}
                        </span>
                        {exists && (
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>追加済</span>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>

          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            検索から選択、または下のフォームに直接入力
          </div>

          {/* Symbol */}
          <label style={labelStyle}>シンボル</label>
          <input
            type="text"
            style={{ ...inputStyle, textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}
            placeholder="例: CL=F, ^VIX, BTC-USD"
            value={symbol}
            onChange={e => setSymbol(e.target.value)}
          />
          {alreadyExists && (
            <div style={{ fontSize: '11px', color: 'var(--negative)', marginTop: '4px' }}>
              このシンボルは既にリストにあります
            </div>
          )}

          {/* Name */}
          <label style={labelStyle}>表示名</label>
          <input
            type="text"
            style={inputStyle}
            placeholder="例: WTI 原油, ビットコイン"
            value={name}
            onChange={e => setName(e.target.value)}
          />

          {/* Sector */}
          <label style={labelStyle}>カテゴリ</label>
          <select
            style={{
              ...inputStyle,
              fontFamily: 'inherit',
            }}
            value={sector}
            onChange={e => setSector(e.target.value)}
          >
            {SECTOR_OPTIONS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '20px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 20px', borderRadius: '4px', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-light)', color: 'var(--text-secondary)',
              }}
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                padding: '8px 20px', borderRadius: '4px', fontSize: '12px', fontWeight: 600,
                cursor: canSubmit ? 'pointer' : 'default',
                background: 'var(--accent-orange)', border: '1px solid var(--accent-orange)',
                color: '#000', opacity: canSubmit ? 1 : 0.5,
              }}
            >
              追加
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
