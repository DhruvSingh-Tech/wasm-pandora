
use wasmtime::{Caller, Config, Engine, Linker, Module, Store};

fn main() -> anyhow::Result<()> {
    let mut config = Config::new();
    config.consume_fuel(true);

    let engine = Engine::new(&config)?;
    let mut linker = Linker::<()>::new(&engine);

    // Explicitly grant only the log capability.
    linker.func_wrap(
        "pandora:host",
        "log",
        |_caller: Caller<'_, ()>, value: i32| {
            println!("[plugin log] {value}");
        },
    )?;

    for path in [
        "plugins/allowed_logger.wasm",
        "plugins/unauthorized_access.wasm",
    ] {
        println!("\nTesting {path}");

        let module = Module::from_file(&engine, path)?;
        let mut store = Store::new(&engine, ());
        store.set_fuel(10_000)?;

        match linker.instantiate(&mut store, &module) {
            Ok(instance) => {
                let run = instance.get_typed_func::<(), ()>(
                    &mut store,
                    "run",
                )?;

                match run.call(&mut store, ()) {
                    Ok(()) => println!("Result: SUCCESS"),
                    Err(error) => println!("Execution rejected: {error}"),
                }
            }
            Err(error) => {
                println!("Instantiation rejected: {error}");
            }
        }
    }

    Ok(())
}
