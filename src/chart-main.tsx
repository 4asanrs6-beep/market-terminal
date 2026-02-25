import React from 'react'
import ReactDOM from 'react-dom/client'
import { ChartWindowApp } from './components/ChartWindowApp'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ChartWindowApp />
  </React.StrictMode>
)
