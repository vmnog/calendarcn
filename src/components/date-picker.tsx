"use client"

import * as React from "react"
import { isSameDay } from "date-fns"

import { Calendar } from "@/components/ui/calendar"
import {
  SidebarGroup,
  SidebarGroupContent,
} from "@/components/ui/sidebar"

interface DatePickerProps {
  onDateSelect?: (date: Date) => void
  currentDate?: Date
  visibleDays?: Date[]
}

export function DatePicker({ onDateSelect, currentDate, visibleDays }: DatePickerProps) {
  const [today] = React.useState(() => new Date())
  const [displayedMonth, setDisplayedMonth] = React.useState<Date>(currentDate ?? today)

  // Track previous first visible day to determine scroll direction
  const prevFirstDayRef = React.useRef<Date | null>(null)

  // Auto-navigate datepicker month so highlighted days stay visible
  // Scrolling forward → keep last visible day's month shown
  // Scrolling backward → keep first visible day's month shown
  React.useEffect(() => {
    if (!visibleDays || visibleDays.length === 0) return

    const firstDay = visibleDays[0]
    const lastDay = visibleDays[visibleDays.length - 1]
    const prevFirstDay = prevFirstDayRef.current
    prevFirstDayRef.current = firstDay

    const setMonthIfChanged = (anchor: Date) => {
      setDisplayedMonth((prev) => {
        if (prev.getMonth() === anchor.getMonth() && prev.getFullYear() === anchor.getFullYear()) {
          return prev
        }
        return anchor
      })
    }

    // Scrolling forward → ensure last visible day's month is displayed
    if (prevFirstDay && firstDay.getTime() > prevFirstDay.getTime()) {
      setMonthIfChanged(lastDay)
      return
    }

    // Scrolling backward or initial render → ensure first visible day's month is displayed
    setMonthIfChanged(firstDay)
  }, [visibleDays])

  const isSameMonth =
    displayedMonth.getMonth() === today.getMonth() &&
    displayedMonth.getFullYear() === today.getFullYear()

  const monthYearLabel = displayedMonth.toLocaleDateString("default", {
    month: "long",
    year: "numeric",
  })

  const goBackToToday = () => {
    setDisplayedMonth(today)
    onDateSelect?.(today)
  }

  // Build modifiers for visible days highlighting
  const modifiers = React.useMemo(() => {
    if (!visibleDays || visibleDays.length === 0) return undefined

    return {
      inView: (date: Date) => visibleDays.some((d) => isSameDay(d, date)),
    }
  }, [visibleDays])

  const modifiersClassNames = React.useMemo(() => {
    if (!modifiers) return undefined
    return {
      inView: "in-view-day",
    }
  }, [modifiers])

  return (
    <SidebarGroup className="px-0">
      <SidebarGroupContent>
        <Calendar
          mode="single"
          month={displayedMonth}
          onMonthChange={setDisplayedMonth}
          selected={today}
          onSelect={(date) => {
            if (date) {
              onDateSelect?.(date)
            }
          }}
          showWeekNumber
          fixedWeeks
          showBackToToday={!isSameMonth}
          onBackToToday={goBackToToday}
          monthLabel={!isSameMonth ? monthYearLabel : undefined}
          modifiers={modifiers}
          modifiersClassNames={modifiersClassNames}
          className="bg-transparent [&_[role=gridcell].bg-accent]:bg-sidebar-primary [&_[role=gridcell].bg-accent]:text-sidebar-primary-foreground"
        />
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
