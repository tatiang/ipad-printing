# Coffee Time? v1.01

Published as an isolated subdirectory of the existing Vercel-connected `tatiang/ipad-printing` repository.

Production URL: https://ipad-printing.vercel.app/coffee-time/

## Data source
Google Calendar resource: Rsv-Lower Learning Commons

Calendar ID:
`markdayschool.org_3938393134353234343033@resource.calendar.google.com`

## Occupancy rules
Counts titles containing `Learning Commons` or `Class`, except `Open LC for Lunch/Recess`.

## Google OAuth
The app asks for a Google OAuth Web Client ID on first use and stores it in localStorage on that device.

Authorized JavaScript origin:
`https://ipad-printing.vercel.app`

Required scope:
`https://www.googleapis.com/auth/calendar.readonly`

No client secret is used or stored.
