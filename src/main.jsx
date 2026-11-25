import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App.jsx'
import { cityFromPath } from './cities.js'
import { loadAreas } from './cityData.js'

// Work out the city from the address (e.g. /manchester), load its areas, then
// replace the prerendered page with the live app.
const city = cityFromPath(window.location.pathname)

loadAreas(city.id).then((areas) => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App city={city} areas={areas} />
    </StrictMode>,
  )
})
