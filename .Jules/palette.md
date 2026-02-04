## 2024-05-22 - Accessibility Improvements for ChatPanel
**Learning:** Many icon-only buttons in the application lack `aria-label` attributes, making them inaccessible to screen reader users. The "Reset Chat" button represented by "×" is particularly problematic as it's read as "times" or "cross".
**Action:** Always verify that icon-only buttons have descriptive `aria-label` attributes. Use specific labels like "Reset Chat" instead of relying on visual symbols.
