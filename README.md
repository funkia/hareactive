<img align="right" src="https://avatars0.githubusercontent.com/u/21360882?v=3&s=200">

# Hareactive

A pure FRP library for JavaScript with the following features/goals:

* Precise semantics similar to classic FRP (the semantics is WIP
  see [here](./semantics.md))
* Support for continuous time for performant and expressive
  declaration of time-dependent behavior and motions.
* Splendid performance
* Monadic IO integrated with FRP for expressing side-effects in an
  expressive and tetsable way that utilizes FRP for powerful handling
  of asynchronous operations.

[![Build Status](https://travis-ci.org/Funkia/hareactive.svg?branch=master)](https://travis-ci.org/Funkia/hareactive)
[![codecov](https://codecov.io/gh/Funkia/hareactive/branch/master/graph/badge.svg)](https://codecov.io/gh/Funkia/hareactive)

# Contributing

```
npm install
```

## Run tests

```
npm test
```

## Benchmark

First you will have to get set up to running the benchmarks:

```
npm run build
./benchmark/prepare-benchmarks.sh
```

To run a single benchmark:
```
node benchmark/<name-of-benchmark>
```

Example:
```
node benchmark/scan.suite
```

To run all benchmarks:

```
npm run bench
```
