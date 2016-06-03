import {Observable} from "./Observable";

type HasElement = {elm: HTMLElement}
type RenderFn = (...obs: Observable<any>[]) => HasElement

export default function(sel: string, render: RenderFn): void {
  let initialObservables: Observable<any>[] = [];
  for (let i = 0; i < render.length; ++i) {
    initialObservables.push(Observable());
  }
  const {elm} = render(...initialObservables);
  document.querySelector(sel).appendChild(elm);
};
