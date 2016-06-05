import {Events, publish, subscribe, isEvents} from "./Events";

type Children = (Events<string> | Events<Component> | string | Component)[]

export type Component = {
  elm: HTMLElement,
  event: EventTable
};

interface EventTable {
  [index: string]: Events<any>;
}

export function h(tag: string, children: Children = []): Component {
  const elm = document.createElement(tag);
  const event: EventTable = {};

  [].concat(children).forEach((ch) => {
    if (isEvents(ch)) {
      const text = document.createElement("span");
      subscribe((t: string) => text.innerText = t, ch);
      elm.appendChild(text);
    } else {
      elm.appendChild((typeof ch === "string") ? document.createTextNode(ch) : ch.elm);
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
