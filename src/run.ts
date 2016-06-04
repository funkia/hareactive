import {Events} from "./Events";

type HasElement = {elm: HTMLElement}
type RenderFn = (...obs: Events<any>[]) => HasElement

export default function(sel: string, render: RenderFn): void {
  let initialEvents: Events<any>[] = [];
  for (let i = 0; i < render.length; ++i) {
    initialEvents.push(new Events());
  }
  const {elm} = render(...initialEvents);
  document.querySelector(sel).appendChild(elm);
};
