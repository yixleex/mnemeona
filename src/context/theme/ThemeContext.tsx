import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export type Theme =
  | "light"
  | "dark"
  | "system"

type ResolvedTheme =
  | "light"
  | "dark"

type ThemeContextValue = {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext =
  createContext<ThemeContextValue | undefined>(
    undefined,
  )

const THEME_STORAGE_KEY =
  "mnemeona-theme"

function getStoredTheme(): Theme {
  if (typeof window === "undefined") {
    return "system"
  }

  const stored =
    window.localStorage.getItem(
      THEME_STORAGE_KEY,
    )

  if (
    stored === "light" ||
    stored === "dark" ||
    stored === "system"
  ) {
    return stored
  }

  return "system"
}

function getSystemTheme(): ResolvedTheme {
  if (
    typeof window !== "undefined" &&
    window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches
  ) {
    return "dark"
  }

  return "light"
}

function resolveTheme(
  theme: Theme,
): ResolvedTheme {
  if (theme === "system") {
    return getSystemTheme()
  }

  return theme
}

function applyTheme(
  resolvedTheme: ResolvedTheme,
) {
  const root =
    document.documentElement

  root.classList.toggle(
    "dark",
    resolvedTheme === "dark",
  )

  root.style.colorScheme =
    resolvedTheme
}

export function ThemeProvider({
  children,
}: {
  children: ReactNode
}) {
  const [theme, setThemeState] =
    useState<Theme>(() =>
      getStoredTheme(),
    )

  const [
    systemTheme,
    setSystemTheme,
  ] = useState<ResolvedTheme>(() =>
    getSystemTheme(),
  )

  /*
   * Keep track of the operating system theme.
   *
   * This only matters when Mnemeona is using
   * the "system" appearance.
   */
  useEffect(() => {
    const mediaQuery =
      window.matchMedia(
        "(prefers-color-scheme: dark)",
      )

    const handleChange = () => {
      setSystemTheme(
        mediaQuery.matches
          ? "dark"
          : "light",
      )
    }

    handleChange()

    mediaQuery.addEventListener(
      "change",
      handleChange,
    )

    return () => {
      mediaQuery.removeEventListener(
        "change",
        handleChange,
      )
    }
  }, [])

  const resolvedTheme =
    theme === "system"
      ? systemTheme
      : theme

  /*
   * Apply the theme whenever either the
   * selected theme or system theme changes.
   */
  useEffect(() => {
    applyTheme(resolvedTheme)
  }, [resolvedTheme])

  const setTheme = (
    nextTheme: Theme,
  ) => {
    setThemeState(nextTheme)

    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      nextTheme,
    )
  }

  /*
   * Simple toolbar toggle:
   *
   * light -> dark
   * dark  -> light
   *
   * If the user is currently using system mode,
   * clicking the button chooses the opposite of
   * the currently resolved system appearance.
   */
  const toggleTheme = () => {
    setTheme(
      resolvedTheme === "dark"
        ? "light"
        : "dark",
    )
  }

  const value =
    useMemo<ThemeContextValue>(
      () => ({
        theme,
        resolvedTheme,
        setTheme,
        toggleTheme,
      }),
      [
        theme,
        resolvedTheme,
      ],
    )

  return (
    <ThemeContext.Provider
      value={value}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context =
    useContext(ThemeContext)

  if (!context) {
    throw new Error(
      "useTheme must be used inside ThemeProvider",
    )
  }

  return context
}
