# Security Policy

## Supported versions

CalendarCN isn't an npm package. Its source is copied into your project from the registry at `calendarcn.xyz/r`, which always serves the latest `main`. Security fixes land there first and are part of the next [release](https://github.com/vmnog/calendarcn/releases).

| Version                                            | Gets security fixes |
| -------------------------------------------------- | ------------------- |
| The latest: the registry and the newest release    | Yes                 |
| Older releases, and projects pinned to one of them | No                  |

To get a fix, update the items you installed: see [Updating](https://calendarcn.xyz/docs/installation#updating). The [Changelog](https://calendarcn.xyz/docs/changelog) names the items each fix changed.

## Reporting a vulnerability

Please don't open a public issue for a security problem. Email [me@vmnog.com](mailto:me@vmnog.com) with:

- what the problem is, and the item or file it's in
- the steps, or a small example, that show it
- the version you're on, or the day you last ran `shadcn add`

The maintainer confirms the report, says whether it reproduces, and keeps you posted until a fix is out. Please allow time for the fix before you publish the details. Reporters are credited in the changelog unless they'd rather not be.

## What counts

CalendarCN's files run inside your app, with your data. Reports that help most:

- event data or an .ics file that makes the calendar run a script, or open a link that isn't `http:` or `https:`
- a problem in the registry or the docs site at `calendarcn.xyz` that could change what people install

A vulnerability in one of the calendar's dependencies (React, date-fns, the shadcn/ui components) belongs with that project. Tell us too if the calendar makes it worse.
