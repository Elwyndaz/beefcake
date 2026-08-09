# AAA-WebApp Design Audit: Beefcake

**Date:** 2026-08-09
**Status:** Active
**Purpose:** Design roadmap for transitioning Beefcake from functional tool to premium product.
**Handoff:** Use this file as the sole reference for any AI-driven design implementation.

---

## 1. Executive Vision: "Tool" vs. "Brand"

The current state is "well-engineered tool" (B+): consistent, readable, functional.
The target state is "premium product" (A+): intentional, energetic, polished.

Every visual choice should serve the goal of helping the user train without thinking. The UI should feel fast, confident, and physically present.

**Design Principles for Beefcake:**
- **Clarity first:** Data is king. Numbers should be unmissable.
- **Physicality:** This is a gym app. Use bold weights, tight typography, high contrast.
- **Silence:** When the app is doing nothing, it should feel calm and spacious.

---

## 2. Design System Refinement

### 2.1 Typography (Personality & Clarity)

**Problem:** `system-ui` is safe but generic. It has no personality.

**Action:**
1.  **Font:** Replace `system-ui` with **Geist** (preferred) or **Inter**. These are designed for screen readability and have excellent numeric characters.
2.  **Heading Hierarchy:**
    *   Large headings (e.g., "Nästa pass", "Översikt"): `font-weight: 800`, `letter-spacing: -0.02em`.
    *   Medium headings (card titles): `font-weight: 700`.
    *   Body: `line-height: 1.7`.
3.  **Numeric Data:**
    *   Force `font-variant-numeric: tabular-nums` on ALL containers with numbers (volume, weight, reps).
    *   Numeric cells should use a slightly higher `font-weight: 600` to make them "pop" from the surrounding text.

### 2.2 Color Palette (Energy & Depth)

**Problem:** The current palette (`#2c3e50`, `#e74c3c`) feels like a default Bootstrap admin panel. It lacks the energy of a fitness app.

**Action:**
1.  **Accent (The "Action" Color):**
    *   Current: `#e74c3c` (Flat UI red).
    *   AAA: **Electric Red** (`#FF4757`) or **High-Energy Orange** (`#FF6B35`).
    *   Usage: Used ONLY for primary actions and important status changes.
2.  **Primary (The "Grounding" Color):**
    *   Keep `#2c3e50` for text, but use a slightly richer shade for the sidebar background to create depth.
3.  **Dark Mode:**
    *   Move away from pure `#121212`. Use a slightly tinted dark grey (e.g., `#11141A` - deep blue-grey) to make the UI feel more "expensive."

### 2.3 Components (Enforce Usage)

**Problem:** You have components in `src/components/` (`Button`, `Card`, `Stat`, `EmptyState`) that are NOT used in the pages.

**Action:**
1.  **Refactor JSX:** Every raw `div class="card"` in `Home.tsx`, `LogSession.tsx`, etc., MUST be replaced with the `<Card>` component.
2.  **Why:** This allows for global design changes (like adding subtle animations or hover states) in one place.
3.  **Empty States:** Every empty list or missing chart must use the `<EmptyState>` component.

---

## 3. UX & Functional Polish

### 3.1 Data Display (Progressive Disclosure)

**Problem:** History tables look like Excel exports.

**AAA Goal:** Simplify and emphasize.

1.  **Tables:**
    *   Remove all vertical borders.
    *   Use horizontal lines ONLY between rows.
    *   Use `border-collapse: separate; border-spacing: 0 4px;` and slightly rounded corners on rows.
2.  **Volume Emphasis:**
    *   Make "Volym" the visual hero of any row.
    *   Use a slightly larger font size for this column.
3.  **Empty States:**
    *   Never show a truly "empty" screen.
    *   Every empty state should have a clear, one-line instruction: "Inga pass registrerade. Logga ett pass för att se statistik."

### 3.2 Micro-interactions

**Problem:** The UI feels "static."

**Action:**
1.  **Transitions:** Ensure EVERY interactable element has:
    ```css
    transition: all 0.2s ease-in-out;
    ```
2.  **Button Feedback:** Add a subtle "scale down" on active/click:
    ```css
    .btn:active { transform: scale(0.98); }
    ```
3.  **Card Hover:** Subtle elevation change on hover:
    ```css
    .card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.12); }
    ```

---

## 4. Implementation Roadmap for AI Handoff

### Phase 1: Structural Cleanup (Priority)
1.  Adopt all components in `src/components/` across all pages.
2.  Integrate Geist/Inter font.
3.  Refactor typography scales using the existing `--text-*` tokens.

### Phase 2: Visual Refresh
4.  Update color variables in `app.css`.
5.  Apply `tabular-nums` globally.
6.  Increase padding in `.card` and `.page-title` to let the UI breathe.

### Phase 3: Premium Polish
7.  Update Chart.js options to inherit CSS color tokens.
8.  Add micro-interactions (transitions, active states).
9.  Refine the password gate to feel less like a "login" and more like a "reveal."

---

## 5. Technical Constraints for the Agent

*   **Zero Regression:** Do not break atomic transactions for `createSession` and `deleteSession`.
*   **Strict Typing:** `any` types are forbidden. Use union types for all inputs.
*   **Token Usage:** Hardcoded hex values in `.tsx` files are forbidden. Use CSS variables.
*   **Documentation:** Any new design token must be documented with a comment in `app.css`.
*   **Swedish Conventions:** All UI text must use Swedish conventions (decimal comma, space as thousands separator).
