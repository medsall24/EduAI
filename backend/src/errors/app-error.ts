// Erreur applicative contrôlée permettant de retourner
// un code HTTP précis sans exposer les détails internes.
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);

    this.name = "AppError";
  }
}