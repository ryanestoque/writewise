"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import styles from "@/app/landing.module.css";

interface CriterionExample {
  id: string;
  label: string;
  bandName: string;
  bandTier: "band-1" | "band-2" | "band-3" | "band-4";
  observation: string;
  explanation: string;
  annotation: string;
}

const examples: CriterionExample[] = [
  {
    id: "spacing",
    label: "Spacing",
    bandName: "Developing",
    bandTier: "band-2",
    observation: "The word gaps change from line to line.",
    explanation:
      "The gap in “Little letters” is tight, while “big possibilities” is much wider. Try using the gap in “Keep growing” as a guide on your next line.",
    annotation: "Compare the tight first gap, wide second gap, and balanced third gap.",
  },
  {
    id: "slant",
    label: "Slant",
    bandName: "Satisfactory",
    bandTier: "band-3",
    observation: "Letters lean in a steady direction.",
    explanation:
      "Tall strokes lean in a similar direction. Keep that steady angle as you practice the next line.",
    annotation: "Dashed guides show the lean of tall strokes.",
  },
  {
    id: "baseline",
    label: "Baseline",
    bandName: "Excellent",
    bandTier: "band-4",
    observation: "Letters sit steadily along the writing line.",
    explanation: "Keep resting the bodies of letters on the baseline as you move across the page.",
    annotation: "The highlighted baseline shows where letters rest.",
  },
  {
    id: "size",
    label: "Size",
    bandName: "Excellent",
    bandTier: "band-4",
    observation: "Short letters keep a similar height.",
    explanation:
      "Use the middle guide to keep short letters even, while taller letters reach toward the top guide.",
    annotation: "The shaded band shows the height of short letters.",
  },
  {
    id: "formation",
    label: "Formation",
    bandName: "Satisfactory",
    bandTier: "band-3",
    observation: "Smooth loops and complete letter closures.",
    explanation:
      "Take your time around each loop, closing rounded letters and keeping the joins smooth.",
    annotation: "Highlighted loops draw attention to letter shapes.",
  },
];

export function WorksheetDemo() {
  const [activeTab, setActiveTab] = React.useState("spacing");

  return (
    <section className={styles.demo} id="example" aria-labelledby="example-heading">
      <div className={styles.demoHeader}>
        <h2 className={styles.demoHeading} id="example-heading">
          Explore the handwriting feedback
        </h2>
        <p className={styles.demoHint}>Choose a criterion to see what it highlights.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className={styles.demoTabs}>
        <TabsList className={styles.demoTabList} aria-label="Explore handwriting criteria">
          {examples.map((example) => (
            <TabsTrigger key={example.id} value={example.id} className={styles.demoTab}>
              {example.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {examples.map((example) => (
          <TabsContent key={example.id} value={example.id} className={styles.demoPanel}>
            <figure className={styles.worksheet} data-view={example.id}>
              <figcaption className={styles.sheetHeading}>
                <span className={styles.sheetSampleBadge}>Illustrative example</span>
                <span className={styles.sheetSub}>Three-guide paper</span>
              </figcaption>

              {/* The Penmanship Paper Surface */}
              <div className={styles.paperSheet}>
                {/* Line 1 */}
                <div className={styles.writingLine} data-line="1">
                  <div className={styles.guideLines} aria-hidden="true">
                    <span className={styles.lineAscender} />
                    <span className={styles.lineMidline} />
                    <span className={styles.lineBaseline} />
                  </div>
                  <div
                    className={styles.lineContent}
                    role="img"
                    aria-label="Little letters, with a tight gap between the words"
                  >
                    <span className={styles.wordGroup} data-word="1">
                      <span className={styles.letterStem} data-char="L">
                        L
                      </span>
                      <span className={styles.letterBody}>ittle</span>
                    </span>
                    <span className={styles.wordSpacingGap} data-gap="tight" aria-hidden="true">
                      <span className={styles.spacingMarker} />
                    </span>
                    <span className={styles.wordGroup} data-word="2">
                      <span className={styles.letterBody}>letters,</span>
                    </span>
                  </div>
                </div>

                {/* Line 2 */}
                <div className={styles.writingLine} data-line="2">
                  <div className={styles.guideLines} aria-hidden="true">
                    <span className={styles.lineAscender} />
                    <span className={styles.lineMidline} />
                    <span className={styles.lineBaseline} />
                  </div>
                  <div
                    className={styles.lineContent}
                    role="img"
                    aria-label="big possibilities, with a wide gap between the words"
                  >
                    <span className={styles.wordGroup} data-word="3">
                      <span className={styles.letterStem} data-char="b">
                        b
                      </span>
                      <span className={styles.letterBody}>ig</span>
                    </span>
                    <span className={styles.wordSpacingGap} data-gap="wide" aria-hidden="true">
                      <span className={styles.spacingMarker} />
                    </span>
                    <span className={styles.wordGroup} data-word="4">
                      <span className={styles.letterStem} data-char="p">
                        p
                      </span>
                      <span className={styles.letterBody}>ossibilities.</span>
                    </span>
                  </div>
                </div>

                {/* Line 3 */}
                <div className={styles.writingLine} data-line="3">
                  <div className={styles.guideLines} aria-hidden="true">
                    <span className={styles.lineAscender} />
                    <span className={styles.lineMidline} />
                    <span className={styles.lineBaseline} />
                  </div>
                  <div
                    className={styles.lineContent}
                    role="img"
                    aria-label="Keep growing, with a balanced gap between the words"
                  >
                    <span className={styles.wordGroup} data-word="5">
                      <span className={styles.letterStem} data-char="K">
                        K
                      </span>
                      <span className={styles.letterBody}>eep</span>
                    </span>
                    <span className={styles.wordSpacingGap} aria-hidden="true">
                      <span className={styles.spacingMarker} />
                    </span>
                    <span className={styles.wordGroup} data-word="6">
                      <span className={styles.letterStem} data-char="g">
                        g
                      </span>
                      <span className={styles.letterBody}>rowing.</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Plain-language explanation of the active overlay */}
              <div className={styles.annotationBar}>
                <div className={styles.annotation}>
                  <span className={styles.annotationDot} aria-hidden="true" />
                  <span>{example.annotation}</span>
                </div>
              </div>
            </figure>

            {/* Diagnostic Feedback Card */}
            <div className={styles.feedbackCard}>
              <div className={styles.feedbackTop}>
                <span className={styles.bandBadge} data-tier={example.bandTier}>
                  <span className={styles.bandDot} aria-hidden="true" />
                  {example.bandName}
                </span>
              </div>
              <h3 className={styles.feedbackTitle}>{example.observation}</h3>
              <p className={styles.feedbackText}>{example.explanation}</p>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <p className={styles.demoCaption}>
        Illustrative handwriting and feedback, not a real student assessment.
      </p>
    </section>
  );
}
