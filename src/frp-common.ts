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
export type ScanFunction<A, B> = ((b: B, a: A) => B);
export type FilterFunction<A> = ((a: A) => boolean);

export class MapBody<A, B> implements Body {
  private fn: MapFunction<A, B>;
  private source: Reactive<A>;  // srcE
  private target: Reactive<B>;   // ev

  constructor(fn: MapFunction<A, B>, target: Reactive<B>, source: Reactive<A>) {
    this.fn = fn;
    this.target = target;
    this.source = source;
  }

  public run: ((a: A) => void) = a => {
    this.target.publish(this.fn(a));
  }

  public pull: (() => B) = () => {
    return this.fn(((this.source.last !== undefined) ? this.source.last : this.source.body.pull()));
  }
}
