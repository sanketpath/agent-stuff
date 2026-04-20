---
name: voice-journal-cleanup
description: Clean rough voice-journal transcripts into polished markdown. Removes filler words (um, uh, you know), fixes obvious grammar errors, organizes into logical short paragraphs, and adds [[xxxx]] square brackets around proper nouns (people, companies, products) on first mention. Use this skill whenever the user has a messy voice recording transcript, voice notes, or rough audio transcription that needs cleanup and formatting for their journal or knowledge base.
---

# Voice Journal Cleanup

Transform messy voice-journal transcripts into clean, readable markdown with entity linking.

## What This Skill Does

Takes rough transcribed speech and produces polished markdown by:
- **Removing filler words**: um, uh, you know, like, basically, essentially, and so on & so forth, etc.
- **Fixing obvious grammar**: Subject-verb agreement, tense consistency, basic punctuation
- **Organizing into paragraphs**: Natural topic breaks, short paragraphs (4-6 sentences typical)
- **Linking entities**: Adds `[[Entity Name]]` brackets around proper nouns (people, companies, products) on **first mention only**
- **Preserving voice**: Keeps your exact phrasing, tone, and reasoning—no summarizing or rewriting

## What NOT to Do

- Don't add section headers or artificial structure
- Don't summarize or condense
- Don't remove or combine ideas
- Don't change meaning or tone
- Don't bracket common nouns, roles, or non-proper entities (e.g., "VP of Design" stays unbracketed unless it's someone's actual title/name)
- Don't bracket acronyms or repeated mentions of the same entity

## Workflow

1. **Read and identify** the transcript for:
   - Filler words to remove
   - Obvious grammar errors
   - Natural paragraph breaks (topic shifts, logical groupings)
   - All proper nouns (people, company names, product names)

2. **Track entities:** As you clean, maintain a mental list of entities you've bracketed. Bracket each entity **exactly once** on its first mention only.

3. **Clean the text:**
   - Remove fillers while preserving cadence
   - Fix grammar without changing voice
   - Break into short logical paragraphs
   - Add brackets `[[Entity]]` to proper nouns (people, companies, products) on **first mention only** (refer to your entity list)

4. **Output** as markdown with no frontmatter unless the user requests it

## Example Transformation

**Input (messy):**
> Um, so I talked to Sameer who works at TechCorp, uh, and basically they're doing AI stuff, you know, like agent builders and workflows and, uh, it's interesting but also kind of risky because the company is, you know, not really growing. I think they're trying to move to PLG which is, um, a big shift.

**Output (cleaned):**
> I spoke with [[Sameer]] who works at [[TechCorp]]. They're building AI stuff—agent builders, workflows, and that sort of thing. It's interesting but also risky because the company isn't growing. They're trying to shift to PLG, which is a significant move.

## Notes

- Keep paragraphs short (3-8 sentences typical)
- If a transcript has natural sections or time breaks, use those as paragraph boundaries
- Preserve the user's perspective and reasoning exactly
- When in doubt about whether something is a "proper noun," ask rather than bracket
