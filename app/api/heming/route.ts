import type { NextRequest } from 'next/server';
import { streamChat } from '@/lib/ai/deepseek';
import { HEMING_METHODOLOGY } from '@/lib/ziwei/heming-knowledge';
import type { ZiweiChart } from '@/lib/ziwei/types';

interface HemingBody {
  chartA?: ZiweiChart;
  chartB?: ZiweiChart;
  question?: string;
}

const DEFAULT_QUESTION =
  '请评估两人的合盘匹配度：先看双方命格基础，再互参夫妻宫与福德宫，' +
  '分析相处模式、潜在风险，最后给出具体建议。';

export async function POST(req: NextRequest) {
  let body: HemingBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const { chartA, chartB, question } = body;
  if (!chartA?.palaces?.length || !chartB?.palaces?.length) {
    return Response.json({ error: '缺少 chartA 或 chartB' }, { status: 400 });
  }

  const ask = typeof question === 'string' && question.trim()
    ? question.trim().slice(0, 1000)
    : DEFAULT_QUESTION;

  const system = `你是倪海厦《天纪》体系的紫微斗数命理师，负责双盘合参。
只依据双方命盘中实际出现的星曜、宫位与四化作答，不得臆造；可以引用倪师观点，但不得编造原文。
健康、婚姻等结论留有余地，敏感内容注明「仅供参考」。
输出 Markdown：大节标题用 **【标题】** 独占一行，不要用表格和代码块，全文控制在 1200 字以内。

${HEMING_METHODOLOGY}

【甲方命盘】
${JSON.stringify(chartA)}

【乙方命盘】
${JSON.stringify(chartB)}`;

  return streamChat({ system, messages: [{ role: 'user', content: ask }] });
}
