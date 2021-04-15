import { App, autoUpdater, ipcMain } from "electron";
import { isDevelopment } from "../utils/devUtils";
import SettingsProvider from "./settingsProvider.plugin";
import { AfterInit, BaseProvider, OnInit } from "./_baseProvider";
import { basename } from "path";
import { IpcOn } from "../utils/onIpcEvent";

export default class EventProvider extends BaseProvider
  implements OnInit, AfterInit {
  get settingsInstance(): SettingsProvider {
    return this.getProvider("settings");
  }

  private _updateAvailable: boolean;
  public get updateAvailable() {
    return this._updateAvailable;
  }
  private _updateDownloaded: boolean;
  public get updateDownloaded() {
    return this._updateDownloaded;
  }

  constructor(private app: App) {
    super("startup");
  }
  OnInit() {
    if (!isDevelopment) {
      const settings = this.settingsInstance;
      const app = settings.get("app");
      const server = "https://update.electronjs.org";
      const feed = `${server}/Venipa/ytmdesktop2/${process.platform}-${
        process.arch
      }/${this.app.getVersion()}`;

      autoUpdater.setFeedURL({
        url: feed,
      });
      autoUpdater.on("update-available", () => {
        this.logger.debug("Update Available");
        this._updateAvailable = true;
        ipcMain.emit("app.updateAvailable");
      });
      autoUpdater.on("update-downloaded", () => {
        this.logger.debug("Update Downloaded");
        (this._updateAvailable = true), (this._updateDownloaded = true);
        ipcMain.emit("app.updateDownloaded");
      });
      if (app.autoupdate) autoUpdater.checkForUpdates();
    }
  }
  private _autoUpdateCheckHandle;
  AfterInit() {
    this.logger.debug("Initialized");
  }
  @IpcOn("app.installUpdate", {
    debounce: 1000,
  })
  onAutoUpdateRun() {
    autoUpdater.quitAndInstall();
  }
  @IpcOn("app.checkUpdate", {
    debounce: 1000,
  })
  onCheckUpdate() {
    autoUpdater.checkForUpdates();
  }
  @IpcOn("settingsProvider.update", {
    debounce: 1000,
    filter: (ev, [key]: [string]) => key === "app.autoupdate",
  })
  onAutoUpdateToggled(ev, [key, value]: [string, boolean]) {
    const autoUpdateEnabled = this.settingsInstance.get(
      "app.autoupdate",
      false
    );
    if (!isDevelopment) {
      if (autoUpdateEnabled) {
        if (!this._autoUpdateCheckHandle)
          this._autoUpdateCheckHandle = setInterval(() => {
            autoUpdater.checkForUpdates();
          }, 1000 * 60 * 5);
      } else if (this._autoUpdateCheckHandle) {
        clearInterval(this._autoUpdateCheckHandle);
      }
    }
  }
}
