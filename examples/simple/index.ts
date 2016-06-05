import {Events, map} from "../../src/Events";
import {Component, h, on} from "../../src/DOMBuilder";
import run from "../../src/run";

const app = (input$: Events<string>) => {
  let nameInput: Component;

  const DOM = h("div", [
    h("span", ["Hello "]), h("span", [input$]),
    h("br"),
    h("label", ["Name: "]),
    nameInput = h("input")
  ]);

  const inputEvent$ = on("input", nameInput);
  input$.def = map((ev) => ev.target.value, inputEvent$);

  return DOM;
};

run("body", app);
