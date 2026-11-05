---
"@ilokesto/modal": patch
---

Notify modal closure only for accepted transitions and preserve settlement results during reentrant callbacks. Keep closeAll notifications deferred until removal and avoid removing requests opened by remove/clear callbacks.

Deliver committed close notifications even when store subscribers throw, preserving the delegated error. Attempt every captured clear callback before reporting callback failures.
