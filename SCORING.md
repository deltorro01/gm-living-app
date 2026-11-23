# How the match score works

This document describes how each area's match score is calculated in `src/App.jsx`. Any change to these rules changes the rankings, so it should be agreed and tested before it is made (see "Change history" at the end).

## Overview

Each area gets a score from 0 to 100. Areas are sorted from highest to lowest score. If two areas have the same score, the one with the shorter commute to Manchester city centre (`commuteCityMinutes`) ranks higher.

The final score is a weighted total of these parts:

| Part | Weight |
|---|---|
| Affordability | 18% |
| Life-stage fit | 32% |
| Commute | 11% |
| Safety | 8% |
| Nightlife | 7% |
| Green space | 7% |
| Value for money | 7% |
| Schools | 6% |
| Cycling | 4% |

The weights add up to 100%. A tram or train requirement can then add or subtract points (see "Non-negotiable requirements" below).

## Lifestyle sliders: how a rating is matched

Each lifestyle slider (1 to 5) is compared with the area's rating for that category (1 to 5). There are two rules.

**Meets or beats** (green space, value for money, schools, safety, cycling): the slider is treated as "at least this good".

- An area rated at or above the slider scores 100.
- Each point below the slider loses 22: **Match = 100 − (22 × shortfall)**, limited to 0 to 100. One point short scores 78, two 56, three 34, four 12.
- For example, with green space set to 3, areas rated 3, 4 and 5 all score 100, and an area rated 2 scores 78.

**Closest match** (nightlife only): the slider is treated as "about this much".

- **Match = 100 − (22 × difference)**, limited to 0 to 100, where the difference can be above or below the slider.
- This keeps a low nightlife setting meaningful: someone who sets it to 1 prefers quieter areas, and an area rated 5 for nightlife scores 12.

## Affordability

The area's average cost is divided by the user's budget:

| Cost as a share of budget | Score |
|---|---|
| 100% or less (within budget) | 100 |
| 100% to 110% | 78 |
| 110% to 120% | 55 |
| 120% to 135% | 30 |
| Over 135% | 8 |

If the budget is zero or missing, the score is 50.

## Commute

The score depends on the commute preference the user chooses:

- **Manchester city centre:** 10 minutes or less = 100, up to 20 minutes = 85, up to 30 minutes = 65, up to 40 minutes = 40, over 40 minutes = 18.
- **Hybrid:** a blend of value (35%), green space (25%), cycling (10%) and commute time (30%). Unlike the sliders, these use the area's raw rating, not a match against a slider setting. The commute part gives 85 up to 20 minutes, 65 up to 30 minutes, 45 up to 40 minutes, and 25 beyond that.
- **Work from home:** a blend of green space (40%), quietness (40%) and commute time (20%). The commute part gives 70 up to 25 minutes, 55 up to 35 minutes, and 35 beyond that.

## Life-stage fit

The life-stage score combines the other parts using different weights for each stage:

- **Young professional:** nightlife 30%, cafés 20%, culture 18%, commute 15%, safety 10%, value 7%.
- **Family:** schools 26%, safety 24%, green space 18%, quietness 18%, commute 8%, affordability 6%.
- **First-time buyer:** affordability 28%, value 24%, safety 20%, commute 14%, cafés 7%, green space 7%.
- **Downsizer:** quietness 28%, safety 24%, green space 20%, affordability 12%, commute 8%, schools 8%.

## Non-negotiable requirements

- **Tram access needed:** +5 if the area has tram access, −10 if it doesn't.
- **Train access needed:** +5 if the area has train access, −10 if it doesn't.

These are the only non-negotiables currently implemented.

## Known limitations

- The weights, life-stage mixes and commute bands are fixed in the code and have not been validated against real data.
- Only tram and train are treated as non-negotiable requirements.
- The Hybrid and Work from home commute options use raw ratings rather than the sliders.

Any change to these rules will change existing rankings, so it should be agreed and tested before it is made.

## Change history

- **November 2026:** green space, value for money, schools, safety and cycling changed from "closest match" to "meets or beats". Affordability changed so that any area within budget scores 100; previously areas at 75% of budget or less scored 78 and those at 75% to 90% scored 90. The weights did not change.
