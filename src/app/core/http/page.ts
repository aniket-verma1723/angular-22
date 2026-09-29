export interface Page<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly skip: number;
  readonly limit: number;
}
