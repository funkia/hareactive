export type Observable<V> = {
  subscribers: ((V) => void)[];
  def: Observable<V>;
}

export function publish<V>(v: V, obs: Observable<V>) {
  obs.subscribers.forEach((fn) => fn(v))
}

export function subscribe<V>(fn: ((V) => any), obs: Observable<V>) {
  obs.subscribers.push(fn)
}

export const isObservable = (obs : any) : boolean =>
  (typeof obs === 'object' && 'subscribers' in obs)

export function Observable<V>(): Observable<V> {
  return {
    subscribers: [],
    set def(obs) {
      obs.subscribers.push(...this.subscribers)
      this.subscribers = obs.subscribers
    }
  }
}

export function map<A, B>(fn: ((A) => B), obs: Observable<A>): Observable<B> {
  const o = Observable<B>();
  subscribe((item) => publish(fn(item), o), obs)
  return o;
};
