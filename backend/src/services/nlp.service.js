import OpenAI from 'openai';
import { OPENAI_API_KEY } from '../config.js';
import { analyzeWithChrono } from './deadline.service.js';

const client = new OpenAI({ apiKey: OPENAI_API_KEY });

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

export async function analyzeEmailThread(messages) {
  if (!messages?.length) {
    return { task: null, deadline: null, priority: 1, summary: 'No actionable task', confidence: 0.0 };
  }

  const combinedText = messages.join('\n---\n');
  const aiResult = await analyzeWithAI(combinedText);
  if (aiResult) return normalizeResponse(aiResult);
  return normalizeResponse(analyzeWithChrono(combinedText));
}
