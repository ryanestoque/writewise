export interface StrokeStep {
  d: string;
  instruction: string;
  liftBefore?: true;
}

export interface LetterStrokes {
  upper: StrokeStep[];
  lower: StrokeStep[];
}

export const PAIRED_LETTER_OFFSETS = { upper: -45, lower: 35 } as const;

function step(d: string, instruction: string, liftBefore?: true): StrokeStep {
  return { d, instruction, liftBefore };
}

// Original centerlines based on Zaner-Bloser's formation charts (Practice Masters 58–60).
// https://media.zaner-bloser.com/handwriting/pdfs/ZB_HW_Cursive_Practice_Package.pdf#page=13
// Headline y=25, midline y=50, baseline y=75, descender line y=100.
// Numbered movements can share one pen stroke. Only liftBefore begins a separate stroke.
export const CURSIVE_STROKES_DATA: Record<string, LetterStrokes> = {
  A: {
    upper: [
      step(
        "M 211 25 C 195 25 181 42 178 60 C 173 85 192 78 211 25",
        "Start at the headline. Curve left and down to the baseline, then sweep back up to close the oval."
      ),
      step(
        "M 211 25 L 190 68 C 183 83 207 72 222 50",
        "Slant back down along the right side, then turn up from the baseline to the midline."
      ),
    ],
    lower: [
      step(
        "M 201 50 C 190 50 179 59 179 69 C 179 82 194 72 201 50",
        "Start at the midline. Curve left and down, round the bottom, and return to the start to close the oval."
      ),
      step(
        "M 201 50 L 191 70 C 186 81 204 73 219 50",
        "Slant down from the top of the oval and sweep up from the baseline toward the next letter."
      ),
    ],
  },
  B: {
    upper: [
      step(
        "M 173 50 C 184 46 199 36 205 25",
        "Start near the midline and sweep up to the headline."
      ),
      step("M 205 25 L 180 75", "Slant down to the baseline."),
      step(
        "M 180 75 L 205 25 C 230 20 235 49 210 51 C 199 52 199 44 207 46 C 221 49 219 76 197 75 C 187 74 185 67 187 61",
        "Retrace the stem. Round the top bowl, make a small turn at the middle, and round the lower bowl back toward the stem."
      ),
      step(
        "M 187 61 C 189 66 195 69 203 68",
        "Retrace the turn and finish with a short curve to the right."
      ),
    ],
    lower: [
      step(
        "M 172 75 C 186 73 205 53 210 33 C 215 19 205 24 201 33 L 184 68 C 176 85 197 72 206 50",
        "Sweep up from the baseline and loop at the headline. Slant down, round the bottom, and come back up to the midline."
      ),
      step(
        "M 206 50 C 209 55 216 55 223 48",
        "Dip slightly and flick back up to make the high join."
      ),
    ],
  },
  C: {
    upper: [
      step("M 213 25 L 208 35", "Start at the headline with a short slant down to the left."),
      step(
        "M 208 35 C 211 24 202 22 194 27 C 184 32 176 45 174 58 C 172 80 194 82 220 50",
        "Turn back up, sweep left around the open body, then curve up from the baseline to the midline."
      ),
    ],
    lower: [
      step(
        "M 198 59 C 202 53 199 49 194 50 C 185 51 179 62 181 69 C 183 81 199 75 216 50",
        "Start with a small hook near the midline. Curve left and down, leave the body open on the right, then sweep up from the baseline."
      ),
    ],
  },
  D: {
    upper: [
      step(
        "M 201 25 C 188 24 179 47 170 66 C 162 82 151 74 161 67 C 170 61 174 74 187 75 C 208 78 228 45 217 30 C 210 21 193 25 195 31 C 197 38 218 37 237 25",
        "Start at the headline and sweep down left. Make a small loop at the foot, round the large bowl to the headline, then turn through a small top loop and sweep right."
      ),
    ],
    lower: [
      step(
        "M 200 50 C 189 50 177 59 177 69 C 177 82 191 71 200 50 L 212 25",
        "Start at the midline. Round the oval, then continue up along its right side to the headline."
      ),
      step(
        "M 212 25 L 189 70 C 184 81 202 73 217 50",
        "Retrace down the tall stem, turn at the baseline, and sweep up."
      ),
    ],
  },
  E: {
    upper: [
      step("M 213 25 L 208 35", "Start at the headline with a short slant down to the left."),
      step(
        "M 208 35 C 210 23 199 23 192 28 C 182 36 180 48 191 52 C 198 54 198 48 190 47 C 179 45 170 57 175 67 C 181 81 202 76 222 50",
        "Curve back to form the small upper bowl. Loop through the middle, round the wider lower bowl, and sweep up from the baseline."
      ),
    ],
    lower: [
      step(
        "M 177 75 C 188 74 201 61 200 53 C 199 45 192 53 188 63 C 180 85 200 75 219 50",
        "Sweep up from the baseline into a small loop at the midline, then curve down and back up into the exit."
      ),
    ],
  },
  F: {
    upper: [
      step("M 185 25 L 181 32", "Begin at the headline with a short slant down to the left."),
      step("M 181 32 C 195 18 214 38 237 25", "Sweep right to make the wavy top bar."),
      step(
        "M 210 29 C 200 37 197 51 190 64 C 179 85 163 76 157 50",
        "Lift to the top bar. Curve down to the baseline and sweep back up to the left.",
        true
      ),
      step(
        "M 157 50 C 160 58 168 61 177 60",
        "Retrace the upper end of the hook, then curve a little to the right."
      ),
      step("M 186 50 L 207 50", "Lift and cross the stem from left to right at the midline.", true),
    ],
    lower: [
      step(
        "M 169 75 C 185 72 204 52 210 33 C 216 19 206 24 202 34 L 176 94 C 171 107 190 99 190 75",
        "Sweep up into a loop at the headline. Slant down past the baseline, then loop forward and back up to the baseline."
      ),
      step("M 190 75 C 200 74 213 65 223 50", "Continue up and right into the exit."),
    ],
  },
  G: {
    upper: [
      step(
        "M 163 75 C 181 63 203 45 206 32 C 209 19 195 25 191 36 C 184 57 206 60 225 40",
        "Sweep up from the baseline to loop at the headline. Round through the middle and curl up to the right."
      ),
      step(
        "M 225 40 C 203 58 209 75 190 75 C 177 75 170 64 169 50",
        "Curve down around the lower bowl, then turn up to the left."
      ),
      step(
        "M 169 50 C 172 58 181 61 189 60",
        "Retrace the upper end of the left hook, then flick right."
      ),
    ],
    lower: [
      step(
        "M 203 50 C 193 50 181 57 180 69 C 178 83 195 73 203 50",
        "Start at the midline. Curve left and down, round the bottom, and return to the top to close the oval."
      ),
      step(
        "M 203 50 L 184 92 C 178 106 169 99 177 90 C 185 82 200 67 224 50",
        "Slant down past the baseline, loop back to the left, and rise through the tail into the exit."
      ),
    ],
  },
  H: {
    upper: [
      step(
        "M 171 26 C 184 22 191 25 184 40 L 166 75",
        "Curve right near the headline, then slant down to the baseline."
      ),
      step(
        "M 226 26 C 213 21 206 35 202 46 L 187 75",
        "Lift to the right side of the headline. Hook left, then slant down to make the second stem.",
        true
      ),
      step(
        "M 187 75 L 197 55 C 198 50 193 49 185 51 C 171 54 178 71 194 63 C 205 59 211 54 214 50",
        "Retrace part of the second stem, loop left across the middle, and curve back out to the right."
      ),
    ],
    lower: [
      step(
        "M 170 75 C 185 72 207 48 210 33 C 214 20 205 24 201 34 L 181 75",
        "Sweep up from the baseline, loop at the headline, and slant back down to the baseline."
      ),
      step(
        "M 181 75 C 190 58 198 50 205 50 C 211 50 201 63 199 70 C 194 82 212 73 227 50",
        "Curve up over one hump. Slant down, round the bottom, and sweep up into the exit."
      ),
    ],
  },
  I: {
    upper: [
      step(
        "M 213 75 C 204 64 207 43 217 30 C 225 19 239 26 226 43 C 207 68 181 91 170 50",
        "Start near the baseline and arc up into a loop at the headline. Sweep down through the middle, round the bottom, and turn up to the left."
      ),
      step(
        "M 170 50 C 172 57 183 61 192 60",
        "Retrace the top of the hook, then curve right to finish."
      ),
    ],
    lower: [
      step("M 178 75 C 188 74 197 65 205 50", "Sweep up from the baseline to the midline."),
      step(
        "M 205 50 L 195 68 C 184 85 205 73 222 50",
        "Slant down, then sweep up out of the baseline turn."
      ),
      step("M 209 39 l 0.1 0", "Lift the pen and tap a dot above the stem.", true),
    ],
  },
  J: {
    upper: [
      step(
        "M 198 75 C 189 65 189 43 199 31 C 207 21 222 22 216 36 L 190 92 C 183 108 172 100 182 89 C 190 81 211 62 230 50",
        "Start near the baseline and arc back up into a tall loop. Slant below the baseline, loop left, and rise to the right across the tail."
      ),
    ],
    lower: [
      step("M 173 75 C 187 74 197 62 204 50", "Sweep up from the baseline to the midline."),
      step(
        "M 204 50 L 184 93 C 177 107 168 98 179 88 C 190 78 206 62 225 50",
        "Slant below the baseline, loop back to the left, then sweep right through the tail."
      ),
      step("M 209 38 l 0.1 0", "Lift the pen and tap a dot above the stem.", true),
    ],
  },
  K: {
    upper: [
      step(
        "M 168 26 C 181 22 189 26 181 41 L 165 75",
        "Curve forward at the headline and slant down to the baseline."
      ),
      step(
        "M 226 25 C 207 24 203 60 178 49",
        "Lift to the right at the headline. Sweep down and left until the curve touches the stem near the midline.",
        true
      ),
      step(
        "M 178 49 C 190 49 187 64 188 70 C 191 83 209 71 225 50",
        "Curve from the middle down to the baseline, then sweep up and right."
      ),
    ],
    lower: [
      step(
        "M 169 75 C 183 72 204 49 209 33 C 214 20 203 23 199 34 L 179 75",
        "Sweep up and loop at the headline, then slant down to the baseline."
      ),
      step(
        "M 179 75 C 189 56 195 49 205 50 C 217 52 215 64 196 62 L 189 61",
        "Curve up over the small arm of the k, then circle back toward the stem."
      ),
      step(
        "M 189 61 C 196 65 194 75 204 75 C 213 75 222 63 230 50",
        "Angle down to the baseline, then sweep up into the exit."
      ),
    ],
  },
  L: {
    upper: [
      step(
        "M 169 50 C 191 54 218 44 222 32 C 226 21 213 23 207 32 C 196 46 192 75 171 75 C 151 75 159 63 176 71 C 182 74 189 75 197 75 C 212 75 226 73 235 66",
        "Start at the midline and sweep up into a tall loop. Curve down left into a small loop at the baseline, then sweep right along the line and gently up."
      ),
    ],
    lower: [
      step(
        "M 175 75 C 190 72 208 48 214 33 C 219 20 208 24 203 34 L 186 68 C 177 84 199 75 217 50",
        "Sweep up from the baseline and loop at the headline. Slant back down, round the bottom, and sweep up."
      ),
    ],
  },
  M: {
    upper: [
      step(
        "M 153 27 C 162 22 178 23 175 37 L 163 75",
        "Curve right at the headline, then draw a gently slanted stem to the baseline."
      ),
      step(
        "M 163 75 C 169 55 176 25 187 25 C 200 25 193 46 185 75",
        "Curve up to the headline to form the first arch, then come back down to the baseline."
      ),
      step(
        "M 185 75 C 191 52 200 25 211 25 C 223 25 218 42 214 54 L 210 68 C 209 73 210 75 214 75 C 222 75 233 62 239 50",
        "Bring the second arch up to the headline too. Round the turn at the baseline and sweep up to the midline."
      ),
    ],
    lower: [
      step(
        "M 162 75 C 171 61 183 48 190 50 C 194 53 182 66 178 75",
        "From the baseline, arch up to the midline and slant back down."
      ),
      step(
        "M 178 75 C 186 62 198 49 205 50 C 209 52 198 66 194 75",
        "Arch over the second hump and slant back to the baseline."
      ),
      step(
        "M 194 75 C 201 62 212 49 219 50 C 224 51 213 64 210 70 C 205 82 223 73 239 50",
        "Arch over the last hump, turn at the baseline, and sweep up."
      ),
    ],
  },
  N: {
    upper: [
      step(
        "M 170 26 C 182 22 190 25 183 40 L 165 75",
        "Curve forward at the headline and slant down to the baseline."
      ),
      step(
        "M 165 75 C 178 49 189 29 200 33 C 207 35 191 60 189 68 C 181 84 204 74 224 50",
        "Curve up over the hump just below the headline. Slant down, round the bottom, and sweep up."
      ),
    ],
    lower: [
      step(
        "M 170 75 C 179 62 190 48 198 50 C 202 52 191 65 186 75",
        "From the baseline, arch up to the midline and slant back down."
      ),
      step(
        "M 186 75 C 194 62 205 48 213 50 C 217 52 206 65 203 70 C 197 81 214 76 230 50",
        "Arch up once more, turn at the baseline, and sweep up into the exit."
      ),
    ],
  },
  O: {
    upper: [
      step(
        "M 204 25 C 187 24 174 42 172 61 C 169 77 185 80 198 71 C 214 61 220 30 204 25 C 190 21 198 44 227 25",
        "Curve left and down from the headline. Round the oval back up, loop through its top, and sweep right."
      ),
    ],
    lower: [
      step(
        "M 201 50 C 187 48 179 60 180 70 C 183 84 202 70 202 57 C 202 51 199 50 196 51",
        "Start at the midline, round the oval left and down, and close it near the top."
      ),
      step(
        "M 196 51 C 200 55 209 56 218 48",
        "Curve gently right and back up to make a high join."
      ),
    ],
  },
  P: {
    upper: [
      step("M 174 50 C 186 46 195 36 202 25", "Sweep up from the midline to the headline."),
      step("M 202 25 L 179 75", "Slant down to the baseline."),
      step(
        "M 179 75 L 194 44 C 207 17 234 22 229 42 C 225 59 204 60 191 50",
        "Retrace the stem partway. Curve over the top and back around to the stem near the midline."
      ),
    ],
    lower: [
      step("M 169 75 C 182 74 195 61 203 50", "Sweep up from the baseline to the midline."),
      step(
        "M 203 50 L 180 94 C 173 108 164 96 181 82 C 195 69 199 50 210 50 C 222 50 220 63 213 70 C 207 76 196 77 188 73",
        "Slant below the baseline and loop back. Rise into a small oval on the right and curve back to the stem."
      ),
      step("M 188 73 C 197 78 210 75 230 50", "Turn at the baseline and sweep up to the right."),
    ],
  },
  Q: {
    upper: [
      step(
        "M 206 75 C 184 80 173 70 178 53 C 181 38 194 24 209 25 C 225 25 229 40 221 57 C 214 70 198 76 188 72 C 177 67 184 56 194 62 C 206 68 213 82 229 79",
        "Curve left from the baseline and rise around the oval. Return to the baseline, loop inward, and sweep the tail out to the right."
      ),
    ],
    lower: [
      step(
        "M 203 50 C 191 50 179 60 180 70 C 181 83 197 71 203 50",
        "Start at the midline. Round the oval left and down, then return to the top to close it."
      ),
      step(
        "M 203 50 L 184 93 C 177 107 197 100 191 75",
        "Slant below the baseline and loop forward, returning to the baseline on the right of the stem."
      ),
      step("M 191 75 C 201 75 213 65 225 50", "Sweep up and right from the baseline."),
    ],
  },
  R: {
    upper: [
      step("M 170 50 C 181 46 192 36 198 25", "Sweep up from the midline to the headline."),
      step("M 198 25 L 174 75", "Slant down to the baseline."),
      step(
        "M 174 75 L 190 42 C 203 17 231 23 224 43 C 220 55 200 55 186 50",
        "Retrace part of the stem. Round the bowl back to the stem at the midline."
      ),
      step(
        "M 186 50 C 199 48 189 73 200 75 C 210 77 222 65 233 50",
        "Curve from the middle down to the baseline, then sweep up and right."
      ),
    ],
    lower: [
      step("M 176 75 C 189 73 198 61 205 50", "Sweep up from the baseline to the midline."),
      step(
        "M 205 50 C 209 48 211 51 213 55",
        "Tip the pen slightly down and right to make the small shoulder."
      ),
      step(
        "M 213 55 L 205 70 C 199 83 217 73 231 50",
        "Slant down to the baseline, round the bottom, and sweep up."
      ),
    ],
  },
  S: {
    upper: [
      step(
        "M 164 75 C 181 70 208 53 218 34 C 226 19 211 24 205 34 C 197 48 211 62 198 73 C 185 81 169 73 167 50",
        "Sweep from the baseline up into a loop at the headline. Curve down through the middle, then round the lower bowl up to the left."
      ),
      step(
        "M 167 50 C 170 58 181 62 189 61",
        "Retrace the top of the hook, then curve right to finish."
      ),
    ],
    lower: [
      step("M 175 75 C 189 73 199 59 207 50", "Sweep from the baseline up to the midline."),
      step(
        "M 207 50 C 205 56 211 65 202 72 C 198 76 192 76 188 72",
        "Curve down to make the rounded body and turn back to the left at the baseline."
      ),
      step(
        "M 188 72 C 196 77 211 72 226 50",
        "Sweep back right along the baseline and up into the exit."
      ),
    ],
  },
  T: {
    upper: [
      step("M 185 25 L 181 32", "Begin at the headline with a short slant down to the left."),
      step("M 181 32 C 195 18 214 38 237 25", "Sweep right to make the wavy top bar."),
      step(
        "M 210 29 C 200 37 197 51 190 64 C 179 85 163 76 157 50",
        "Lift to the top bar. Curve down to the baseline and sweep back up to the left.",
        true
      ),
      step(
        "M 157 50 C 160 58 168 61 177 60",
        "Retrace the upper end of the hook, then curve a little to the right."
      ),
    ],
    lower: [
      step("M 174 75 C 190 74 203 52 216 25", "Sweep up from the baseline to the headline."),
      step(
        "M 216 25 L 193 68 C 185 85 206 74 224 50",
        "Retrace down the stem, turn at the baseline, and sweep up."
      ),
      step(
        "M 195 42 L 213 42",
        "Lift and cross the stem left to right, a little above the midline.",
        true
      ),
    ],
  },
  U: {
    upper: [
      step(
        "M 166 26 C 179 22 185 26 179 40 L 166 66 C 158 87 182 73 206 25",
        "Curve right near the headline. Slant down to round the baseline, then sweep all the way back up."
      ),
      step(
        "M 206 25 L 183 68 C 176 84 199 74 219 50",
        "Slant down from the headline and round the baseline again, ending at the midline."
      ),
    ],
    lower: [
      step("M 170 75 C 183 73 192 62 198 50", "Sweep up from the baseline to the midline."),
      step(
        "M 198 50 L 188 68 C 180 85 201 72 210 50",
        "Slant down, round the first turn at the baseline, and come back up to the midline."
      ),
      step(
        "M 210 50 L 201 69 C 193 83 212 75 229 50",
        "Slant down again, then sweep up from the baseline into the exit."
      ),
    ],
  },
  V: {
    upper: [
      step(
        "M 168 26 C 181 22 186 26 181 40 L 168 66 C 160 86 179 79 188 58 C 196 39 205 24 222 25",
        "Curve forward at the headline, slant down, then round the bottom and arch back up to the headline."
      ),
    ],
    lower: [
      step(
        "M 171 75 C 179 63 192 48 199 50 C 204 52 191 65 190 72 C 188 82 205 65 214 50",
        "Arch up to the midline, slant down, then round the baseline and rise back to the midline."
      ),
      step("M 214 50 C 217 54 224 54 230 48", "Dip slightly and flick up to make the high join."),
    ],
  },
  W: {
    upper: [
      step(
        "M 163 26 C 175 22 181 26 175 39 L 162 66 C 153 87 177 72 198 25",
        "Curve right at the headline. Slant down, round the baseline, and sweep back to the headline."
      ),
      step(
        "M 198 25 L 177 67 C 168 87 187 78 199 57 C 207 39 215 24 230 25",
        "Slant down again, then round the baseline and arch up to finish at the headline."
      ),
    ],
    lower: [
      step("M 162 75 C 175 73 185 61 191 50", "Sweep up from the baseline to the midline."),
      step(
        "M 191 50 L 182 68 C 173 85 195 71 202 50",
        "Slant down and round the first valley, then rise back to the midline."
      ),
      step(
        "M 202 50 L 193 69 C 185 85 206 73 214 50",
        "Slant down and round the second valley, then rise back to the midline."
      ),
      step("M 214 50 C 217 55 223 55 230 48", "Dip slightly and flick up to make the high join."),
    ],
  },
  X: {
    upper: [
      step(
        "M 177 26 C 190 23 199 25 194 42 C 190 56 183 69 191 74 C 198 78 210 73 216 67",
        "Curve forward near the headline, slant down, and make a short turn to the right at the baseline."
      ),
      step(
        "M 223 25 L 174 75",
        "Lift and cross diagonally from the upper right to the lower left.",
        true
      ),
    ],
    lower: [
      step(
        "M 170 75 C 179 64 190 48 200 50 C 206 51 196 64 195 70 C 192 81 210 73 228 50",
        "Arch up to the midline, slant down, then sweep up out of the baseline turn."
      ),
      step(
        "M 212 50 L 183 75",
        "Lift and cross diagonally from the upper right to the lower left.",
        true
      ),
    ],
  },
  Y: {
    upper: [
      step(
        "M 167 26 C 179 22 186 26 180 40 L 167 66 C 158 86 183 73 205 25",
        "Curve forward near the headline. Slant down, round the baseline, and sweep back up to the headline."
      ),
      step(
        "M 205 25 L 175 92 C 168 108 157 98 169 87 C 181 76 199 61 222 50",
        "Slant down past the baseline, loop back to the left, and sweep up through the tail."
      ),
    ],
    lower: [
      step(
        "M 165 75 C 174 63 187 48 194 50 C 199 51 187 65 186 71 C 182 84 206 65 212 50",
        "Arch up to the midline, slant down, then round the baseline and rise to the midline."
      ),
      step(
        "M 212 50 L 191 92 C 183 109 173 98 185 87 C 197 75 212 61 231 50",
        "Slant below the baseline, loop back to the left, and sweep up through the tail."
      ),
    ],
  },
  Z: {
    upper: [
      step(
        "M 177 26 C 192 22 201 27 199 37 C 197 49 185 61 173 75",
        "Curve forward at the headline, then slant left down to the baseline."
      ),
      step(
        "M 173 75 C 182 67 189 67 188 75 C 187 84 176 100 168 100 C 155 100 175 76 220 50",
        "Turn over to the right at the baseline, curl down into a loop, and sweep up across the tail."
      ),
    ],
    lower: [
      step(
        "M 168 75 C 178 64 190 48 200 50 C 206 51 194 65 186 75",
        "Arch up from the baseline to the midline, then slant back down to make the shoulder."
      ),
      step(
        "M 186 75 C 195 67 202 67 201 75 C 199 85 187 100 179 100 C 167 100 187 76 230 50",
        "Turn over to the right at the baseline, curl down into a loop, and sweep up across the tail."
      ),
    ],
  },
};

export function getLetterStrokes(letterId: string): LetterStrokes {
  const key = (letterId || "A").trim().toUpperCase();
  return CURSIVE_STROKES_DATA[key] ?? CURSIVE_STROKES_DATA.A;
}
