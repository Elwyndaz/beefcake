import { render } from 'preact'
import './index.css'
import { App } from './app.tsx'
import { seedIfEmpty } from './services/dataService'

seedIfEmpty()
  .catch(err => console.error('Seed misslyckades:', err))
  .finally(() => render(<App />, document.getElementById('app')!))
