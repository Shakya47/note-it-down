export interface FaqItem {
  question: string;
  answer: string;
  /** Matches a sync error message that this item explains. */
  match?: RegExp;
}

export const FAQ: FaqItem[] = [
  {
    question: "It says it can't reach my worker",
    answer:
      'Check the Worker URL: it starts with https:// and ends with .workers.dev (no extra path). Open it in a new tab; you should see a small JSON message, not an error page. If the deploy never finished, finish it in your Cloudflare dashboard under Workers & Pages.',
    match: /network error|doesn't look like|doesn't point to|older version/i,
  },
  {
    question: 'Sync says 401 Unauthorized',
    answer:
      "The token doesn't match the one this worker's data was created with. Copy the whole token from your first device (no spaces, no line break) and paste it here. Click Generate only on the very first device.",
    match: /401|unauthorized/i,
  },
  {
    question: 'Sync says "sync ID is not allowed" (403)',
    answer:
      "Your worker has an ALLOWED_ADDRESSES allow-list and this device's Sync ID isn't on it. Add the Sync ID shown under Advanced to that setting in Cloudflare, or remove the setting.",
    match: /403|not allowed/i,
  },
  {
    question: 'My phone shows no notes, or different ones',
    answer:
      'Open the phone app, go to its settings, and use the exact same Worker URL and token as here. The Sync ID (shown under the token) must be identical on every device. A different Sync ID means a different, empty space.',
  },
  {
    question: 'Did I deploy twice? Which one do I use?',
    answer:
      'Pick one worker and use its URL everywhere. Extra workers are harmless but separate: they never share notes. Delete the ones you do not use from Cloudflare, under Workers & Pages.',
  },
  {
    question: 'The icon shows a red ! on some pages',
    answer:
      "Chrome doesn't let extensions run on chrome:// pages, the Chrome Web Store and a few other protected pages. It works on normal websites.",
  },
  {
    question: "I lost my token. What now?",
    answer:
      "It can't be recovered, because it is never sent anywhere. If another device is still connected, copy it from there. If not, Generate a new one here: your notes on this device are kept and are uploaded to a fresh sync space, and you paste the new token on your other devices.",
  },
  {
    question: 'What do Disconnect and Delete server data do?',
    answer:
      'Disconnect stops this device syncing and keeps your notes here and on the server. Delete server data also removes your encrypted notes from your worker. Neither deletes notes from your devices.',
  },
  {
    question: 'Still stuck?',
    answer: 'Open an issue on the project page and include the message shown under Last Sync Status. Never include your token.',
  },
];

/** Index of the first FAQ item that explains this sync error, or -1. */
export function findFaq(error: string | null): number {
  if (!error) return -1;
  return FAQ.findIndex((item) => item.match?.test(error));
}
