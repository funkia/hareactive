import {Do} from "jabz/monad";

import {Behavior, stepper} from "../../src/Behavior";
import {Stream, snapshotWith} from "../../src/Stream";
import {Now} from "../../src/Now";

import {
  Component, component, runMain, span, input, br, text, button
} from "../../src/framework";

const isValidEmail = (s: string) => s.match(/.+@.+\..+/i);

const getLength = (_: any, s: string) => s.length;

// The behaviors that make up the model. The `model` function below
// must return `Now<Model>`. The `view` function below recieves
// `Model` as its argument.
type Model = {
  validB: Behavior<boolean>,
  lengthB: Behavior<number>
};

// Types representing the behaviors and streams that the view create.
// These are passed into the `model` function.
type ViewOut = {
  behaviors: [Behavior<string>],
  streams: [Stream<Event>]
};

// The code below creates a `Component` from a `model` function and a
// `view` function. `model` hooks these up in a feedback loop so that
// `model` and `view` are circulair dependent.
const main = component<Model, ViewOut>({
  model({behaviors: [emailB], streams: [calcLength]}) {
    return Do(function*(): Iterator<Now<any>> {
      const validB = emailB.map(isValidEmail);
      const lengthUpdate = snapshotWith(getLength, emailB, calcLength);
      const lengthB = stepper(0, lengthUpdate);
      return Now.of({validB, lengthB});
    });
  },
  view({validB, lengthB}) {
    return Do(function*(): Iterator<Component<any>> {
      yield span("Please enter an email address: ");
      const {inputValue: emailB} = yield input();
      yield br;
      yield text("The address is ");
      yield text(validB.map(t => t ? "valid" : "invalid"));
      yield br;
      const {click: calcLength} = yield button("Calculate length");
      yield text(" The length of the email is ");
      yield text(lengthB);
      return Component.of({behaviors: [emailB], streams: [calcLength]});
    });
  }
});

// `runMain` should be the only impure function in application code
runMain("body", main);
