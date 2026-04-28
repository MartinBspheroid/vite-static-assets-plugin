import { createFileRoute } from '@tanstack/react-router'
import { staticAssets } from 'virtual:static-assets'
import '../check'

export const Route = createFileRoute('/')({ component: Home })

const logoUrl = staticAssets('logo.png')
const iconUrl = staticAssets('icons/sun/sun.svg')

function Home() {
  return (
    <div>
      <img id="harness-logo" src={logoUrl} alt="logo" />
      <div id="harness-asset-url">{logoUrl}</div>
      <div id="harness-icon-url">{iconUrl}</div>
    </div>
  )
}
