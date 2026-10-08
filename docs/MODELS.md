# Choosing free models

CrossTalk only runs models that OpenRouter's own price list shows at **$0** for both prompt and completion. This guide doesn't name specific models, because the free list changes often. Pick from what's on offer the day you set it up.

## Pick two (three later, for Iris)

1. Open **openrouter.ai/models** and filter or sort by price so the free models show. You don't need to sign in to browse.
2. For each candidate, open its page and check:
   - **Pricing** shows $0 input and $0 output **and** the ID ends in `:free`. The app checks both. Some $0 models without `:free` still need purchased credits (OpenRouter answers "402 insufficient credits"), so the app blocks them.
   - It isn't restricted to approved apps. Some free models answer "403 only available on agentic harnesses"; skip those.
   - It isn't `openrouter/free` or another `openrouter/...` router: those pick a model for you, which CrossTalk never allows.
   - It's a **chat / text** model with a context window of at least 8K tokens.
   - It isn't marked deprecated or "going away".
   - Its **licence allows commercial use** if you plan to publish episodes (see `docs/PLAN.md`, Path to podcast).
3. Choose **two different models**, ideally from different companies, so the hosts sound different. The app refuses to run the same model in both seats.
4. Copy each model's **ID exactly** as OpenRouter shows it (it looks like `company/model-name`, often with `:free` on the end).

## Put them in the settings

| Setting | What goes in it |
| --- | --- |
| `PROVIDER_MODE` | `openrouter` |
| `OPENROUTER_API_KEY` | Your key from openrouter.ai → Keys. Never paste it into chat, code or an issue. |
| `SPEAKER_A_MODEL` | First model ID (left seat) |
| `SPEAKER_B_MODEL` | Second model ID (right seat) |
| `ARTIST_MODEL` | Leave empty until Milestone 5 |
| `ALLOW_PAID_MODELS` | Leave `false` |

On your own computer these go in a `.env` file in the repo folder (copy `.env.example`). In a Claude cloud session they go in the cloud environment's settings. Either way, restart the server afterwards.

## Check it worked

Open **Settings** in the app. Each model shows **✓ Free** or **✕** with the reason. **Check models again** re-reads OpenRouter's price list. If a model shows ✕, every run is blocked until you change it. The app never swaps in a different model on its own.

## Limits to know (checked Oct 2026)

- OpenRouter allows about **20 requests a minute** and **50 a day** on free models if you've never bought credits. One discussion uses 8 requests, plus any retries.
- The app stops itself at `MAX_REQUESTS_PER_DAY` (40 by default), so you stay under that.
- A negative credit balance can make even free models fail with a "402" error.
- Popular free models are often briefly busy ("rate limited"). The app waits 5 seconds and retries once; if it still fails, try again a few minutes later or pick a less busy model.
- Source: https://openrouter.ai/docs/limits
