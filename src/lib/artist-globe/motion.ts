// Exact critically damped spring solution: stable at variable frame rates.
export function advanceSpring(
  offset: number,
  velocity: number,
  dt: number,
  frequency = 16,
) {
  const decay = Math.exp(-frequency * dt);
  const impulse = frequency * offset - velocity;
  const remaining = (offset + impulse * dt) * decay;
  return {
    offset: remaining,
    velocity: (velocity + frequency * impulse * dt) * decay,
    step: offset - remaining,
  };
}
