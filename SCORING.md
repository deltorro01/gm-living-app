# How the match score works

This document describes how each area's match score is calculated in `src/App.jsx`. It reflects the current behaviour, which is deliberately kept as it is. The scoring is a known area for future improvement (see the end of this document).

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

Each lifestyle slider (1 to 5) is compared with the area's rating for that category (1 to 5):

- **Match = 100 − (22 × difference)**, limited to the range 0 to 100.
- An exact match scores 100. A difference of 1 scores 78, 2 scores 56, 3 scores 34, and 4 or more scores 12 or less.

This means the score rewards areas whose rating is **close to** the slider setting, not areas with the highest rating. For example, if green space is set to 3, an area rated 5 scores lower than an area rated 3. This applies to nightlife, green space, value, schools, cycling and safety.

## Affordability

The area's average cost is divided by the user's budget:

| Cost as a share of budget | Score |
|---|---|
| 75% or less | 78 |
| 75% to 90% | 90 |
| 90% to 100% | 100 |
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

- The preference matching rewards closeness to the slider, as described above. A highly rated area can rank below an average one for a user who sets a lower slider value.
- The weights, life-stage mixes and commute bands are fixed in the code and have not been validated against real data.
- Only tram and train are treated as non-negotiable requirements.

Any change to these rules will change existing rankings, so it should be agreed and tested before it is made.
