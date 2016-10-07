# Semantics

## Introduction

This document intends to describe the semantics of Hareactive. The
semantics are highly inspired by Atze van der Ploegs paper [Practical
Principled FRP](http://www.cse.chalmers.se/~atze/papers/prprfrp.pdf)
and Conal Elliotts work, in particular the papers [Functional Reactive
Animation](http://conal.net/papers/icfp97/) and [Push-Pull Functional
Reactive Programming](http://conal.net/papers/push-pull-frp/).

## Future and behavior

Time is semantically equal to the reals.

```haskell
type Time = ℝ
```

A `Behavior a` is denoted as a function from `Time` to `a`.

```haskell
Behavior a = Time -> a
```

A `Future a` is denoted as a pair of `Time` and `a`.


```haskell
Future a = (Time, a)
```

A `Behavior` is a Functor, Applicative and Monad in exactly the same
way as its denotation, a function, is.

```haskell
instance Functor Behavior where
  map f b = map f b

instance Applicative Behavior where
  pure = const
  ap f b = \t -> f t (b t)

instance Monad Behavior where
  m >>= f = \t -> f (m t) t
```

A `Future` is a Functor, Applicative and Monad in exactly the same
way as its denotation, a pair, is.

```haskell
instance Functor Future where
  map f (t, a) = (t, f a)

instance Applicative Future where
  pure a = (-Infinity, a)
  ap (ta, f) (tb, a) = (max ta tb, f a)

instance Monad Future where
  (ta, a) >>= f = let (tb, b) = f a
                  in (max ta tb, b)
```

## Stream

A `Stream` is denoted as below.


```haskell
Stream a = [(Time, a)]
```

Where the points in time are non-strictly increasing. This means that
any time must be larger than or equal to any points prior to it and
smaller than or equal to any points after it.
