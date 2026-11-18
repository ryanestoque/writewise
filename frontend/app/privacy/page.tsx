import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How WriteWise handles account information, children's handwriting worksheets, assessment records, and privacy requests.",
};

const sections: LegalSection[] = [
  {
    id: "about",
    title: "Who we are",
    content: (
      <>
        <p>
          WriteWise is a cursive handwriting assessment and progress monitoring capstone project
          developed by Ryan Christopher B. Estoque, John Lawrence V. Monleon, James David B. Asoy,
          and Saara Eliana G. Ibag, BSIT students at Holy Cross of Davao College. This identifies
          the project team; it does not imply that the college operates or endorses the service.
        </p>
        <p>
          This policy covers the WriteWise website and teacher and parent portals. Contact the
          project team at <a href="mailto:info@writewise.tech">info@writewise.tech</a> about this
          policy or your personal data. For a school-led activity, your participating teacher can
          also help route a request.
        </p>
      </>
    ),
  },
  {
    id: "information",
    title: "Information we handle",
    content: (
      <>
        <ul>
          <li>
            <strong>Account information:</strong> your name, email address, account role,
            authentication information, and account preferences.
          </li>
          <li>
            <strong>Student and class records:</strong> student names and profile details supplied
            by teachers, class enrollment, and links to authorized parent or guardian accounts.
          </li>
          <li>
            <strong>Worksheets and assessments:</strong> uploaded handwriting photos, activity
            instructions, submission history and status, measurements, scores, teacher grades,
            diagnostic feedback, and progress records. A rejected submission can still have a record
            and rejection reason.
          </li>
          <li>
            <strong>Communication:</strong> teacher and parent comments, return notes, and
            notification records associated with an activity or submission.
          </li>
          <li>
            <strong>Technical information:</strong> authentication cookies and operational
            information needed to maintain and secure the service. Hosting and security providers
            may process connection information such as IP addresses and browser details.
          </li>
        </ul>
        <p>
          Students do not create accounts or use the portals. Their participation takes place on
          paper, and teachers or parents upload their work. Upload only the worksheet; avoid
          including faces, unrelated documents, or unnecessary personal information in a photo.
        </p>
      </>
    ),
  },
  {
    id: "purpose",
    title: "How information is used",
    content: (
      <>
        <p>
          We use this information to create and secure accounts, connect teachers and authorized
          parents with the correct student, assess worksheets, show feedback and progress, support
          teacher review, deliver service notifications, and investigate technical problems.
        </p>
        <p>
          Where automated assessment is enabled, image processing measures handwriting features and
          a trained model supports letter-formation analysis. Results cover letter formation, size
          consistency, spacing, slant, and baseline alignment. Teacher-entered scores may also be
          used while scoring is being calibrated. Results support teacher judgment and can be
          inaccurate; they are not a medical or learning-disability diagnosis.
        </p>
        <p>
          Participation consent for children and research is handled through paper forms outside the
          app. Creating an adult account, reading this policy, or accepting the Terms of Service
          does not replace that process. Teachers and parents should have the necessary
          authorization before adding a child or uploading their work.
        </p>
      </>
    ),
  },
  {
    id: "access",
    title: "Access and service providers",
    content: (
      <>
        <p>
          Access depends on your role and your relationship to the student or activity. Teachers can
          access records within their authorized teaching scope. Linked parents can access the
          records made available for their child. Activity conversations are shared with the
          activity owner and the child’s currently linked parents, including retained conversation
          history when a new parent is linked. All linked parents can see a posted comment without
          waiting for assessment results to be released.
        </p>
        <p>
          Authorized project maintainers may access information when needed for support, incident
          response, or permitted research preparation. We use Supabase for authentication, database,
          and file storage; Vercel for website hosting; and Railway for backend hosting. Email
          delivery may use Resend, and authentication screens may use Cloudflare Turnstile for abuse
          protection. These providers process the information needed for their services, potentially
          outside the Philippines.
        </p>
      </>
    ),
  },
  {
    id: "safeguards",
    title: "Photo privacy and safeguards",
    content: (
      <>
        <p>
          Before a worksheet image is stored, WriteWise removes embedded EXIF metadata, including
          location, capture time, and device information. This does not remove names or other
          information visible in the photo itself.
        </p>
        <p>
          WriteWise uses account authentication, access controls, private file storage, and
          encrypted network connections. Application diagnostic logs are designed to exclude student
          names, image contents, and private comment text. No online service can guarantee absolute
          security; tell us promptly if you suspect unauthorized access to your account.
        </p>
        <p>
          Authentication uses cookies to maintain your session. Blocking these cookies can prevent
          sign-in and portal features from working.
        </p>
      </>
    ),
  },
  {
    id: "research",
    title: "Research use",
    content: (
      <>
        <p>
          Within the scope of the participation consent, worksheet measurements and teacher scores
          may support the project’s calibration and academic evaluation. Research datasets are
          prepared through a controlled export and anonymization process. Private comment bodies and
          return notes are excluded from those exports.
        </p>
        <p>
          Genuinely anonymized research datasets may be kept indefinitely and may be used in future
          academic publication. Once information can no longer be linked back to an individual, we
          may be unable to locate or remove that individual’s contribution. Previously computed
          aggregate calibration statistics may also retain the effect of a contribution.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "Retention and deletion",
    content: (
      <>
        <p>
          The project’s retention schedule keeps identified student records and worksheet images
          through the thesis defense and for six months afterward to support evaluation follow-up,
          then calls for deletion of those records, images, and identified backup copies. Anonymized
          research datasets have a separate retention period described above.
        </p>
        <p>
          Available worksheet-deletion controls depend on your role and the submission’s status.
          Deleting a worksheet does not remove backup copies or previously exported datasets.
          Removing a teacher’s class link does not by itself delete a student’s profile, parent
          links, or historical records.
        </p>
      </>
    ),
  },
  {
    id: "rights",
    title: "Your rights and requests",
    content: (
      <>
        <p>
          Under the Philippine Data Privacy Act of 2012, applicable rights include being informed
          about processing, access to personal data, correction, objection, and erasure or blocking
          in the circumstances provided by law. You may also raise a complaint with the{" "}
          <a href="https://privacy.gov.ph/data-subject-rights/">National Privacy Commission</a>.
        </p>
        <p>
          Email <a href="mailto:info@writewise.tech">info@writewise.tech</a> to request access or
          correction, ask about deletion, or raise a privacy concern. A parent or guardian can also
          notify the participating teacher through the channel used for the paper consent form. We
          may need to verify your identity and authority to act for the child before disclosing or
          changing records. Do not email worksheet photos or identity documents unless a suitable
          method has been arranged.
        </p>
        <p>
          Consent withdrawal requires coordination with the project team. A complete withdrawal
          process is not currently available as a self-service feature. Do not treat unenrollment or
          deletion of an individual worksheet as confirmation that all collection, access, backups,
          and research use have been addressed. Ask the team to confirm the scope and completion of
          your request.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    content: (
      <p>
        We will update the date on this page when this policy changes. Material changes to data use
        will be communicated to affected participants, and any additional consent needed will be
        handled separately. You can also read our <Link href="/terms">Terms of Service</Link>.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      introduction="Understand what happens to your information and your child’s handwriting, from upload to assessment and beyond."
      summary="Students stay on paper. Teachers and parents use WriteWise to share worksheets and follow progress. This policy explains the data behind that work and how to ask us about it."
      sections={sections}
    />
  );
}
