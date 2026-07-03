import { google } from 'googleapis';
import { simpleParser } from 'mailparser';
import * as cheerio from 'cheerio';

function getGmailService(accessToken) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: 'v1', auth });
}

function cleanHtml(html) {
  try {
    const $ = cheerio.load(html);
    return $.text().replace(/\s+/g, ' ').trim();
  } catch {
    return html;
  }
}

export async function fetchThreads(accessToken, maxThreads = 20) {
  const gmail = getGmailService(accessToken);
  const threadMap = new Map();
  let nextPageToken = undefined;

  while (threadMap.size < maxThreads) {
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 50,
      pageToken: nextPageToken,
      q: 'in:inbox -category:promotions',
    });

    const messages = listRes.data.messages || [];

    for (const msg of messages) {
      if (threadMap.size >= maxThreads) break;

      const msgData = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'raw',
      });

      const threadId = msgData.data.threadId;
      const timestamp = parseInt(msgData.data.internalDate, 10);
      const raw = Buffer.from(msgData.data.raw, 'base64url');
      const parsed = await simpleParser(raw);

      let text = parsed.text?.trim() || '';
      if (!text && parsed.html) text = cleanHtml(parsed.html);
      if (!text) continue;

      const existing = threadMap.get(threadId);
      if (!existing || timestamp > existing.timestamp) {
        threadMap.set(threadId, { text, timestamp });
      }
    }

    nextPageToken = listRes.data.nextPageToken;
    if (!nextPageToken) break;
  }

  return Array.from(threadMap.entries()).map(([thread_id, { text }]) => ({
    thread_id,
    messages: [text],
  }));
}
