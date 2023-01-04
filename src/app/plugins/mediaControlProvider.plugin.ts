import { App, globalShortcut } from "electron";
import { BaseProvider, AfterInit, BeforeStart, OnDestroy } from "@/app/utils/baseProvider";
import { IpcContext, IpcOn } from "@/app/utils/onIpcEvent";
import TrackProvider from "./trackProvider.plugin";
import { MediaServiceProvider } from "xosms";
import { XOSMS } from "@/app/utils/xosms-types";
import { TrackData } from "@/app/utils/trackData";
import ApiProvider from "./apiProvider.plugin";
import IPC_EVENT_NAMES from "../utils/eventNames";

@IpcContext
export default class MediaControlProvider extends BaseProvider
  implements AfterInit, BeforeStart, OnDestroy {
  private _mediaProvider: MediaServiceProvider;
  private xosmsLog = this.logger.child("xosms");
  
  constructor(private app: App) {
    super("mediaController");
  }
  
  private mediaProviderEnabled() {
    return this._mediaProvider && this._mediaProvider.isEnabled;
  }

  async BeforeStart(app?: App) {
    app.commandLine.appendSwitch("disable-features", "MediaSessionService");
    app.commandLine.appendSwitch("in-progress-gpu"); // gpu paint not working on some devices, todo: workaround/await fix
    app.commandLine.appendSwitch("no-sandbox"); // avoid freeze, todo: workaround/await fix
  }

  async AfterInit() {
    this._mediaProvider = ((msp) => {
      msp.isEnabled = true;
      return msp;
    })(new MediaServiceProvider(this.app.name, this.app.name));

    if (this._mediaProvider) {
      this._mediaProvider.buttonPressed = (keyName, ...args) => {
        this.xosmsLog.debug(["button press", keyName, ...args]);
        const trackProvider = this.getProvider<ApiProvider>("api");
        if (keyName === "playpause") trackProvider.toggleTrackPlayback();
        else if (keyName === "play") trackProvider.playTrack();
        else if (keyName === "pause") trackProvider.pauseTrack();
        else if (keyName === "next") trackProvider.nextTrack();
        else if (keyName === "previous") trackProvider.prevTrack();
      };
    }
    if (!this.mediaProviderEnabled())
      this.xosmsLog.warn(
        [
          "XOSMS is disabled",
          ":: Status:",
          `Provider: ${!!this
            ._mediaProvider}, Enabled: ${this.mediaProviderEnabled()}`,
        ].join(", ")
      );
  }

  async OnDestroy() {
    globalShortcut
  }

  // @IpcOn(IPC_EVENT_NAMES.TRACK_PLAYSTATE)
  private __handleTrackMediaOSControl(_ev, isPlaying: boolean) {
    if (!this.mediaProviderEnabled()) return;

    console.log('NAVIGATOR')

    const { trackData } = this.getProvider<TrackProvider>("track");
    // this.handleTrackMediaOSControlChange(trackData)
    if (!trackData) {
      this._mediaProvider.playbackStatus = XOSMS.PlaybackStatus.Stopped;
      this._mediaProvider.playButtonEnabled = true;
      this._mediaProvider.pauseButtonEnabled = false;
    } else {
      this._mediaProvider.playbackStatus = isPlaying
        ? XOSMS.PlaybackStatus.Playing
        : XOSMS.PlaybackStatus.Paused;

      this._mediaProvider.playButtonEnabled = !isPlaying;
      this._mediaProvider.pauseButtonEnabled = isPlaying;
      this.xosmsLog.debug(
        [
          `IsPlaying State: ${isPlaying}`,
          `XOSMS: ${XOSMS.PlaybackStatus[
            this._mediaProvider.playbackStatus
          ]?.toString?.()}`,
        ].join(", ")
      );
    }
  }

  public handleTrackMediaOSControlChange(trackData: TrackData) {
    if (!this.mediaProviderEnabled() || !trackData) return;
    const albumThumbnail = trackData.video.thumbnail.thumbnails
      .sort((a, b) => b.width - a.width)
      .find((x) => x.url)?.url;

    this.views.youtubeView.webContents.executeJavaScript(`
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Unforgettable',
        artist: 'Nat King Cole',
        album: 'The Ultimate Collection (Remastered)',
        artwork: [
          { src: '${albumThumbnail}',   sizes: '512x512',   type: 'image/png' },
        ]
      })
    `)

    console.log('CHHHHHHHHHHHHHHANNGEDCHHHHHHHHHHHHHHANNGEDCHHHHHHHHHHHHHHANNGEDCHHHHHHHHHHHHHHANNGEDCHHHHHHHHHHHHHHANNGED', {
      albumThumbnail,
      title: trackData.video.title
    })
    try {
      this._mediaProvider.mediaType =
      {
        ["Video"]: XOSMS.MediaType.Video,
        ["Music"]: XOSMS.MediaType.Music,
        ["Image"]: XOSMS.MediaType.Image,
      }[trackData.context.category] ?? XOSMS.MediaType.Video;
    this._mediaProvider.playbackStatus = XOSMS.PlaybackStatus.Playing;
    this._mediaProvider.albumArtist = trackData.video.author;
    this._mediaProvider.albumTitle = trackData.context.pageOwnerDetails.name;
    this._mediaProvider.artist = trackData.video.author;
    this._mediaProvider.setThumbnail(XOSMS.ThumbnailType.Uri, albumThumbnail);
    this._mediaProvider.title = trackData.video.title;
    this._mediaProvider.trackId = trackData.video.videoId;
    this._mediaProvider.previousButtonEnabled = true;
    this._mediaProvider.nextButtonEnabled = true;
    } catch (ex) {
      this.logger.error(ex); // rip media service
    }
    this.logger.debug([
      this._mediaProvider.title,
      XOSMS.MediaType[this._mediaProvider.mediaType].toString(),
      this._mediaProvider.trackId,
    ]);
  }
}
