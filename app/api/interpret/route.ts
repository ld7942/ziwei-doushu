import type { NextRequest } from 'next/server';
import { streamChat, type ChatMessage } from '@/lib/ai/deepseek';
import { detectPatterns } from '@/lib/ziwei/patterns';
import type { ZiweiChart } from '@/lib/ziwei/types';

interface InterpretBody {
  chart?: ZiweiChart;
  messages?: ChatMessage[];
}

export async function POST(req: NextRequest) {
  let body: InterpretBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const { chart, messages } = body;
  if (!chart?.palaces?.length || !Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: '缺少 chart 或 messages' }, { status: 400 });
  }

  // 只保留合法的对话消息，并限制轮数与单条长度
  const history = messages
    .filter(m => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string')
    .slice(-20)
    .map(m => ({ role: m.role, content: m.content.slice(0, 8000) }));

  if (history.length === 0) {
    return Response.json({ error: '没有可用的对话内容' }, { status: 400 });
  }

  const patterns = detectPatterns(chart)
    .map(p => `- ${p.name}（${p.level}）：${p.description}`)
    .join('\n');

  const system = `你是倪海厦《天纪》体系的紫微斗数命理师，负责为一张已经排好的命盘做解读。

规则：
1. 只依据【命盘数据】里实际出现的星曜、宫位、四化与格局作答，不得臆造命盘里没有的信息。
2. 可以引用倪海厦《天纪》或《紫微斗数全书》的观点，但不得编造原文、集数与时间码。
3. 健康、婚姻、六亲等结论要留有余地，敏感内容注明「仅供参考」。
4. 输出 Markdown：大节标题用 **【标题】** 独占一行，正文可用 **加粗**，不要用表格和代码块。
5. 每段回答控制在 800 字以内，先结论、再依据、最后给可操作建议。

【命盘数据】
${JSON.stringify(chart)}

【已识别格局】
${patterns || '（无）'}`;

  return streamChat({ system, messages: history });
}
