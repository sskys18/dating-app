interface TypePoles {
  axisAPole: string;
  axisBPole: string;
  axisCPole: string;
  axisDPole: string;
}

interface AxisWeights {
  axisA?: number;
  axisB?: number;
  axisC?: number;
  axisD?: number;
}

export function computeRealCompatibility(
  userType: TypePoles,
  candidateType: TypePoles,
  weights?: AxisWeights,
): number {
  let score = 60;

  // Same closeness pole = good
  if (userType.axisAPole === candidateType.axisAPole)
    score += 10 * (weights?.axisA ?? 1.0);

  // Complementary reassurance
  if (userType.axisBPole !== candidateType.axisBPole)
    score += 10 * (weights?.axisB ?? 1.0);

  // Same commitment
  if (userType.axisCPole === candidateType.axisCPole)
    score += 8 * (weights?.axisC ?? 1.0);

  // Complementary conflict style
  if (userType.axisDPole !== candidateType.axisDPole)
    score += 7 * (weights?.axisD ?? 1.0);

  return Math.max(0, Math.min(95, Math.round(score)));
}
