export interface Consumer<A> {
  push(a: A, changed?: any): void;
}

export interface Body {
  run: (a: any) => void;
  pull: () => any;
}

export interface Reactive<A> {
  publish: (a: A) => void;
  last: A;
  body: Body;
}

export type MapFunction<A, B> = ((a: A) => B);
export type SubscribeFunction<A> = ((a: A) => void);
export type PushFunction<A> = ((a: A) => any);
export type ScanFunction<A, B> = ((a: A, b: B) => B);
export type FilterFunction<A> = ((a: A) => boolean);
