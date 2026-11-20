# FundB pre-launch security test plan

This is a staging test plan, not evidence that tests have already passed. Run it only against a separate test account and test database/table set. Never use the production profile row or real user account for destructive tests.

## A. Existing account and profile preservation

- Sign in with a previously created test account; verify the same Appwrite user ID and profile row are returned.
- Refresh the profile repeatedly; confirm points, referral code and saved inviter relationship do not change.
- Confirm a URL referral parameter cannot silently overwrite an existing inviter.
- Confirm an invalid referral code, self-referral code and unknown code are rejected without changing either profile.
- Confirm the inviter count equals the number of saved referred-user relationships after repeated refreshes.
- Verify a failed referral-counter reconciliation does not erase the saved relationship.

## B. Authentication and authorization

- Missing JWT: request is rejected.
- Expired or malformed JWT: request is rejected.
- JWT for account A with an attempted account B identifier in the body: only the authenticated account may be accessed.
- Missing function key or project configuration: fail closed.
- Untrusted browser origin: no permissive CORS origin is returned.
- Confirm logs contain no JWT, API key, password, recovery token or full provider payload.

## C. Reward event verification (only after implementation)

- Valid provider-signed completion event: exactly one event and one ledger entry.
- Same event replayed sequentially: no additional entry.
- Same event submitted concurrently: unique constraint permits exactly one posted credit.
- Invalid signature, expired timestamp, wrong app/site ID, wrong user mapping and incomplete ad: rejected.
- Client-supplied amount, asset, balance, user ID or status: ignored or rejected.
- Zero, negative, fractional precision overflow and out-of-range amounts: rejected.
- Provider reversal or chargeback: handled by a compensating ledger entry, never by deleting the original.

## D. Data and API boundaries

- User A cannot read User B's transaction history.
- Anonymous users cannot access profiles or ledger records.
- Browser clients cannot create or update ledger rows directly.
- Unknown actions and malformed JSON return safe errors.
- Rate limits prevent rapid profile, referral and event abuse.
- Pagination is bounded and stable; history responses do not expose private provider metadata.

## E. Release decision

Do not enable rewards unless all applicable tests pass, the database permissions and unique indexes are verified, provider callback signing is configured, reconciliation is operational, and the public terms accurately describe the reward source and eligibility. Do not enable cash/token withdrawals until a funded and audited payout path is separately approved.

## Current status

The current FundB API supports authenticated profile loading and referral relationship handling only. Transaction history intentionally returns HTTP 501. No test results are implied by this document; record each test's date, environment, build and outcome before release.
