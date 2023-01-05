<template>
  <div class="h-full overflow-hidden">
    <div
      class="flex items-stretch justify-between border-b bg-gray-900 border-gray-600 select-none h-10 px-2 space-x-2"
    >
      <template v-if="!isDarwin">
        <div class="flex items-center space-x-1">
          <div @click="onClose" class="control-button control-button-danger">
            <CloseIcon />
          </div>
          <div @click="onMin" class="control-button">
            <MinIcon />
          </div>
        </div>
      </template>

      <div class="flex items-center drag space-x-2 appear">
        <div
          class="text-xs bg-secondary h-7 rounded items-center px-3 bg-opacity-50 appear flex truncate"
          v-if="track"
        >
          <span class="truncate overflow-ellipsis"
            >{{ track?.video?.title }} • {{ track?.video?.author }}</span
          >
        </div>
      </div>
      <div class="w-px h-6 bg-gray-600"></div>
      <toolbar-options></toolbar-options>

      <div class="flex flex-1 drag"></div>

      <div class="flex items-center space-x-2">
        <template v-if="isDarwin && appVersion">
          <div class="text-xs opacity-30 text-white">v{{ appVersion }}</div>
          <div class="w-px h-6 bg-gray-600"></div>
        </template>
        <template v-if="updateInfo">
          <button
            class="text-xs h-7 rounded items-center px-3 transition duration-100 ease-out appear flex truncate cursor-pointer"
            :class="{
              'bg-green-500 text-white': updateInfo && !updateInfoProgress && !updateDownloaded,
              'text-green-500': updateDownloaded,
            }"
            @click="() => runUpdate()"
          >
            <template v-if="updateInfoProgress?.percent"
              >Downloading Update v{{ updateInfo.version }}...
              {{ updateInfoProgress.percent.toFixed(0).padStart(5) }}%</template
            >
            <template v-else>
              <span class="truncate overflow-ellipsis">New Update v{{ updateInfo.version }}</span>
            </template>
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent, ref } from "vue";
import CloseIcon from "@/assets/icons/close.svg";
import MaxIcon from "@/assets/icons/max-window.svg";
import MinIcon from "@/assets/icons/min-window.svg";
import ToolbarOptions from "./toolbar-options.vue";
import { refIpc } from "@/utils/Ipc";
const appVersion = ref(window.api.version);
const isDarwin = ref(window.process.platform === "darwin");
export default defineComponent({
  components: {
    CloseIcon,
    MinIcon,
    ToolbarOptions,
  },
  setup() {
    const [track] = refIpc("TRACK_CHANGE", {
      ignoreUndefined: true,
      defaultValue: null,
    });
    const [updateInfo, setUpdateInfo] = refIpc("APP_UPDATE", {
      ignoreUndefined: true,
      defaultValue: null,
    });
    const [updateInfoProgress] = refIpc("APP_UPDATE_PROGRESS", {
      ignoreUndefined: true,
      defaultValue: null,
    });
    const [updateDownloaded] = refIpc("APP_UPDATE_DOWNLOADED", {
      ignoreUndefined: true,
      defaultValue: null,
      mapper: (x) => !!x,
    });
    const isInstalling = ref(false);
    return {
      track,
      appVersion,
      updateInfo,
      updateInfoProgress,
      updateDownloaded,
      isDarwin,
      runUpdate() {
        if (isInstalling.value) return;
        isInstalling.value = true;
        return window.api
          .action("app.installUpdate")
          .then(() => {
            setUpdateInfo(null);
          })
          .finally(() => {
            isInstalling.value = false;
          });
      },
    };
  },
  beforeRouteLeave() {
    return;
  },
  methods: {
    onClose() {
      window.api.quit();
    },
    onMax() {
      window.api.maximize();
    },
    onMin() {
      window.api.minimize();
    },
  },
  created() {},
});
</script>

<style lang="scss">
html,
body {
  @apply overflow-hidden;
}
</style>
