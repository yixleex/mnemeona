import {
  Moon,
  Sun,
} from "lucide-react"

import {
  Button,
} from "@/components/ui/button"

import {
  useTheme,
} from "@/context/theme/ThemeContext"

export function ThemeToggle() {
  const {
    resolvedTheme,
    toggleTheme,
  } = useTheme()

  const isDark =
    resolvedTheme === "dark"

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8"
      onClick={toggleTheme}
      aria-label={
        isDark
          ? "Switch to light mode"
          : "Switch to dark mode"
      }
      title={
        isDark
          ? "Switch to light mode"
          : "Switch to dark mode"
      }
    >
      {isDark ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}

      <span className="sr-only">
        {isDark
          ? "Switch to light mode"
          : "Switch to dark mode"}
      </span>
    </Button>
  )
}
