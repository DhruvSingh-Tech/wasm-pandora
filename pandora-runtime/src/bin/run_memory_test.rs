
use wasmtime::{Config, Engine, Instance, Module, Store, StoreLimits, StoreLimitsBuilder};

struct HostState {
    limits: StoreLimits,
}

fn main() -> anyhow::Result<()> {
    let mut config = Config::new();
    config.consume_fuel(true);

    let engine = Engine::new(&config)?;
    let module = Module::from_file(
        &engine,
        "plugins/memory_bomb.wasm",
    )?;

    // Two WebAssembly pages = 128 KiB.
    let limits = StoreLimitsBuilder::new()
        .memory_size(2 * 64 * 1024)
        .build();

    let state = HostState { limits };
    let mut store = Store::new(&engine, state);

    store.limiter(|state| &mut state.limits);
    store.set_fuel(10_000)?;

    let instance = Instance::new(&mut store, &module, &[])?;
    let run = instance.get_typed_func::<(), i32>(&mut store, "run")?;

    println!("Running memory-limit test...");
    println!("Maximum guest memory: 128 KiB");

    match run.call(&mut store, ()) {
        Ok(previous_pages) => {
            println!("Growth result: {previous_pages}");
            println!("Negative one means memory growth was rejected.");
        }
        Err(error) => {
            println!("Execution trapped: {error}");
        }
    }

    Ok(())
}
