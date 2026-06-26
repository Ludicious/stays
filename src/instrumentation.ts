export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // ExcelJS parses xlsx via internal streams. If the stream emits an 'error'
    // event with no listener, Node.js throws an uncaughtException and kills the
    // process — bypassing the try/catch in route handlers. These handlers log
    // the error and keep the server alive so a bad file can't crash the app.
    process.on('uncaughtException', (err) => {
      console.error('[server] uncaughtException (server kept alive):', err?.message ?? err);
    });
    process.on('unhandledRejection', (reason) => {
      console.error('[server] unhandledRejection (server kept alive):', reason);
    });
  }
}
