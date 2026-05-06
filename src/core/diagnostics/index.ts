export class DiagnosticWriter {
  private isBackpressured = false;
  private droppedCount = 0;

  warn(message: string): void {
    this.write(message);
  }

  private write(message: string): void {
    const line = message.endsWith('\n') ? message : `${message}\n`;

    if (this.isBackpressured) {
      this.droppedCount++;
      return;
    }

    const ok = process.stderr.write(line);
    if (ok) return;

    this.isBackpressured = true;
    process.stderr.once('drain', () => {
      this.isBackpressured = false;
      this.reportDroppedWarnings();
    });
  }

  private reportDroppedWarnings(): void {
    if (this.droppedCount === 0) return;

    const dropped = this.droppedCount;
    this.droppedCount = 0;
    const line = `[Corelens] Dropped ${dropped} diagnostic warning(s) while stderr was backpressured\n`;

    const ok = process.stderr.write(line);
    if (!ok) {
      this.isBackpressured = true;
      process.stderr.once('drain', () => {
        this.isBackpressured = false;
        this.reportDroppedWarnings();
      });
    }
  }
}

export const diagnostics = new DiagnosticWriter();
