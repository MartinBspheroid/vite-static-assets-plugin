import { staticAssets } from 'virtual:static-assets'
import './check'

const logoUrl = staticAssets('logo.png')
const iconUrl = staticAssets('icons/sun/sun.svg')

function App() {
  return (
    <div>
      <img id="harness-logo" src={logoUrl} alt="logo" />
      <div id="harness-asset-url">{logoUrl}</div>
      <div id="harness-icon-url">{iconUrl}</div>
    </div>
  )
}

export default App
