
# Add Real-Time Hourly Contact Data to Team Dashboard Chart

## Overview
Replace the mock hourly data in the Team Dashboard with actual Apollo contact counts aggregated by hour from the `enrichment_runs` table. The chart will display real contacts discovered each hour across all team members.

## Current State
- The chart uses `Math.random()` to generate fake hourly data (lines 133-143 in TeamDashboard.tsx)
- The backend `get-team-dashboard-stats` action already queries `enrichment_runs` but doesn't return hourly breakdowns
- Real data exists in the database showing hourly contact counts (e.g., 398 contacts at 15:00, 225 at 13:00)

## Implementation Plan

### 1. Backend: Extend the data-api Edge Function
**File:** `supabase/functions/data-api/index.ts`

Add hourly aggregation to the `get-team-dashboard-stats` action:
- Group contacts by hour for the past 24 hours
- Return an `hourlyData` array alongside existing stats
- Each entry contains `{ hour: "HH:00", contacts: number }`

```text
Response structure:
{
  success: true,
  data: {
    stats: [ ...existing team member stats... ],
    hourlyData: [
      { hour: "09:00", contacts: 45 },
      { hour: "10:00", contacts: 78 },
      { hour: "11:00", contacts: 120 },
      ...
    ]
  }
}
```

### 2. Frontend API: Update TypeScript Types
**File:** `src/lib/dataApi.ts`

- Update `getTeamDashboardStats` to expect a new response shape containing both `stats` and `hourlyData`
- Add `HourlyDataPoint` interface: `{ hour: string; contacts: number }`

### 3. Frontend UI: Consume Real Data
**File:** `src/pages/TeamDashboard.tsx`

- Remove the mock `hourlyData` useMemo that generates random values
- Store hourly data from the API response in component state
- Pass real data to the recharts LineChart component
- Handle edge cases: empty data, loading states

## Technical Details

### Backend Aggregation Logic
```text
Query enrichment_runs for last 24 hours
Group by hour (date_trunc)
Sum contacts per hour (jsonb_array_length of enriched_data)
Format hours as "HH:00" strings
Fill in missing hours with 0 contacts
```

### Data Flow
```text
enrichment_runs table
       |
       v
data-api edge function (aggregation)
       |
       v
{ stats: [...], hourlyData: [...] }
       |
       v
TeamDashboard.tsx (state)
       |
       v
recharts LineChart component
```

## Files to Modify
1. `supabase/functions/data-api/index.ts` - Add hourly aggregation to `get-team-dashboard-stats`
2. `src/lib/dataApi.ts` - Update interface and response type
3. `src/pages/TeamDashboard.tsx` - Replace mock data with API data

## Expected Outcome
- Chart displays actual hourly Apollo contact discovery rates
- Data refreshes when the dashboard loads
- Hours with no activity show as 0 contacts
- Time axis spans the current day (midnight to current hour)
