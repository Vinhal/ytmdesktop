import { App, BrowserWindow } from "electron";
import { BaseProvider, AfterInit, OnDestroy } from "@/app/utils/baseProvider";
import { ApiWorker, createApiWorker } from "@/api/createApiWorker";
import SettingsProvider from "./settingsProvider.plugin";
import { IpcContext, IpcHandle, IpcOn } from "@/app/utils/onIpcEvent";
import TrackProvider from "./trackProvider.plugin";
import { API_ROUTES } from "../utils/eventNames";
import { clamp } from "lodash-es";
import Vibrant from "node-vibrant";
import fetch from "node-fetch";
@IpcContext
export default class ApiProvider
  extends BaseProvider
  implements AfterInit, OnDestroy {
  private _thread: ApiWorker;
  private _renderer: BrowserWindow;
  constructor(private _app: App) {
    super("api");
  }
  OnDestroy() {
    this._thread?.destroy();
  }
  get app() {
    return this._app;
  }
  sendMessage(...args: any[]) {
    return this._thread?.send("socket", ...args);
  }
  private get settingsProvider() {
    return this.getProvider("settings") as SettingsProvider;
  }
  private get trackProvider() {
    return this.getProvider<TrackProvider>("track");
  }
  async AfterInit() {
    if (this._thread) this._thread.destroy();
    const config = this.settingsProvider;
    if (!config.instance?.api?.enabled) return;
    this._thread = await createApiWorker(this.windowContext.main);
    const tpid = await this._thread.invoke<number>("initialize", {
      config: { ...config!.instance },
    });
    this._renderer = BrowserWindow.getAllWindows().find(
      (x) => x.id === this._thread.rendererId
    );
    this.logger.debug("running thread pid: " + tpid);
  }

  @IpcOn("settingsProvider.change", {
    filter: (key: string) => key === "api.enabled",
    debounce: 1000,
  })
  private async __onApiEnabled(key: string, value: boolean) {
    if (!value) {
      this._thread.destroy();
    } else {
      await this.AfterInit();
    }
  }
  @IpcHandle("api/routes")
  private async __getRoutes() {
    return Object.values(API_ROUTES).map((x) => x.replace(/^\/?api\//, ""));
  }
  @IpcHandle(API_ROUTES.TRACK_CURRENT)
  async getTrackInformation() {
    return (this.getProvider("track") as TrackProvider)?.trackData;
  }
  @IpcHandle(API_ROUTES.TRACK_ACCENT)
  async getTrackAccent() {
    const track = await this.getTrackInformation();
    if (!track || !track.video || !track.video.thumbnail.thumbnails[0]?.url) return null;
    return await fetch(track.video.thumbnail.thumbnails[0].url)
      .then((th) => th.buffer())
      .then((file) => Vibrant.from(file))
      .then((clr) => clr.getPalette())
      .then((clr) => clr.Vibrant.hex)
      .catch(err => {
        this.logger.error(err);
        return null;
      })
  }
  @IpcHandle(API_ROUTES.TRACK_LIKE)
  async postTrackLike(_ev, like: boolean) {
    const doLike = (await this.trackProvider.currentSongLikeState())?.[0] === like;
    if (!doLike)
      return this.views.youtubeView.webContents
        .executeJavaScript(
          `document.querySelector("#like-button-renderer tp-yt-paper-icon-button.like").click()`
        )
        .then(() => this.trackProvider.currentSongLikeState())
        .catch(() => [false])
        .then(([isLiked]) => {
          this.trackProvider.setTrackState((state) => {
            state.liked = isLiked;
          });
          return isLiked;
        });
  }
  @IpcHandle(API_ROUTES.TRACK_DISLIKE)
  async postTrackDisLike(_ev, like: boolean) {
    const likeState = (await this.trackProvider.currentSongLikeState())?.[1] === like;
    if (!likeState)
      return this.views.youtubeView.webContents
        .executeJavaScript(
          `document.querySelector("#like-button-renderer tp-yt-paper-icon-button.dislike").click()`
        )
        .then(() => this.trackProvider.currentSongLikeState())
        .catch(() => [false, false])
        .then(([, _likeState]) => {
          this.trackProvider.setTrackState((state) => {
            state.disliked = _likeState;
          });
          return _likeState;
        });
  }
  @IpcHandle(API_ROUTES.TRACK_CURRENT_STATE)
  async getTrackState() {
    return (this.getProvider("track") as TrackProvider)?.getTrackState();
  }
  @IpcHandle(API_ROUTES.TRACK_CONTROL_NEXT)
  async nextTrack() {
    await this.views.youtubeView.webContents.executeJavaScript(
      `(el => el && el.click())(document.querySelector(".ytmusic-player-bar.next-button"))`
    );
  }
  @IpcHandle(API_ROUTES.TRACK_CONTROL_FORWARD)
  async forwardTrack(_ev, data) {
    const { time } = data ?? {};
    if (typeof time === "number" && time !== 0)
      this.views.youtubeView.webContents.send("track:seek", {
        time,
      });
  }
  @IpcHandle(API_ROUTES.TRACK_CONTROL_SEEK)
  async seekTrack(_ev, time) {
    if (typeof time !== "number") return;
    this.views.youtubeView.webContents.send("track:seek", {
      time,
    });
  }
  @IpcHandle(API_ROUTES.TRACK_CONTROL_BACKWARD)
  async backwardTrack(_ev, data) {
    const { time } = data ?? {};
    if (typeof time === "number" && time !== 0)
      this.views.youtubeView.webContents.send("track:seek", {
        time: -time,
      });
  }
  @IpcHandle(API_ROUTES.TRACK_CONTROL_PREV)
  async prevTrack() {
    await this.views.youtubeView.webContents.executeJavaScript(
      `(el => el && el.click())(document.querySelector(".ytmusic-player-bar.previous-button"))`
    );
  }
  @IpcHandle(API_ROUTES.TRACK_CONTROL_PLAY)
  async playTrack() {
    if (this.trackProvider.playState === "paused")
      await this.views.youtubeView.webContents.executeJavaScript(
        `(el => el && el.click())(document.querySelector(".ytmusic-player-bar#play-pause-button"))`
      );
  }
  @IpcHandle(API_ROUTES.TRACK_CONTROL_PAUSE)
  async pauseTrack() {
    if (this.trackProvider.playState === "playing")
      await this.views.youtubeView.webContents.executeJavaScript(
        `(el => el && el.click())(document.querySelector(".ytmusic-player-bar#play-pause-button"))`
      );
  }
  @IpcHandle(API_ROUTES.TRACK_CONTROL_TOGGLE_PLAY)
  async toggleTrackPlayback() {
    if (this.trackProvider.playState === "playing") return this.pauseTrack();
    else if (this.trackProvider.playState === "paused") return this.playTrack();
    return Promise.resolve(null);
  }


  @IpcHandle(API_ROUTES.TRACK_CONTROL_MUTE)
  async muteTrack() {
    await this.views.youtubeView.webContents.executeJavaScript(
      `(el => el && el.click())(document.querySelector(".ytmusic-player-bar.volume"))`
    )
    .then(() => this.trackProvider.currentMutedState())
    .then((muted) => {
      this.trackProvider.setTrackState((state) => {
        state.muted = muted;
      });
      return muted;
    })
    .catch(() => false);
  }

  @IpcHandle(API_ROUTES.TRACK_CONTROL_REPEAT)
  async repeatTrack() {
    await this.views.youtubeView.webContents.executeJavaScript(
      `(el => el && el.click())(document.querySelector(".ytmusic-player-bar.repeat"))`
    )
    .then(() => this.trackProvider.currentRepeatState())
    .then((repeateState) => {
      this.trackProvider.setTrackState((state) => {
        state.repeat = repeateState;
      });
      return repeateState;
    })
    .catch(() => 'off');
  }

  @IpcHandle(API_ROUTES.TRACK_CONTROL_SHUFFLE)
  async shuffleTrack() {
    await this.views.youtubeView.webContents.executeJavaScript(
      `(el => el && el.click())(document.querySelector(".ytmusic-player-bar.shuffle"))`
    );
  }
}
