import {Component, h, input, br} from "../../src/DOMBuilder";
import {mount, declareBehaviors} from "../../src/bootstrap";

function app(): Component {
  const [name] = declareBehaviors("");
  return h("div", [
    h("span.classname#myid", ["Hello "]), h("span", [name]),
    br(),
    h("label", ["Name: "]),
    {inputValue: name.def} = input()
  ]);
}

mount("body", app);
