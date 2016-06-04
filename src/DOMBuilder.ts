import {Events, publish, subscribe, isEvents} from "./Events";

type Children = (Events<string> | Events<Component> | string | Component)[]

type Component = {
  elm: HTMLElement,
  on: (event: string) => Events<any>
};

interface EventTable {
  [index: string]: Events<any>;
}

export const h = (tag: string, children: Children = []): Component => {
  const elm = document.createElement(tag);

  [].concat(children).forEach((ch) => {

    if (isEvents(ch)) {
      const text = document.createElement("span");
      subscribe((t: string) => text.innerText = t, ch);
      elm.appendChild(text);
    } else {
      elm.appendChild((typeof ch === "string") ? document.createTextNode(ch) : ch.elm);
    }
  });

  let event: EventTable = {};

  const on = (eventname: string) => {
    if (event[eventname]) {
      return event[eventname];
    }

    const event$ = new Events();
    elm.addEventListener(eventname, (ev) => publish(ev, event$));
    event[eventname] = event$;
    return event$;
  };

  return {elm, on};
};
