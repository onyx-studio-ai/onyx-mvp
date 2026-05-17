# Website Messaging Clarity Guide

## Goal
- Make first-time visitors understand the business model in under 5 seconds.
- Remove ambiguity between "pure AI tool" and "human-directed production service."
- Keep the same service naming across zh-TW, zh-CN, and en.

## 1) Messaging Hierarchy (applies to all entry pages)
- **Line 1:** What we sell (voiceover, music production, live strings recording).
- **Line 2:** How we are different (AI generation + human direction).
- **Line 3:** What client receives (commercial-ready delivery, licensing, timeline).
- **CTA:** One clear next step (sample, pricing, order).

## 2) Priority Pages and Required Clarity
- `home.hero` (used on `/voice`): define core services before brand language.
- `music.landing` (used on `/music`): add "what you receive" blocks near first CTA.
- `orchestra.landing` (used on `/music/orchestra`): explicitly frame as service, not metaphor.
- `lobby` (used on `/`): one-line business definition before product cards.

## 3) Canonical Service Terms
- **Voice:** AI Voiceover / AI 配音 / AI 配音
- **Music:** AI Music Production / AI 音樂製作 / AI 音乐制作
- **Strings:** Live Strings Recording / 現場弦樂錄製 / 现场弦乐录制
- **Model difference:** AI generation + human direction, never "AI only" unless explicitly true.

## 4) 5-Second Comprehension Test
- Show only first screen of one page for 5 seconds.
- Ask:
  1) "What does this company sell?"
  2) "Is this AI-only or AI + human service?"
  3) "What should I click next if I want to buy?"
- Pass criteria:
  - >= 80% answer Q1 correctly
  - >= 80% answer Q2 correctly
  - >= 70% can pick correct CTA

## 5) Funnel Validation Metrics
- Home hero CTA CTR (`homeHeroCtaClick / homeHeroView`)
- Service page CTA CTR (`serviceCtaClick / servicePageView`)
- Service page -> order page rate (`orderEntry / servicePageView`)
- Optional qualitative metric: support tickets or chats asking "What exactly do you do?"

## 6) Copy QA Checklist Before Launch
- Same meaning across zh-TW / zh-CN / en (not literal-only translation).
- No abstract hero without explicit service statement.
- Every service entry page has one "service definition" statement above first fold.
- CTA labels describe action outcome (preview, pricing, start project).
