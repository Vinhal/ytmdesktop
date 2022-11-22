<template>
  <div class="flex flex-row items-center space-x-2">
    <button
      @click="() => action('nav.same-origin')"
      class="control-button relative w-4 h-4"
      v-if="!isHome"
    >
      <HomeIcon></HomeIcon>
    </button>
    <button
      @click="() => action('app.devTools')"
      class="control-button relative w-4 h-4"
      v-if="isDev"
    >
      <DevIcon></DevIcon>
    </button>
    <button @click="onSettings" class="control-button">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path
          fill-rule="evenodd"
          d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
          clip-rule="evenodd"
        />
      </svg>
    </button>
    <button
      @click="() => action('app.miniPlayer')"
      class="control-button relative w-4 h-4"
      :disabled="!playState"
      :class="miniPlayer ? { 'opacity-100': playState, 'opacity-70': !miniPlayer?.active } : {}"
    >
      <MiniPlayerIcon />
    </button>
  </div>
</template>

<script>
import { defineComponent, onMounted, ref } from "vue";
import { refIpc } from "../../utils/Ipc";
import HomeIcon from "@/assets/icons/home.svg";
import DevIcon from "@/assets/icons/chip.svg";
import MiniPlayerIcon from "@/assets/icons/mini-player.svg";
export default defineComponent({
  components: { HomeIcon, DevIcon, MiniPlayerIcon },
  setup() {
    const [discordConnected, setDiscordConnected] = refIpc(
      ["discord.connected", "discord.disconnected"],
      {
        defaultValue: false,
        mapper: (data, name) => {
          return { ["discord.connected"]: true, ["discord.disconnected"]: false }[name];
        },
        ignoreUndefined: true,
      }
    );
    const [miniPlayer, setMiniPlayer] = refIpc("miniplayer.state", {
      defaultValue: null,
      ignoreUndefined: true,
    });
    const [playState] = refIpc("TRACK_PLAYSTATE");
    const [isHome] = refIpc("nav.same-origin", {
      defaultValue: true,
      mapper: ([sameOrigin]) => !!sameOrigin,
      rawArgs: true,
    });
    const [discordEnabled, setDiscordEnabled] = refIpc("settingsProvider.change", {
      defaultValue: window.settings.get("discord.enabled"),
      mapper: ([key, value]) => {
        if (key === "discord.enabled") return value;
      },
      ignoreUndefined: true,
      rawArgs: true,
    });
    const [isDev] = refIpc("settingsProvider.change", {
      defaultValue: window.settings.get("app.enableDev"),
      mapper: ([key, value]) => {
        if (key === "app.enableDev") return value;
      },
      ignoreUndefined: true,
      rawArgs: true,
    });
    onMounted(() => {
      window.ipcRenderer.invoke("req:discord.connected").then((x) => setDiscordConnected(!!x));
    });
    const [updateChecking, setUpdateChecking] = refIpc("APP_UPDATE_CHECKING");
    return {
      discordEnabled,
      discordConnected,
      updateChecking,
      isHome,
      isDev,
      playState,
      miniPlayer,
      async toggleSetting(key) {
        const setting = await window.api.settingsProvider.update(key, !window.settings.get(key));
        if (key === "discord.enabled") setDiscordEnabled(setting);
      },
      checkUpdate() {
        if (updateChecking.value) return;
        setUpdateChecking(true);
        this.action("app.checkUpdate").finally(() => {
          setUpdateChecking(false);
        });
      },
      action(actionParam, ...params) {
        return window.api.action(actionParam, ...params);
      },
      invoke(invokeParam, ...params) {
        return window.api.invoke(invokeParam, ...params);
      },
      onSettings() {
        window.api.openWindow("settingsWindow");
      },
    };
  },
});
</script>

<style></style>
