import {Logger} from './logger/logger';


export class BroadcasterService {
  private bc?: BroadcastChannel;

  constructor(private readonly logger: Logger, channeName: string = 'general') {
    this.createBroadcastChannel(channeName);
  }

  private createBroadcastChannel(channeName: string) {
    if ('BroadcastChannel' in window) {
      this.bc = new BroadcastChannel(channeName);
    } else {
      this.logger.err('createBroadcastChannel', 'BroadcastChannel not supported');
    }
  }

  public broadcast(message: any) {
    this.bc?.postMessage(message);
    this.logger.debug('broadcast', 'BroadcastChannel message sent');
  }

  public onMessage(callback: (message: any) => void) {
    if (this.bc) {
      this.bc.onmessage = (ev) => {
        callback(ev.data);
      };
    }
  }
}
