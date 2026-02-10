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

  // Sync displayedMonth when currentDate changes
  React.useEffect(() => {
    if (!currentDate) return;
    setDisplayedMonth(currentDate)
  }, [currentDate])

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
