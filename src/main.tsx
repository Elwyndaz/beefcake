import { render } from 'preact'
import { App } from './app.tsx'
import { syncSeed } from './services/dataService'

syncSeed()
  .then(({ sessionsAdded, exercisesAdded }) => {
    if (sessionsAdded || exercisesAdded) {
      console.info(`Seed: +${sessionsAdded} pass, +${exercisesAdded} övningar`)
    }
  })
  .catch(err => console.error('Seed misslyckades:', err))
  .finally(() => render(<App />, document.getElementById('app')!))
