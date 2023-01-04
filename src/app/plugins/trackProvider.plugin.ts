import { App } from "electron";

import { AfterInit, BaseProvider } from "@/app/utils/baseProvider";
import { IpcContext, IpcOn } from "@/app/utils/onIpcEvent";
import { serverMain } from "@/app/utils/serverEvents";
import { TrackData } from "@/app/utils/trackData";
import DiscordProvider from "./discordProvider.plugin";
import IPC_EVENT_NAMES from "../utils/eventNames";
import { clone } from "lodash-es";
import ApiProvider from "./apiProvider.plugin";
import MediaControlProvider from "./mediaControlProvider.plugin";

type RepeatState = 'off' | 'one' | 'all'
type TrackState = {
  id: string;
  playing: boolean;
  progress: number;
  uiProgress?: number;
  duration: number;
  liked: boolean;
  disliked: boolean;
  muted: boolean;
  repeat: RepeatState;
};
const tracks: {
  [id: string]: TrackData;
} = {};
@IpcContext
export default class TrackProvider extends BaseProvider implements AfterInit {
  private _activeTrackId: string;
  private _playState: "playing" | "paused" | undefined;
  private _trackState: TrackState;
  get playState() {
    return this._playState;
  }
  get trackState() {
    return this._trackState;
  }
  setTrackState(fn: TrackState | ((d: TrackState) => void | TrackState)) {
    const isFunc = typeof fn === "function";
    const ret = isFunc ? fn(this._trackState) : fn;
    const isVoid = ret === void 0 || ret === undefined;
    this._trackState = !isVoid ? (ret as TrackState) : this._trackState;

    this.windowContext.sendToAllViews("track:play-state", {
      ...(this.trackState ?? {}),
    });
  }
  get playing() {
    return this.playState === "playing";
  }
  constructor(private app: App) {
    super("track");
  }
  async AfterInit() {}
  get trackData() {
    return tracks[this._activeTrackId];
  }
  async getActiveTrackByDOM() {
    return this.views.youtubeView.webContents
      .executeJavaScript(`document.querySelector("a.ytp-title-link.yt-uix-sessionlink").href`)
      .then((href) => new URLSearchParams(href.split("?")[1])?.get("v"))
      .catch(() => null);
  }

  @IpcOn("track:info-req")
  private async __onTrackInfo(ev, track: TrackData) {
    if (!track.video) return;
    tracks[track.video.videoId] = track;

    if (
      track.video.videoId === this._activeTrackId ||
      (await this.getActiveTrackByDOM()) === track.video.videoId
    ) {
      this._activeTrackId = track.video.videoId;
      this.pushTrackToViews(track);
    }
  }
  @IpcOn("track:title-change", {
    debounce: 100,
  })
  private __onTitleChange(ev, trackId: string) {
    if (trackId) this.__onActiveTrack(trackId);
  }
  /**
   * 
   * @param lazy 500ms timeout before throwing
   * @returns [like, dislike] tuple
   */
  async currentSongLikeState(lazy?: boolean): Promise<[boolean, boolean]> {
    return (
      lazy ? new Promise<void>((resolve) => setTimeout(() => resolve(), 500)) : Promise.resolve()
    ).then(() =>
      this.views.youtubeView.webContents
        .executeJavaScript(
          `[document.querySelector("#like-button-renderer tp-yt-paper-icon-button.like").ariaPressed, document.querySelector("#like-button-renderer tp-yt-paper-icon-button.dislike").ariaPressed]`
        )
        .then((values: string[]) => values.map(x => x === "true") as any)
        .catch(() => [false, false])
    );
  }

  /**
   * 
   * @param lazy 500ms timeout before throwing
   * @returns [like, dislike] tuple
   */
   async currentMutedState(lazy?: boolean): Promise<boolean> {
    return (
      lazy ? new Promise<void>((resolve) => setTimeout(() => resolve(), 500)) : Promise.resolve()
    ).then(() =>
      this.views.youtubeView.webContents
        .executeJavaScript(
          `document.querySelector("#right-controls div.right-controls-buttons tp-yt-paper-icon-button.volume").ariaPressed`
        )
        .then((pressed: string) => pressed == "true")
        .catch(() => false)
    );
  }

