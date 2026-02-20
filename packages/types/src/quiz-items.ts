import type { QuizItem } from './quiz';

/**
 * 12 quiz items: 3 per axis (A, B, C, D), forced A/B choice.
 * Axis encoding: choosing option B increments the axis score.
 * - Axis A (Avoidance): B = DIST direction (score toward DIST)
 * - Axis B (Anxiety):    B = NEED direction (score toward NEED)
 * - Axis C (Orientation): B = EXPLORE direction (score toward EXPLORE)
 * - Axis D (Conflict):   B = PAUSE direction (score toward PAUSE)
 *
 * Pole assignment: score 0-1 → first pole (CLOSE/CALM/COMMIT/ENGAGE),
 *                  score 2-3 → second pole (DIST/NEED/EXPLORE/PAUSE)
 */
export const QUIZ_ITEMS: QuizItem[] = [
  // ─── Axis A: Avoidance (CLOSE vs DIST) ─────────────────────
  {
    id: 0,
    axis: 'a',
    optionA: {
      text: 'I feel most secure when my partner and I share everything openly.',
      textKo: '파트너와 모든 것을 솔직하게 나눌 때 가장 안정감을 느낍니다.',
    },
    optionB: {
      text: 'I feel most secure when I have my own space, even in a relationship.',
      textKo: '연애 중에도 나만의 공간이 있을 때 가장 안정감을 느낍니다.',
    },
  },
  {
    id: 1,
    axis: 'a',
    optionA: {
      text: 'When I\'m stressed, I want to talk it out with my partner right away.',
      textKo: '스트레스를 받으면 파트너와 바로 이야기를 나누고 싶습니다.',
    },
    optionB: {
      text: 'When I\'m stressed, I need time alone to process before talking.',
      textKo: '스트레스를 받으면 이야기하기 전에 혼자 정리할 시간이 필요합니다.',
    },
  },
  {
    id: 2,
    axis: 'a',
    optionA: {
      text: 'A perfect weekend means spending most of it together with my partner.',
      textKo: '완벽한 주말은 파트너와 대부분의 시간을 함께 보내는 것입니다.',
    },
    optionB: {
      text: 'A perfect weekend includes significant time for my own activities.',
      textKo: '완벽한 주말에는 나만의 활동을 위한 충분한 시간이 포함됩니다.',
    },
  },

  // ─── Axis B: Anxiety (CALM vs NEED) ─────────────────────────
  {
    id: 3,
    axis: 'b',
    optionA: {
      text: "If my partner doesn't reply for a while, I assume they're just busy.",
      textKo: '파트너가 한동안 답장이 없으면 바쁜가 보다 하고 생각합니다.',
    },
    optionB: {
      text: "If my partner doesn't reply for a while, I start wondering if something's wrong.",
      textKo: '파트너가 한동안 답장이 없으면 무슨 일이 있는 건 아닌지 걱정됩니다.',
    },
  },
  {
    id: 4,
    axis: 'b',
    optionA: {
      text: 'I rarely need verbal reassurance to feel secure in a relationship.',
      textKo: '관계에서 안정감을 느끼기 위해 말로 확인받을 필요가 거의 없습니다.',
    },
    optionB: {
      text: 'Hearing "I care about you" regularly helps me feel more settled.',
      textKo: '"널 아끼고 있어"라는 말을 자주 들으면 마음이 더 안정됩니다.',
    },
  },
  {
    id: 5,
    axis: 'b',
    optionA: {
      text: 'After a small disagreement, I can move on fairly quickly.',
      textKo: '작은 의견 충돌 후에는 비교적 빨리 넘어갈 수 있습니다.',
    },
    optionB: {
      text: 'After a small disagreement, I tend to replay it in my mind for a while.',
      textKo: '작은 의견 충돌 후에도 한동안 계속 그 생각이 맴돕니다.',
    },
  },

  // ─── Axis C: Orientation (COMMIT vs EXPLORE) ────────────────
  {
    id: 6,
    axis: 'c',
    optionA: {
      text: 'I prefer to focus on building something deep with one person.',
      textKo: '한 사람과 깊은 관계를 쌓아가는 것을 선호합니다.',
    },
    optionB: {
      text: 'I prefer to take my time getting to know different people before deciding.',
      textKo: '결정하기 전에 여러 사람을 천천히 알아가는 것을 선호합니다.',
    },
  },
  {
    id: 7,
    axis: 'c',
    optionA: {
      text: 'Having a clear definition of the relationship early on feels right to me.',
      textKo: '초기에 관계를 명확하게 정의하는 것이 저에게 맞습니다.',
    },
    optionB: {
      text: "I'd rather let a relationship develop naturally without early labels.",
      textKo: '초기 라벨 없이 관계가 자연스럽게 발전하도록 두는 것을 선호합니다.',
    },
  },
  {
    id: 8,
    axis: 'c',
    optionA: {
      text: 'Long-term planning with a partner excites me.',
      textKo: '파트너와의 장기적인 계획은 저를 설레게 합니다.',
    },
    optionB: {
      text: 'Keeping future plans flexible sounds more appealing.',
      textKo: '미래 계획을 유연하게 유지하는 것이 더 매력적으로 느껴집니다.',
    },
  },

  // ─── Axis D: Conflict (ENGAGE vs PAUSE) ─────────────────────
  {
    id: 9,
    axis: 'd',
    optionA: {
      text: 'When tension comes up, I prefer to address it right away.',
      textKo: '긴장이 생기면 바로 해결하는 것을 선호합니다.',
    },
    optionB: {
      text: 'When tension comes up, I prefer to wait until things cool down.',
      textKo: '긴장이 생기면 상황이 가라앉을 때까지 기다리는 것을 선호합니다.',
    },
  },
  {
    id: 10,
    axis: 'd',
    optionA: {
      text: 'I think disagreements can actually strengthen a relationship.',
      textKo: '의견 불일치가 오히려 관계를 강화할 수 있다고 생각합니다.',
    },
    optionB: {
      text: "I think it's better to avoid conflict whenever possible.",
      textKo: '가능하면 갈등을 피하는 것이 더 낫다고 생각합니다.',
    },
  },
  {
    id: 11,
    axis: 'd',
    optionA: {
      text: "I'd rather have an honest, direct conversation even if it's uncomfortable.",
      textKo: '불편하더라도 솔직하고 직접적인 대화를 하는 편을 택합니다.',
    },
    optionB: {
      text: "I'd rather keep the peace and bring it up later, if at all.",
      textKo: '평화를 유지하고 나중에, 혹은 아예 언급하지 않는 편을 택합니다.',
    },
  },
];
