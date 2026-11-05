---
"@ilokesto/modal": patch
---

Synchronize native top-layer dialog closure with modal removal so dialog forms and direct close calls settle pending requests and notify onModalClose once. Preserve results and rejections already set through the modal API.
