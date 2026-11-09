/**
 * DeepSeek（OpenAI 兼容协议）流式调用封装。
 *
 * 上游返回的格式是 `choices[0].delta.content`，而前端（InsightPanel / ChatPanel /
 * 合盘页）按 `data: {"delta":{"text":"..."}}` + `data: [DONE]` 解析，
 * 因此在这里统一做一次转发与格式转换。
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface StreamChatOptions {
  system: string;
  messages: ChatMessage[];
}

const DONE_FRAME = 'data: [DONE]\n\n';

export async function streamChat({ system, messages }: StreamChatOptions): Promise<Response> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'DEEPSEEK_API_KEY 未配置' }, { status: 500 });
  }

  const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com').replace(/\/+$/, '');
  const model = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat';

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
        stream: true,
        temperature: 0.7,
        messages: [{ role: 'system', content: system }, ...messages],
      }),
    });
  } catch (err) {
    console.error('[deepseek] 请求失败:', err);
    return Response.json({ error: '无法连接模型服务' }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    console.error('[deepseek] 上游返回错误', upstream.status, detail);
    return Response.json({ error: `模型服务返回 ${upstream.status}` }, { status: 502 });
  }

  const body = upstream.body;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = '';

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = body.getReader();
      const send = (chunk: string) => controller.enqueue(encoder.encode(chunk));

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const raw of lines) {
            const line = raw.trim();
            if (!line.startsWith('data:')) continue;

            const data = line.slice(5).trim();
            if (data === '[DONE]') {
              send(DONE_FRAME);
              controller.close();
              return;
            }

            try {
              const delta = JSON.parse(data)?.choices?.[0]?.delta;
              const text: string = delta?.content ?? '';
              if (text) send(`data: ${JSON.stringify({ delta: { text } })}\n\n`);
            } catch {
              // 忽略跨 chunk 的不完整片段
            }
          }
        }
        send(DONE_FRAME);
        controller.close();
      } catch (err) {
        console.error('[deepseek] 流式读取失败:', err);
        controller.error(err);
      }
    },
    cancel() {
      body.cancel().catch(() => {});
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
