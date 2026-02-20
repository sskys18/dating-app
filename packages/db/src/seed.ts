import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const POLES_A = ['CLOSE', 'DIST'] as const;
const POLES_B = ['CALM', 'NEED'] as const;
const POLES_C = ['COMMIT', 'EXPLORE'] as const;
const POLES_D = ['ENGAGE', 'PAUSE'] as const;

interface TypeDef {
  id: number;
  code: string;
  label: string;
  labelKo: string;
  description: string;
  descriptionKo: string;
  axisAPole: string;
  axisBPole: string;
  axisCPole: string;
  axisDPole: string;
}

function generateTypes(): TypeDef[] {
  const types: TypeDef[] = [];

  const labels: Record<string, { en: string; ko: string }> = {
    CLOSE_CALM_COMMIT_ENGAGE: {
      en: 'The Steady Anchor',
      ko: '안정적인 닻',
    },
    CLOSE_CALM_COMMIT_PAUSE: {
      en: 'The Gentle Harbor',
      ko: '포근한 항구',
    },
    CLOSE_CALM_EXPLORE_ENGAGE: {
      en: 'The Curious Companion',
      ko: '호기심 많은 동반자',
    },
    CLOSE_CALM_EXPLORE_PAUSE: {
      en: 'The Quiet Explorer',
      ko: '조용한 탐험가',
    },
    CLOSE_NEED_COMMIT_ENGAGE: {
      en: 'The Passionate Protector',
      ko: '열정적인 수호자',
    },
    CLOSE_NEED_COMMIT_PAUSE: {
      en: 'The Tender Devotee',
      ko: '다정한 헌신자',
    },
    CLOSE_NEED_EXPLORE_ENGAGE: {
      en: 'The Bold Connector',
      ko: '대담한 연결자',
    },
    CLOSE_NEED_EXPLORE_PAUSE: {
      en: 'The Dreamy Seeker',
      ko: '몽환적인 탐색자',
    },
    DIST_CALM_COMMIT_ENGAGE: {
      en: 'The Independent Builder',
      ko: '독립적인 건설자',
    },
    DIST_CALM_COMMIT_PAUSE: {
      en: 'The Calm Strategist',
      ko: '차분한 전략가',
    },
    DIST_CALM_EXPLORE_ENGAGE: {
      en: 'The Free Spirit',
      ko: '자유로운 영혼',
    },
    DIST_CALM_EXPLORE_PAUSE: {
      en: 'The Solo Wanderer',
      ko: '홀로 걷는 방랑자',
    },
    DIST_NEED_COMMIT_ENGAGE: {
      en: 'The Guarded Loyalist',
      ko: '신중한 충성파',
    },
    DIST_NEED_COMMIT_PAUSE: {
      en: 'The Cautious Heart',
      ko: '조심스러운 마음',
    },
    DIST_NEED_EXPLORE_ENGAGE: {
      en: 'The Restless Adventurer',
      ko: '쉬지 않는 모험가',
    },
    DIST_NEED_EXPLORE_PAUSE: {
      en: 'The Distant Dreamer',
      ko: '먼 곳의 몽상가',
    },
  };

  const descriptions: Record<string, { en: string; ko: string }> = {
    CLOSE_CALM_COMMIT_ENGAGE: {
      en: 'You thrive on closeness, stay cool under pressure, prefer commitment, and face conflict head-on. A reliable rock for any partner.',
      ko: '친밀함 속에서 빛나며, 압박 속에서도 침착하고, 헌신을 선호하며, 갈등을 정면으로 마주합니다. 파트너에게 든든한 반석이 되는 타입입니다.',
    },
    CLOSE_CALM_COMMIT_PAUSE: {
      en: 'You love deep connection, remain calm, value commitment, and prefer to step back when tensions rise. A peaceful, devoted partner.',
      ko: '깊은 유대를 사랑하며, 차분함을 유지하고, 헌신을 중시하며, 긴장이 높아지면 한 발 물러서는 편입니다. 평화롭고 헌신적인 파트너입니다.',
    },
    CLOSE_CALM_EXPLORE_ENGAGE: {
      en: 'You enjoy intimacy, stay grounded, like exploring possibilities, and address issues directly. An open-minded yet present partner.',
      ko: '친밀함을 즐기고, 안정감 있으며, 가능성 탐색을 좋아하고, 문제를 직접 해결합니다. 열린 마음이면서도 현재에 충실한 파트너입니다.',
    },
    CLOSE_CALM_EXPLORE_PAUSE: {
      en: 'You crave closeness, keep your cool, enjoy exploring at your own pace, and avoid confrontation. A gentle free spirit in relationships.',
      ko: '친밀함을 갈망하고, 침착함을 유지하며, 자기 페이스로 탐색을 즐기고, 대립을 피합니다. 관계에서 부드러운 자유로운 영혼입니다.',
    },
    CLOSE_NEED_COMMIT_ENGAGE: {
      en: 'You seek deep bonds, feel strongly, commit fully, and tackle problems actively. An intense, protective force in love.',
      ko: '깊은 유대를 추구하고, 강하게 느끼며, 완전히 헌신하고, 문제를 적극적으로 해결합니다. 사랑에서 강렬하고 보호적인 힘입니다.',
    },
    CLOSE_NEED_COMMIT_PAUSE: {
      en: 'You desire closeness, feel deeply, value long-term bonds, and withdraw during conflict. A tender, devoted soul who needs reassurance.',
      ko: '친밀함을 원하고, 깊이 느끼며, 장기적 유대를 중시하고, 갈등 시 물러납니다. 확신이 필요한 다정하고 헌신적인 영혼입니다.',
    },
    CLOSE_NEED_EXPLORE_ENGAGE: {
      en: 'You want connection, feel intensely, enjoy variety, and face friction directly. A passionate soul who wants it all.',
      ko: '연결을 원하고, 강렬하게 느끼며, 다양성을 즐기고, 마찰을 직접 마주합니다. 모든 것을 원하는 열정적인 영혼입니다.',
    },
    CLOSE_NEED_EXPLORE_PAUSE: {
      en: 'You crave attachment, feel deeply, like to keep options open, and shy away from fights. A sensitive dreamer navigating love.',
      ko: '애착을 갈망하고, 깊이 느끼며, 선택지를 열어두길 좋아하고, 싸움을 피합니다. 사랑을 항해하는 민감한 몽상가입니다.',
    },
    DIST_CALM_COMMIT_ENGAGE: {
      en: 'You value independence, stay composed, honor commitments, and resolve issues proactively. A self-sufficient partner who builds steadily.',
      ko: '독립성을 중시하고, 침착함을 유지하며, 약속을 지키고, 문제를 선제적으로 해결합니다. 꾸준히 쌓아가는 자립적인 파트너입니다.',
    },
    DIST_CALM_COMMIT_PAUSE: {
      en: 'You need space, remain calm, believe in commitment, and step back during tension. A quiet, dependable presence.',
      ko: '공간이 필요하고, 차분하며, 헌신을 믿고, 긴장 상황에서 물러납니다. 조용하고 믿음직한 존재입니다.',
    },
    DIST_CALM_EXPLORE_ENGAGE: {
      en: 'You prize freedom, keep cool, love exploring, and engage openly with conflict. An adventurous, level-headed free spirit.',
      ko: '자유를 소중히 하고, 침착하며, 탐색을 사랑하고, 갈등에 열린 자세로 임합니다. 모험적이고 냉철한 자유로운 영혼입니다.',
    },
    DIST_CALM_EXPLORE_PAUSE: {
      en: 'You love autonomy, stay serene, enjoy discovery, and avoid drama. A peaceful wanderer on your own terms.',
      ko: '자율성을 사랑하고, 평온함을 유지하며, 발견을 즐기고, 드라마를 피합니다. 자기만의 방식으로 걷는 평화로운 방랑자입니다.',
    },
    DIST_NEED_COMMIT_ENGAGE: {
      en: 'You guard your space yet yearn for security, commit once trust is earned, and confront issues. A loyal heart behind a cautious wall.',
      ko: '공간을 지키면서도 안정감을 갈망하고, 신뢰가 쌓이면 헌신하며, 문제에 맞섭니다. 신중한 벽 뒤의 충성스러운 마음입니다.',
    },
    DIST_NEED_COMMIT_PAUSE: {
      en: 'You need distance yet crave reassurance, value loyalty, and retreat when overwhelmed. A cautious heart that opens slowly.',
      ko: '거리가 필요하면서도 확신을 갈망하고, 충성을 중시하며, 압도되면 물러납니다. 천천히 열리는 조심스러운 마음입니다.',
    },
    DIST_NEED_EXPLORE_ENGAGE: {
      en: 'You seek independence, feel deeply, keep exploring, and tackle conflicts head-on. A restless spirit chasing connection on your terms.',
      ko: '독립을 추구하고, 깊이 느끼며, 계속 탐색하고, 갈등을 정면으로 해결합니다. 자기만의 방식으로 연결을 쫓는 쉬지 않는 영혼입니다.',
    },
    DIST_NEED_EXPLORE_PAUSE: {
      en: 'You value space, feel intensely, resist settling, and pull away during conflict. A complex soul searching for something just right.',
      ko: '공간을 중시하고, 강렬하게 느끼며, 정착을 꺼리고, 갈등 시 물러납니다. 딱 맞는 무언가를 찾는 복잡한 영혼입니다.',
    },
  };

  for (let a = 0; a < 2; a++) {
    for (let b = 0; b < 2; b++) {
      for (let c = 0; c < 2; c++) {
        for (let d = 0; d < 2; d++) {
          const id = (a << 3) | (b << 2) | (c << 1) | d;
          const code = `${POLES_A[a]}_${POLES_B[b]}_${POLES_C[c]}_${POLES_D[d]}`;
          const label = labels[code];
          const desc = descriptions[code];

          types.push({
            id,
            code,
            label: label.en,
            labelKo: label.ko,
            description: desc.en,
            descriptionKo: desc.ko,
            axisAPole: POLES_A[a],
            axisBPole: POLES_B[b],
            axisCPole: POLES_C[c],
            axisDPole: POLES_D[d],
          });
        }
      }
    }
  }

  return types;
}

async function main() {
  console.log('Seeding 16 types...');

  const types = generateTypes();

  for (const t of types) {
    await prisma.typeCatalog.upsert({
      where: { id: t.id },
      update: t,
      create: t,
    });
  }

  console.log(`Seeded ${types.length} types.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
