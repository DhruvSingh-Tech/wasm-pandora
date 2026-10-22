
use wasmtime::{Config, Engine, Instance, Module, Store};

fn main() -> anyhow::Result<()> {
    let mut config = Config::new();
    config.consume_fuel(true);

    let engine = Engine::new(&config)?;
    let module = Module::from_file(
        &engine,
        "plugins/infinite_loop.wasm",
    )?;

    let mut store = Store::new(&engine, ());
    
    // Intentionally tiny budget for this security test.
    store.set_fuel(1_000)?;

    let instance = Instance::new(&mut store, &module, &[])?;
    let run = instance.get_typed_func::<(), ()>(&mut store, "run")?;

    println!("Running untrusted plugin...");
    println!("Fuel budget: 1000");

    match run.call(&mut store, ()) {
        Ok(()) => println!("Plugin completed unexpectedly."),
        Err(error) => {
            println!("Plugin execution stopped.");
            println!("Reason: {error}");
            println!("Remaining fuel: {}", store.get_fuel()?);
        }
    }

    Ok(())
}
