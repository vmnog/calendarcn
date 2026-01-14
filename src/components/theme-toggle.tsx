"use client"

import * as React from "react"
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const cycleTheme = () => {
    if (theme === "system") {
      setTheme("light")
      return
    }
    if (theme === "light") {
      setTheme("dark")
      return
    }
    setTheme("system")
  }

  const getIcon = () => {
    if (theme === "light") {
      return <SunIcon className="size-4" />
    }
    if (theme === "dark") {
      return <MoonIcon className="size-4" />
    }
    return <MonitorIcon className="size-4" />
  }

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="size-8">
        <MonitorIcon className="size-4" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8"
      onClick={cycleTheme}
    >
      {getIcon()}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
