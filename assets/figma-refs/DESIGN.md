# VXO Vendor App — Design Reference

Auto-generated reference for the Figma design `VXO Vendor App V.1 Final`.
Connects screen PNGs ↔ icons ↔ tokens, so an AI agent can implement screens
without re-reading the Figma file.

All paths are relative to `vxo-vendor-app/assets/figma-refs/`.

---

## 1. Product overview

**VXO Vendor App** is a mobile app (React Native + Expo, iOS-first design)
for service contractors (HVAC, plumbing, etc.). Vendors receive **Work Orders
(WO#)** from VXO, accept/reject jobs, navigate to the location, communicate
with clients via in-app chat, send quotes, and invoice through Stripe. The app
is structured around a `Jobs` / `Home` tab with detail chat threads.

Tagline (from welcome screen): *"The best messenger and chat app of the
century to bring you more business."*

---

## 2. Design system

### 2.1 Colors

The full extracted palette has 52 colors (see `tokens/tokens.json`). Most are
incidental (gradient stops, emoji colors). The **core brand + UI palette** is:

| Role               | Hex        | Where used                                                  |
| ------------------ | ---------- | ----------------------------------------------------------- |
| Brand primary      | `#246bfd`  | Primary buttons, links, active tab underline, checkbox fill |
| Brand dark         | `#003290`  | VXO wordmark logo                                           |
| Header gradient    | `#246bfd` → `#3062c8` | Top header backgrounds (chat, home, support)     |
| Brand surface tint | `#246bfd14` / `#e9f0ff` | Active field background, selected pill         |
| Accent orange      | `#ff981f`  | "Document" upload chip, progress bar (paid)                 |
| Accent teal        | `#009689`  | "Camera" upload chip                                        |
| Accent purple      | `#9d28ac`  | "Gallery" upload chip, "Learn More" promo banner            |
| Indigo (secondary) | `#615efc`  | Purple progress bar (pending)                               |
| Success            | `#4aaf57` / `#34a853` | "Completed" badge, "Accept" button                |
| Danger             | `#e31d1c` / `#ff0000` | Notification dot, urgent metadata                 |
| Warning            | `#fbbc05` / `#ffc02d` | Pending status                                    |
| Text primary       | `#212121`  | Body text, titles                                           |
| Text secondary     | `#757575`  | Subtle labels, helper text                                  |
| Text tertiary      | `#9e9e9e` / `#bdbdbd` | Placeholders, timestamps                          |
| Surface base       | `#ffffff`  | Card / screen background                                    |
| Surface muted      | `#f5f5f5` / `#fafafa` | Input fields, chip backgrounds                    |
| Divider            | `#e0e0e0` / `#eeeeee` | Lines between sections                            |

### 2.2 Typography

**Primary font:** `Urbanist` (~22 of 32 styles). Secondary system fonts:
`SF Pro Display`, `SF Pro Text`, `Inter` (used in keyboard / OS chrome).

Practical scale to import into the theme:

| Token        | Family   | Weight | Size | Line height | Used for                          |
| ------------ | -------- | ------ | ---- | ----------- | --------------------------------- |
| `display`    | Urbanist | 700    | 48   | 57.6        | "Login to Your Account", "Let's you in" |
| `h1`         | Urbanist | 700    | 40   | 48          | "Welcome to VXO"                  |
| `h2`         | Urbanist | 700    | 32   | 38.4        | "OTP Code Verification", "Fill Your Profile" |
| `h3`         | Urbanist | 700    | 24   | 28.8        | Section headers, "VXO Support"    |
| `title`      | Urbanist | 600    | 20   | 28          | Card titles                       |
| `bodyBold`   | Urbanist | 700    | 18   | 25.2        | List item titles                  |
| `body`       | Urbanist | 500    | 16   | 22.4        | Body text, buttons                |
| `bodySmall`  | Urbanist | 400    | 14   | 19.6        | Helper text, captions             |
| `caption`    | Urbanist | 500    | 12   | 14.4        | Timestamps, badges                |
| `micro`      | Urbanist | 600    | 10   | 12          | Tab badges                        |

Note the `Urbanist 800 / 400px` style — that's the **splash logo** "VXO"
wordmark size, not a typography token. Treat the logo as a separate asset.

### 2.3 Shadows

4 elevation tokens (see `tokens/tokens.json` — `shadows`):

| Token       | Spec                                            | Used for                  |
| ----------- | ----------------------------------------------- | ------------------------- |
| `glow`      | `0 8 24` blur with `#246bfd40` (blue, 25% α)    | Primary button glow       |
| `cardLow`   | `0 4 60` blur with `#04060f0d` (~5% α)          | Cards, list items         |
| `cardHigh`  | `0 20 100` blur with `#04060f14` (~8% α)        | Modal / bottom sheet      |
| `innerInk`  | inner `0 0 6` with `#0000000f`                  | Input field inset         |

### 2.4 Layout primitives

- **Screen padding:** ~24px horizontal
- **Field height:** ~56–64px, fully rounded (≈14–16px radius)
- **Primary button:** full-width, ~60px tall, rounded ≈30px, white text 18/700, blue glow shadow
- **Avatar circle:** large variant ~180px (Fill Profile), header variant ~120px
- **Status bar:** appears in every PNG at `9:41` — this is mockup chrome; real app uses SafeAreaView

---

## 3. Icon catalog

20 SVG icons in [`icons/`](icons/). Each is a Figma render of the Iconly icon
set used on screen. **20 more icons referenced in the file failed to export**
(library permission limits on Figma free tier). Use `lucide-react-native` (already
installed in [package.json](../../package.json:38)) for those — name mapping below.

### Available locally as SVG

| File                         | Original Figma name          | Lucide RN equiv | Used on screens         |
| ---------------------------- | ---------------------------- | --------------- | ----------------------- |
| `light-outline-arrow-left.svg` | Iconly/Light/Arrow - Left  | `ArrowLeft`     | 3, 4, 5, 7, 8, 10, 11, 12, 13, 16, 20, 29 (all back-nav screens) |
| `arrow-right-2.svg`          | Iconly/Regular/Outline/Arrow - Right 2 | `ChevronRight`  | 29 (list item chevron)  |
| `arrow-down-2.svg`           | Iconly/.../Arrow - Down 2    | `ChevronDown`   | 4, 7 (country dropdown), 12 (Trade & Services dropdown) |
| `search.svg`                 | Iconly/.../Search            | `Search`        | 17, 19, 57, 65 (header search) |
| `more-circle.svg`            | Iconly/Light/More Circle     | `MoreHorizontal` | 17, 19, 57, 65 (header overflow) |
| `call.svg`                   | Iconly/Light/Call            | `Phone`         | 20 (chat header), 29 (top-right) |
| `voice.svg`                  | Iconly/Light/Voice           | `Mic`           | 20 (chat composer)      |
| `camera.svg`                 | Iconly/Light/Camera          | `Camera`        | 12 (upload bottom sheet — teal chip), 20 (chat attach) |
| `image.svg`                  | Iconly/Light/Image           | `ImageIcon`     | 12 (upload — purple "Gallery" chip) |
| `document.svg`               | Iconly/Light/Document        | `FileText`      | 12 (upload — orange "Document" chip) |
| `edit-square.svg`            | Iconly/Light/Edit Square     | `PencilSquare` (or `Pencil`) | 12, 13 (avatar edit button) |
| `curved-calendar.svg`        | Iconly/Curved/Calendar       | `Calendar`      | 12, 13 (Trade & Services field) |
| `curved-message.svg`         | Iconly/Curved/Message        | `MessageCircle` | 17 (chat-bubble action), 65 (FAB) |
| `curved-setting.svg`         | Iconly/Curved/Setting        | `Settings`      | 65 (dropdown menu)      |
| `curved-volume-down.svg`     | Iconly/Curved/Volume Down    | `Volume1`       | 20 (chat — audio message) |
| `curved-3-user.svg` / `3-user.svg` | Iconly/Curved/3 User   | `Users`         | 17 ("Current Job Support" — group avatar) |
| `add-user.svg`               | Iconly/Light/Add User        | `UserPlus`      | 17 ("General Q & A") |
| `curved-image-2.svg`         | Iconly/Curved/Image 2        | `ImagePlus`     | (chat attach variant)   |
| `curved-danger-square.svg`   | Iconly/Curved/Danger Square  | `AlertTriangle` | 20 ("Emergency SLA" indicator) |

### Referenced but NOT exported (use Lucide)

| Figma name                          | Lucide RN equivalent       | Notes                                |
| ----------------------------------- | -------------------------- | ------------------------------------ |
| Iconly/Bold/Notification            | `Bell`                     | Header / FAB notification badge      |
| Iconly/Bold/Star                    | `Star`                     | Ratings                              |
| Iconly/Bold/Delete                  | `Trash2`                   | Destructive action                   |
| Iconly/Bold/Upload                  | `Upload`                   | Upload COI / W-9 fields (screen 12)  |
| Iconly/Bold/Video                   | `Video`                    | Video call (chat header)             |
| Iconly/Bold/Profile                 | `User`                     | Profile menu item                    |
| Iconly/Bold/Scan                    | `ScanLine` / `Fingerprint` | Screen 16 (fingerprint)              |
| Iconly/Curved/Chart                 | `BarChart3`                | Analytics                            |
| Iconly/Curved/Tick Square           | `CheckSquare`              | Checkboxes ("Remember me" — screen 4–8) |
| Iconly/Curved/Close Square          | `XSquare`                  | Dismiss                              |
| Iconly/Curved/Plus                  | `Plus`                     | Add (FAB)                            |
| Iconly/Curved/Heart                 | `Heart`                    | Favorite                             |
| Iconly/Curved/Time Square           | `Clock`                    | Timestamp / pending                  |
| Iconly/Curved/Discovery             | `Compass`                  | Explore                              |
| Iconly/Curved/Download              | `Download`                 | Download invoice/quote               |
| Iconly/Light/Chat                   | `MessageCircle`            | Alternative to `curved-message.svg`  |

**Convention recommendation:** create `src/components/Icon.tsx` that maps a
string key → Lucide component. Then screens never import Lucide directly, so
swapping icon library later is one-file change.

---

## 4. Screen-by-screen breakdown

PNGs are sorted by the numeric prefix in the original Figma name. The number
reflects the design's intended **user flow order**.

### 4.1 Onboarding flow

#### `1-light-splash-screen.png` — Splash

- **Purpose:** App launch / initial loading
- **Layout:** Centered VXO logo wordmark (dark blue `#003290`, ~400px), decorative light-blue circles scattered, loading spinner near bottom
- **Components:** Static — no interactions
- **Icons:** None
- **Background:** White `#ffffff`
- **Implementation note:** Use Expo SplashScreen — keep it on-screen until auth state resolves, then navigate to Welcome (if first-launch) or Home (if signed in).

#### `2-light-welcome-screen.png` — Welcome / Onboarding intro

- **Purpose:** First-time user welcome with brand pitch
- **Layout:**
  - Top half: 9 floating 3D emoji stickers (AC unit, truck, hammer, house, hard hat, woman selfie, barriers, wrench, building) in scattered grid
  - Bottom half: H1 "Welcome to VXO" (centered, brand blue), body subtitle, 3 pagination dots (first active), full-width primary CTA "Get Started"
- **Components:** PaginationDots (3 dots, blue active), PrimaryButton
- **Icons:** None (emoji are PNG assets — needs separate sourcing or 3D emoji library)
- **Colors:** Title `#246bfd`, body `#212121`, dots active `#246bfd` / inactive `#e0e0e0`

#### `3-light-lets-you-in.png` — Auth method picker

- **Purpose:** Choose auth provider before email flow
- **Layout:** Back arrow top-left → illustration of 2 people chatting → "Let's you in" h1 → 3 social buttons (Facebook, Google, Apple) → "or" divider → primary "Sign in with Email" → "Don't have an account? Sign up" link
- **Components:** SocialButton (outlined, ~64px tall, brand-colored icon + label), PrimaryButton, TextLink
- **Icons:** `light-outline-arrow-left.svg` (back), brand icons (FB blue, Google G, Apple logo — use real brand SVGs not Lucide)
- **Illustration:** Custom blob illustration — needs to be exported separately or replaced

### 4.2 Sign-in flow (existing user)

#### `4-light-sign-in-blank-form.png` — Sign-in empty state
- VXO logo small → "Login to Your Account" → email field with US flag dropdown + placeholder → unchecked "Remember me" → primary "Sign in"
- **Icons:** `light-outline-arrow-left.svg` (back), `arrow-down-2.svg` (flag dropdown)
- **Note:** Field has flag prefix — suggests this might be a phone-number flow, but placeholder says "fistlast@gmail.com" so it's email. Designer used a generic phone-input pattern.

#### `5-light-sign-in-type-form.png` — Sign-in typing
- Same as 4, but field has focus state (`#246bfd` border, light tint background `#e9f0ff`), iOS keyboard visible
- **State transition:** focused input + soft keyboard pushes up

#### `6-light-sign-in-filled-form.png` — Sign-in filled
- Same, but "Remember me" is **checked** (filled blue checkbox), field shows just "email" (post-submit placeholder?)

### 4.3 Sign-up flow (new user)

#### `7-light-sign-up-blank-form.png` — Sign-up empty
- "Create New Account" h1, email field, unchecked Remember me, "Sign up" primary, "Already have an account? Sign in"

#### `8-light-sign-up-type-form.png` — Sign-up typing
- Active state (blue border on email field)

#### `10-light-otp-code-verification-type-form.png` — OTP typing
- Header with back + "OTP Code Verification" title (h2)
- "Code has been send to + Email" subtitle
- 4 OTP boxes (1st filled `7`, 2nd active with `4` and blue border, others empty)
- "Resend code in 55s" (countdown — last number in brand blue)
- "Verify" primary button, numeric keyboard visible

#### `11-light-otp-code-verification-filled-form.png` — OTP filled
- All 4 boxes filled: `7 4 5 8`, no active state (all completed)
- Subtitle shows phone format: "Code has been send to +1 111 ******99" (suggests SMS too — flow supports both?)
- "Resend code in 53s", Verify button at bottom

### 4.4 Profile setup

#### `12-light-fill-your-profile-blank-form.png` — Profile blank
- "Fill Your Profile" h2, back arrow
- Avatar placeholder (~280px circle, gray icon) with **edit pencil chip** (blue square, white pencil)
- Fields (stacked): Full Name, Business Name, Trade & Services (with calendar icon — opens picker), Email (with chevron right — opens picker?), About (multiline), Upload COI (Optional), Upload W-9 (Optional)
- **Bottom sheet (visible)** — 3 colored circular chips:
  - Document (orange `#ff981f`) — `document.svg`
  - Camera (teal `#009689`) — `camera.svg`
  - Gallery (purple `#9d28ac`) — `image.svg`
- "Continue" primary button (sticky bottom)
- **Icons:** `light-outline-arrow-left.svg`, `edit-square.svg`, `curved-calendar.svg`, `document.svg`, `camera.svg`, `image.svg`

#### `13-light-fill-your-profile-filled-form.png` — Profile filled
- Same layout but with sample data:
  - Avatar photo: man with curly hair
  - Full Name: "Andrew Ainsley"
  - Business Name: "Andrew HVAC LLC"
  - Trade & Services: "HVAC"
  - Email: "andrew_ainsley@yourdomain.com"
  - About: "Always Available :)"
- No bottom sheet visible (it's a sheet that's been dismissed)

#### `16-light-account-setup-successful.png` — Setup success modal
- **Background screen (faded):** "Set Your Fingerprint" with body text and Skip/Continue buttons (this is the underlying screen 15 that didn't export separately)
- **Modal overlay (foreground):** White rounded card centered on screen
  - Large blue circle with person icon, decorative dots around it
  - "Congratulations!" h2 (blue `#246bfd`)
  - Body: "Your account is ready to use. You will be redirected to the Home page in a few seconds.."
  - Loading spinner at bottom (auto-redirect timer)
- **Pattern:** Use Modal / BottomSheet with backdrop. Auto-dismiss after ~3s.
- **Icons:** `light-outline-arrow-left.svg` (background screen)

### 4.5 Main app

#### `57-home-tab.png` — Home dashboard
- **Header:** Blue gradient (`#246bfd` → darker), VXO mascot + "VXO" wordmark left, `search.svg` + `more-circle.svg` right
- **Tab bar:** "Jobs" / "Home" (Home active — white underline)
- **Summary card:** "This Month: $5,000 earned · 12 jobs" with two stat columns "$3,000 Invoices Sent | $5,000 Completed"
- **Job list:**
  - Sun emoji + "Job #12345 · $225 · Paid ✅" + orange progress bar (full)
  - Sun emoji + "Job #12345 · $225 · Paid ✅" + orange progress bar (full)
  - Umbrella emoji + "Job #12345 · $225 · Pending ⌛" + purple progress bar (half)
- **Promo banner (bottom):** Purple gradient "Learn More VXO Oppertunities" with crown emoji avatar
- **Icons:** `search.svg`, `more-circle.svg`

#### `17-first-time-login.png` — VXO Support / FAQ list
- Same blue header pattern: back arrow + "VXO Support" + search + more
- 2 list items, each with:
  - Large blue circle icon (group/add-user)
  - Title text
  - Right-aligned chat bubble FAB (blue circle, white chat icon)
- Items: "Current Job Support" (`curved-3-user.svg`), "General Q & A" (`add-user.svg`)
- **Icons:** `light-outline-arrow-left.svg`, `search.svg`, `more-circle.svg`, `curved-3-user.svg`, `add-user.svg`, `curved-message.svg` (chat FABs)

#### `19-light-select-contact-to-chat.png` — Chats list
- Blue header: VXO mascot + "VXO" + search + more
- Tab strip: "Chats (1)" (active) / "Status"
- List items of Work Order chats: `WO# 12345 - HVAC`, `WO# 12345 - Plumbing` with last-message preview, status colors (urgent red, completed green, this-week amber), unread badges
- **Icons:** `search.svg`, `more-circle.svg`

#### `65-light-home-more-menu-option.png` — More menu popover (same screen + dropdown)
- Same as 19 but with dropdown popover open in top-right showing 4 menu items:
  - Contact VXO (`curved-3-user.svg`)
  - Profile (Lucide `User`)
  - Stripe (custom Stripe S logo)
  - Settings (`curved-setting.svg`)
- Floating chat FAB bottom-right (`curved-message.svg`)
- **Pattern:** Implement as Popover/Menu — positioned absolutely below the more icon. Backdrop click to close.

#### `20-light-chat-details.png` / `20-completed-job-thread-id.png` — Chat detail (job thread)
*(These two PNGs appear identical — both render the same `20_Completed Job Thread / ID` frame at different times.)*

- **Header:** Blue gradient with back arrow + "WO# 12345" + `call.svg` (phone) + more
- **Chat thread:** System message bubbles (white card style with shadow) interleaved with user/blue bubbles. Content blocks:
  - Today timestamp pill
  - Metadata pill: "4 Hour - 2.5 Miles Away"
  - Location card with pin emoji + address
  - Work Order card with WO#, trade type, time window, NTE (Not To Exceed) price, notes
  - Emergency SLA card (`curved-danger-square.svg` orange flag)
  - Accept (green) / Reject (red with X) action buttons
  - Blue acceptance confirmation bubble
  - Action grid: Get Directions, Invoice Client, Send Quote, Questions/Contact Client (each as list-style button with emoji)
  - More automated system messages
  - Check Out timestamp
- **Composer (bottom):** Text input "Type a message...", attach (`curved-image-2.svg`), camera (`camera.svg`), voice (`voice.svg` — blue circular)
- **Icons:** `light-outline-arrow-left.svg`, `call.svg`, `more-circle.svg`, `curved-danger-square.svg`, `voice.svg`, `camera.svg`, `curved-image-2.svg`
- **Critical pattern:** This is a chat UI with **structured cards as system messages**, not just text. Each card is a custom component (LocationCard, WorkOrderCard, SLACard, ActionGrid).

#### `29-light-personal-contact-details.png` — Contact / Client profile
- **Header:** Blue gradient with back + `call.svg` (top-right)
- **Profile card:** Large circular photo, "Tyler Stack" name (h2), "+1-300-555-0136" (phone, brand blue)
- **Status:** "Always available, just contact me 😊" + date "December 12, 2024"
- **Stats list:**
  - User icon + "150 Jobs Completed" + count "269" + `arrow-right-2.svg`
  - Group icon + "rporcaro@vxoservices.com" + count "8" + `arrow-right-2.svg`
- **Icons:** `light-outline-arrow-left.svg` (back), `call.svg`, user icons, `arrow-right-2.svg`

### 4.6 Notes on duplicates / oddities

- **`17-first-time-login.png` was overwritten** — in the Figma file two different frames have the identical name `17_FIrst Time Login` (one at id `4:10155`, one at `4:10164`). The export script overwrote the first PNG with the second. To get both, run the icons script again with the dedup-by-id branch (see "Open issues" below).
- **`20-light-chat-details.png` ≈ `20-completed-job-thread-id.png`** — both PNGs render the same source frame. The Figma file has the screen duplicated under two names (#20 has been used for both `light chat details` and `Completed Job Thread / ID`).
- The "VXO" wordmark and the mascot face badge (smile-with-dot eyes top-left of headers) are **custom brand assets** — not in `icons/`. Need to be exported as separate PNG/SVG or recreated.

---

## 5. User flow (suggested implementation order)

```
[1 Splash] → (auth-check)
   ├─ unauth → [2 Welcome] → [3 Let's you in]
   │                              ├─ Email → [4-5-6 Sign in] ──┐
   │                              └─ Sign up → [7-8 Sign up] → [10-11 OTP]
   │                                                                  ↓
   │                                                            [12-13 Fill Profile]
   │                                                                  ↓
   │                                                            [15 Set Fingerprint] → [16 Success modal]
   │                                                                                          ↓
   └─ authed ──────────────────────────────────────────────────────────────────────────→ [57 Home]
                                                                                              ↕
                                  ┌─────────────────────────────────────────────────────────┤
                                  ↓                                ↓                          ↓
                          [Jobs tab]                       [19 Chats list] ←→ [65 + menu]
                                  ↓                                ↓
                            [20 Chat detail (job thread)]   [17 VXO Support]
                                  ↓
                            [29 Client contact details]
```

Build order (each depends only on earlier ones):

1. Theme setup — colors + typography + shadows from `tokens/` into `src/theme/`
2. Primitive components — `<Button>`, `<TextInput>`, `<Checkbox>`, `<Icon>`, `<Avatar>`, `<Card>`
3. Splash + Welcome (1, 2) — verifies theme + image rendering
4. Lets-you-in (3) — adds SocialButton variant
5. Sign-in + Sign-up forms (4–8) — adds `react-hook-form` + `zod` validation
6. OTP screen (10–11) — adds OTPInput component
7. Fill Your Profile (12–13) — adds upload bottom sheet + file picker (`expo-image-picker` already installed)
8. Setup success modal (16) — adds Modal component
9. Home tab (57) — adds tabbed header + job list card
10. Chats list (19, 65) — adds chat-list row, popover menu
11. Chat detail (20) — biggest screen, builds on existing primitives + 4-5 specialized message cards
12. Client contact details (29) — relatively simple, depends on Avatar + list

---

## 6. Prompt template for asking an AI to build a screen

Use this when asking another AI (or me in a fresh session) to implement a screen.
Fill in the `[brackets]`. Include the manifest entry from this doc.

### Template

```
I'm building the VXO Vendor App — a React Native (Expo 54, expo-router) app for service contractors. The design lives in `vxo-vendor-app/assets/figma-refs/`. Theme tokens are in `assets/figma-refs/tokens/tokens.ts`.

**Task:** Implement the [SCREEN NAME] screen.

**Reference:**
- Visual: `assets/figma-refs/[FILENAME].png` — open and read this image first
- Design spec for this screen: see `assets/figma-refs/DESIGN.md` section 4.X (paste the relevant section inline so you don't need to grep)

**Tech constraints:**
- React Native 0.81, Expo 54, expo-router 6 (file-based routing under `app/`)
- TypeScript strict
- Use `lucide-react-native` for icons not present in `assets/figma-refs/icons/`
- Forms: `react-hook-form` + `zod` (both already installed)
- State: Zustand for client state, TanStack Query for server (both installed)
- Auth: Supabase (`@supabase/supabase-js` installed; client at `src/lib/supabase.ts` if exists)
- SafeAreaView + react-native-safe-area-context — wrap the screen
- Font family: `Urbanist` — load via `expo-font`. Sizes per tokens.ts (`display`, `h1`, etc.)

**Acceptance criteria:**
1. Visual fidelity: matches the PNG within tolerance (spacing ±4px, colors exact from tokens)
2. All interactive elements have proper hit areas (≥44px)
3. Loading + empty + error states are handled where applicable
4. Form validation uses zod schema
5. Screen file lives at `app/[route].tsx` (e.g. `app/auth/sign-in.tsx`)
6. Pure presentational components extracted to `src/components/`
7. No `any` types; no inline color hex (use theme constants)

**Specifically for this screen:**
- Icons needed: [list from DESIGN.md section 4.X]
- Colors used: [list from DESIGN.md section 4.X]
- Navigation: where does back-arrow go? what happens on primary button submit?
- State: [is this form/list/static?]

**Out of scope (don't do these):**
- Don't build other screens
- Don't refactor existing code in `app/` or `src/` unless directly required
- Don't add new dependencies without asking
- Don't implement actual API calls — stub server interactions and add `// TODO: wire up to Supabase`

When done, report:
- Files created/modified
- How to test (route to navigate to, what to click)
- Any deviations from the design and why
```

### Example filled-in for the splash screen

```
**Task:** Implement the Splash screen.

**Reference:**
- Visual: `assets/figma-refs/1-light-splash-screen.png`
- Design spec: see DESIGN.md §4.1 — "Splash"

**Specifically for this screen:**
- Icons needed: None
- Assets needed: VXO wordmark logo (custom brand asset — not in icons/, may need to be recreated as SVG or asked separately)
- Colors used: brand-dark `#003290` (logo), brand-primary `#246bfd` (decoration circles), background `#ffffff`
- Navigation: When auth state resolves (≥ 1.5s elapsed), navigate to Welcome (unauth) or Home (auth)
- State: Reads auth session from Zustand store / Supabase getSession()

**Out of scope:**
- Don't build the actual auth check — use a `setTimeout(1500)` placeholder and add TODO
```

---

## 7. Open issues / known gaps

- **2 icons missed by name collision** in the export script — re-running with id-based filenames would recover both `17_FIrst Time Login` variants and the duplicate `20_*` screens.
- **20 of ~42 Iconly icons failed to export** due to free-tier API limits. Map them to Lucide RN (table in §3).
- **3D emoji stickers** on screen 2 (Welcome) — these are stock 3D emoji art (likely Microsoft Fluent or similar). Need to be sourced/replaced separately. Options: `unicode-emoji`, `emoji-mart`, or download from openmoji.org.
- **VXO wordmark + mascot** — custom brand assets not in any folder. Need to be exported manually from Figma (right-click → Export → SVG) or recreated.
- **Custom illustrations** — screen 3 (people chatting) and screen 16 (blue circle avatar with dots) are unique illustrations. Source separately.
- **Country / phone-number flag dropdown** — implies international phone support. Consider `react-native-country-codes-picker` or similar.
- **Stripe icon** — needs to be Stripe's official brand SVG, not Lucide.

---

*This document is auto-generated reference. To refresh:
re-run `npm run figma:screens && npm run figma:icons && npm run figma:tokens`
(when Figma free-tier API quota allows), then manually update DESIGN.md
sections that depend on visual inspection.*
