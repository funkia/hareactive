import {Observable, publish, subscribe, isObservable} from './Observable'

type Children = any[] | string

export const h = (tag: string, children: Children = []): any => {
  const elm = document.createElement(tag);

  [].concat(children).forEach((ch) => {

    if (isObservable(ch)) {
      const text = document.createElement("span");
      subscribe((t) => text.innerText = t, ch);
      elm.appendChild(text);
    } else {
      elm.appendChild((typeof ch === "string") ? document.createTextNode(ch) : ch.elm)
    }

  });

  var events = {};

  const on = (eventname) => {
    if(events[eventname]) return events[eventname];

    const event$ = Observable();
    elm.addEventListener(eventname, (ev) => publish(ev, event$))
    events[eventname] = event$;
    return event$;
  };

  return {elm, on};
};
