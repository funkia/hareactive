import {sink} from "../../src/Behavior";
import {h, input, br, Component} from "../../src/DOMBuilder";
import run from "../../src/run";

function app(): Component {
  const input$ = sink<string>("");

  return h("div", [
    h("span.classname#myid", ["Hello ", input$]),
    br(),
    h("label", ["Name: "]),
    {inputValue: input$.def} = input()
  ]);
}

run("body", app);
