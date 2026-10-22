
(module
  (memory (export "memory") 1 100)

  (func (export "run") (result i32)
    ;; Request two additional 64 KiB pages.
    i32.const 2
    memory.grow

    ;; memory.grow returns -1 when growth is denied.
    ;; Return 1 if denied; return 0 if growth succeeds.
    i32.const -1
    i32.eq
  )
)
