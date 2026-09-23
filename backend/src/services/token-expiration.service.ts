import { jwtConfig } from "../config/jwt.js";

const durationToMilliseconds = (
  duration: string,
): number => {
  const match = duration.match(/^(\d+)([smhd])$/);

  if (!match) {
    throw new Error(
      `Unsupported JWT duration format: ${duration}`,
    );
  }

  const value = Number(match[1]);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit];
};

export const getRefreshTokenExpiration = (): Date => {
  return new Date(
    Date.now() +
      durationToMilliseconds(jwtConfig.refreshExpiresIn),
  );
};