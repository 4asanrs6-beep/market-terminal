import { useState, useCallback } from 'react'

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
}

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
  minWidth: '340px',
  maxWidth: '400px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '16px',
}

const titleStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  color: 'var(--accent-blue)',
  letterSpacing: '0.5px',
}

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-muted)',
  fontSize: '14px',
  cursor: 'pointer',
}

const checkItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '10px 8px',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '12px',
  color: 'var(--text-primary)',
  transition: 'background 0.15s',
}

const hintStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-muted)',
  marginBottom: '12px',
}

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px',
  marginTop: '20px',
}

const btnBase: React.CSSProperties = {
  padding: '7px 18px',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

export function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const [watchlists, setWatchlists] = useState(true)
  const [futures, setFutures] = useState(true)
  const [favorites, setFavorites] = useState(true)
  const [exporting, setExporting] = useState(false)

  const handleExport = useCallback(async () => {
    if (!watchlists && !futures && !favorites) return
    setExporting(true)
    try {
      await window.electronAPI.exportData({ watchlists, futures, favorites })
    } finally {
      setExporting(false)
      onClose()
    }
  }, [watchlists, futures, favorites, onClose])

  if (!isOpen) return null

  const noneSelected = !watchlists && !futures && !favorites

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={headerStyle}>
          <span style={titleStyle}>EXPORT DATA</span>
          <button style={closeBtnStyle} onClick={onClose}>&#x2715;</button>
        </div>
        <div style={hintStyle}>エクスポートするデータを選択してください</div>

        <label style={checkItemStyle}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <input type="checkbox" checked={watchlists} onChange={e => setWatchlists(e.target.checked)} />
          ウォッチリスト
        </label>
        <label style={checkItemStyle}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <input type="checkbox" checked={futures} onChange={e => setFutures(e.target.checked)} />
          先物・指数・通貨リスト
        </label>
        <label style={checkItemStyle}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <input type="checkbox" checked={favorites} onChange={e => setFavorites(e.target.checked)} />
          お気に入り
        </label>

        <div style={footerStyle}>
          <button
            style={{ ...btnBase, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
            onClick={onClose}
          >
            キャンセル
          </button>
          <button
            style={{
              ...btnBase,
              background: noneSelected || exporting ? 'var(--bg-tertiary)' : 'var(--accent-blue)',
              border: 'none',
              color: noneSelected || exporting ? 'var(--text-muted)' : '#000',
              cursor: noneSelected || exporting ? 'not-allowed' : 'pointer',
            }}
            onClick={handleExport}
            disabled={exporting || noneSelected}
          >
            {exporting ? 'エクスポート中...' : 'エクスポート'}
          </button>
        </div>
      </div>
    </div>
  )
}
