export interface PublicPost {
  readonly id: number;
  readonly title: string;
  readonly body: string;
  readonly userId: number;
}

export interface PublicComment {
  readonly id: number;
  readonly body: string;
  readonly postId: number;
  readonly user: { readonly id: number; readonly fullName: string };
}
