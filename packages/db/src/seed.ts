import { PrismaClient } from '../generated/client';

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
  labelJa: string;
  description: string;
  descriptionKo: string;
  descriptionJa: string;
  axisAPole: string;
  axisBPole: string;
  axisCPole: string;
  axisDPole: string;
}

function generateTypes(): TypeDef[] {
  const types: TypeDef[] = [];

  const labels: Record<string, { en: string; ko: string; ja: string }> = {
    CLOSE_CALM_COMMIT_ENGAGE: {
      en: 'The Warm Anchor',
      ko: '따뜻한 닻',
      ja: 'あたたかな錨（いかり）',
    },
    CLOSE_CALM_COMMIT_PAUSE: {
      en: 'The Cozy Harbor',
      ko: '포근한 항구',
      ja: 'ほっとする港',
    },
    CLOSE_CALM_EXPLORE_ENGAGE: {
      en: 'The Curious Sweetheart',
      ko: '호기심 많은 다정한 사람',
      ja: '好奇心いっぱいの優しい人',
    },
    CLOSE_CALM_EXPLORE_PAUSE: {
      en: 'The Easygoing Explorer',
      ko: '느긋한 탐험가',
      ja: 'のんびり屋の探検家',
    },
    CLOSE_NEED_COMMIT_ENGAGE: {
      en: 'The Devoted Sweetheart',
      ko: '헌신적인 사랑꾼',
      ja: '一途な甘えん坊',
    },
    CLOSE_NEED_COMMIT_PAUSE: {
      en: 'The Tender Heart',
      ko: '다정한 마음',
      ja: 'やさしい心の持ち主',
    },
    CLOSE_NEED_EXPLORE_ENGAGE: {
      en: 'The Passionate Spark',
      ko: '열정 가득한 사람',
      ja: '情熱たっぷりな人',
    },
    CLOSE_NEED_EXPLORE_PAUSE: {
      en: 'The Gentle Dreamer',
      ko: '다정한 몽상가',
      ja: 'やわらかな夢見がち',
    },
    DIST_CALM_COMMIT_ENGAGE: {
      en: 'The Steady Independent',
      ko: '듬직한 독립러',
      ja: '頼れるマイペース',
    },
    DIST_CALM_COMMIT_PAUSE: {
      en: 'The Calm Companion',
      ko: '차분한 동반자',
      ja: '穏やかな相棒',
    },
    DIST_CALM_EXPLORE_ENGAGE: {
      en: 'The Free Spirit',
      ko: '자유로운 영혼',
      ja: '自由な心の持ち主',
    },
    DIST_CALM_EXPLORE_PAUSE: {
      en: 'The Easy Wanderer',
      ko: '여유로운 방랑자',
      ja: 'マイペースな旅人',
    },
    DIST_NEED_COMMIT_ENGAGE: {
      en: 'The Loyal Heart',
      ko: '한결같은 마음',
      ja: '一途で誠実な人',
    },
    DIST_NEED_COMMIT_PAUSE: {
      en: 'The Slow-to-Bloom Heart',
      ko: '천천히 피어나는 마음',
      ja: 'ゆっくり花ひらく心',
    },
    DIST_NEED_EXPLORE_ENGAGE: {
      en: 'The Spirited Adventurer',
      ko: '활기찬 모험가',
      ja: '元気いっぱいの冒険家',
    },
    DIST_NEED_EXPLORE_PAUSE: {
      en: 'The Thoughtful Dreamer',
      ko: '사려 깊은 몽상가',
      ja: '思いやり深い夢見がち',
    },
  };

  const descriptions: Record<string, { en: string; ko: string; ja: string }> = {
    CLOSE_CALM_COMMIT_ENGAGE: {
      en: "You love being close, you stay calm when things get bumpy, and you're all in once you've found your person. When something needs talking through, you go for it gently and openly.",
      ko: '가까이 있는 걸 좋아하고, 힘든 순간에도 침착함을 잃지 않아요. 한번 마음을 정하면 진심을 다하고, 풀어야 할 일이 생기면 부드럽게 먼저 대화를 꺼내는 사람이에요.',
      ja: '相手とそばにいる時間が好きで、ちょっとした波風が立っても落ち着いていられる人。一度「この人」と決めたら全力で向き合い、話し合いが必要なときは、やさしく自分から切り出せます。',
    },
    CLOSE_CALM_COMMIT_PAUSE: {
      en: "You cherish deep connection and bring a calm, steady warmth to it. You're in it for the long run, and when tension rises you like to take a quiet moment before coming back to talk.",
      ko: '깊은 유대를 소중히 여기고, 곁에 있으면 마음이 편안해지는 따뜻함을 가진 사람이에요. 오래 함께할 사이를 꿈꾸고, 긴장이 생기면 잠시 숨을 고른 뒤 다시 다가와 이야기를 나눠요.',
      ja: '深いつながりを大切にし、一緒にいるとほっとする穏やかなあたたかさを持つ人。長く続く関係を望んでいて、ぴりっとした空気になったら、少し間を置いてからまた歩み寄って話せます。',
    },
    CLOSE_CALM_EXPLORE_ENGAGE: {
      en: "You enjoy real closeness and stay grounded while staying curious about where things could go. When something comes up, you talk it out openly, no drama.",
      ko: '진짜 가까운 사이를 즐기면서도 안정감을 잃지 않고, 두 사람의 가능성을 호기심 어린 눈으로 바라보는 사람이에요. 무슨 일이 생기면 꾸밈없이 솔직하게 풀어가요.',
      ja: '本当の意味で近い関係を楽しみながらも地に足がついていて、これからどうなるかを好奇心いっぱいに見つめられる人。何かあれば、構えずにオープンに話し合えます。',
    },
    CLOSE_CALM_EXPLORE_PAUSE: {
      en: "You love feeling close, you keep an easy calm about you, and you like exploring life at your own pace. When things heat up, you'd rather take a breather than push.",
      ko: '가까운 느낌을 사랑하고, 늘 여유로운 차분함을 지닌 사람이에요. 자기만의 속도로 새로운 걸 탐험하길 좋아하고, 분위기가 달아오르면 밀어붙이기보다 잠시 쉬어가는 편이에요.',
      ja: '近さを感じることが大好きで、いつもゆったりとした落ち着きをまとっている人。自分のペースで新しいことを楽しみたいタイプで、空気が熱くなったら、押すよりひと息つくことを選びます。',
    },
    CLOSE_NEED_COMMIT_ENGAGE: {
      en: "You love deeply and aren't afraid to show it, and a little reassurance goes a long way for you. You give your whole heart and face things together, head-on.",
      ko: '깊이 사랑하고 그 마음을 숨기지 않으며, 작은 확인 한마디가 큰 힘이 되는 사람이에요. 마음을 온전히 내어주고, 무슨 일이든 함께 정면으로 마주해요.',
      ja: '深く愛し、その気持ちを隠さない人。ちょっとした安心の言葉が大きな支えになります。心をまるごと差し出し、どんなことも一緒に正面から向き合えます。',
    },
    CLOSE_NEED_COMMIT_PAUSE: {
      en: "You feel things deeply and treasure closeness and reassurance, and you're built for a lasting bond. When conflict shows up, you take a gentle pause before you're ready to reconnect.",
      ko: '깊이 느끼는 사람이라 친밀함과 확신을 무엇보다 소중히 여기고, 오래가는 인연에 잘 어울려요. 갈등이 생기면 마음을 추스를 시간을 가진 뒤 다시 다가갈 준비를 해요.',
      ja: '物事を深く感じ取る人で、近さと安心感を何より大切にし、長く続く絆にぴったり。すれ違いが起きたら、そっとひと呼吸おいてから、また心を寄せる準備をします。',
    },
    CLOSE_NEED_EXPLORE_ENGAGE: {
      en: "You bring big, warm energy to love — you want real connection, you feel everything intensely, and you stay open to where things lead. When something's up, you'd rather talk it through than let it sit.",
      ko: '사랑에 크고 따뜻한 에너지를 쏟는 사람이에요. 진짜 연결을 원하고, 모든 걸 강렬하게 느끼며, 관계가 흘러가는 방향에 열려 있어요. 마음에 걸리는 게 있으면 묵혀두기보다 바로 이야기로 풀어요.',
      ja: '恋に大きくてあたたかいエネルギーを注ぐ人。本当のつながりを求め、何でも強く感じ取り、関係の行き先にも前向きでオープン。気になることがあれば、ためこまずにすぐ話して解きほぐします。',
    },
    CLOSE_NEED_EXPLORE_PAUSE: {
      en: "You're a softhearted dreamer who longs for closeness and reassurance and likes keeping life open and full of possibility. You'd rather smooth things over gently than dive into a clash.",
      ko: '친밀함과 확신을 그리워하면서도, 가능성으로 가득한 열린 삶을 좋아하는 마음 여린 몽상가예요. 부딪히기보다 부드럽게 상황을 다독이는 쪽을 택해요.',
      ja: '近さと安心感を求めながらも、可能性に満ちた自由な毎日を好む、心やさしい夢見がちな人。ぶつかり合うより、そっと場をやわらげる方を選びます。',
    },
    DIST_CALM_COMMIT_ENGAGE: {
      en: "You love your independence and bring a calm, steady presence to a relationship. You keep your word and, when something needs sorting out, you handle it openly and early.",
      ko: '독립적인 자기 시간을 사랑하면서도, 관계에는 차분하고 든든한 존재감을 주는 사람이에요. 약속은 꼭 지키고, 풀어야 할 일이 생기면 솔직하게 그리고 일찍 다뤄요.',
      ja: '自分の自立した時間を大切にしながらも、関係には穏やかで頼れる存在感をもたらす人。約束はきちんと守り、片づけるべきことがあれば、早めに、そしてオープンに向き合えます。',
    },
    DIST_CALM_COMMIT_PAUSE: {
      en: "You value your own space and stay wonderfully calm, and you truly believe in sticking with someone. When tension rises, you take a quiet step back before circling back to talk.",
      ko: '자기만의 공간을 소중히 여기고 놀랄 만큼 차분하며, 한 사람과 끝까지 함께하는 걸 진심으로 믿는 사람이에요. 긴장이 높아지면 조용히 한 발 물러섰다가, 다시 돌아와 이야기를 나눠요.',
      ja: '自分だけの空間を大切にし、驚くほど落ち着いていて、ひとりの相手と最後まで歩むことを心から信じている人。緊張が高まると、そっと一歩引いてから、また戻って話そうとします。',
    },
    DIST_CALM_EXPLORE_ENGAGE: {
      en: "You treasure your freedom and keep a cool, easy head about you, and you love discovering new things together. When something comes up, you meet it openly rather than letting it linger.",
      ko: '자유를 소중히 여기고 늘 시원시원하고 여유로운 사람이에요. 함께 새로운 걸 발견하는 즐거움을 사랑하고, 무슨 일이 생기면 묵혀두지 않고 열린 마음으로 마주해요.',
      ja: '自由を大切にし、いつもさっぱりとして余裕のある人。一緒に新しいものを見つける楽しさが大好きで、何かあれば、ためこまずにオープンに向き合います。',
    },
    DIST_CALM_EXPLORE_PAUSE: {
      en: "You love your autonomy and carry a peaceful, unhurried calm, and you find joy in discovering things your own way. You'd happily skip the drama and keep things light.",
      ko: '자율성을 사랑하고 평온하고 서두르지 않는 차분함을 지닌 사람이에요. 자기만의 방식으로 무언가를 발견하는 데서 기쁨을 느끼고, 소란스러움은 가볍게 흘려보내는 편이에요.',
      ja: '自分らしさを大切にし、穏やかで急がない落ち着きをまとった人。自分のやり方で何かを見つけることに喜びを感じ、ごたごたはさらりと受け流して、軽やかでいられます。',
    },
    DIST_NEED_COMMIT_ENGAGE: {
      en: "You like your own space but you also warm to closeness and reassurance, and once trust is there, you're wonderfully devoted. When something matters, you face it together rather than letting it slide.",
      ko: '자기만의 공간을 좋아하면서도 친밀함과 확신에 마음이 녹는 사람이에요. 신뢰가 쌓이면 더없이 한결같아지고, 중요한 일은 그냥 넘기지 않고 함께 마주해요.',
      ja: '自分だけの空間を好みつつも、近さや安心感にちゃんと心がほどける人。信頼が育てば、とても一途になります。大事なことは流さず、一緒に向き合えます。',
    },
    DIST_NEED_COMMIT_PAUSE: {
      en: "You take your time and value both your space and a little reassurance, and you're deeply loyal once you feel safe. When things get heavy, you step back to recharge, then come back ready.",
      ko: '천천히 마음을 여는 사람이라 자기 공간도, 작은 확신도 함께 소중히 여겨요. 안전하다고 느끼면 더없이 한결같아지고, 버거운 순간엔 잠시 물러나 충전한 뒤 다시 돌아와요.',
      ja: 'ゆっくり心をひらく人で、自分の空間も、ちょっとした安心感も、どちらも大切にします。安心できれば、とても誠実に。重たい場面では一度退いて充電し、また戻ってこられます。',
    },
    DIST_NEED_EXPLORE_ENGAGE: {
      en: "You've got a spirited, independent streak and you feel things deeply, and you love keeping life full of new experiences. When something comes up, you'd rather talk it out than tiptoe around it.",
      ko: '활기차고 독립적인 면이 있으면서도 깊이 느끼는 사람이에요. 새로운 경험으로 가득한 삶을 사랑하고, 일이 생기면 빙빙 돌기보다 솔직하게 이야기로 풀어가요.',
      ja: '元気で自立した一面を持ちながら、物事を深く感じ取る人。新しい経験に満ちた毎日が大好きで、何かあれば、遠回しにせず、まっすぐ話して解きほぐします。',
    },
    DIST_NEED_EXPLORE_PAUSE: {
      en: "You're a thoughtful dreamer who values your space and feels everything deeply, and you like leaving room for what life might bring. When tension rises, you gently take a step back to find your footing.",
      ko: '자기 공간을 소중히 여기고 모든 걸 깊이 느끼는 사려 깊은 몽상가예요. 삶이 데려다줄 것들을 위해 여백을 남겨두길 좋아하고, 긴장이 생기면 마음을 다잡으려 부드럽게 한 발 물러서요.',
      ja: '自分の空間を大切にし、何でも深く感じ取る、思いやり深い夢見がちな人。これから訪れるもののために余白を残しておくのが好きで、緊張が高まると、心を整えるためにそっと一歩引きます。',
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
            labelJa: label.ja,
            description: desc.en,
            descriptionKo: desc.ko,
            descriptionJa: desc.ja,
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
    const data = {
      id: t.id,
      code: t.code,
      label: t.label,
      labelKo: t.labelKo,
      labelJa: t.labelJa,
      description: t.description,
      descriptionKo: t.descriptionKo,
      descriptionJa: t.descriptionJa,
      axisAPole: t.axisAPole,
      axisBPole: t.axisBPole,
      axisCPole: t.axisCPole,
      axisDPole: t.axisDPole,
    };

    await prisma.typeCatalog.upsert({
      where: { id: t.id },
      update: data,
      create: data,
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
