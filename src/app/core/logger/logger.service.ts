import { Injectable } from '@angular/core';
import {Logger, LoggerServiceInterface, LogSeverity} from './logger';

@Injectable({
  providedIn: 'root'
})

export class LoggerService implements LoggerServiceInterface {
  enabled = true;
  globalLoglevel = LogSeverity.DEBUG;

  constructor() { }

  createLocalLoggerInstance(componentName: string, logLevel: LogSeverity): Logger {
    return new Logger(this.enabled, logLevel, this, componentName);
  }

  configure(enable: boolean, globalLoglevel: LogSeverity) {
    this.enabled = enable;
    this.globalLoglevel = globalLoglevel;
  }

  log(severity: LogSeverity, logLevel: number, componentName: string, methodName: string, ...msg: any[]) {
    if (!this.enabled) return;
    if (this.globalLoglevel < logLevel) logLevel = this.globalLoglevel;
    if (severity < logLevel) return;

    switch (severity) {
      case LogSeverity.DEBUG:
        console.debug(new Date().toISOString(), componentName, methodName, ...msg);
        break;
      case LogSeverity.INFO:
        console.info(new Date().toISOString(), componentName, methodName, ...msg);
        break;
      case LogSeverity.WARN:
        console.warn(new Date().toISOString(), componentName, methodName, ...msg);
        break;
      case LogSeverity.ERROR:
        console.error(new Date().toISOString(), componentName, methodName, ...msg);
        break;
     }
  }
}
