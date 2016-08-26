import {Do} from "jabz/monad";

import {Behavior} from "../../src/Behavior";
import {Stream} from "../../src/Stream";
import {Now} from "../../src/Now";

import {
  Component, component, runMain, span, input, br, text, viewOut
} from "../../src/framework";

const isValidEmail = (s: string) => s.match(/.+@.+\..+/i);

const getLength = (s: string) => s.length;

// The behaviors that make up the model. The `model` function below
// must return `Now<Model>`. The `view` function below recieves
// `Model` as its argument.
type Model = {
  validB: Behavior<boolean>,
  lengthB: Behavior<number>
};

// Types representing the behaviors and streams that the view create.
// These are passed into the `model` function.
type ViewBehaviors = [Behavior<string>];
type ViewStreams = Stream<any>[];

// The code below creates a `Component` from a `model` function and a
// `view` function. `model` hooks these up in a feedback loop so that
// `model` and `view` are circulair dependent.
const main = component<Model, ViewBehaviors, ViewStreams>({
  model({behaviors: [emailB]}: {behaviors: Behavior<string>[]}) {
    return Do(function*(): Iterator<Now<any>> {
      return Now.of({
        validB: emailB.map(isValidEmail),
        lengthB: emailB.map(getLength)
      });
    });
  },
  view({validB, lengthB}) {
    return Do(function*(): Iterator<Component<any>> {
      yield span("Please enter an email address:");
      const {inputValue: emailB} = yield input();
      yield br();
      yield text("The length of the email is ");
      yield text(lengthB);
      yield br();
      yield text("The address is ");
      yield text(validB.map(t => t ? "valid" : "invalid"));
      return Component.of({behaviors: [emailB], events: []});
    });
  }
});

// `runMain` should be the only impure function in application code
runMain("body", main);
