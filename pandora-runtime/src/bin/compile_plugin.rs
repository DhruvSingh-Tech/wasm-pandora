
fn main() -> anyhow::Result<()> {
    let args: Vec<String> = std::env::args().collect();

    let input = args
        .get(1)
        .map(String::as_str)
        .unwrap_or("plugins/add.wat");

    let output = args
        .get(2)
        .map(String::as_str)
        .unwrap_or("plugins/add.wasm");

    let source = std::fs::read_to_string(input)?;
    let wasm = wat::parse_str(&source)?;

    std::fs::write(output, wasm)?;

    println!("Plugin compiled: {output}");
    Ok(())
}
