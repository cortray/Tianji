import type { BaziChart, Skill } from '../types'

export interface BaziProfile {
  name: string
  gender: 'male' | 'female'
  birthdayText: string
  hourText: string
  birthplace: string
  alive: boolean
}

/** AI 命理分析 system prompt：角色 + 分析框架 + 经典典籍规则 */
export function buildBaziSystemPrompt(skill: Skill | null): string {
  const framework = `你是一位中国传统四柱八字命理的专业研究者，熟读《穷通宝典》《三命通会》《滴天髓》《渊海子平》《子平真诠》《神峰通考》等典籍。请严格按照以下框架对用户提供的排盘结果进行专业分析：

1. 日主分析：判断日干旺衰（得令、得地、得势），确定身旺/身弱/从强/从弱，分析日主五行特性对性格的影响。
2. 十神分析：列出各柱十神及其含义，重点分析对日主影响最大的十神，结合六亲关系。
3. 五行平衡：统计命局五行力量分布，判断偏旺/偏缺，确定喜用神和忌神（参考调候用神）。
4. 格局判定：根据月令和透干确定格局，判断格局高低成败，分析用神和相神的有力无力。
5. 大运分析：分析当前所处大运及各步大运的整体吉凶趋势，重点分析当前大运对原局的影响。
6. 流年分析：分析当年流年干支与原局、大运的关系，预测当年运势趋势，可适当展望近 1-3 年。
7. 历史事件校准：根据排盘结果提出 3-5 个该人已经发生的关键事件的时间段和性质预测，供用户验证是否准确。
8. 综合建议：事业方向、财运趋势、感情婚姻、健康注意事项。

所有论断应引用经典典籍并标注出处。注意：命理分析仅供文化研究和参考，避免极端或恐吓性断语，保持中性和建设性语气。`

  const classical = skill?.references.find((r) => r.name.includes('classical-texts'))?.content
  if (!classical) return framework
  return (
    framework +
    '\n\n# 经典典籍论命规则摘要\n（以下为九本经典的核心论命规则，分析时请引用对应条目并标注出处）\n\n' +
    classical
  )
}

/** AI 命理分析 user prompt：出生信息 + 排盘 JSON + 分析要求 */
export function buildBaziUserPrompt(profile: BaziProfile, chart: BaziChart): string {
  const gender = profile.gender === 'male' ? '男' : '女'
  return `请对以下八字进行完整的专业命理分析。

【出生信息】
- 姓名：${profile.name || '（未提供）'}
- 性别：${gender}
- 出生日期：${profile.birthdayText}
- 出生时辰：${profile.hourText || '未知'}
- 出生地：${profile.birthplace || '（未提供）'}
- 在世状态：${profile.alive ? '在世' : '已故'}
- 当前公历年：${chart.currentYear.year}（流年：${chart.currentYear.ganzhi}）

【排盘结果】（本地精确计算，含四柱/十神/藏干/纳音/五行/大运）
${JSON.stringify(chart, null, 2)}

【分析要求】
请严格按系统提示中的 8 个步骤进行分析，重点：
1. 用清晰的分节和小标题组织输出；
2. 明确给出喜用神与忌神结论；
3. 结合当前大运和流年 ${chart.currentYear.ganzhi} 分析近期运势；
4. 提出 3-5 个历史关键事件的验证预测（时间段 + 性质），并说明推断依据；
5. 最后给出事业、财运、感情、健康四方面的综合建议。`
}
