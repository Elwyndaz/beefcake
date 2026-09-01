/// <reference types="vite-plugin-pwa/client" />
import { render } from 'preact'
import { registerSW } from 'virtual:pwa-register'
import { App } from './app.tsx'
import { announceUpdate } from './components/UpdateBanner'
import { syncSeed } from './services/dataService'

// Service workern hämtar nya byggen men aktiverar dem inte själv: bannern frågar först.
const updateSW = registerSW({
  onNeedRefresh() { announceUpdate(() => updateSW(true)) }
})

syncSeed()
  .then(({ sessionsAdded, exercisesAdded }) => {
    if (sessionsAdded || exercisesAdded) {
      console.info(`Seed: +${sessionsAdded} pass, +${exercisesAdded} övningar`)
    }
  })
  .catch(err => console.error('Seed misslyckades:', err))
  .finally(() => render(<App />, document.getElementById('app')!))
