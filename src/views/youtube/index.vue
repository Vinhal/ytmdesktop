<template>
  <div class="h-full">
    <router-view></router-view>
  </div>
</template>

<script>
import { onMounted } from "vue";
import MouseTrap from "mousetrap";

export default defineComponent({
  setup() {
    onMounted(() => {
      MouseTrap.bind("space", function () {
        window.ipcRenderer.invoke("api/track/toggle-play-state");
      });
    });
  },
});
</script>

<style></style>
