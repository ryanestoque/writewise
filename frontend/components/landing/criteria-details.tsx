import {
  BaselineSpecimen,
  FormationSpecimen,
  SizeSpecimen,
  SlantSpecimen,
  SpacingSpecimen,
} from "@/components/landing/landing-art";
import styles from "@/app/landing.module.css";

const criteria = [
  {
    id: "formation",
    name: "Letter formation",
    body: "Letters are shaped and joined the way they’re taught: loops close cleanly, strokes connect smoothly, and nothing floats loose.",
    note: "Most loops close neatly. Next: finish the loop in “l” before joining the next letter.",
    Specimen: FormationSpecimen,
  },
  {
    id: "size",
    name: "Size consistency",
    body: "Small letters stay between the dotted midline and baseline; tall ascenders reach the top guide consistently across the line.",
    note: "Some small letters stretch past the midline. Next: aim each short stroke right at the dotted line.",
    Specimen: SizeSpecimen,
  },
  {
    id: "spacing",
    name: "Spacing",
    body: "Even breathing room between connected letters, and a steady, readable gap separating each word.",
    note: "Two words run together. Next: leave a finger-width gap after each word.",
    Specimen: SpacingSpecimen,
  },
  {
    id: "slant",
    name: "Slant",
    body: "Letters lean in one consistent direction across the page, with downstrokes running parallel.",
    note: "One letter tips backward. Next: keep downstrokes parallel to the forward slant guide.",
    Specimen: SlantSpecimen,
  },
  {
    id: "baseline",
    name: "Baseline alignment",
    body: "Words rest steadily along the bottom rule instead of floating upward or dipping below the line.",
    note: "The word climbs toward the end. Next: rest the final letters firmly on the bottom line.",
    Specimen: BaselineSpecimen,
  },
];

const bands = [
  {
    key: "needs",
    label: "Needs Improvement",
    desc: "Early letter-tracing stage; building foundational stroke control.",
  },
  {
    key: "developing",
    label: "Developing",
    desc: "Shapes and rhythm are emerging; steadying with guided practice.",
  },
  {
    key: "satisfactory",
    label: "Satisfactory",
    desc: "On-track execution with only minor variations across the line.",
  },
  {
    key: "excellent",
    label: "Excellent",
    desc: "Consistent formation, slant, spacing, and baseline control.",
  },
];

export function CriteriaDetails() {
  return (
    <section id="criteria" className={styles.criteriaSection} aria-labelledby="criteria-heading">
      <div className={styles.sectionHeader}>
        <div>
          <h2 id="criteria-heading" className={styles.sectionTitle}>
            Five fundamentals of fluent cursive.
          </h2>
        </div>
        <p className={styles.sectionLede}>
          Every worksheet is evaluated across five penmanship criteria. Instead of red pass-or-fail
          marks, each score maps to a supportive four-tier developmental spectrum.
        </p>
      </div>

      <div className={styles.bandSpectrumCard} aria-label="Developmental score bands">
        <div className={styles.bandSpectrumHead}>
          <span className={styles.bandSpectrumTitle}>Developmental growth spectrum</span>
        </div>
        <ul className={styles.bandSpectrumGrid}>
          {bands.map((b) => (
            <li key={b.key} className={styles.bandSpectrumItem}>
              <span className={styles.band} data-band={b.key}>
                <span className={styles.bandDot} aria-hidden="true" />
                {b.label}
              </span>
              <p className={styles.bandSpectrumDesc}>{b.desc}</p>
            </li>
          ))}
        </ul>
      </div>

      <ul className={styles.ledger}>
        {criteria.map(({ id, name, body, note, Specimen }) => (
          <li key={id} className={styles.ledgerRow}>
            <div className={styles.ledgerSpecimen}>
              <Specimen />
            </div>
            <div className={styles.ledgerText}>
              <h3 className={styles.ledgerName}>{name}</h3>
              <p className={styles.ledgerBody}>{body}</p>
            </div>
            <p className={styles.ledgerNote}>
              <span className={styles.ledgerNoteLabel}>Sample coaching tip</span>
              {note}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
