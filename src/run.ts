import {Events} from "./Events";
import {Behavior, sink} from "./Behaviour";

type HasElement = {elm: HTMLElement}
type RenderFn = (...obs: Behavior<any>[]) => HasElement

export default function(sel: string, render: RenderFn): void {
  let initialBehaviors: Behavior<any>[] = [];
  for (let i = 0; i < render.length; ++i) {
    initialBehaviors.push(sink(undefined));
  }
  const {elm} = render(...initialBehaviors);
  document.querySelector(sel).appendChild(elm);
};