  /**
   * 
   * @param lazy 500ms timeout before throwing
   * @returns [like, dislike] tuple
   */
   async currentRepeatState(lazy?: boolean): Promise<RepeatState> {
    const repeatParser: Record<string, RepeatState> = {
      'Repeat all': 'all',
      'Repeat one': 'one',
      'Repeat off': 'off'
    }

    return (
      lazy ? new Promise<void>((resolve) => setTimeout(() => resolve(), 500)) : Promise.resolve()
    ).then(() =>
      this.views.youtubeView.webContents
        .executeJavaScript(
          `document.querySelector("#right-controls div.right-controls-buttons tp-yt-paper-icon-button.repeat").ariaLabel`
        )
        .then((label: string) => repeatParser[label])
        .catch(() => 'off')
    );
  }

  async getTrackState(): Promise<TrackState> {
    const isMuted = await this.currentMutedState();
    const repeatState = await this.currentRepeatState();

    const trackState: TrackState = {
      ...this._trackState,
      muted: isMuted,
      repeat: repeatState,
    };

    this.setTrackState(trackState)

    return trackState
  }

  getTrackDuration() {
    const td = this.trackData;
    if (!this.trackData) return null;
    return ((dur) => (dur ? Number.parseInt(dur) : null))(
      td.context?.videoDetails?.durationSeconds ?? td.video?.lengthSeconds
    );
  }
  @IpcOn("track:set-active", {
    debounce: 1000,
  })
  private async __onActiveTrack(trackId: string) {
    if (this._activeTrackId === trackId) return;

    this.logger.debug(`active track:`, trackId);
    this._activeTrackId = trackId;
    if (this.trackData) {
      const td = this.trackData;
      const [isLiked, isDLiked] = await this.currentSongLikeState();
      const isMuted = await this.currentMutedState();
      const repeatState = await this.currentRepeatState();
      this.pushTrackToViews(td);
      this.setTrackState({
        id: trackId,
        playing: this.playing,
        duration: this.getTrackDuration(),
        liked: isLiked,
        disliked: isDLiked,
        progress: 0,
        uiProgress: 0,
        muted: isMuted,
        repeat: repeatState,
      });
    }
  }
  public async pushTrackToViews(track: TrackData) {
    this.views.toolbarView.webContents.send("track:title", track?.video?.title);
    this.views.youtubeView.webContents.send("track.change", track.video.videoId);
    this.windowContext.sendToAllViews(IPC_EVENT_NAMES.TRACK_CHANGE, track);
    
    const api = this.getProvider("api") as ApiProvider;
    api.sendMessage(IPC_EVENT_NAMES.TRACK_CHANGE, { ...track });

    const mediaController = this.getProvider<MediaControlProvider>("mediaController");
    mediaController.handleTrackMediaOSControlChange(track)
  }
  @IpcOn(IPC_EVENT_NAMES.TRACK_PLAYSTATE, {
    debounce: 100
  })
  private async __onPlayStateChange(
    _ev,
    isPlaying: boolean,
    progressSeconds: number = 0,
    uiTimeInfo: [number, number] = null
  ) {
    // this.logger.debug(
    //   [
    //     "play state change",
    //     isPlaying ? "playing" : "paused",
    //     ", progress: ",
    //     progressSeconds,
    //     ", ui progress: ",
    //     ...(uiTimeInfo?.length > 0 ? uiTimeInfo : ["-"]),
    //   ].join(" ")
    // );
    this._playState = isPlaying ? "playing" : "paused";
    const discordProvider = this.getProvider("discord") as DiscordProvider;
    if (isPlaying && !discordProvider.isConnected && discordProvider.enabled)
      await discordProvider.enable();
    const isUIViewRequired = uiTimeInfo?.[1] && progressSeconds > uiTimeInfo?.[1];

    const [currentUIProgress] = isUIViewRequired ? uiTimeInfo : [progressSeconds];
    if (isUIViewRequired) await discordProvider.updatePlayState(isPlaying, currentUIProgress);
    else await discordProvider.updatePlayState(isPlaying, progressSeconds);
    const [isLiked, isDLiked] = await this.currentSongLikeState();
    const isMuted = await this.currentMutedState();
    const repeatState = await this.currentRepeatState();
    if (this._trackState) {
      this.setTrackState((state) => {
        state.playing = isPlaying;
        state.progress = progressSeconds;
        state.uiProgress = uiTimeInfo[0];
        state.liked = isLiked;
        state.disliked = isDLiked;
        state.duration = uiTimeInfo[1];
      });
    } else {
      this.setTrackState({
        playing: isPlaying,
        progress: progressSeconds,
        uiProgress: uiTimeInfo[0],
        liked: isLiked,
        disliked: isDLiked,
        duration: uiTimeInfo[1],
        id: this._activeTrackId,
        muted: isMuted,
        repeat: repeatState,
      });
    }
  }
}
