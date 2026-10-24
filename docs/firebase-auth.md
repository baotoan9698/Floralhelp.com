# Firebase Authentication

Shop data remains in PostgreSQL. Firebase stores the authentication identity; `Shop.firebaseUid` links it to the existing shop ID. Platform admin login remains separate.

## Configuration

Set `FIREBASE_AUTH_ENABLED=1`, `FIREBASE_PROJECT_ID`, `FIREBASE_WEB_API_KEY`, `GOOGLE_APPLICATION_CREDENTIALS` and `SITE_URL`. Enable Email/Password and authorize the sale website domain in Firebase. The JSON credential belongs outside the repository, readable only by the server account. Never use a `NEXT_PUBLIC_` variable for admin credentials.

Before first enablement, back up PostgreSQL, apply migrations and run `node scripts/firebase-import-legacy.mjs --apply` from the new release with its environment. The deploy script supports `FIREBASE_IMPORT_LEGACY=1` for this first rollout. Remove that flag after successful migration. It imports Node's standard scrypt hashes (N=16384, r=8, p=1, length=64, UTF-8 hex salt), preserving passwords, shop IDs, access dates and existing local sessions. A failed import stops deployment; retry after resolving the account conflict. Do not roll back to a local-password-only release after customers reset passwords on Firebase.

## Behaviour

- New registrations remain `unverified` with no session or trial expiry until Firebase confirms the email and the customer logs in. Trial activation is a conditional one-time database update, for exactly 15 days.
- Suspended/rejected accounts cannot activate their trial. Expired shops retain their data.
- Existing accounts keep access and need not verify again. Linked accounts never fall back to the old local password. Future legacy accounts can link on successful password login.
- Verification resend has a one-minute cooldown; password-reset requests have a limit and a generic success message. Check Firebase email quotas and delivery separately; API success does not prove inbox delivery.
- Every authenticated request checks Firebase disabled/revocation state and local access restrictions. Firebase outages deny access temporarily without deleting valid local sessions. Password changes/reset revoke prior sessions; Firebase timestamps have second precision.
- Admin resets and shop password changes synchronize Firebase; deleting a shop also removes its Firebase identity.

## Verification

`scripts/firebase-credential-check.mjs` uses a disposable Firebase identity to verify hash migration, email verification codes and reset codes without sending email. `tests/firebase-auth.test.mjs` uses a dedicated SQLite test database and dev server on port 3100; it checks registration gating, mobile dialog, cooldown, trial-once semantics, session revocation, expiry retention and legacy continuity. Never point this test at a customer database. A real mailbox check is still needed to confirm delivery/Spam placement.
