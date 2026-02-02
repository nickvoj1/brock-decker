
# Fix Location Suggestions to Prioritize CV Applicant Location

## Problem Analysis

The location suggestion system currently has complex logic that tries to be "smart" about location mapping but ends up suggesting wrong cities like Tokyo for a candidate based in Boston/MA. The issue stems from:

1. **Fragmented matching logic** - US state matching regex may not correctly capture all formats
2. **Fallback paths** - When the primary match fails, secondary sources (work history, education) can override with unrelated cities
3. **Keyword-based extraction** - The `extractLocationsFromText` function looks for city names as keywords, which can pick up irrelevant mentions

## Solution Overview

Simplify the location analysis to make the candidate's explicit CV location the **absolute primary source**, with a reliable fallback chain:

1. **First**: Try to extract a known city/location directly from `candidate.location`
2. **Second**: If only a US state is found, map to the major hub for that state
3. **Third**: If only a country is found, map to major cities for that country
4. **Fourth**: Only if no location is found at all, use secondary signals (work history, etc.) as supplementary

## Technical Changes

### File: `src/lib/cvAnalyzer.ts`

#### 1. Simplify the Primary Location Extraction (Lines 416-502)

```text
Current flow:
  candidate.location → US state regex → stateToCity map OR extractLocationsFromText

New flow:
  candidate.location → extractLocationsFromText FIRST (check for known cities)
                     → THEN US state detection (only if no city found)
                     → THEN country-to-hub fallback (only if still nothing)
```

The key change is to **check for known city names first** in the location string. For example:
- "Boston, MA" → matches "boston" directly → ✅ Primary: Boston
- "Chelsea, MA" → no city match → US state "MA" → maps to Boston
- "London, UK" → matches "london" directly → ✅ Primary: London

#### 2. Ensure Secondary Signals Don't Override

When a primary location is found from `candidate.location`, secondary sources (work history regional hints, summary, education) should only be added as **supplementary suggestions with much lower weight**, never replacing the primary.

Currently the code does try to do this (`foundPrimaryLocation` flag), but the logic flow allows edge cases where the flag isn't set properly.

#### 3. Add Direct City Extraction Before US State Regex

Before running the US state regex, first try to extract any known city name from the location string. This handles cases like:
- "Greater Boston Area, MA"
- "Boston Metropolitan Area"
- "London, United Kingdom"

## Implementation Steps

1. **Reorder extraction logic** in `analyzeLocations`:
   - Call `extractLocationsFromText(candidate.location)` FIRST
   - If it finds a known city, use that as primary (weight 15)
   - If it doesn't find a city but finds a country, continue to step 2
   - Only if no city found, run US state detection and state-to-city mapping

2. **Strengthen the foundPrimaryLocation guard**:
   - Once a primary location is set, prevent any secondary signal from adding locations with weight > 5

3. **Improve US state-to-city fallback coverage**:
   - Add more states to the stateToCity map (currently missing some like NJ, NH, CT, etc.)
   - Map New Jersey to New York, New Hampshire to Boston, Connecticut to New York, etc.

4. **Remove the "if no match, add all major US hubs" fallback** (lines 475-479):
   - This is causing suggestions like "New York, Boston, Chicago, San Francisco, Los Angeles" to appear when the state isn't in the map
   - Instead, add just the country ("United States") and let the country-to-hub fallback handle it later

## Expected Outcome

For a CV with location "Chelsea, MA":
- **Before**: Could suggest Tokyo, New York, or other unrelated cities
- **After**: Suggests Boston (nearest hub in MA) as primary, with United States as country

For a CV with location "London, UK":
- **Before & After**: Suggests London as primary (no change, already working)

For a CV with location "Frankfurt am Main, Germany":
- **Before**: Might not match if "Frankfurt am Main" isn't exact
- **After**: Matches "frankfurt" keyword → suggests Frankfurt as primary
