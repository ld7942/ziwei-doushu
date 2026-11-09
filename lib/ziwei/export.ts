/**
 * Markdown 导出：把命盘信息 + AI 解读拼成一份 .md 文档。
 *
 * 这份文件运行在浏览器侧（InsightPanel / 合盘页均为 'use client'），
 * 所以不要 import 依赖 Node 的模块；lib/ziwei 下的纯数据/纯函数可以直接用。
 */

import { STEMS, BRANCHES, SHICHEN } from './constants';
import { detectPatterns } from './patterns';
import type { ZiweiChart } from './types';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** 单盘 Markdown */
export function chartToMarkdown(chart: ZiweiChart, messages?: ChatMessage[]): string {
  const b = chart.birthInfo;
  const genderLabel = b.gender === 'male' ? '男' : '女';
  const shichen = SHICHEN[b.hour];
  const stem = STEMS[chart.lunarInfo.yearStem];
  const branch = BRANCHES[chart.lunarInfo.yearBranch];
  const mingGong = chart.palaces.find(p => p.branch === chart.mingGongBranch);
  const shenGong = chart.palaces.find(p => p.branch === chart.shenGongBranch);
  const patterns = detectPatterns(chart);

  const lines: string[] = [];

  lines.push(`# 紫微斗数命盘解读`);
  lines.push('');
  lines.push(`> 生成时间：${new Date().toLocaleString('zh-CN')}`);
  lines.push('');

  // ─── 基本信息 ───
  lines.push(`## 一、基本信息`);
  lines.push('');
  if (b.name) lines.push(`- **姓名**：${b.name}`);
  lines.push(`- **性别**：${genderLabel}`);
  lines.push(`- **公历出生**：${b.year} 年 ${b.month} 月 ${b.day} 日 ${shichen.name}（${shichen.range}）`);
  if (b.province && b.city) lines.push(`- **出生地**：${b.province} ${b.city}`);
  if (b.longitude) lines.push(`- **出生地经度**：${b.longitude}°`);
  lines.push(`- **生年干支**：${stem}${branch}（${chart.yinYangGender ?? ''}）`);
  lines.push(`- **五行局**：${chart.wuxingJuName}`);
  if (chart.mingZhu) lines.push(`- **命主星**：${chart.mingZhu}`);
  if (chart.shenZhu) lines.push(`- **身主星**：${chart.shenZhu}`);
  lines.push('');

  // ─── 命宫 / 身宫 ───
  lines.push(`## 二、命宫与身宫`);
  lines.push('');
  if (mingGong) {
    const stars = formatPalaceStars(mingGong);
    lines.push(`- **命宫**（${BRANCHES[mingGong.branch]}）：${stars || '无主星（借对宫）'}`);
  }
  if (shenGong && shenGong !== mingGong) {
    const stars = formatPalaceStars(shenGong);
    lines.push(`- **身宫**（${BRANCHES[shenGong.branch]}）：${stars || '无主星'}`);
  }
  lines.push('');

  // ─── 生年四化 ───
  const sihua = chart.palaces
    .flatMap(p => p.stars.filter(s => s.siHua))
    .map(s => `${s.name}化${s.siHua}`);
  if (sihua.length > 0) {
    lines.push(`## 三、生年四化`);
    lines.push('');
    lines.push(`- ${sihua.join('、')}`);
    lines.push('');
  }

  // ─── 当前大限 ───
  const curDx = chart.daXians[chart.currentDaXianIndex];
  if (curDx) {
    lines.push(`## 四、当前大限（${curDx.startAge}–${curDx.endAge} 岁）`);
    lines.push('');
    lines.push(`- **大限宫**：${curDx.palaceName}（${BRANCHES[curDx.palaceBranch]}）`);
    if (curDx.siHua) {
      const sh = curDx.siHua;
      const parts = [];
      if (sh.lu) parts.push(`${sh.lu}化禄`);
      if (sh.quan) parts.push(`${sh.quan}化权`);
      if (sh.ke) parts.push(`${sh.ke}化科`);
      if (sh.ji) parts.push(`${sh.ji}化忌`);
      if (parts.length) lines.push(`- **大限四化**：${parts.join('、')}`);
    }
    lines.push('');
  }

  // ─── 格局 ───
  if (patterns.length > 0) {
    lines.push(`## 五、已识别格局（${patterns.length} 个）`);
    lines.push('');
    const levelLabel: Record<string, string> = {
      excellent: '上格', good: '吉格', neutral: '平格', caution: '凶格',
    };
    for (const p of patterns) {
      const tag = levelLabel[p.level] ?? p.level;
      lines.push(`- **${p.name}**（${tag}）：${p.description}`);
    }
    lines.push('');
  }

  // ─── AI 解读 ───
  if (messages && messages.length > 0) {
    lines.push(`## 六、AI 解读`);
    lines.push('');
    for (const msg of messages) {
      if (msg.role === 'user') continue;
      const clean = msg.content.trim();
      if (!clean) continue;
      lines.push(clean);
      lines.push('');
    }
  }

  return lines.join('\n');
}

