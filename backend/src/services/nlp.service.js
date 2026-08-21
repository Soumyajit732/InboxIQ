import OpenAI from 'openai';
import axios from 'axios';
import { OPENAI_API_KEY, SPACY_SERVICE_URL } from '../config.js';
import { withRetry } from '../utils/http.utils.js';

const client = new OpenAI({ apiKey: OPENAI_API_KEY });

function restoreRedactions(result, redactions = {}) {
  const restore = value => {
    if (typeof value !== 'string') return value;
    return Object.entries(redactions).reduce(
      (restored, [placeholder, original]) => restored.replaceAll(placeholder, original),
      value,
    );
  };

  return {
    ...result,
    task: restore(result.task),
    summary: restore(result.summary),
    source_snippet: restore(result.source_snippet),
    reasoning: restore(result.reasoning),
  };
}

function buildSanitizedSearchText(result, sanitizedText) {
  // Only text that has already been sanitized is sent to the embeddings API.
  // `result` here preserves placeholders, before identifiers are restored for
  // the user-facing dashboard.
  return [
    `Task: ${result.task || ''}`,
    `Summary: ${result.summary || ''}`,
    `Email: ${sanitizedText.slice(0, 600)}`,
  ].join('\n');
}

async function sanitizeForExternalAI(text) {
  try {
    const res = await withRetry(() => axios.post(`${SPACY_SERVICE_URL}/sanitize-email`, { text }));
    if (typeof res.data?.sanitized_text !== 'string') {
      throw new Error('Privacy service returned no sanitized text');
    }
    return {
      text: res.data.sanitized_text,
      redactions: res.data.redactions || {},
    };
  } catch (err) {
    // Fail closed: never send raw email text to an external AI provider when
    // the privacy service is unavailable or returns an invalid payload.
    console.warn('Email sanitization failed; using local fallback only:', err.message);
    return null;
  }
}

export function computePriority(task, deadline) {
  let score = 1;

  if (deadline) {
    try {
      const diffHours = (new Date(deadline) - new Date()) / 3_600_000;
      if (diffHours < 0) return 5;
      else if (diffHours <= 6) score += 4;
      else if (diffHours <= 24) score += 3;
      else if (diffHours <= 72) score += 2;
      else score += 1;
    } catch { /* ignore invalid dates */ }
  }

  const text = (task || '').toLowerCase();
  const highKw = ['submit', 'deadline', 'urgent', 'asap', 'important', 'immediately', 'due'];
  const medKw = ['meeting', 'schedule', 'review', 'prepare', 'join', 'attend'];

  if (highKw.some(k => text.includes(k))) score += 2;
  else if (medKw.some(k => text.includes(k))) score += 1;

  return Math.max(1, Math.min(5, score));
}

function normalizeResponse(data) {
  const task = data.task ?? null;
  const deadline = data.deadline ?? null;
  return {
    task,
    deadline,
    priority: computePriority(task, deadline),
    summary: data.summary || '',
    confidence: parseFloat(data.confidence ?? 0.5),
    source_snippet: data.source_snippet || null,
    reasoning: data.reasoning || null,
    deadline_source: data.deadline_source ?? (deadline ? 'llm' : null),
  };
}

async function analyzeWithAI(text) {
  const today = new Date().toISOString().replace('T', ' ').slice(0, 19);
  try {
    const res = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: `You are an advanced email intelligence system.

Today's datetime: ${today}

Context:
- Messages are ordered from oldest → latest
- The LAST message contains the FINAL decision

Rules:
- Always prioritize the latest message
- Interpret relative dates like "tomorrow", "next Monday" using today's date
- Extract only actionable tasks
- Extract time if mentioned (e.g., "5 pm")
- Ignore promotional emails
- source_snippet must be a short verbatim quote from the email that justifies the task
  (not a paraphrase) -- this is shown to the user as evidence for the extraction
- reasoning must be one sentence explaining why this was flagged as a task
- The email may contain placeholders such as [PERSON_1] or [EMAIL_1]. Preserve those
  placeholders exactly; never attempt to infer the original value.

Return STRICT JSON:
{"task": string or null, "deadline": ISO datetime or null, "priority": 1-5, "summary": string, "confidence": 0-1, "source_snippet": string or null, "reasoning": string or null}

If no task: {"task": null, "deadline": null, "priority": 1, "summary": "No actionable task", "confidence": 0.5, "source_snippet": null, "reasoning": null}`,
        },
        { role: 'user', content: text },
      ],
      temperature: 0.2,
    });

    return JSON.parse(res.choices[0].message.content);
  } catch (err) {
    console.warn('AI analysis failed:', err.message);
    return null;
  }
}

async function analyzeWithSpacy(text) {
  try {
    const res = await withRetry(() => axios.post(`${SPACY_SERVICE_URL}/spacy-analyze`, { text }));
    return res.data;
  } catch (err) {
    console.warn('spaCy service unavailable:', err.message);
    return {
      task: 'Derived from conversation',
      deadline: null,
      priority: 2,
      summary: text.slice(0, 100),
      confidence: 0.5,
      source_snippet: null,
      reasoning: null,
      deadline_source: null,
    };
  }
}

export async function analyzeEmailThread(messages) {
  if (!messages?.length) {
    return { task: null, deadline: null, priority: 1, summary: 'No actionable task', confidence: 0.0 };
  }

  const combinedText = messages.join('\n---\n');
  const privacySafeInput = await sanitizeForExternalAI(combinedText);
  if (!privacySafeInput) {
    return normalizeResponse(await analyzeWithSpacy(combinedText));
  }

  const aiResult = await analyzeWithAI(privacySafeInput.text);
  if (aiResult) {
    const sanitizedResult = normalizeResponse(aiResult);
    return {
      ...restoreRedactions(sanitizedResult, privacySafeInput.redactions),
      // Internal-only: routes remove this before returning a task to the browser.
      _sanitized_search_text: buildSanitizedSearchText(sanitizedResult, privacySafeInput.text),
    };
  }

  const fallbackResult = normalizeResponse(await analyzeWithSpacy(combinedText));
  return {
    ...fallbackResult,
    // Fallback summaries can contain raw email text, so do not embed them.
    _sanitized_search_text: `Email: ${privacySafeInput.text.slice(0, 600)}`,
  };
}
