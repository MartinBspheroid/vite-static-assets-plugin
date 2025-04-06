import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { staticAssets,staticAssetsFromDir } from "./static-assets"

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={staticAssets("logo.png")} className="logo" alt="Vite Static Assets logo" />
        </a>

        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      {staticAssetsFromDir("icons/").map((path) => (
        <img key={path} src={path} className="logo" alt="logo" style={{
          width: "24px"
        }} />
      ))}
      {staticAssetsFromDir("icons/sun/").map((path) => (
        <img key={path} src={path} className="logo" alt="logo" style={{
          width: "24px"
        }} />
      ))}
      <h1>Vite + <span style={{
        color: "lightblue"
      }}>vite-static-assets-plugin</span> + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
