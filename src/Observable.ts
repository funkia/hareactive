export type Observable<V> = {
  subscribers: ((V) => void)[];
  def: any;
}

export const publish = (v: any, obs: Observable<any>): void =>
  obs.subscribers.forEach((fn) => fn(v))

export const subscribe = (fn: ((any) => any), obs: Observable<any>): number =>
  obs.subscribers.push(fn)

export const isObservable = (obs : any) : boolean =>
  (typeof obs === 'object' && 'subscribers' in obs)

export const Observable = (): Observable<any> => {
  return {
    subscribers: [],
    set def(obs: Observable<any>) {
      obs.subscribers.push(...this.subscribers)
      this.subscribers = obs.subscribers
    }
  }
}
