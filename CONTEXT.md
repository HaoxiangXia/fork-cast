# 吃什么 (Fork-Cast)

A zero-tagging meal decision engine that matches unstructured cravings against a personal candidate pool using calibrated choice probabilities.

## Language

**Candidate**:
A distinct food item or dining option available in the user's rotation.
_Avoid_: Dish, meal, food, item

**Candidate Pool**:
The finite set of all candidates configured by the user, strictly capped at a maximum of 36 items to bound System 1 primitive evaluation.
_Avoid_: Menu, candidate list, options, food list

**Craving**:
The raw, unstructured natural language text expressing the user's current physical state, constraints, mood, or appetite.
_Avoid_: Query, prompt, state, condition, preference

**Verdict**:
The final system resolution for a craving, categorized by probability distribution characteristics.
_Avoid_: Result, answer, output, recommendation

**System 1 Decision Model**:
A structured, non-generative probability engine (such as TypeSafe Jev or Liquid AI D1) that evaluates atomic primitives concurrently against state without conversational text generation.
_Avoid_: LLM, chat model, generative AI, classifier, text generator

**Decisive Pick**:
A verdict produced when one candidate dominates with high confidence and a clear margin.
_Avoid_: Direct pick, winner, recommendation, best choice

**Dilemma Duel**:
A single-shot, non-repeatable tie-breaker verdict between two or three top candidates tied closely in probability.
_Avoid_: Roulette, coin toss, two-choice, tie, re-spin

**Impasse**:
A verdict produced when the craving is contradictory, impossible, or rejected by all candidates, including when cascade revocations exhaust the entire candidate pool.
_Avoid_: Deadlock, rejection, failure, error

**Indifference**:
A verdict produced when the user expresses total apathy with no specific food preference, triggering or recommending a Blind Box pick.
_Avoid_: Random, whatever, any

**State Context**:
The dynamic operational context (such as time of day, recent history within the suppression window, and exclusions) bundled with the craving into the System 1 Decision Model's evaluation state.
_Avoid_: Prompt context, extra info, metadata

**Suppression Window**:
The configurable time horizon (in hours) defining which recorded history entries are active for cumulative fatigue dampening in state context. Multiple occurrences of the same candidate within the window compound the suppression penalty, but soft dampening guarantees graceful degradation without causing an Impasse even under total candidate pool saturation.
_Avoid_: Lookback window, history window, time limit, TTL

**Free Quota**:
The unified daily allowance (10 evaluations per client calendar day across all models combined) of shared server-funded compute granted before personal credentials are required. Device identity is strictly node-local to the browser instance and never roams across backup migrations.
_Avoid_: Per-model quota, free tier, free trial, rate limit, tokens

**BYOK (Bring Your Own Key)**:
The operational mode where user-supplied model credentials supersede server compute. BYOK failures are isolated and strictly fatal, never silently falling back to deplete the shared Free Quota.
_Avoid_: Custom key, private API, user credentials, fallback mode



**Blind Box**:
A re-rollable, non-deterministic selection mechanism that samples uniformly at random from the candidate pool, exempt from History.
_Avoid_: Random pick, mystery box, lottery, draw

**History**:
The chronological log of implicitly recorded Decisive Picks and settled Dilemma Duels injected into state context, excluding Blind Box selections.
_Avoid_: Past meals, meal log, memory, cache
**Revocation**:
The explicit rollback of strictly the most recent auto-logged entry from History upon user rejection (leaving prior occurrences within the Suppression Window intact), which restores the craving input and places the candidate into Session Exclusion.
_Avoid_: Undo, delete, remove, cancel


**Session Exclusion**:
A transient candidate exclusion active only during the immediate decision turn, applied when a verdict is revoked.
_Avoid_: Blacklist, blocklist, ignored list
