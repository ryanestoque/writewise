import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Guidelines for teacher and parent accounts, authorized worksheet uploads, and responsible use of WriteWise assessments.",
};

const sections: LegalSection[] = [
  {
    id: "service",
    title: "About the service",
    content: (
      <>
        <p>
          WriteWise is an academic capstone project providing cursive handwriting assessment and
          progress monitoring for teachers and parents or guardians. It is developed by Ryan
          Christopher B. Estoque, John Lawrence V. Monleon, James David B. Asoy, and Saara Eliana G.
          Ibag, BSIT students at Holy Cross of Davao College. This academic context does not imply
          institutional operation, endorsement, or certification.
        </p>
        <p>
          These terms describe the conditions for using the website and portals. Read them before
          creating an account or uploading work. Contact{" "}
          <a href="mailto:info@writewise.tech">info@writewise.tech</a> if you need clarification.
        </p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Accounts and responsibilities",
    content: (
      <>
        <p>
          Accounts are intended for teachers and adult parents or guardians. Students do not have
          accounts and complete activities on paper. Provide accurate account details, use the
          correct role, keep your sign-in information private, and report suspected unauthorized
          access promptly.
        </p>
        <p>
          Teachers are responsible for the student records, class links, activities, parent
          invitations, and grades they manage. Parents and guardians must access only children they
          are authorized to support. Do not use another person’s account or share access to a
          child’s records with an unauthorized person.
        </p>
      </>
    ),
  },
  {
    id: "uploads",
    title: "Worksheets and permission",
    content: (
      <>
        <p>
          Upload only worksheets and information that you are authorized to provide for the
          activity. Obtain the required participation and parent or guardian consent before adding
          children’s information. Account registration and these terms do not replace the project’s
          separate paper consent process.
        </p>
        <p>
          You retain any rights you hold in the material you provide. You authorize WriteWise to
          store, process, and display it as needed to deliver the service within your permissions
          and the <Link href="/privacy">Privacy Policy</Link>. Any research use remains subject to
          the applicable participation consent.
        </p>
        <p>
          Use clear photos of the requested handwriting activity. Avoid faces, unrelated personal
          documents, and unnecessary identifiers. Embedded photo metadata is removed before storage,
          but visible information in a photo remains visible.
        </p>
      </>
    ),
  },
  {
    id: "assessment",
    title: "Understanding assessments",
    content: (
      <>
        <p>
          WriteWise supports review of letter formation, size consistency, spacing, slant, and
          baseline alignment. Some results may use teacher-entered scores while automated scoring is
          being calibrated. Photo quality, handwriting style, and model limitations can affect
          results.
        </p>
        <p>
          Teachers should review results and apply professional judgment before using them in
          educational decisions. The service does not diagnose a medical condition or learning
          disability, guarantee a particular learning outcome, or claim official curriculum
          alignment or certification.
        </p>
      </>
    ),
  },
  {
    id: "conduct",
    title: "Acceptable use",
    content: (
      <ul>
        <li>
          Use the service for authorized educational activities and related teacher and parent
          communication.
        </li>
        <li>
          Do not access or attempt to access another class, family, or account without permission.
        </li>
        <li>
          Do not upload harmful or unlawful content, impersonate someone, or misrepresent your
          relationship to a child.
        </li>
        <li>
          Do not interfere with the service, bypass access controls, or probe private records.
        </li>
        <li>
          Keep comments respectful and relevant. Activity conversations can be seen by the activity
          owner and all currently linked parents; they are not a private message to just one parent.
        </li>
      </ul>
    ),
  },
  {
    id: "availability",
    title: "Availability and access",
    content: (
      <>
        <p>
          WriteWise is being developed and evaluated as a capstone project. Features may change, and
          maintenance, technical faults, or the end of the project can affect availability. Do not
          rely on the service as your only copy of required school records.
        </p>
        <p>
          Access may be restricted where necessary to investigate misuse or protect participants. If
          you believe access was restricted in error, contact the project team. Ending access does
          not by itself delete personal data; retention and privacy requests are covered in the{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "Questions and updates",
    content: (
      <>
        <p>
          Email <a href="mailto:info@writewise.tech">info@writewise.tech</a> with questions about
          these terms or a concern about the service. For an activity, grade, or student-link issue,
          your participating teacher can help with the classroom context.
        </p>
        <p>
          When these terms change, we will update the date shown on this page and communicate
          material changes to affected users. These terms do not remove rights or remedies available
          under applicable Philippine law.
        </p>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      introduction="A shared understanding for teachers and parents supporting each child’s handwriting progress."
      summary="Use WriteWise with permission, protect children’s information, and review assessments with care. These terms explain what that means for your account and the work you share."
      sections={sections}
    />
  );
}
