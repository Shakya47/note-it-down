import { useState } from 'react';
import styles from './SyncSettings.module.css';

const DEPLOY_URL = 'https://deploy.workers.cloudflare.com/?url=https://github.com/Shakya47/note-it-down';
const DEPLOY_STARTED_KEY = 'nid.deployStarted';

function readDeployStarted(): boolean {
  try {
    return localStorage.getItem(DEPLOY_STARTED_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * First-time setup help. Shown only while sync is not connected, so a person
 * who already has a worker is never nudged to deploy a second one.
 */
export function SetupGuide({ connected, workerFound }: { connected: boolean; workerFound: boolean }) {
  const [deployStarted, setDeployStarted] = useState(readDeployStarted);

  if (connected) {
    return (
      <details className={styles.details}>
        <summary>Set up your phone or another computer</summary>
        <ol className={styles.steps}>
          <li>Do not deploy anything again: the same worker serves all your devices.</li>
          <li>On a computer: install Note It Down, open its settings, paste this Worker URL and token, then Save &amp; Sync.</li>
          <li>On your phone: open your Worker URL in the browser, add it to your home screen, and paste the same URL and token.</li>
        </ol>
      </details>
    );
  }

  const handleDeploy = () => {
    try {
      localStorage.setItem(DEPLOY_STARTED_KEY, String(Date.now()));
    } catch {
      /* the guard is only a convenience */
    }
    setDeployStarted(true);
  };

  if (workerFound) {
    return (
      <div className={styles.inlineOk} role="status">
        ✓ Found your worker. You don't need to deploy again: generate a token below and click Save &amp; Sync.
      </div>
    );
  }

  return (
    <div className={styles.guide}>
      <div className={styles.guideTitle}>First time? Set up sync in 3 steps</div>
      <p className={styles.helpText}>
        Do this <strong>once</strong>. Your phone and other computers reuse the same URL and token. Already have a worker
        URL? Skip to step 3.
      </p>
      <ol className={styles.steps}>
        <li>
          Click <strong>Deploy to Cloudflare</strong> and follow the page that opens (free account, about 3 minutes).
        </li>
        <li>
          When it finishes, copy your worker URL. It looks like <code>https://note-it-down-sync.you.workers.dev</code>.
        </li>
        <li>
          Paste it below, click <strong>Generate</strong>, then <strong>Save &amp; Sync</strong>. Keep the token: your
          other devices need it.
        </li>
      </ol>
      {deployStarted && (
        <div className={styles.inlineNote} role="status">
          You already started a deploy. Check Workers &amp; Pages in your Cloudflare dashboard for your URL before
          deploying again: a second deploy makes a second, separate server.
        </div>
      )}
      <a
        className={deployStarted ? styles.genBtnLink : styles.syncBtnLink}
        href={DEPLOY_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleDeploy}
      >
        {deployStarted ? 'Deploy again (only if the first one failed)' : '☁ Deploy to Cloudflare'}
      </a>
    </div>
  );
}
