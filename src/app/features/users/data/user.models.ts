export interface PublicUser {
  readonly id: number;
  readonly firstName: string;
  readonly lastName: string;
  readonly image: string | null;
}

export interface UserQuery {
  readonly q: string;
  readonly pageIndex: number;
  readonly pageSize: 10 | 25 | 50;
}
