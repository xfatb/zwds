export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * 调用 DeepSeek（OpenAI 兼容）流式接口，并把上游 SSE 转成前端期望的格式：
 *   data: {"delta":{"text":"..."}}
 *   data: [DONE]
 */
export async function streamDeepSeekCompletion(
  messages: ChatMessage[],
  signal?: AbortSignal
): Promise<Response> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: '服务端未配置 DEEPSEEK_API_KEY' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');

  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: 0.7,
      }),
      signal,
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: '连接 DeepSeek API 失败' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => '');
    return new Response(
      JSON.stringify({ error: `DeepSeek API 错误 (${upstream.status})`, detail: errText.slice(0, 500) }),
      { status: upstream.status, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const data = trimmed.slice(5).trim();
            if (data === '[DONE]') {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ delta: { text: content } })}\n\n`)
                );
              }
            } catch {
              // 跳过无法解析的行
            }
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
