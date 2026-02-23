# Music Order Version Limits by Plan

## Overview

Music orders use a version-based workflow with limits that vary by plan tier.

## Version Limits by Plan

| Plan | Max Versions | Description |
|------|-------------|-------------|
| **AI Curator** | 1 | One version only - client must confirm or request changes (limited) |
| **Pro-Arrangement** | 3 | Three versions - client can iterate up to 3 times |
| **Masterpiece** | Unlimited | Infinite versions - iterate until perfect |

## Database Schema

```sql
-- music_orders table
version_count INTEGER DEFAULT 0  -- Number of versions uploaded (v1, v2, v3...)
max_versions INTEGER DEFAULT 1   -- Maximum versions allowed (-1 = unlimited)
confirmed_version_id UUID        -- Version ID client confirmed
awaiting_final_upload BOOLEAN    -- Whether admin needs to upload final files
```

## Workflow States

```
paid → in_production → version_ready → awaiting_final → completed
        ↑                  ↓
        └──────────────────┘ (if client requests changes)
```

### State Descriptions

- **paid**: Payment received, order in queue
- **in_production**: Team is working on the track
- **version_ready**: New version uploaded, client can review
- **awaiting_final**: Client confirmed version, admin preparing final files
- **completed**: Final files delivered

## Client Experience

### When Version is Ready (`version_ready`)

Client sees the latest version and can:

1. **Preview & Download** - Listen to the version
2. **Add Annotations** - Use the feedback panel to mark specific sections
3. **Confirm Version** ✓ - Move to final delivery
4. **Request Changes** ↻ - Go back to production (if under limit)

### Version Limit Behavior

#### Under Limit
- "Request Changes" button is enabled
- Client can freely iterate
- Counter shows: "Versions: 1 / 3" (for Pro)

#### At Limit
- "Request Changes" button is disabled
- Shows warning: "Version limit reached (3 versions) — please confirm current version"
- Client must either:
  - Confirm the current version
  - Contact support for additional revisions

#### Unlimited (Masterpiece)
- No version counter shown
- Always shows: "Unlimited versions — keep iterating until perfect!"
- "Request Changes" always enabled

## Admin Experience

### Uploading New Versions

1. Admin uploads new version file
2. System auto-increments `version_count`
3. Status changes to `version_ready`
4. Client receives email notification

### Version Counter Display

Admin sees: "Versions: 2 / 3" or "Versions: 5 / Unlimited"

### After Client Confirmation

1. Client confirms a version
2. Status → `awaiting_final`
3. Admin uploads final files (all formats: MP3, WAV, stems, etc.)
4. Status → `completed`

## Code Locations

### API
- `/app/api/orders/music/route.ts` - Sets `max_versions` based on tier on order creation

### Components
- `/components/admin/MusicOrderWorkflow.tsx` - Admin workflow with version counter
- `/components/dashboard/MusicOrderDetail.tsx` - Client view with version limit checks

### Database
- Migration: `20260220001829_add_version_limits_by_plan.sql`

## Version Counter Component

```tsx
<VersionCounter used={versionsUsed} max={order.max_versions} />
```

Displays:
- Green badge for unlimited plans
- Red badge when limit reached
- Normal progress for plans with limits

## Request Changes Logic

```typescript
const versionsUsed = order.version_count || 0;
const canRequestChanges = order.max_versions === -1 || versionsUsed < order.max_versions;

// Button disabled if canRequestChanges is false
<Button disabled={!canRequestChanges}>Request Changes</Button>
```

## Email Notifications

- `version_ready` - New version uploaded (to client)
- `version_confirmed` - Client confirmed version (to admin)
- `changes_requested` - Client wants changes (to admin)
- `final_ready` - Final files ready (to client)

## Notes

- Version numbers are sequential: v1, v2, v3...
- All versions remain accessible in history
- Clients can always confirm at any point (even before limit)
- Support can manually adjust `max_versions` if needed
