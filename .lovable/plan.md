

# Improve Skills Allocation by Analyzing Existing Bullhorn Contacts

## Overview

Enhance the skill allocation system by learning from existing contacts in Bullhorn. This approach analyzes patterns from successfully assigned skills in your Bullhorn database to improve accuracy for new contact exports.

## Current Limitations

The existing system uses static keyword mappings that:
- Cannot adapt to your organization's specific skill naming conventions
- Miss context-specific patterns unique to your Bullhorn instance
- Don't learn from successful skill assignments made by recruiters

## Proposed Solution: Skills Pattern Learning

Create a new edge function that queries existing Bullhorn contacts, extracts skill patterns, and builds a reference dataset for better skill matching.

```text
+------------------------+     +------------------------+     +------------------------+
| Bullhorn Contacts      | --> | Pattern Analyzer       | --> | Skills Reference DB    |
| (existing skills data) |     | (extract patterns)     |     | (company→skills map)   |
+------------------------+     +------------------------+     +------------------------+
                                                                        |
                                                                        v
+------------------------+     +------------------------+     +------------------------+
| New Apollo Contacts    | --> | Enhanced Skill Engine  | --> | Bullhorn Export        |
| (from enrichment run)  |     | (learned + rules)      |     | (better skills)        |
+------------------------+     +------------------------+     +------------------------+
```

## Implementation Details

### Phase 1: Create Skills Analysis Edge Function

**New file: `supabase/functions/analyze-bullhorn-skills/index.ts`**

This function will:

1. **Query existing Bullhorn contacts** with skills data:
   ```text
   GET /search/ClientContact?fields=id,name,firstName,lastName,occupation,
       desiredSkills,customText1,categorySkills,address(city,countryID),
       clientCorporation(id,name)
   ```

2. **Extract skill patterns** by grouping contacts by:
   - Company name → skills associations
   - Job title patterns → skills associations
   - Location → skills associations

3. **Store learned mappings** in a new `skill_patterns` table:
   ```text
   | pattern_type | pattern_value      | skills           | frequency |
   |--------------|-------------------|------------------|-----------|
   | company      | goldman sachs     | TIER 1;IB;...    | 47        |
   | title        | managing director | SENIOR;BUSINESS  | 128       |
   | location     | london            | LONDON;EMEA      | 312       |
   ```

### Phase 2: Database Schema

**New table: `skill_patterns`**

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| pattern_type | text | 'company', 'title', 'location' |
| pattern_value | text | Lowercase normalized value |
| skills | text[] | Array of learned skills |
| frequency | integer | How many times this pattern appears |
| confidence | numeric | Confidence score (frequency-based) |
| last_analyzed_at | timestamptz | When pattern was last updated |

### Phase 3: Enhance Export Function

**Modify: `supabase/functions/export-to-bullhorn/index.ts`**

Update `generateSkillsString()` to:

1. **Query learned patterns** from `skill_patterns` table
2. **Prioritize high-frequency patterns** for skill matching
3. **Fall back to existing rules** when no learned pattern exists
4. **Merge learned + rule-based skills** with deduplication

```text
Skill Priority Order:
1. Learned patterns (confidence > 0.7, frequency > 5)
2. Existing rule-based mappings (COMPANY_SKILLS, TITLE_SKILLS)
3. Generic fallbacks (BUSINESS, GLOBAL, etc.)
```

### Phase 4: Admin UI Integration

**Add to Settings page:**

- "Analyze Bullhorn Skills" button that triggers the analysis
- Display last analysis timestamp
- Show top learned patterns for verification
- Option to clear learned patterns

## Data Flow

```text
User clicks "Analyze Bullhorn Skills"
       |
       v
Edge function queries up to 1000 recent contacts from Bullhorn
       |
       v
Extract skills from: desiredSkills, customText1, categorySkills
       |
       v
Group by company/title/location and count frequencies
       |
       v
Store patterns with frequency >= 3 (minimum threshold)
       |
       v
During export, match new contacts against learned patterns
       |
       v
Merge learned skills with rule-based skills
```

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/analyze-bullhorn-skills/index.ts` | New edge function for pattern analysis |
| Migration for `skill_patterns` table | Store learned mappings |

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/export-to-bullhorn/index.ts` | Query learned patterns before rule-based matching |
| `supabase/functions/data-api/index.ts` | Add actions for triggering analysis and viewing patterns |
| `src/pages/Settings.tsx` | Add UI for skill analysis trigger |
| `src/components/settings/BullhornSettingsCard.tsx` | Add analysis button and status display |

## API Endpoints

| Action | Description |
|--------|-------------|
| `analyze-bullhorn-skills` | Trigger full skill pattern analysis |
| `get-skill-patterns` | Retrieve learned patterns for display |
| `clear-skill-patterns` | Reset learned patterns |

## Technical Considerations

### Bullhorn API Rate Limits
- Query contacts in batches of 100
- Add 200ms delay between batches
- Total analysis limited to 1000 contacts (configurable)

### Pattern Quality Filters
- Minimum frequency threshold: 3 occurrences
- Skip patterns with only generic skills (BUSINESS, GLOBAL)
- Normalize company names (lowercase, trim whitespace)

### Confidence Scoring
```text
confidence = min(1.0, frequency / 20)
```
- 3+ occurrences = included
- 20+ occurrences = max confidence (1.0)

## Expected Benefits

| Aspect | Before | After |
|--------|--------|-------|
| Unknown companies | Generic fallback skills | Learned from similar contacts |
| Skill accuracy | ~70% relevant | ~85-90% relevant |
| Adaptation | Manual rule updates | Automatic pattern learning |
| Organization fit | Generic mappings | Your Bullhorn's actual skills |

## Limitations

- Requires existing contacts in Bullhorn to learn from
- Initial analysis may take 1-2 minutes
- Patterns reflect historical data (may include outdated skills)

