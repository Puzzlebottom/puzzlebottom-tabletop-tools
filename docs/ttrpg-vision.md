# Puzzlebottom's Tabletop Tools Suite — Vision & Open Questions

This document captures the product vision and open questions for the TTRPG tools suite. Update answers as decisions are made.

## Confirmed Vision (Summary)

| Aspect               | Decision                                                                             |
| -------------------- | ------------------------------------------------------------------------------------ |
| **Project name**     | Puzzlebottom's Tabletop Tools Suite                                                  |
| **First tool**       | Dice roller                                                                          |
| **Player interface** | Cross-platform: web + iOS + Android (future)                                         |
| **Dice animation**   | 3D animated; simple at first, fancier later                                          |
| **Roll types**       | Ad hoc (player-initiated) + GM-assigned (skill checks, saves, initiative, etc.)      |
| **GM controls**      | Assign rolls to any/all players; set DC, advantage, modifiers; toggle private/public |
| **Visibility**       | Player roll results public to play group by default; GM can make private             |
| **Ruleset**          | 5e D&D first; extensible for other rulesets                                          |
| **Architecture**     | Modular—additional tools added with focus on modularization                          |

---

## Open Questions (By Category)

Update each **Answer** line when a decision is made. **Priority:** MVP = must answer before dice roller MVP; Defer = can wait for later phases.

### Product & Scope

1. **Play group model** — Is a "play group" always tied to a campaign, or can players form groups without a campaign (e.g. one-shot sessions)?
   - **Priority:** Defer (needed for GM-assigned rolls; not for ad hoc MVP)
   - **Answer:** _TBD_

2. **GM interface** — Will the GM use the web app only, or will GMs also need a mobile interface?
   - **Priority:** Defer
   - **Answer:** _TBD_

3. **Offline support** — Do players need to roll dice offline (e.g. poor connectivity at the table) and sync later, or is online-only acceptable?
   - **Priority:** Defer
   - **Answer:** _TBD_

4. **Session vs campaign** — Is a "session" always part of a campaign, or can there be standalone sessions?
   - **Priority:** Defer
   - **Answer:** _TBD_

5. **Tool composition** — Will tools be presented as one unified app (tabs/sections) or as separate deployables that share auth and data?
   - **Priority:** Defer (single tool for MVP)
   - **Answer:** _TBD_

---

### Cross-Platform Strategy

6. **Mobile framework** — React Native, Flutter, or native (Swift/Kotlin)? Consider code reuse with web, team skills, and 3D rendering needs.
   - **Priority:** Defer (mobile is Phase 2)
   - **Answer:** _TBD_

7. **Shared logic** — How much should be shared between web and native? (e.g. roll logic, ruleset config, API client)
   - **Priority:** Defer
   - **Answer:** _TBD_

8. **Mobile timeline** — Is mobile a Phase 2 after web dice roller ships, or should architecture decisions account for mobile from day one?
   - **Priority:** Defer
   - **Answer:** _TBD_

9. **3D on mobile** — Same 3D stack (e.g. Three.js/Babylon) on web and native, or different approaches per platform?
   - **Priority:** Defer
   - **Answer:** _TBD_

---

### Dice Roller — Behavior

10. **Dice notation** — Support full notation (e.g. `2d6+3`, `4d6kh3`) or curated presets only (d20, 2d6, etc.)?
    - **Priority:** MVP
    - **Answer:** _TBD_

11. **GM-assigned roll flow** — Does the GM "push" a roll request to player devices (real-time), or do players poll/refresh to see assigned rolls?
    - **Priority:** Defer (GM-assigned is Phase 2)
    - **Answer:** _TBD_

12. **Initiative** — Is initiative a special roll type (d20 + Dex mod) that auto-orders, or does the GM manually order results?
    - **Priority:** Defer
    - **Answer:** _TBD_

13. **Roll modifiers** — Beyond advantage/disadvantage and DC: proficiency, inspiration, bless, guidance? How configurable per ruleset?
    - **Priority:** MVP (at least advantage/disadvantage + flat modifier for 5e)
    - **Answer:** _TBD_

14. **Roll context** — Do rolls link to a character (for auto-modifiers) or are they standalone with manual modifier entry?
    - **Priority:** MVP (standalone simplifies MVP; character linking can be Phase 2)
    - **Answer:** _TBD_

15. **Roll history** — How long is history retained? Per session, per campaign, or user-level? Can GM/players export or search?
    - **Priority:** MVP (affects whether we persist rolls and how)
    - **Answer:** _TBD_

---

### Dice Roller — Real-Time & Visibility

16. **Update latency** — How fast must roll results appear to other players? AppSync subscriptions (real-time) vs polling?
    - **Priority:** Defer for ad hoc MVP (single user); MVP when adding shared/group rolls
    - **Answer:** _TBD_

17. **Private rolls** — When GM toggles private: hidden from all players, or hidden from some (e.g. only GM sees)?
    - **Priority:** Defer
    - **Answer:** _TBD_

18. **Roll assignment visibility** — When GM assigns a roll, do all players see the assignment, or only the target player(s)?
    - **Priority:** Defer
    - **Answer:** _TBD_

---

### Ruleset Extensibility

19. **5e scope** — Which 5e elements are predefined: skills (18), saves (6), ability checks, attack rolls, death saves? All or subset?
    - **Priority:** MVP (defines which presets to build)
    - **Answer:** _TBD_

