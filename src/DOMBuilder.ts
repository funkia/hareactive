import {Events, publish, subscribe, isEvents} from "./Events";
import * as B from "./Behavior";
import {Behavior, at} from "./Behavior";

type Children = (Behavior<string|number> | string | Component)[]

export interface Component {
  elm: HTMLElement;
  event: EventTable;
};

interface EventTable {
  [index: string]: Events<any>;
}

export function h(tag: string, children: Children = []): Component {
  const elm = document.createElement(tag);
  const event: EventTable = {};

  children.forEach((ch) => {
    if (B.isBehavior(ch)) {
      const text = document.createElement("span");
      const initial = at(ch);
      console.log("initial", initial);
      text.innerText = typeof initial === "string" ? initial : initial.toString();
      elm.appendChild(text);
      if (ch.pushing === true) {
        B.subscribe((t: string) => text.innerText = t, ch);
      } else {
        console.log("pulling");
        // quick hack below
        const sampleFn = () => {
          const newVal = at(ch);
          text.innerText = typeof newVal === "string" ? newVal : newVal.toString();
          window.requestAnimationFrame(sampleFn);
        };
        window.requestAnimationFrame(sampleFn);
      }
    } else if (typeof ch === "string") {
      elm.appendChild(document.createTextNode(ch));
    } else {
      elm.appendChild(ch.elm);
    }
  });
  return {elm, event};
}

export function on(eventName: string, comp: Component): Events<any> {
  let {elm, event} = comp;

  if (event[eventName]) {
    return event[eventName];
  } else {
    const event$ = new Events();
    elm.addEventListener(eventName, (ev) => publish(ev, event$));
    event[eventName] = event$;
    return event$;
  }
}

export interface InputComponent extends Component {
  inputValue: Behavior<string>;
}

export function input(): InputComponent {
  const elm = document.createElement("input");
  return {
    elm,
    event: {},
    get inputValue(): Behavior<string> {
      const newB = B.sink("");
      elm.addEventListener(
        "input",
        (ev: any) => B.publish(ev.target.value, newB)
      );
      return newB;
    }
  };
}

export function br(): Component {
  return h("br");
}
