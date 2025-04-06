import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { type StaticAssetPath, staticAssets , type FilesInFolder} from "./static-assets"

type  Icons = FilesInFolder<'icons/sun/'>;

type Suns = {
  icon: Icons,
  name: string

}
const suns: Suns[] = [
  {
    icon: "icons/sun/line-md--sunny.svg",
    name: "Sunny"
  },
  {
    icon: "icons/sun/line-md--sun-rising-loop.svg",
    name: "Sun Rising"
  },
  {
    icon: "icons/sun/line-md--sun-rising-twotone-loop.svg",
    name: "Sun Rising Twotone"
  },
  {
    icon: "icons/sun/line-md--sun-rising-filled-loop.svg",
    name: "Sun Rising Filled"
  }

]
// Type-safe variables
const assetPath: StaticAssetPath = 'icons/sun/line-md--sunny.svg';


function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank" rel="noreferrer">
          <img src={staticAssets("logo.png")} className="logo" alt="Vite Static Assets logo" />
        </a>

        <a href="https://vite.dev" target="_blank" rel="noreferrer">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank" rel="noreferrer">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
     {suns.map(sun => (
        <img key={sun.name} src={staticAssets(sun.icon)} className="logo" alt={sun.name} style={{
          width: "24px"
        }} />
      ))}
      <h1>Vite + <span style={{
        color: "lightblue"
      }}>vite-static-assets-plugin</span> + React</h1>
      <div className="card">
        <button
          type="button"
        onClick={() => setCount((count: number) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
      <img src={staticAssets(assetPath)} className="logo" alt="logo" />
    </>
  )
}

export default App
