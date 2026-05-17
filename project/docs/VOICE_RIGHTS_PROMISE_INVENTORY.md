# Onyx Platform Rights Promise Inventory

> Purpose: Extract all customer-facing rights and legal promises that must be fully covered by Talent-side rights acquisition documents.
> Scope sources: `messages/en.json` (`legal.terms`, `legal.privacy`, `verify`), `lib/certificate-rights.ts`, `app/[locale]/legal/refund/page.tsx`, `components/landing/Footer.tsx`.
> Version date: 2026-02-25

## A. Core Rights Promises to Customers (Must Be Backed by Talent Agreement)

1. **Perpetual license validity**
   - Promise: Customer usage rights do not expire.
   - Source:
     - `messages/en.json` -> `verify.validity`
     - `messages/en.json` -> `legal.terms.s31Body`
     - `lib/certificate-rights.ts` (`validityPeriod`)

2. **Worldwide territory**
   - Promise: Usage allowed globally across countries/regions.
   - Source:
     - `messages/en.json` -> `verify.territory`
     - `lib/certificate-rights.ts` (`geographicTerritory`)

3. **Rights-tier model (Standard / Broadcast / Global)**
   - Promise: Rights scope is defined by purchased tier and is cumulative.
   - Source:
     - `messages/en.json` -> `legal.terms.s3Body`
     - `messages/en.json` -> `verify.rightsStandard`, `verify.rightsBroadcast`, `verify.rightsGlobal`
     - `lib/certificate-rights.ts` (`RightsLevel`, `mediaChannels`)

4. **Sublicensing for Broadcast/Global tiers**
   - Promise: Broadcast and Global buyers can sublicense in larger projects.
   - Source:
     - `messages/en.json` -> `legal.terms.s6Body` (6.3)
     - `messages/en.json` -> `verify.sublicensing`
     - `lib/certificate-rights.ts` (`sublicensingRights`)

5. **Transferability in full buyout scenarios**
   - Promise: Certain buyout/full ownership scenarios allow assignment to third parties.
   - Source:
     - `messages/en.json` -> `legal.terms.s23Body`
     - `messages/en.json` -> `verify.transferability`
     - `lib/certificate-rights.ts` (`transferability`)

6. **Ownership transfer / full buyout representations**
   - Promise: In specific products, customer receives full ownership (as represented on certificate).
   - Source:
     - `messages/en.json` -> `legal.terms.s4Body` (Masterpiece), `s5Body`, `s39Body`
     - `lib/certificate-rights.ts` (`ownershipStatus`)

7. **Moral rights non-assertion by performers**
   - Promise: Performers have waived or covenanted not to assert moral rights against Onyx and licensees.
   - Source:
     - `messages/en.json` -> `legal.terms.s7Body`
     - `messages/en.json` -> `legal.terms.s8Body` (indemnification wording)
     - `lib/certificate-rights.ts` (`indemnification`)

8. **Royalty-free to client (no extra performer fee)**
   - Promise: No ongoing royalties/residuals/additional performer payments required from client.
   - Source:
     - `messages/en.json` -> `legal.terms.s8Body` (8.4)
     - `lib/certificate-rights.ts` (`indemnification`)

9. **Voice ID Affidavit traceability**
   - Promise: Certain assets can be linked to verified performer identity/rights transfer affidavit.
   - Source:
     - `messages/en.json` -> `legal.terms.s8Body` (8.3)
     - `messages/en.json` -> `verify.voiceAffidavit`
     - `lib/certificate-rights.ts` (`voiceAffidavit`)

10. **Non-retroactive talent departure**
    - Promise: Prior licenses remain valid even if talent exits.
    - Source:
      - `messages/en.json` -> `legal.terms.s56Body`
      - `messages/en.json` -> `legal.terms.s41Body`

11. **Archive Status permanent retention (post-departure/legal validation only)**
    - Promise: Archived models are permanently retained for license validation, legal defense, and compliance, not new commercialization.
    - Source:
      - `messages/en.json` -> `legal.terms.s58Body`
      - `messages/en.json` -> `legal.privacy.s11Body`

12. **Clean chain of title + IP indemnification**
    - Promise: Onyx warrants lawful rights chain and defends clients for qualified third-party IP claims.
    - Source:
      - `messages/en.json` -> `legal.terms.s19Body`
      - `messages/en.json` -> `verify.indemnification`

13. **License verification + evidence trail**
    - Promise: License certificates are verifiable via unique ID and portal.
    - Source:
      - `messages/en.json` -> `legal.terms.s8Body`
      - `messages/en.json` -> `verify.title` and related fields

14. **Business continuity of license**
    - Promise: Granted rights survive Onyx merger/acquisition/dissolution (subject to breach clauses).
    - Source:
      - `messages/en.json` -> `legal.terms.s31Body`
      - `messages/en.json` -> `verify.businessContinuityDesc`

## B. Risk-Sensitive Promises That Require Tight Talent-Side Drafting

1. **Irrevocability and no retroactive clawback**
   - Why sensitive: If talent later attempts withdrawal/deletion, customer-facing perpetual grant could break.
   - Source anchors: `legal.terms.s41Body`, `s56Body`, `s58Body`.

2. **Moral rights and reputation objections**
   - Why sensitive: In Taiwan framework, moral rights are generally not assignable; must use covenant-not-to-assert language.
   - Source anchors: `legal.terms.s7Body`, `s8Body`.

3. **Sublicense and downstream client use**
   - Why sensitive: Must ensure talent-side grant covers sublicensing and multi-layer client chains.
   - Source anchors: `legal.terms.s6Body`, `verify.sublicensing`.

4. **Archive retention vs deletion requests**
   - Why sensitive: Privacy/deletion claims may conflict with permanent archival commitments to existing license holders.
   - Source anchors: `legal.privacy.s11Body`, `legal.terms.s58Body`.

5. **Royalty-free finality**
   - Why sensitive: Talent-side compensation model must block later residual/extra fee demands toward clients.
   - Source anchors: `legal.terms.s8Body`, `verify.indemnification`.

## C. Pricing/Marketing Rights Labels That Must Match Contract Language

- `Standard Commercial`
- `Broadcast TV & Buyout` / `Broadcast TV & Full Media Buyout`
- `Global TV & Game Rights`
- `Full Media Buyout`
- `License Scope`
- `Voice Affidavit`
- `Archive Status`

These labels appear in product UI, verification certificate display, and legal text. Talent agreement wording must not be narrower than the strongest of these external labels.

