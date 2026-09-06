export type DealScoreInput = {
  currentPrice: number;
  typicalPrice?: number;
  nonstop?: boolean;
};

export type DealScore = {
  typicalPrice: number;
  percentBelowTypical: number;
  score: number;
};

const scoreConfig = {
  base: Number(process.env.DEAL_SCORE_BASE ?? 35),
  nonstopBonus: Number(process.env.DEAL_SCORE_NONSTOP_BONUS ?? 10),
  unknownBaselineScore: Number(process.env.DEAL_SCORE_UNKNOWN_BASELINE ?? 50),
};

function discountPoints(percent: number) {
  if (percent >= 50) return 40;
  if (percent >= 40) return 32;
  if (percent >= 30) return 24;
  if (percent >= 20) return 15;
  if (percent >= 10) return 7;
  return 0;
}

export function scoreDeal(input: DealScoreInput): DealScore {
  const hasBaseline = Boolean(input.typicalPrice && input.typicalPrice > 0);
  const typicalPrice = Math.max(1, Math.round(input.typicalPrice ?? input.currentPrice));
  const percentBelowTypical = hasBaseline
    ? Math.max(0, Math.round(((typicalPrice - input.currentPrice) / typicalPrice) * 100))
    : 0;
  const rawScore = hasBaseline
    ? scoreConfig.base + discountPoints(percentBelowTypical) + (input.nonstop ? scoreConfig.nonstopBonus : 0)
    : scoreConfig.unknownBaselineScore + (input.nonstop ? scoreConfig.nonstopBonus : 0);

  return {
    typicalPrice,
    percentBelowTypical,
    score: Math.max(0, Math.min(100, rawScore)),
  };
}
