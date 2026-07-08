# Fake Users Cleanup Note

Current status: Link-Up uses a mixed dataset with real registered users and seeded fake users for early-stage demonstration.

Do not delete seeded/fake users yet. They are useful for classroom demo, AI Matching, manual search, and Taylor's University filtering before the platform has enough real users.

Future production cleanup rule:
- Keep users created through real registration and OTP verification.
- Remove seeded/fake/demo users from `users.csv`.
- Keep real request, team, message, and competition records only if they belong to real registered accounts.
- Re-test AI Matching, Manual Search, Team Creation, Requests / Chat, Lifecycle, and Competitions after cleanup.
