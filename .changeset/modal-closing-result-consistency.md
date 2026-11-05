---
"@ilokesto/modal": patch
---

Notify modal closure only for accepted transitions and preserve settlement results during reentrant callbacks. Keep closeAll notifications deferred until removal and avoid removing requests opened by remove/clear callbacks.
