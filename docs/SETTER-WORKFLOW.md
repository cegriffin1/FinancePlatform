# Setter Workflow

## Role

Setter is a **quality-control** layer — not platform admin by default.

Permissions:

- `setter.leads.view`
- `setter.leads.verify`
- `setter.appointments.manage`

## Flow

1. Open `/setter` queue (READY NOW / VERY HOT / HOT / NEEDS REVIEW)
2. Open `/setter/leads/[id]`
3. Review 10-second pre-call brief
4. Verify fields (SELF_REPORTED / CONFIRMED / UPDATED / UNABLE_TO_VERIFY)
5. Confirm assets only when prospect restates them
6. Set disposition
7. Schedule appointment + introduce advisor using approved org script
8. Assign agent → in-app **NEW VERIFIED RETIREMENT OPPORTUNITY**

## Rules

- Never mutate original assessment answers
- Never invent credentials in introduction scripts
- Asset confirmation ≠ independent financial verification
