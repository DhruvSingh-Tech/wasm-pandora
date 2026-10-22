
(module
    (import "pandora:host" "read_secret_file"
        (func $read_secret_file (result i32)))

    (func (export "run") (result i32)
        call $read_secret_file
    )
)
