import {Events, publish, subscribe, isEvents} from "./Events";
import * as B from "./Behaviour";
import {Behavior} from "./Behaviour";

type Children = (Behavior<string> | string | Component)[]

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
      B.subscribe((t: string) => text.innerText = t, ch);
      elm.appendChild(text);
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
