# Known Limitations

## Simulated / in-memory

- Growth simulation store powers many MVP demos (leads, notifications, marketplace)
- Social channel providers may be mock implementations unless LIVE credentials are wired
- Dynamics 365 provider is a placeholder and throws until configured
- Rate limiting is process-local (not distributed)

## Compliance

- System records consent text/version/timestamp and suppression, but is **not** a legal certification
- Counsel must review consent language, TCPA/CAN-SPAM/state rules, and resale permissions before production media spend

## Analytics

- Cost metrics show **Unavailable** when ad spend has not been synced — values are not invented

## Product gaps for later

- Full Outlook/Teams/SMS delivery channels
- Distributed reservation locks across multiple app instances
- Rich mobile native apps (web is responsive)
- Complete ownership of all D365 objects

## Accessibility / performance

- Public assessment has progress ARIA, radiogroup semantics, larger touch targets
- Further Lighthouse/perf budgets and full screen-reader QA remain recommended before wide release

## Test environment notes

- Playwright Chromium install fails on macOS 12 (darwin 21) with current Playwright packages — browser e2e cannot run on that host until OS upgrade or pinned compatible browser
- Auth on admin/MVP APIs currently uses `x-altus-role` header in sim mode; production must replace with real session + RLS
