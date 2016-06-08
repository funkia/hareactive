import {stepper} from "../../src/Behavior";
import {h, button, Component, input} from "../../src/DOMBuilder";
import {Events, AbstractEvents, snapshotWith} from "../../src/Events";
import {mount, declareBehaviors} from "../../src/bootstrap";

function app(): Component {
  const addClick$ = new Events();
  const [nameInput] = declareBehaviors("");

  const todoItems: AbstractEvents<Component>  = snapshotWith((_, todoName) => todoName, nameInput, addClick$)
    .scan((todoArr, todo) => [...todoArr, todo], [])
    .map((todoArr) => h("ul", todoArr.map((item) => h("li", [item]))));
  const todos = stepper(h("ul", [h("li", ["test1"])]), todoItems);

  return h("div", [
    h("h1", ["Todo list:"]),
    {inputValue: nameInput.def} = input(),
    {click: addClick$.def} = button("add"),
    todos
  ]);
}

mount("body", app);