20. **Ruleset config format** — How are rulesets defined: JSON/YAML config, code, or both? Who can add rulesets (you only vs community)?
    - **Priority:** Defer (5e hardcoded for MVP)
    - **Answer:** _TBD_

21. **Other rulesets** — Which are in scope (Pathfinder 2e, OSR, custom)? Timeline for first non-5e ruleset?
    - **Priority:** Defer
    - **Answer:** _TBD_

22. **Modifier sources** — Do modifiers come from character sheet data (e.g. STR +3) or are they always manually entered at roll time?
    - **Priority:** MVP (manual for MVP; character-sheet-driven is Phase 2)
    - **Answer:** _TBD_

---

### 3D Dice Animation

23. **3D engine** — Three.js, Babylon.js, or other? Consider bundle size, mobile performance, and animation capabilities.
    - **Priority:** MVP
    - **Answer:** _TBD_

24. **Simplicity vs fancy** — For "simple at first": 2D sprites, basic 3D cubes, or low-poly 3D? What defines "fancier" later (physics, materials, sound)?
    - **Priority:** MVP
    - **Answer:** _TBD_

25. **Performance targets** — Lowest supported device? 60fps on mid-range phones, or 30fps acceptable?
    - **Priority:** Defer (web-first MVP; can use reasonable defaults)
    - **Answer:** _TBD_

26. **Dice customization** — Will players/GMs be able to choose dice appearance (color, style) or is one default sufficient initially?
    - **Priority:** Defer
    - **Answer:** _TBD_

---

### Modularization & Architecture

27. **Monorepo structure** — Per-tool packages (e.g. `packages/dice-roller`, `packages/character-sheet`)? Shared packages (`shared/roll-logic`, `shared/rulesets`)?
    - **Priority:** Defer (incremental; single tool for MVP)
    - **Answer:** _TBD_

28. **Backend organization** — One GraphQL API with tool-specific types/resolvers, or separate APIs per tool? How does this affect AppSync schema growth?
    - **Priority:** Defer (use existing AppSync for MVP)
    - **Answer:** _TBD_

29. **Frontend modularization** — Per-tool route bundles, lazy-loaded? Or each tool as a separate app entry?
    - **Priority:** Defer
    - **Answer:** _TBD_

30. **Shared domain** — What entities are shared across tools (User, PlayGroup, Campaign, Session, Character)? Defined in `shared/schemas`?
    - **Priority:** Defer (minimal for MVP: User, Roll)
    - **Answer:** _TBD_

31. **Tool dependencies** — Can the dice roller exist without campaigns/characters, or does it assume those exist? (Affects MVP scope.)
    - **Priority:** MVP (standalone enables simpler MVP)
    - **Answer:** _TBD_

---

### Data & Auth

32. **Play group membership** — How do players join: invite link, code, GM-add? Is there a "join request" flow?
    - **Priority:** Defer
    - **Answer:** _TBD_

33. **GM designation** — One GM per campaign/group, or multiple? Can GM role be transferred?
    - **Priority:** Defer
    - **Answer:** _TBD_

34. **Character linking** — Do rolls optionally attach to a character for audit/history? Required for GM-assigned rolls?
    - **Priority:** Defer
    - **Answer:** _TBD_

35. **Cognito scope** — Keep Cognito for auth, or consider migration for mobile (e.g. social login, Apple Sign-In)?
    - **Priority:** Defer (keep Cognito for MVP)
    - **Answer:** _TBD_

---

### Infrastructure & Deployment

36. **EventBridge/SQS** — Does the dice roller need the existing pipeline (submit → process → store), or is it more real-time (AppSync mutation + subscription only)?
    - **Priority:** MVP (determines architecture: pipeline vs direct AppSync)
    - **Answer:** _TBD_

37. **DynamoDB design** — How do rolls, play groups, campaigns, and sessions relate? Single table or multiple? GSI design for "rolls by session" etc.?
    - **Priority:** MVP (if storing rolls); Defer if roll history is Phase 2
    - **Answer:** _TBD_

38. **Sandbox strategy** — Do sandbox deploys still make sense for TTRPG development, or is a single dev/staging/prod sufficient?
    - **Priority:** Defer (existing sandbox works)
    - **Answer:** _TBD_

---

## MVP Question Summary (11 to answer first)

| #   | Question                                     |
| --- | -------------------------------------------- |
| 10  | Dice notation: presets vs full               |
| 13  | Roll modifiers: advantage + DC minimum       |
| 14  | Roll context: standalone vs character-linked |
| 15  | Roll history: store or not, retention        |
| 19  | 5e scope: which presets                      |
| 22  | Modifier sources: manual for MVP             |
| 23  | 3D engine: Three.js vs Babylon vs other      |
| 24  | Simplicity: 2D vs basic 3D vs low-poly       |
| 31  | Tool dependencies: standalone for MVP        |
| 36  | EventBridge/SQS vs AppSync-only              |
| 37  | DynamoDB design (if storing rolls)           |

---

## Suggested Next Steps (When Ready)

1. **Answer MVP questions** — Resolve the 11 MVP-priority questions above to unblock implementation.
2. **Rebrand** — Update project name to Puzzlebottom's Tabletop Tools Suite (per existing plan todo).
3. **Dice roller MVP scope** — Define minimal feature set (e.g. web-only, ad hoc rolls, 5e presets, no GM assignment yet) to unblock implementation.
