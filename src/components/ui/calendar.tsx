"use client"

import * as React from "react"
import {
  ChevronDownIcon,
  ChevronUpIcon,
  Undo2Icon,
} from "lucide-react"
import {
  DayPicker,
  getDefaultClassNames,
  type DayButton,
} from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  showBackToToday,
  onBackToToday,
  monthLabel,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"]
  showBackToToday?: boolean
  onBackToToday?: () => void
  monthLabel?: string
}) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "bg-background group/calendar px-2 py-1 [--cell-size:--spacing(6)] [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className
      )}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString("default", { month: "short" }),
        formatWeekNumber: (weekNumber) => String(weekNumber),
        ...formatters,
      }}
      classNames={{
        root: cn("w-full relative", defaultClassNames.root),
        months: cn(
          "flex gap-2 flex-col",
          defaultClassNames.months
        ),
        month: cn("flex flex-col w-full gap-0", defaultClassNames.month),
        nav: cn(
          "flex w-full items-center justify-end gap-0",
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-6 aria-disabled:opacity-50 p-0 select-none hover:!bg-calendar-day-hover hover:!text-current transition-none justify-self-center",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-6 aria-disabled:opacity-50 p-0 select-none hover:!bg-calendar-day-hover hover:!text-current transition-none justify-self-center",
          defaultClassNames.button_next
        ),
        month_caption: cn(
          "hidden",
          defaultClassNames.month_caption
        ),
        dropdowns: cn(
          "w-full flex items-center text-sm font-medium justify-center h-(--cell-size) gap-1.5",
          defaultClassNames.dropdowns
        ),
        dropdown_root: cn(
          "relative has-focus:border-ring border border-input shadow-xs has-focus:ring-ring/50 has-focus:ring-[3px] rounded-md",
          defaultClassNames.dropdown_root
        ),
        dropdown: cn(
          "absolute bg-popover inset-0 opacity-0",
          defaultClassNames.dropdown
        ),
        caption_label: cn(
          "select-none font-medium",
          captionLayout === "label"
            ? "text-sm"
            : "rounded-md pl-2 pr-1 flex items-center gap-1 text-sm h-8 [&>svg]:text-muted-foreground [&>svg]:size-3.5",
          defaultClassNames.caption_label
        ),
        table: "w-full border-collapse",
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-muted-foreground rounded-md flex-1 font-normal text-xxs select-none",
          defaultClassNames.weekday
        ),
        week: cn(
          "flex w-full items-center relative group/week mb-0.5",
          defaultClassNames.week
        ),
        week_number_header: cn(
          "select-none w-5",
          defaultClassNames.week_number_header
        ),
        week_number: cn(
          "text-xxs select-none text-muted-foreground w-5",
          defaultClassNames.week_number
        ),
        day: cn(
          "relative flex items-center justify-center w-full p-0 text-center [&:last-child[data-selected=true]_button]:rounded-r-md group/day select-none",
          "[&.in-view-day]:bg-calendar-current-week",
          "[&.in-view-day:not(.in-view-day+.in-view-day)]:rounded-l-md",
          "[&.in-view-day:not(:has(+.in-view-day))]:rounded-r-md",
          props.showWeekNumber
            ? "[&:nth-child(2)[data-selected=true]_button]:rounded-l-md"
            : "[&:first-child[data-selected=true]_button]:rounded-l-md",
          defaultClassNames.day
        ),
        range_start: cn(
          "rounded-l-md bg-accent",
          defaultClassNames.range_start
        ),
        range_middle: cn("rounded-none", defaultClassNames.range_middle),
        range_end: cn("rounded-r-md bg-accent", defaultClassNames.range_end),
        today: cn(
          "rounded-md",
          defaultClassNames.today
        ),
        outside: cn(
          "text-muted-foreground/40 aria-selected:text-muted-foreground",
          defaultClassNames.outside
        ),
        disabled: cn(
          "text-muted-foreground opacity-50",
          defaultClassNames.disabled
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => {
          return (
            <div
              data-slot="calendar"
              ref={rootRef}
              className={cn(className)}
              {...props}
            />
          )
        },
        Nav: ({ className, ...props }) => {
          return (
            <nav className={cn("flex w-full items-center", className)} {...props}>
              {/* Week number space - same as week_number_header */}
              <div className="w-5" />

              {/* Month label - spans 4 columns worth (Su-We) */}
              {monthLabel && (
                <span className="text-sidebar-primary flex-[4] text-sm font-medium">
                  {monthLabel}
                </span>
              )}
              {!monthLabel && <span className="flex-[4]" />}

              {/* Th column - Undo button or empty space */}
              {showBackToToday && onBackToToday ? (
                <div className="flex-1 flex justify-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={onBackToToday}
                        className={cn(
                          buttonVariants({ variant: buttonVariant }),
                          "size-6 p-0 select-none hover:!bg-calendar-day-hover hover:!text-current transition-none"
                        )}
                      >
                        <Undo2Icon className="size-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Go back to today</TooltipContent>
                  </Tooltip>
                </div>
              ) : (
                <span className="flex-1" />
              )}

              {/* Fr column - Up chevron */}
              <div className="flex-1 flex justify-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        buttonVariants({ variant: buttonVariant }),
                        "size-6 p-0 select-none hover:!bg-calendar-day-hover hover:!text-current transition-none"
                      )}
                      aria-label="Go to previous month"
                      onClick={props.onPreviousClick}
                    >
                      <ChevronUpIcon className="size-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Go to previous month</TooltipContent>
                </Tooltip>
              </div>

              {/* Sa column - Down chevron */}
              <div className="flex-1 flex justify-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        buttonVariants({ variant: buttonVariant }),
                        "size-6 p-0 select-none hover:!bg-calendar-day-hover hover:!text-current transition-none"
                      )}
                      aria-label="Go to next month"
                      onClick={props.onNextClick}
                    >
                      <ChevronDownIcon className="size-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Go to next month</TooltipContent>
                </Tooltip>
              </div>
            </nav>
          )
        },
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div className="flex h-(--cell-size) w-5 items-center justify-center text-center text-xxs">
                {children}
              </div>
            </td>
          )
        },
        ...components,
      }}
      {...props}
    />
  )
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames()

  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  const isInView = "inView" in modifiers && modifiers.inView === true

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      data-outside={modifiers.outside}
      data-today={modifiers.today}
      data-in-view={isInView}
      className={cn(
        "text-foreground data-[outside=true]:text-muted-foreground/40 data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[range-middle=true]:bg-accent data-[range-middle=true]:text-accent-foreground data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground flex size-7 items-center justify-center leading-none font-normal transition-none outline-none focus-visible:outline-none focus-visible:ring-0 data-[range-end=true]:rounded-md data-[range-end=true]:rounded-r-md data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-md data-[range-start=true]:rounded-l-md [&>span]:text-xs [&>span]:opacity-70 hover:bg-calendar-day-hover data-[in-view=true]:hover:bg-calendar-day-hover-current-week data-[today=true]:hover:!bg-primary data-[today=true]:hover:!text-primary-foreground",
        defaultClassNames.day,
        className
      )}
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }
