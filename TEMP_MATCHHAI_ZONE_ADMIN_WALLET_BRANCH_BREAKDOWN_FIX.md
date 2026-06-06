# Zone Admin Wallet Branch Breakdown Fix

Branch: product-ready

## Status

- Implemented branch-aware Zone Admin Wallet summary and transaction filtering.
- Removed the branch-level "coming soon" wallet UI warning.
- Kept available balance account-level and added helper copy.
- Passed selected wallet branch into the withdrawal modal and validated submitted withdrawal branches server-side.

## Backend Notes

- Future venue payout wallet transactions now store `zoneId`, `branchId`, and `branchName` in metadata.
- `zoneWallet.getSummary` validates the selected branch against the current zone and filters earnings/withdrawal cards by branch.
- `zoneWallet.listTransactionsPage` preserves existing All pagination and uses offset pagination for selected branch views after branch-context filtering.
- Historical payout transactions without recoverable branch context stay in All and are not attributed to a specific branch.

## UI Notes

- Wallet branch chips are rendered from one shared chip row.
- Selecting a branch shows contextual text such as "Showing earnings for Garden Branch".
- Transaction empty copy is branch-specific when a branch is selected.
- Withdrawal remains account-level financially; selected branch is context for the request.

## Validation

- Passed: `npx tsc -p tsconfig.json --noEmit`
- Failed unrelated existing/time-sensitive test: `npm test -- --runInBand`
  - New `__tests__/unit/zoneBranch.test.ts` passed.
  - Existing `__tests__/unit/matchroomLifecycle.test.ts` expected `open` but received `expired`.
- Passed: `git diff --check`
  - Git reported LF-to-CRLF working-copy warnings only.
