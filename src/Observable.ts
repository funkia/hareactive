export type Observable<V> = {
  subscribers: ((v: V) => void)[];
  def: Observable<V>;
}

export function publish<V>(v: V, obs: Observable<V>): void {
  obs.subscribers.forEach((fn) => fn(v));
}

export function subscribe<V>(fn: ((v: V) => any), obs: Observable<V>): void {
  obs.subscribers.push(fn);
}

export const isObservable = (obs: any): boolean =>
  (typeof obs === "object" && "subscribers" in obs);

export function Observable<V>(): Observable<V> {
  return {
    subscribers: [],
    set def(obs: Observable<V>) {
      obs.subscribers.push(...this.subscribers);
      this.subscribers = obs.subscribers;
    }
  };
}

export function map<A, B>(fn: ((a: A) => B), obs: Observable<A>): Observable<B> {
  const newObs = Observable<B>();
  subscribe((item) => publish(fn(item), newObs), obs);
  return newObs;
};

export function filter<V>(fn: ((v: V) => boolean), obs: Observable<V>): Observable<V> {
  const newObs = Observable<V>();
  subscribe((item) => {
    if (fn(item)) {
      publish(item, newObs);
    }
  }, obs);
  return newObs;
}
