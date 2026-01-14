"use client"

import * as React from "react"

import { Calendar } from "@/components/ui/calendar"
import {
  SidebarGroup,
  SidebarGroupContent,
} from "@/components/ui/sidebar"

export function DatePicker() {
  const [today] = React.useState(() => new Date())
  const [displayedMonth, setDisplayedMonth] = React.useState<Date>(today)

  const isSameMonth =
    displayedMonth.getMonth() === today.getMonth() &&
    displayedMonth.getFullYear() === today.getFullYear()

  const monthYearLabel = displayedMonth.toLocaleDateString("default", {
    month: "long",
    year: "numeric",
  })

  const goBackToToday = () => {
    setDisplayedMonth(today)
  }

  return (
    <SidebarGroup className="px-0">
      <SidebarGroupContent>
        <Calendar
          mode="single"
          month={displayedMonth}
          onMonthChange={setDisplayedMonth}
          selected={today}
          onSelect={() => {}}
          showWeekNumber
          fixedWeeks
          showBackToToday={!isSameMonth}
          onBackToToday={goBackToToday}
          monthLabel={!isSameMonth ? monthYearLabel : undefined}
          className="bg-transparent [&_[role=gridcell].bg-accent]:bg-sidebar-primary [&_[role=gridcell].bg-accent]:text-sidebar-primary-foreground"
        />
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
