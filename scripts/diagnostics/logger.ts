export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Readonly<Record<string, unknown>>;

export interface LogRecord {
  level: LogLevel;
  scope: string;
  message: string;
  tick?: number;
  fields?: LogFields;
}

export type LogSink = (record: LogRecord) => void;

function defaultSink(record: LogRecord): void {
  const serialized = `[Sky Knights] ${JSON.stringify(record)}`;

  if (record.level === "error") {
    console.error(serialized);
    return;
  }

  console.warn(serialized);
}

export class Logger {
  public constructor(
    private readonly scope: string,
    private readonly sink: LogSink = defaultSink,
    private readonly tickProvider?: () => number,
  ) {}

  public child(scope: string): Logger {
    return new Logger(`${this.scope}.${scope}`, this.sink, this.tickProvider);
  }

  public debug(message: string, fields?: LogFields): void {
    this.write("debug", message, fields);
  }

  public info(message: string, fields?: LogFields): void {
    this.write("info", message, fields);
  }

  public warn(message: string, fields?: LogFields): void {
    this.write("warn", message, fields);
  }

  public error(message: string, fields?: LogFields): void {
    this.write("error", message, fields);
  }

  private write(level: LogLevel, message: string, fields?: LogFields): void {
    this.sink({
      level,
      scope: this.scope,
      message,
      tick: this.tickProvider?.(),
      fields,
    });
  }
}
