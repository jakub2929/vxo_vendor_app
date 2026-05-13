# Welcome screen emoji stickers

Source: Figma file, page `0:1` "Page 1", frame `2_Light_welcome screen` (node `4:10402`),
sticker group `4:10412`. Each PNG is a single `Avatar` component instance from that group.

| File           | Source node | Figma square size | PNG size (after crop) |
|----------------|-------------|-------------------|-----------------------|
| sticker-1.png  | 4:10413     | 75×75             | 76×76                 |
| sticker-2.png  | 4:10414     | 115×115           | 115×115               |
| sticker-3.png  | 4:10415     | 96×96             | 72×96                 |
| sticker-4.png  | 4:10416     | 96×96             | 62×96                 |
| sticker-5.png  | 4:10417     | 83×83             | 83×83                 |
| sticker-6.png  | 4:10418     | 170×170           | 170×170               |
| sticker-7.png  | 4:10419     | 77×77             | 59×78                 |
| sticker-8.png  | 4:10420     | 134×134           | 135×135               |
| sticker-9.png  | 4:10421     | 122×122           | 122×122               |

## Export method

Pulled directly from the Figma Dev Mode MCP server via `get_screenshot` with
`contentsOnly: true`. The 9 source nodes are component instances and cannot be
downloaded as raw image fills, so a per-node rendered screenshot is the only
MCP-available path.

There is **no npm script** for this — Figma Desktop must be running locally with
the MCP server enabled. Regenerate by re-running `/tmp/figma_export.py` against
the live Figma file (or have the agent loop `get_screenshot` over the 9 node
IDs in the table above and write the returned base64 PNG bytes to this folder).

Numbering is by source node ID order, not by visual position — positions are
assigned in code (see `src/components/StickerCollage.tsx`).

## Resolution caveat

`get_screenshot` does not expose a scale parameter, so PNGs come back at the
node's native pixel size — between 76 px and 170 px square. Three of the
stickers (`-3`, `-4`, `-7`) came back non-square because `contentsOnly: true`
crops to opaque pixels; the surrounding transparency is missing from the file
but is preserved in code by positioning each image inside a square Figma-sized
slot with `resizeMode="contain"`.

If retina rendering looks blurry on device, switch to the Figma REST API with
`scale=3` (and ideally `format=svg` for vector source) and rerun the export.