/** 合盘 Markdown */
export function hemingToMarkdown(
  chartA: ZiweiChart,
  chartB: ZiweiChart,
  analysis: string,
  question?: string,
): string {
  const lines: string[] = [];
  lines.push(`# 紫微合盘分析`);
  lines.push('');
  lines.push(`> 生成时间：${new Date().toLocaleString('zh-CN')}`);
  lines.push('');

  const aLabel = chartA.birthInfo.gender === 'male' ? '男方' : '女方';
  const bLabel = chartB.birthInfo.gender === 'male' ? '男方' : '女方';

  lines.push(`## 甲方（${aLabel}）`);
  lines.push('');
  lines.push(formatBirthInfoLine(chartA));
  lines.push('');

  lines.push(`## 乙方（${bLabel}）`);
  lines.push('');
  lines.push(formatBirthInfoLine(chartB));
  lines.push('');

  if (question) {
    lines.push(`## 提问`);
    lines.push('');
    lines.push(question);
    lines.push('');
  }

  if (analysis.trim()) {
    lines.push(`## 合盘分析`);
    lines.push('');
    lines.push(analysis.trim());
    lines.push('');
  }

  return lines.join('\n');
}

// ─── 工具函数 ───────────────────────────────────────────────

function formatPalaceStars(palace: ZiweiChart['palaces'][number]): string {
  return palace.stars
    .map(s => `${s.name}${s.siHua ? '化' + s.siHua : ''}`)
    .join('、');
}

function formatBirthInfoLine(chart: ZiweiChart): string {
  const b = chart.birthInfo;
  const shichen = SHICHEN[b.hour];
  const mingGong = chart.palaces.find(p => p.branch === chart.mingGongBranch);
  const mingStars = mingGong
    ? mingGong.stars.filter(s => s.type === 'major').map(s => s.name).join('、') || '无主星'
    : '';
  const gender = b.gender === 'male' ? '男' : '女';
  const name = b.name ? `${b.name}，` : '';
  return `- ${name}${gender}，${b.year} 年 ${b.month} 月 ${b.day} 日 ${shichen.name}，命宫主星：${mingStars}`;
}

/** 下载：把文本以 UTF-8 BOM 写成 Blob 并触发浏览器下载。 */
export function downloadMarkdown(filename: string, content: string) {
  // UTF-8 BOM，避免 Windows 记事本打开时乱码
  const blob = new Blob(['\uFEFF' + content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    // 稍后释放 object URL，避免内存泄漏
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** 基于命盘生成默认文件名，如 `紫微命盘_男_1990-01-01_子时.md` */
export function chartFilename(chart: ZiweiChart, suffix = ''): string {
  const b = chart.birthInfo;
  const gender = b.gender === 'male' ? '男' : '女';
  const shichen = SHICHEN[b.hour]?.name ?? '';
  const base = b.name
    ? `${b.name}_${gender}_${b.year}-${pad(b.month)}-${pad(b.day)}_${shichen}`
    : `紫微命盘_${gender}_${b.year}-${pad(b.month)}-${pad(b.day)}_${shichen}`;
  return `${base}${suffix ? '_' + suffix : ''}.md`;
}

function pad(n: number) { return String(n).padStart(2, '0'); }
