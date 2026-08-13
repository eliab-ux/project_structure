export class Result<T, E = Error> {
  private constructor(
    private readonly _isSuccess: boolean,
    private readonly _value?: T,
    private readonly _error?: E,
  ) {}

  public static ok<T, E = Error>(value: T): Result<T, E> {
    return new Result<T, E>(true, value);
  }

  public static fail<E>(error: E): Result<never, E> {
    return new Result<never, E>(false, undefined, error);
  }

  public get isSuccess(): boolean {
    return this._isSuccess;
  }

  public get isFailure(): boolean {
    return !this._isSuccess;
  }

  public get value(): T {
    if (!this.isSuccess) {
      throw new Error('Cannot get value from a failed result');
    }
    return this._value!;
  }

  public get error(): E {
    if (this.isSuccess) {
      throw new Error('Cannot get error from a successful result');
    }
    return this._error!;
  }

  public map<U>(fn: (value: T) => U): Result<U, E> {
    if (this.isFailure) {
      return Result.fail<E>(this._error!);
    }
    return Result.ok<U, E>(fn(this._value!));
  }

  public flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    if (this.isFailure) {
      return Result.fail(this._error!);
    }
    return fn(this._value!);
  }
}
