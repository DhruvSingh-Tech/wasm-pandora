
mod runtime;

use anyhow::Result;
use runtime::PandoraRuntime;

fn main() -> Result<()> {
    let runtime = PandoraRuntime::new()?;

    println!("=== Pandora Runtime ===");

    let report = runtime.run_add("plugins/add.wasm", 10, 20)?;
    println!("\nAddition plugin");
    println!("Success: {}", report.success);
    println!("{}", report.message);
    println!("Duration: {} µs", report.duration_us);
    println!("Fuel remaining: {}", report.fuel_remaining);

    let report = runtime.run_unit("plugins/allowed_logger.wasm")?;
    println!("\nLogger plugin");
    println!("Success: {}", report.success);
    println!("{}", report.message);
    println!("Duration: {} µs", report.duration_us);
    println!("Fuel remaining: {}", report.fuel_remaining);

    let report = runtime.run_unit("plugins/infinite_loop.wasm")?;
    println!("\nInfinite-loop plugin");
    println!("Success: {}", report.success);
    println!("{}", report.message);
    println!("Duration: {} µs", report.duration_us);
    println!("Fuel remaining: {}", report.fuel_remaining);

    Ok(())
}
