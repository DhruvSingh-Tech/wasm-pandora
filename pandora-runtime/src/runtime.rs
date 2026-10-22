use anyhow::{anyhow, Result};
use std::time::Instant;
use wasmtime::{
    Caller, Config, Engine, Linker, Module, Store, StoreLimits,
    StoreLimitsBuilder,
};

struct HostState {
    limits: StoreLimits,
}
#[derive(serde::Serialize)]
pub struct RunReport {
    pub success: bool,
    pub duration_us: u128,
    pub fuel_remaining: u64,
    pub message: String,
}


pub struct PandoraRuntime {
    engine: Engine,
}

impl PandoraRuntime {
    pub fn new() -> Result<Self> {
        let mut config = Config::new();
        config.consume_fuel(true);

        Ok(Self {
            engine: Engine::new(&config)?,
        })
    }

    fn create_store(&self) -> Result<Store<HostState>> {
        let limits = StoreLimitsBuilder::new()
            .memory_size(2 * 64 * 1024)
            .build();

        let mut store = Store::new(&self.engine, HostState { limits });
        store.limiter(|state| &mut state.limits);
        store.set_fuel(10_000)?;

        Ok(store)
    }

    fn create_linker(&self) -> Result<Linker<HostState>> {
        let mut linker = Linker::new(&self.engine);

        linker.func_wrap(
            "pandora:host",
            "log",
            |_caller: Caller<'_, HostState>, value: i32| {
                eprintln!("[plugin log] {value}");
            },
        )?;

        Ok(linker)
    }

    pub fn run_unit(&self, path: &str) -> Result<RunReport> {
        let started = Instant::now();
        let module = Module::from_file(&self.engine, path)?;
        let mut store = self.create_store()?;
        let linker = self.create_linker()?;

        let result = (|| -> Result<()> {
            let instance = linker.instantiate(&mut store, &module)?;
            let run = instance.get_typed_func::<(), ()>(&mut store, "run")?;
            run.call(&mut store, ())?;
            Ok(())
        })();

        let duration_us = started.elapsed().as_micros();
        let fuel_remaining = store.get_fuel()?;

        Ok(RunReport {
            success: result.is_ok(),
            duration_us,
            fuel_remaining,
            message: match result {
                Ok(()) => "Plugin completed successfully".to_string(),
                Err(error) => format!("{error:#}"),
            },
        })
    }

    pub fn run_add(&self, path: &str, a: i32, b: i32) -> Result<RunReport> {
        let started = Instant::now();
        let module = Module::from_file(&self.engine, path)?;
        let mut store = self.create_store()?;
        let linker = self.create_linker()?;

        let result = (|| -> Result<String> {
            let instance = linker.instantiate(&mut store, &module)?;
            let run = instance.get_typed_func::<(i32, i32), i32>(
                &mut store,
                "run",
            )?;

            let output = run.call(&mut store, (a, b))?;
            Ok(format!("Output: {output}"))
        })();

        let duration_us = started.elapsed().as_micros();
        let fuel_remaining = store.get_fuel()?;

        Ok(RunReport {
            success: result.is_ok(),
            duration_us,
            fuel_remaining,
            message: result.unwrap_or_else(|error| format!("{error:#}")),
        })
    }

    pub fn run_memory(&self, path: &str) -> Result<RunReport> {
        let started = Instant::now();
        let module = Module::from_file(&self.engine, path)?;
        let mut store = self.create_store()?;
        let linker = self.create_linker()?;

        let result = (|| -> Result<String> {
            let instance = linker.instantiate(&mut store, &module)?;
            let run =
                instance.get_typed_func::<(), i32>(&mut store, "run")?;

            let growth_denied = run.call(&mut store, ())?;

            if growth_denied == 1 {
                Ok("PASS: memory growth beyond the 128 KiB limit was rejected"
                    .to_string())
            } else {
                Err(anyhow!(
                    "FAIL: plugin successfully grew memory beyond the expected limit"
                ))
            }
        })();

        let duration_us = started.elapsed().as_micros();
        let fuel_remaining = store.get_fuel()?;

        Ok(RunReport {
            success: result.is_ok(),
            duration_us,
            fuel_remaining,
            message: result.unwrap_or_else(|error| format!("{error:#}")),
        })
    }

    pub fn run_uploaded(&self, path: &str) -> Result<RunReport> {
        let started = Instant::now();
        let mut store = self.create_store()?;

        let result = (|| -> Result<String> {
            let module = Module::from_file(&self.engine, path)?;
            let linker = self.create_linker()?;

            let instance = linker.instantiate(&mut store, &module)?;

            // Uploaded plugin ABI: export `run() -> i32`.
            let run = instance.get_typed_func::<(), i32>(&mut store, "run")?;
            let output = run.call(&mut store, ())?;

            Ok(format!("Plugin returned: {output}"))
        })();

        let duration_us = started.elapsed().as_micros();
        let fuel_remaining = store.get_fuel()?;

        Ok(RunReport {
            success: result.is_ok(),
            duration_us,
            fuel_remaining,
            message: result.unwrap_or_else(|error| format!("{error:#}")),
        })
    }


}
