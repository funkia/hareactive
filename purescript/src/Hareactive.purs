module Data.Hareactive
  ( Now
  , Behavior
  , Stream
  ) where
import Prelude hiding (append, map)

foreign import data FRP :: Effect

foreign import data Now :: Type -> Type

foreign import data Behavior :: Type -> Type

foreign import data Stream :: Type -> Type

foreign import filter :: forall a. (a -> Boolean) -> Stream a -> Stream a

foreign import _mapStream ∷ forall a b. (a -> b) -> Stream a -> Stream b

instance functorStream ∷ Functor Stream where
  map = _mapStream

foreign import _mapBehavior ∷ forall a b. (a -> b) -> Behavior a -> Behavior b

instance functorBehavior ∷ Functor Behavior where
  map = _mapBehavior

foreign import on :: forall e a. Stream a -> (a -> Eff e Unit) -> Eff e Unit