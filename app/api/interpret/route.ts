import { NextRequest } from 'next/server';
import type { ZiweiChart } from '@/lib/ziwei/types';
import { chartToText } from '@/lib/ziwei/chart-text';
import { detectPatterns } from '@/lib/ziwei/patterns';
import { streamDeepSeekCompletion, type ChatMessage } from '@/lib/ai/deepseek';

export const runtime = 'nodejs';

function buildSystemPrompt(chart: ZiweiChart): string {
  const chartText = chartToText(chart);

  const patterns = detectPatterns(chart);
  let patternText = '';
  if (patterns.length > 0) {
    patternText =
      '\n\n【格局识别】\n' +
      patterns.map((p) => `${p.name}（${p.level}）：${p.description}`).join('\n');
  }

  return `你是一位精通倪海厦《天纪》紫微斗数体系的资深命理师。请基于下方命盘客观排盘数据，进行专业、系统、有依据的命理解读。

【解读要求】
1. 严格基于命盘数据，不得凭空编造不存在的星曜或宫位。
2. 遵循倪海厦体系：重视宫位三方四正、庙旺利陷、生年四化；不使用飞星派的宫干自化、大限四化等技法。
3. 语言专业但通俗，可用 Markdown 小标题分段，重点突出、层次分明。
4. 客观理性，不制造焦虑，结尾可简短提示「命理仅供参考」。
5. 命理专名保留中文。

【命盘数据】
${chartText}${patternText}`;
}

export async function POST(req: NextRequest) {
  let body: { chart?: ZiweiChart; messages?: { role: string; content: string }[] };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: '请求体解析失败' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { chart, messages } = body;
  if (!chart || !messages || !Array.isArray(messages)) {
    return new Response(JSON.stringify({ error: '缺少 chart 或 messages' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const chatMessages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(chart) },
    ...messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ];

  return streamDeepSeekCompletion(chatMessages, req.signal);
}
