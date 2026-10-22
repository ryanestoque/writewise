"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import styles from "@/app/landing.module.css";

const questions = [
  {
    question: "What kind of handwriting can WriteWise assess?",
    answer:
      "WriteWise assesses cursive handwriting for teacher-created activities. Learners copy the target text on paper with three printed penmanship guides: top, middle, and baseline. A teacher or parent then uploads a clear photo. Ordinary single-rule or unruled paper does not meet the worksheet requirement.",
  },
  {
    question: "Do students need an account or a device?",
    answer:
      "No. Students practice on paper. Teachers and parents use WriteWise to upload worksheets, review feedback, and follow progress.",
  },
  {
    question: "How do parents follow their child’s progress?",
    answer:
      "Parents create an account and connect through an invitation from their child’s teacher. Once linked, they can view their own child’s assessment history, feedback, and progress, and upload take-home worksheets.",
  },
  {
    question: "Does WriteWise replace a teacher’s judgment?",
    answer:
      "WriteWise supports a teacher’s review with a breakdown of five handwriting criteria and visual feedback. Teachers bring the classroom context and use that information to guide each learner’s next practice.",
  },
];

export function LandingFaq() {
  return (
    <Accordion className={styles.faqList}>
      {questions.map(({ question, answer }) => (
        <AccordionItem key={question} className={styles.faqItem}>
          <AccordionTrigger className={styles.faqTrigger}>{question}</AccordionTrigger>
          <AccordionContent className={styles.faqAnswer}>{answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
