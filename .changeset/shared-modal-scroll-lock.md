---
"@ilokesto/modal": patch
---

Share body scroll-lock ownership across inline, top-layer and hosted inline modals. Keep scrolling locked through exit and across providers until the last modal is removed, then restore the original overflow declarations and priorities.
