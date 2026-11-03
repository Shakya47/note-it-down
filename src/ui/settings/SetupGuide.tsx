import { useState } from 'react';
import styles from './SyncSettings.module.css';

const DEPLOY_URL = 'https://deploy.workers.cloudflare.com/?url=https://github.com/Shakya47/note-it-down';
// Cloudflare's cloud mark, bundled so opening settings makes no network request.
function CloudflareLogo() {
  return (
    <svg className={styles.cfLogo} viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path
        fill="#F6821F"
        d="M16.5088 16.8447c.1475-.5068.0908-.9707-.1553-1.3154-.2246-.3164-.6045-.499-1.0615-.5205l-8.6592-.1123a.1559.1559 0 0 1-.1333-.0713c-.0283-.042-.0351-.0986-.021-.1553.0278-.084.1123-.1484.2036-.1562l8.7359-.1123c1.0351-.0489 2.1601-.8868 2.5537-1.9136l.499-1.3013c.0215-.0561.0293-.1128.0147-.168-.5625-2.5463-2.835-4.4453-5.5499-4.4453-2.5039 0-4.6284 1.6177-5.3876 3.8614-.4927-.3658-1.1187-.5625-1.794-.499-1.2026.119-2.1665 1.083-2.2861 2.2856-.0283.31-.0069.6128.0635.894C1.5683 13.171 0 14.7754 0 16.752c0 .1748.0142.3515.0352.5273.0141.083.0844.1475.1689.1475h15.9814c.0909 0 .1758-.0645.2032-.1553l.12-.4268zm2.7568-5.5634c-.0771 0-.1611 0-.2383.0112-.0566 0-.1054.0415-.127.0976l-.3378 1.1744c-.1475.5068-.0918.9707.1543 1.3164.2256.3164.6055.498 1.0625.5195l1.8437.1133c.0557 0 .1055.0263.1329.0703.0283.043.0351.1074.0214.1562-.0283.084-.1132.1485-.204.1553l-1.921.1123c-1.041.0488-2.1582.8867-2.5527 1.914l-.1406.3585c-.0283.0713.0215.1416.0986.1416h6.5977c.0771 0 .1474-.0489.169-.126.1122-.4082.1757-.837.1757-1.2803 0-2.6025-2.125-4.727-4.7344-4.727"
      />
    </svg>
  );
}

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
        className={styles.deployBtn}
        href={DEPLOY_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleDeploy}
      >
        <CloudflareLogo />
        {deployStarted ? 'Deploy again (only if the first one failed)' : 'Deploy to Cloudflare'}
      </a>
    </div>
  );
}
