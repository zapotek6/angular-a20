import {Component, inject} from '@angular/core';
import {CacheStore} from '../../core/infra/repo/cache-store';
import {MetricsService} from '../../utils/metrics.service';
import {Item} from '../../core/models/item';
import {ItemsRepository} from '../../core/infra/repo/items.repository';
import {HttpClient} from '@angular/common/http';
import {Router} from '@angular/router';
import {AuthService} from '../../core/auth/auth.service';
import {OnlineFocusService} from '../../utils/online-focus.service';
import {ProjectsRepository} from '../../core/infra/repo/projects.repository';

@Component({
  selector: 'app-development',
  imports: [],
  templateUrl: './development.html',
  styleUrl: './development.scss'
})
export class Development {
  itemsRepo?: ItemsRepository;
  projectsRepo?: ProjectsRepository;
  auth: AuthService = inject(AuthService);

  constructor() {
    /*if (this.auth.isAuthenticated()) {
      let metrics = inject(MetricsService);
      let cacheStore = new CacheStore(metrics);

      let item = new Item();
      item.name = "item X";
      item.value = "X";
      item.version = 1;
      item.tenant_id = "bsh11";
      item.location = "/bsh/dev/projects/connect-rex";
      item.resource_type = "item";
      item.id = "";
      /!*this.cacheStore.set('test', item, item.version.toString());
      let gitem = this.cacheStore.get<Item>('test');
      console.log(gitem);*!/

      this.itemsRepo = new ItemsRepository(inject(OnlineFocusService), inject(HttpClient), cacheStore, inject(Router), metrics, inject(AuthService));
      this.projectsRepo = new ProjectsRepository(inject(OnlineFocusService), inject(HttpClient), cacheStore, inject(Router), metrics, inject(AuthService));


      this.itemsRepo.create("bsh11", item).subscribe(
        (res) => {
          console.log(res);
        },
        (err) => {
          console.log(err);
        }
      );

      /!*this.itemsRepo.getItems("bsh11", { 'path': '/'}).subscribe(
        (res) => {
          console.log(res);
        },
        (err) => {
          console.log(err);
        }
      );*!/

      this.itemsRepo.getMany("bsh11", { 'path': '/'}).subscribe(
        (res) => {
          console.log('READ 1', res);
          if (this.itemsRepo) this.itemsRepo.read("bsh11", "01998ae5-6173-7872-93a0-4731b1c7b9b7").subscribe(
            (res) => {
              console.log('READ 2', res);
            },
            (err) => {
              console.log(err);
            }
          );
        },
        (err) => {
          console.log(err);
        }
      );

      this.projectsRepo.getMany("bsh11", { 'path': '/'}).subscribe(
        (res) => {
          console.log('READ 1', res);

        },
        (err) => {
          console.log(err);
        }
      );


    }*/
  }
}
