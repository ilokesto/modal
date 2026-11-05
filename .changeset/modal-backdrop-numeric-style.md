---
"@ilokesto/modal": patch
---

Preserve React inline style semantics for native dialog backdrops, including numeric lengths, unitless values, vendor properties and case-sensitive custom properties. Copy parsed declarations into the scoped backdrop rule instead of interpolating caller values into stylesheet text, and clear removed styles on updates.
