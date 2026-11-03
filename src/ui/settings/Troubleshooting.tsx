import { FAQ, findFaq } from './faq';
import styles from './SyncSettings.module.css';

/** Collapsed help. The item that explains the current sync error opens by itself. */
export function Troubleshooting({ lastError }: { lastError: string | null }) {
  const relevant = findFaq(lastError);
  return (
    <details className={styles.details} open={relevant >= 0}>
      <summary>Troubleshooting &amp; FAQ</summary>
      {FAQ.map((item, i) => (
        <details key={item.question} className={styles.faqItem} open={i === relevant}>
          <summary>{item.question}</summary>
          <p className={styles.helpText}>{item.answer}</p>
        </details>
      ))}
    </details>
  );
}
