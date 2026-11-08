import { NextRequest } from 'next/server';
import type { ZiweiChart } from '@/lib/ziwei/types';
import { chartToText } from '@/lib/ziwei/chart-text';
import { HEMING_METHODOLOGY } from '@/lib/ziwei/heming-knowledge';
import { streamDeepSeekCompletion, type ChatMessage } from '@/lib/ai/deepseek';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: { chartA?: ZiweiChart; chartB?: ZiweiChart; question?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: '请求体解析失败' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { chartA, chartB, question } = body;
  if (!chartA || !chartB) {
    return new Response(JSON.stringify({ error: '缺少 chartA 或 chartB' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const system = `你是一位精通倪海厦《天纪》紫微斗数合盘分析的资深命理师。请严格按照下方合盘方法论，结合两个人的命盘客观排盘数据，进行专业、系统的合盘（婚姻/缘分）分析。

【合盘方法论】
${HEMING_METHODOLOGY}

【甲方命盘】
${chartToText(chartA)}

【乙方命盘】
${chartToText(chartB)}

【输出要求】
1. 严格基于两方命盘数据与方法论，不凭空编造。
2. 重点分析：双方命宫/夫妻宫/福德宫互参、太阳太阴星象、四化飞化互参、大限同步。
3. 给出缘分类型判断（正缘/良配/需磨合/凶兆），以及相处建议。
4. 语言专业、条理清晰，用 Markdown 小标题分段，客观理性。`;

  const chatMessages: ChatMessage[] = [{ role: 'system', content: system }];
  if (question && question.trim()) {
    chatMessages.push({ role: 'user', content: question.trim() });
  } else {
    chatMessages.push({ role: 'user', content: '请对两人的婚姻缘分进行完整合盘分析。' });
  }

  return streamDeepSeekCompletion(chatMessages, req.signal);
}
