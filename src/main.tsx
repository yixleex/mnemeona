import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"

import App from "./App.tsx"

import {
  ProjectProvider,
} from "./context/ProjectContext.tsx"

import {
  ThemeProvider,
} from "./context/theme/ThemeContext.tsx"

createRoot(
  document.getElementById("root")!,
).render(
  <StrictMode>
    <ThemeProvider>
      <ProjectProvider>
        <App />
      </ProjectProvider>
    </ThemeProvider>
  </StrictMode>,
)
