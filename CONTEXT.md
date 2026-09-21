# 吃了吗 (Fork-Cast)

A zero-tagging meal decision engine that matches unstructured cravings against a personal candidate pool using calibrated choice probabilities.

## Language

**Candidate**:
A distinct food item or dining option available in the user's rotation.
_Avoid_: Dish, meal, food, item

**Candidate Pool**:
The finite set of all candidates configured by the user.
_Avoid_: Menu, candidate list, options, food list

**Craving**:
The raw, unstructured natural language text expressing the user's current physical state, constraints, mood, or appetite.
_Avoid_: Query, prompt, state, condition, preference

**Verdict**:
The final system resolution for a craving, categorized by probability distribution characteristics.
_Avoid_: Result, answer, output, recommendation

**Jev**:
The System 1 structured decision model evaluating atomic questions concurrently against state.
_Avoid_: LLM, AI, model, classifier

**Decisive Pick**:
A verdict produced when one candidate dominates with high confidence and a clear margin.
_Avoid_: Direct pick, winner, recommendation, best choice

**Dilemma Duel**:
A single-shot, non-repeatable tie-breaker verdict between two or three top candidates tied closely in probability.
_Avoid_: Roulette, coin toss, two-choice, tie, re-spin

**Impasse**:
A verdict produced when the craving is contradictory, impossible, or rejected by all candidates.
_Avoid_: Deadlock, rejection, failure, error

**Indifference**:
A verdict produced when the user expresses total apathy with no specific food preference, triggering or recommending a Blind Box pick.
_Avoid_: Random, whatever, any

**State Context**:
The dynamic operational context (such as time of day and recent meal history) bundled with the craving into Jev's evaluation state.
_Avoid_: Prompt context, extra info, metadata

**Blind Box**:
A re-rollable, non-deterministic selection mechanism that samples uniformly at random from the candidate pool, exempt from History.
_Avoid_: Random pick, mystery box, lottery, draw

**History**:
The chronological log of implicitly recorded Decisive Picks and settled Dilemma Duels injected into state context, excluding Blind Box selections.
_Avoid_: Past meals, meal log, memory, cache

**Revocation**:
The explicit rollback of the most recent auto-logged candidate from History upon user rejection, which restores the craving input and places the candidate into Session Exclusion.
_Avoid_: Undo, delete, remove, cancel

**Session Exclusion**:
A transient candidate exclusion active only during the immediate decision turn, applied when a verdict is revoked.
_Avoid_: Blacklist, blocklist, ignored list
