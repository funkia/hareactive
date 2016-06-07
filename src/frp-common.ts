export interface Body {
  run: (a: any) => void;
  pull: () => any;
}

export interface Pushable<A> {
  push: (a: A) => void;
};

export interface Reactive<A> {
  publish: (a: A) => void;
  last: A;
  body: Body;
}

export type MapFunction<A, B> = ((a: A) => B);
export type SubscribeFunction<A> = ((a: A) => void);
export type PushFunction<A> = ((a: A) => any);
export type ScanFunction<A, B> = ((b: B, a: A) => B);
export type FilterFunction<A> = ((a: A) => boolean);
