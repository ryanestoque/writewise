import styles from "@/app/landing.module.css";

/** Public-language summary of SECURITY.md §6.3–6.4 and PRD.md §8. */
export function PrivacyDetails() {
  return (
    <section id="privacy" className={styles.privacy} aria-labelledby="privacy-heading">
      <h2 id="privacy-heading" className={styles.sectionTitle}>
        Your child&rsquo;s work, handled with care.
      </h2>
      <p className={styles.privacyIntro}>
        Here is what WriteWise keeps, who can see it, and how to ask about your child&rsquo;s
        information. Students use paper and never create an account.
      </p>

      <details className={styles.privacyDetails}>
        <summary>What information is collected, and who can see it?</summary>
        <p>
          WriteWise stores teacher and parent account details, student names and class records,
          uploaded worksheets, assessment results, and progress history. Teachers see the learners
          linked to their classes; parents see only their linked children. Location and device
          details are removed from uploaded images.
        </p>
        <p>
          Authorized members of the WriteWise research team can access identified records when
          needed for approved support, research data preparation, or security incident response.
        </p>
      </details>

      <details className={styles.privacyDetails}>
        <summary>How is handwriting used in the research?</summary>
        <p>
          WriteWise is a BSIT thesis project at Holy Cross of Davao College. Participation consent
          is collected through paper forms outside the app; creating an account does not replace
          that consent process. Worksheet measurements and assessment scores may be used to evaluate
          and improve the system under the agreed research consent.
        </p>
        <p>
          Research exports remove student names and account identifiers. Anonymized research data
          may be retained for future analysis or publication. The handwriting examples on this page
          are synthetic and contain no student records.
        </p>
      </details>

      <details className={styles.privacyDetails}>
        <summary>How long is information kept, and what does deletion cover?</summary>
        <p>
          Identified student records and worksheet images are retained through the thesis defense
          and for six months afterward, then deleted. This retention limit also applies to backup
          copies. Anonymized research exports are retained separately without a fixed end date.
        </p>
        <p>
          Teachers can delete individual worksheet submissions. Parents can delete ungraded
          take-home submissions. Deleting a worksheet does not remove backup copies or previously
          exported research data, and removing a learner from a class does not delete their history.
        </p>
      </details>

      <details className={styles.privacyDetails}>
        <summary>How do I ask about my child&rsquo;s data or withdraw participation?</summary>
        <p>
          Contact your child&rsquo;s teacher through the same channel used for the paper consent
          form. Ask them to coordinate your question or withdrawal request with the WriteWise
          research team. A full withdrawal requires follow-up by the team; deleting an individual
          worksheet or removing a class link does not complete it.
        </p>
        <p>
          If research analysis has already taken place, a contribution to aggregate findings or
          scoring calibration cannot necessarily be reversed. The team should explain what your
          request can cover before confirming it is complete.
        </p>
      </details>

      <p className={styles.privacyContact}>
        <strong>Need a person to help?</strong> Start with your child&rsquo;s teacher or the teacher
        coordinating your class&rsquo;s use of WriteWise. They can connect you with the research
        team for questions about access, corrections, deletion, or participation.
      </p>
    </section>
  );
}
