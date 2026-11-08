import type { ZiweiChart, Palace, Star } from './types';
import { STEMS, BRANCHES } from './constants';

/**
 * 将 ZiweiChart 序列化为结构化命盘文本，供 AI 解读（/api/interpret、/api/heming）使用。
 * 开源版不含断语库（db-analysis.ts 为占位），此函数只输出「排盘引擎」产出的客观事实：
 * 四柱、宫位、星曜、四化、格局、大限 —— 不含任何主观论断。
 */

function brightnessText(star: Star): string {
  if (star.brightnessRaw) return star.brightnessRaw;
  if (star.brightness === 'bright') return '庙';
  if (star.brightness === 'normal') return '平';
  if (star.brightness === 'dim') return '陷';
  return '';
}

function starText(star: Star): string {
  const parts: string[] = [star.name];
  const b = brightnessText(star);
  if (b) parts.push(`[${b}]`);
  if (star.siHua) parts.push(`化${star.siHua}`);
  return parts.join('');
}

function palaceText(p: Palace): string {
  const major = p.stars.filter((s) => s.type === 'major');
  const others = p.stars.filter((s) => s.type !== 'major');

  const starParts: string[] = [];
  if (major.length > 0) {
    starParts.push(major.map(starText).join('、'));
  }
  if (others.length > 0) {
    const minor = others
      .filter((s) => s.siHua || s.type === 'lucky' || s.type === 'sha')
      .map(starText);
    const rest = others
      .filter((s) => !(s.siHua || s.type === 'lucky' || s.type === 'sha'))
      .map(starText);
    if (minor.length > 0) starParts.push(minor.join('、'));
    if (rest.length > 0) starParts.push(rest.join('、'));
  }

  const starsStr = starParts.length > 0 ? starParts.join('，') : '（空宫）';

  const marks: string[] = [];
  if (p.isMingGong) marks.push('命宫');
  if (p.isShenGong) marks.push('身宫');
  if (p.selfSihua && p.selfSihua.length > 0) {
    marks.push('自化:' + p.selfSihua.map((s) => `${s.starName}化${s.siHua}`).join('、'));
  }

  const head = `${p.name}(${BRANCHES[p.branch]})`;
  const markStr = marks.length > 0 ? ` 【${marks.join('·')}】` : '';
  return `${head}${markStr}: ${starsStr}`;
}

export function chartToText(chart: ZiweiChart): string {
  const lines: string[] = [];
  const bi = chart.birthInfo;
  const li = chart.lunarInfo;

  // ── 出生信息 ──
  lines.push('【出生信息】');
  lines.push(
    `公历 ${bi.year}年${bi.month}月${bi.day}日 ${BRANCHES[bi.hour]}时（${bi.gender === 'male' ? '男' : '女'}）`
  );
  lines.push(
    `农历 ${li.lunarYear}年${li.isLeapMonth ? '闰' : ''}${li.lunarMonth}月${li.lunarDay}日`
  );
  const pillars = li.fourPillars;
  if (pillars && pillars.length === 4) {
    lines.push(`四柱：${pillars.join(' ')}`);
  }
  lines.push(
    `${STEMS[li.yearStem]}${BRANCHES[li.yearBranch]}年生人`
  );

  // ── 命格基础 ──
  lines.push('');
  lines.push('【命格基础】');
  lines.push(`命宫：${BRANCHES[chart.mingGongBranch]}宫`);
  lines.push(`身宫：${BRANCHES[chart.shenGongBranch]}宫`);
  lines.push(`五行局：${chart.wuxingJuName}`);
  if (chart.yinYangGender) lines.push(`阴阳：${chart.yinYangGender}`);
  if (chart.mingZhu) lines.push(`命主：${chart.mingZhu}`);
  if (chart.shenZhu) lines.push(`身主：${chart.shenZhu}`);

  // ── 十二宫 ──
  lines.push('');
  lines.push('【十二宫】');
  for (const p of chart.palaces) {
    lines.push(palaceText(p));
  }

  // ── 本命四化 ──
  const sihua: string[] = [];
  for (const p of chart.palaces) {
    for (const s of p.stars) {
      if (s.siHua) sihua.push(`${s.name}化${s.siHua}（在${p.name}）`);
    }
  }
  if (sihua.length > 0) {
    lines.push('');
    lines.push('【本命四化】');
    lines.push(sihua.join('、'));
  }

  // ── 大限 ──
  if (chart.daXians && chart.daXians.length > 0) {
    lines.push('');
    lines.push('【大限】');
    lines.push(
      chart.daXians
        .map((dx, i) => {
          const cur = i === chart.currentDaXianIndex ? '（当前）' : '';
          return `${dx.startAge}~${dx.endAge}岁 ${dx.palaceName}${cur}`;
        })
        .join('；')
    );
  }

  return lines.join('\n');
}
