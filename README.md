<img style="float: right; width: 15em" src="https://rawgithub.com/Funkia/hareactive/master/logo.svg">

[![Build Status](https://img.shields.io/travis/Funkia/hareactive.svg?colorB=c100b6)](https://travis-ci.org/Funkia/hareactive)
[![codecov](https://img.shields.io/codecov/c/github/Funkia/hareactive.svg?colorB=c100b6)](https://codecov.io/gh/Funkia/hareactive)
[![Gitter](https://img.shields.io/gitter/room/funkia/General.svg?colorB=c100b6)](https://gitter.im/funkia/General)

# Hareactive

A pure FRP library for JavaScript and TypeScript with the following
features/goals:

* Simple and precise semantics similar to classic FRP. This makes the library
  simpler to use. (the semantics are WIP see [here](./semantics.md))
* Supports _continuous time_ for performant and expressive
  declaration of time-dependent behavior.
* Great performance.
* Support for declarative side-effects in a way that is pure,
  testable and integrates with FRP for powerful handling of asynchronous
  operations.

## Table of contents

* [Tutorial](#tutorial)
* [API documentation](#api-documentation)
* [Contributing](#contributing)
* [Benchmark](#benchmark)

## Introduction

Hareactive contains four key type of things: Future, stream, behavior and
now. These are explained below.

### Future

A future is a _value_ associated with a certain point in _time_. For
instance, the result of a HTTP-request is a future since it
occurs at a specific time (when the response is received) and contains
a value (the response itself).

Future has much in common with JavaScript's Promises. However, they
are simpler. A future has no notion of resolution or
rejection. That is, a specific future can be understood simply as a
time and a value. Conceptually one can think of them as being implemented simply like this.

```js
{time: 22, value: "Foo"}
```

### Stream

A `Stream` is a list of futures. That is, a list of values where the
values are each associated with a point in time.

An example could be a stream of keypresses that a user makes. Each
keypress happens at a specific moment in time and with a value indicating
which key was pressed.

The relationship between `Future` and `Stream` is the same as the
relationship between having a variable that is a string and a variable
that is a list of strings. You wouldn't store a username as `["username"]`
because there is always exactly one username.

Similarly in Hareactive we don't use `Stream` to express the result of
a HTTP-request since a HTTP-request only delivers a response exactly
once. Use a `Future` for things where there is exactly one occurrence
and `Stream` where there may be zero or more.

### Behavior

A behavior represents a value that changes over time. For instance,
the current position of the mouse or the value of an input field is a
behavior.

Conceptually a behavior can be thought of as a function from a point in time to a value.
A behavior always has a value at any given time. This is the difference between a stream and a behavior.
A behavior has a value at all points in time where a stream is a series of events
that happens at specific moments in time.

### Future, stream or behavior?

At first, the difference between the three things may be tricky to
understand. Especially if you're used to other libraries where all
three are represented as a single structure (maybe called "stream" or
"observable"). The key is to understand that the three types represent
things that are fundamentally different. And that expressing different things with different structures is beneficial.

You could forget about future and use a stream where you'd otherwise
use a future. Because stream is more powerful than future. In the same
way you could always use arrays of values instead of just single
values. But you don't do that because `username = "foo"` expresses
that only one username exists whereas `username = ["foo"]` gives the
impression that a user can have more than one username. Similarly one
could forget about numbers and just use strings instead. But saying
`amount = 22` is obviously better than `amount = "22"`.

This is how to figure out if a certain thing is a future, a stream or
a behavior:

1. Ask the question: "does the thing always have a current value?". If
   yes, you're done, the thing should be represented as a behavior.
2. Ask the question: "does the thing always happen once?". If yes, the
   thing should be represented as a future. If no, you should use a
   stream.

Below are some examples:

* The time remaining before an alarm goes off: The remaining time
  always have a current value, therefore it is a behavior.
* The moment where the alarm goes off: This has no current value. And
  since the alarm only goes off a single time this is a future.
* User clicking on a specific button: This has no notion of a current
  value. And the user may press the button more than once. This is a
  stream.
* Whether or not a button is currently pressed: This always has a
  current value. The button is always pressed or not pressed. This
  should be represented as a behavior.
* The tenth time a button is pressed: This happens once at a specific
  moment in time. Use a future.

### Now

The `Now` structure represents a computation at a moment in time.
The computation will always be run in the present—hence the name "now".
`Now` is perhaps the most difficult concept in Hareactive.

Now is used for two things

* Creating stateful behaviors
* Running side-effects

## API

### Future

#### `Future#listen(o: Consumer<A>): void`

Adds a consumer as listener to a future. If the future has already
occurred the consumer is immediately pushed to.

#### `fromPromise<A>(p: Promise<A>): Future<A>`

Converts a promise to a future.

### Stream

#### `apply<A, B>(behavior: Behavior<(a: A) => B>, stream: Stream<A>): Stream<B>`

Applies a function-valued behavior to a stream. Whenever the stream
has an occurrence the value is passed through the current function of
the behavior.

#### `filter<A>(predicate: (a: A) => boolean, s: Stream<A>): Stream<A>`

Returns a stream with all the occurrences from `s` for which
`predicate` returns `true`.

#### `split<A>(predicate: (a: A) => boolean, stream: Stream<A>): [Stream<A>, Stream<A>]`

Returns a pair of streams. The first contains all occurrences from
`stream` for which `predicate` returns `true` and the other the
occurrences for which `predicate` returns `false`.

#### `filterApply<A>(predicate: Behavior<(a: A) => boolean>, stream: Stream<A>): Stream<A>`

Filters a stream by applying the predicate-valued behavior to all
occurrences.

#### `keepWhen<A>(stream: Stream<A>, behavior: Behavior<boolean>): Stream<A>`

Whenever `stream` has an occurrence the current value of `behavior` is
considered. If it is `true` then the returned stream also has the
occurrence—otherwise it doesn't. The behavior works as a filter that
decides whether or not values are let through.

#### `scanS<A, B>(fn: (a: A, b: B) => B, startingValue: B, stream: Stream<A>): Behavior<Stream<B>>`

A stateful scan.

#### `snapshot<B>(b: Behavior<B>, s: Stream<any>): Stream<B>`

Returns a stream that occurs whenever `s` occurs. The value of the
occurrence is `b`s value at the time.

#### `snapshotWith<A, B, C>(f: (a: A, b: B) => C, b: Behavior<B>, s: Stream<A>): Stream<C>`

Returns a stream that occurs whenever `s` occurs. At each occurrence
the value from `s` and the value from `b` is passed to `f` and the
return value is the value of the returned streams occurrence.

#### `switchStream<A>(b: Behavior<Stream<A>>): Stream<A>`

Takes a stream valued behavior and returns a stream that emits values
from the current stream at the behavior. I.e. the returned stream
always "switches" to the current stream at the behavior.

#### `changes<A>(b: Behavior<A>): Stream<A>`

Takes a behavior and returns a stream that has an occurrence whenever
the behavior changes.

#### `combine<A, B>(a: Stream<A>, b: Stream<B>): Stream<(A|B)>`

Combines two streams into a single stream that contains the occurrences
of both `a` and `b`.

#### `isStream(obj: any): boolean`

Returns `true` if `obj` is a stream and `false` otherwise.

#### `delay<A>(ms: number, s: Stream<A>): Stream<A>`

Returns a stream that occurs `ms` milliseconds after `s` occurs.

#### `throttle<A>(ms: number, s: Stream<A>): Stream<A>`

Returns a stream that after occuring, ignores the next occurences in `ms` milliseconds.


### Behavior

#### `when(b: Behavior<boolean>): Behavior<Future<{}>>`

Takes a boolean valued behavior an returns a behavior that at any
point in time contains a future that occurs in the next moment where
`b` is `true`.

#### `snapshot<A>(b: Behavior<A>, f: Future<any>): Behavior<Future<A>>`

Creates a future than on occurence samples the current value of the
behavior and occurs with that value. That is, the original value of
the future is overwritten with the behavior value at the time when the
future occurs.

#### `switcher<A>(init: Behavior<A>, next: Future<Behavior<A>>): Behavior<A>`

From an initial behavior and a future of a behavior `switcher` creates
a new behavior that acts exactly like `initial` until `next` occurs
after which it acts like the behavior it contains.

#### `stepper<B>(initial: B, steps: Stream<B>): Behavior<B>`

Creates a behavior whose value is the last occurrence in the stream.

#### `scan<A, B>(fn: (a: A, b: B) => B, init: B, source: Stream<A>): Behavior<Behavior<B>>`

The returned behavior initially has the initial value, on each
occurrence in `source` the function is applied to the current value of
the behaviour and the value of the occurrence, the returned value
becomes the next value of the behavior.

#### `fromFunction<B>(fn: () => B): Behavior<B>`

This takes an impure function that varies over time and returns a
pull-driven behavior. This is particularly useful if the function is
contionusly changing, like `Date.now`.

#### `isBehavior(b: any): b is Behavior<any>`

Returns `true` if `b` is a behavior and `false` otherwise.

#### `time: Behavior<Time>`

A behavior whose value is the number of milliseconds elapsed win UNIX
epoch. I.e. its current value is equal to the value got by calling
`Date.now`.

#### `timeFrom: Behavior<Behavior<Time>>`

A behavior giving access to continous time. When sampled the outer
behavior gives a behavior with values that contain the difference
between the current sample time and the time at which the outer
behavior was sampled.

### Now

The Now monad represents a computation that takes place in a given
moment and where the moment will always be now when the computation is
run.

#### `async<A>(comp: IO<A>): Now<Future<A>>`

Run an asynchronous IO action and return a future in the Now monad
that resolves with the eventual result of the IO action once it
completes. This function is what allows the Now monad to execute
imperative actions in a way that is pure and integrated with FRP.

#### `sample<A>(b: Behavior<A>): Now<A>`

Returns the current value of a behavior in the Now monad. This is
possible because computations in the Now monad have an associated
point in time.

#### `performStream<A>(s: Stream<IO<A>>): Now<Stream<A>>`

Takes a stream of `IO` actions and return a stream in a now
computation. When run the now computation executes each `IO` action
and delivers their result into the created stream.

#### `performStreamLatest<A>(s: Stream<IO<A>>): Now<Stream<A>>`

A variant of `performStream` where outdated `IO` results are ignored.

#### `performStreamOrdered<A>(s: Stream<IO<A>>): Now<Stream<A>>`

A variant of `performStream` where `IO` results occur in the same order.

#### `plan<A>(future: Future<Now<A>>): Now<Future<A>>`

Convert a future now computation into a now computation of a future.
This function is what allows a Now-computation to reach beyond the
current moment that it is running in.

#### `runNow<A>(now: Now<Future<A>>): Promise<A>`

Run the given Now-computation. The returned promise resolves once the
future that is the result of running the now computation occurs. This
is an impure function and should not be used in normal application
code.

## Contributing

Contributions are very welcome. Development happens as follows:

Install dependencies.
```
npm install
```

Run tests.
```
npm test
```
Running the tests will generate an HTML coverage report in `./coverage/`.

Continuously run the tests with
```
npm run test-watch
```

We also use `tslint` for ensuring a coherent code-style.

## Benchmark

Get set up to running the benchmarks:

```
npm run build
./benchmark/prepare-benchmarks.sh
```

Run all benchmarks with:
```
npm run bench
```

Run a single benchmark with:
```
node benchmark/<name-of-benchmark>
```

For example
```
node benchmark/scan.suite
```
