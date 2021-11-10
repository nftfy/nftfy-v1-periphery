type MainFn = (argv: string[]) => Promise<void>;

async function entrypoint(main: MainFn): Promise<void> {
  try {
    await main(process.argv);
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
  process.exit(0);
}

async function main(args: string[]): Promise<void> {
  console.log('Hello, world!');
}

entrypoint(main);
