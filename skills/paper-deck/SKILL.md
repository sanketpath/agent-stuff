---
name: paper-deck
description: >
  SOP for building presentation slide decks and wireframes in Paper (paper.design) using the Paper MCP server.
  Use whenever the user wants to create slides, a deck, a presentation wireframe, or any multi-slide layout in Paper.
---

# Paper Deck SOP

## What this solves
Build N slides in Paper where slides don't overlap each other, each slide has a notes frame below it, and the final layout can be visually verified.

## 1. Architecture (non-negotiable)

One top-level node per deck. Everything else nests inside it via flex.

```
rootNodeId
└── Deck              (display:flex; flex-direction:row; gap:80px; align-items:flex-start)
    ├── Slide N Group (display:flex; flex-direction:column; gap:80px; width:1280px)
    │   ├── Slide N   (1280×720, white or theme bg)
    │   └── Notes N   (1280×150, notes bg)
    └── ...
```

**Why this architecture:** In the Paper MCP runtime, `position:absolute; left/top` on root-level frames does NOT reliably place them — frames stack at origin regardless. Flex is the only placement method that works. `position:absolute` is fine *inside* a slide frame for headline/bullet/footer placement.

## 2. The one-top-level-node rule

`Deck` is the ONLY child of `rootNodeId`. This applies to real slides AND to throwaway test probes — a probe written at root lands at (0,0) and overlaps whatever is already there.

Before writing to `rootNodeId`, call `get_children(rootNodeId)`. If a `Deck` already exists, append inside it instead of creating a second top-level node. If you need a scratch probe, put it inside Deck as a disposable group and delete it when done.

## 3. Dimensions

| Container | Width | Height |
|---|---|---|
| Slide | 1280px | 720px |
| Notes | 1280px | 150px |
| Gap between slide groups (h-flex) | — | 80px |
| Gap between slide and notes (v-flex) | 80px | — |

Never `height: fit-content` on slide or notes shells.

## 4. Text wrapping

Paper does not auto-wrap. Set explicit width + `white-space: normal`.

| Element | Width |
|---|---|
| Headline | 1088px |
| Bullet text | 1040px |
| Notes paragraph | 1232px |

## 5. Speaker notes snippet

```html
<div style="position:absolute; left:24px; top:20px; font-size:11px; font-weight:600; color:#AAAAAA; letter-spacing:0.1em; text-transform:uppercase; font-family:'Google Sans Flex', sans-serif;">Speaker Notes</div>
<div style="position:absolute; left:24px; top:44px; width:1232px; font-size:14px; font-weight:400; line-height:22px; color:#555555; white-space:normal; font-family:'Google Sans Flex', sans-serif;">…notes body…</div>
```

## 6. Build flow

1. `get_basic_info` → record `rootNodeId`, existing artboards.
2. `get_children(rootNodeId)` → check if a Deck exists. If yes, append into it.
3. If new: write the `Deck` container at root, then pre-create N empty slide groups inside. Record `slideId[n]` and `notesId[n]` for each.
4. Populate each slide: headline, bullets, footer → into `slideId[n]`. Label + body → into `notesId[n]`.
5. Batch parallel writes when populating (one message, many `write_html` calls — the server serializes but you skip agent round-trips).

## 7. Validate before declaring done

**Mandatory final step:** `get_screenshot(deckId)`.

Because Deck is the single parent of everything, this one screenshot captures all slides, all notes frames, and all inter-slide spacing in a single image. No per-artboard screenshots needed.

Check: no overlap, notes below slides, text wraps, no empty frames.

Then call `finish_working_on_nodes(deckId)`.
