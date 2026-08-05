export class RepositoryError extends Error {
  public readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'RepositoryError';
    this.cause = cause;
  }
}

export class NotFoundError extends RepositoryError {
  constructor(entity: string, id: string) {
    super(`${entity} with id "${id}" was not found`);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends RepositoryError {
  public readonly fieldErrors: Record<string, string>;
  constructor(message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = 'ValidationError';
    this.fieldErrors = fieldErrors;
  }
}

export class TransactionError extends RepositoryError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'TransactionError';
  }
}
