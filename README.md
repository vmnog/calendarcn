# Calendar CN

A beautifully crafted, open source calendar component for React. Built with [shadcn/ui](https://ui.shadcn.com), inspired by [Notion Calendar](https://www.notion.so/product/calendar).

![Calendar CN Preview](./public/og-image.png)

## Features

- **Week View** - Full week calendar with time slots
- **Dark Mode** - Seamless light/dark theme support
- **Event Colors** - Multiple event color options (red, orange, yellow, green, blue, purple, gray)
- **All-Day Events** - Support for all-day and multi-day events
- **Current Time Indicator** - Visual indicator for current time
- **Responsive Sidebar** - Collapsible calendar sidebar with mini calendar
- **Calendar Management** - Multiple calendar support with visibility toggles
- **Keyboard Shortcuts** - Navigate efficiently with keyboard shortcuts

## Tech Stack

- [Next.js 16](https://nextjs.org/) - React framework
- [React 19](https://react.dev/) - UI library
- [Tailwind CSS 4](https://tailwindcss.com/) - Styling
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [date-fns](https://date-fns.org/) - Date utilities
- [Lucide React](https://lucide.dev/) - Icons

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Installation

1. Clone the repository:

```bash
git clone https://github.com/vmnog/calendarcn.git
cd calendarcn
```

2. Install dependencies:

```bash
pnpm install
```

3. Run the development server:

```bash
pnpm dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/                    # Next.js app router
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── week-view.tsx       # Main week view component
│   ├── week-view-*.tsx     # Week view sub-components
│   ├── calendar-event-item.tsx  # Event rendering
│   ├── calendars.tsx       # Calendar list sidebar
│   ├── date-picker.tsx     # Mini calendar picker
│   └── sidebar-*.tsx       # Sidebar components
├── hooks/                  # Custom React hooks
└── lib/                    # Utilities and helpers
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `/` | Toggle context panel |
| `⌘ + /` | Toggle calendar sidebar |

## Contributing

Contributions are welcome! Feel free to:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Roadmap

- [ ] Month view
- [ ] Day view
- [ ] Year view
- [ ] Drag and drop events
- [ ] Event creation/editing
- [ ] Recurring events
- [ ] Google Calendar integration
- [ ] iCal import/export

## License

MIT License - feel free to use this in your own projects!

## Credits

- Design inspired by [Notion Calendar](https://www.notion.so/product/calendar)
- Built with [shadcn/ui](https://ui.shadcn.com/) components
- Created by [Victor Nogueira](https://github.com/vmnog)

## Links

- [Live Demo](https://calendarcn.vercel.app)
- [GitHub Repository](https://github.com/vmnog/calendarcn)
- [Twitter](https://twitter.com/vmaborern)
