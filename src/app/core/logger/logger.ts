
export enum LogSeverity {
  DEBUG,
  INFO,
  WARN,
  ERROR
}

export interface LoggerServiceInterface {
  configure(enable: boolean, globalLoglevel: LogSeverity): void;
  log(severity: LogSeverity, logLevel: number, componentName: string, methodName: string, ...msg: any[]): void;
}

export class Logger {
  enabled = false;
  defaultLogLevel = LogSeverity.DEBUG;
  loggerService: LoggerServiceInterface | undefined;

  componentName: string = "";

  appendComponentName(subComponentName: string) {
    this.componentName += `::${subComponentName}`;
  }

  configure(enable: boolean, globalLoglevel: LogSeverity) {
    this.enabled = enable;
    this.defaultLogLevel = globalLoglevel;
  }

  constructor(enabled: boolean, defaultLogLevel: LogSeverity, loggerService: LoggerServiceInterface | undefined, componentName: string) {
    this.enabled = enabled;
    this.defaultLogLevel = defaultLogLevel;
    this.loggerService = loggerService;
    this.componentName = componentName;
  }

  debug(methodName: string, ...msg: any[]) {
    this.log(LogSeverity.DEBUG, methodName, ...msg);
  }
  info(methodName: string, ...msg: any[]) {
    this.log(LogSeverity.INFO, methodName, ...msg);
  }
  warn(methodName: string, ...msg: any[]) {
    this.log(LogSeverity.WARN, methodName, ...msg);
  }
  err(methodName: string, ...msg: any[]) {
    this.log(LogSeverity.ERROR, methodName, ...msg);
  }

  log(severity: LogSeverity, methodName: string, ...msg: any[]) {
    if (!this.enabled) return;

    if (this.loggerService) {
      this.loggerService.log(severity, this.defaultLogLevel, this.componentName, methodName, ...msg);
    } else {
      Logger.localLog(severity, this.componentName, methodName, ...msg);
    }
  }

  static localLog(severity: LogSeverity, componentName: string, methodName: string, ...msg: any[]) {
    switch (severity) {
      case LogSeverity.DEBUG:
        console.debug(componentName, methodName, ...msg);
        break;
      case LogSeverity.INFO:
        console.info(componentName, methodName, ...msg);
        break;
      case LogSeverity.WARN:
        console.warn(componentName, methodName, ...msg);
        break;
      case LogSeverity.ERROR:
        console.error(componentName, methodName, ...msg);
        break;
    }
  }
}
