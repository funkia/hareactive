# hareactive
Experimental FRP library for building web applications.


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
