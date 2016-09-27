<img align="right" src="https://avatars0.githubusercontent.com/u/21360882?v=3&s=200">
[![Build Status](https://travis-ci.org/Funkia/hareactive.svg?branch=master)](https://travis-ci.org/Funkia/hareactive)

# Hareactive

A pure FRP library for JavaScript with the following features/goals:

* Precise semantics similar to classic FRP
* Support for continuous time
* Splendid performance
* Monad IO

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
