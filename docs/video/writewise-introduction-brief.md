# WriteWise introduction video — proposed creative brief

Status: draft for review. This describes the completed-product scenario requested for the video; it is not a statement of current implementation or model validation.

## Purpose and audience

Introduce WriteWise to a broad, nontechnical audience, with teachers and parents as the central users. Viewers should understand what it does, how a worksheet becomes useful feedback, and how that feedback supports practice over time.

Core message: **Understand handwriting. Support progress.**

## Format and direction

- Approximately 90 seconds, 1920 × 1080, 30 fps, MP4.
- Plain English narration, readable captions, quiet instrumental music beneath speech.
- Warm educational style: pine teal, white and warm gray, sage accents, Poppins headings and Inter body text, following the repository's DESIGN.md.
- Follow one fictional learner's worksheet through the teacher and parent experiences. Learners write on paper; adults use the app.
- Give the worksheet and feedback the most screen time. Use purposeful zooms, gentle transitions and legible callouts.
- Use captured product screens where possible. Recreate documented finished-product states when needed, keeping them faithful to docs/DESIGN.md.
- Show a small “Illustrative demo data” label on staged assessments and progress charts. Demo numbers and progress are narrative examples, not validation results or promises of improvement.

## Storyboard and narration

| Time | Picture and action | Narration |
| --- | --- | --- |
| 0–10 s | A cursive worksheet fills the screen. The WriteWise wordmark appears alongside it. | Learning cursive takes practice. Knowing what to work on next can make that practice more meaningful. |
| 10–18 s | Transition from paper into a clean teacher dashboard. Reveal “Understand handwriting. Support progress.” | Meet WriteWise: a handwriting assessment and progress monitoring tool for teachers and parents. |
| 18–30 s | Teacher selects an activity and learner, uploads a worksheet photo, and confirms the preview. | A learner writes on paper. A teacher or parent uploads a photo of the worksheet, and WriteWise analyzes the handwriting. |
| 30–44 s | Reveal five criteria with enlarged worksheet examples. Keep each label visible long enough to read. | It looks at five areas: how letters are formed, their size, the spaces between words, their slant, and how they follow the writing line. |
| 44–60 s | Show a worksheet beside its feedback. Focus on spacing, reveal a restrained highlight, and enlarge a supportive next-step note. | Clear visual highlights and simple feedback help explain what is developing well and where more practice may help. |
| 60–72 s | Show assessment history and a slowly revealed example progress chart, then return to the teacher's student view. | Teachers can review each learner's results and follow changes across activities, helping guide the next lesson. |
| 72–83 s | Show the parent portal with the same learner's worksheet, feedback and history. | Parents can see their child's feedback and progress, making it easier to support practice at home. |
| 83–90 s | Bring the worksheet and teacher/parent views together. Resolve to the logo and closing message. | WriteWise. Understand handwriting. Support progress. One worksheet at a time. |

Final narration timing should govern scene lengths. Adjust pauses or scene boundaries after recording without rushing the spoken explanation.

## Hyperframes production approach

Build an independent HTML/CSS video composition with seekable animation, product captures, worksheet imagery and timed audio. Keep its dependencies separate from the deployed frontend and backend.

Proposed project location: tools/demo-video/.

Required assets: existing WriteWise logo, fictional worksheet, teacher and parent screen captures or faithful staged views, recorded or generated narration, and appropriately licensed music. Asset sourcing and voice selection remain production choices.

Preview every scene for readable text, correct role behavior, caption timing and audio balance; inspect the rendered MP4 before delivery. The finished introduction should communicate benefits without accuracy percentages, instant-processing promises or guaranteed learning outcomes.

## Repository references

- DESIGN.md: brand tokens and visual direction.
- docs/DESIGN.md §§5–8: role navigation, screen inventory, result presentation and supportive feedback copy.
- AGENTS.md §1: paper interaction for learners and teacher/parent portals.
