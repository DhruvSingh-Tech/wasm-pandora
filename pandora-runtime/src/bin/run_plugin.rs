
#[path = "../runtime.rs"]
mod runtime;

use anyhow::{anyhow, Result};
use runtime::{PandoraRuntime, RunReport};

fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().collect();

    let plugin = args
        .get(1)
        .ok_or_else(|| anyhow!(
            "Usage: run_plugin <add|logger|infinite_loop|unauthorized|memory> [a b]"
        ))?;

    let runtime = PandoraRuntime::new()?;

    let report: RunReport = match plugin.as_str() {
        "add" => {
            let a: i32 = args
                .get(2)
                .ok_or_else(|| anyhow!("Missing first integer"))?
                .parse()?;

            let b: i32 = args
                .get(3)
                .ok_or_else(|| anyhow!("Missing second integer"))?
                .parse()?;

            runtime.run_add("plugins/add.wasm", a, b)?
        }
        "logger" => runtime.run_unit("plugins/allowed_logger.wasm")?,
        "infinite_loop" => runtime.run_unit("plugins/infinite_loop.wasm")?,
        "unauthorized" => runtime.run_unit("plugins/unauthorized_access.wasm")?,
        "memory" => runtime.run_memory("plugins/memory_bomb.wasm")?,
        _ => return Err(anyhow!("Unknown plugin ID: {plugin}")),
    };

    println!("{}", serde_json::to_string(&report)?);

    Ok(())
}
