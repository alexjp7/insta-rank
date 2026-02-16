<template>
  <v-app>
    <!-- App Bar -->
    <v-app-bar flat class="glass-panel" style="border-bottom: 1px solid rgba(200, 80, 192, 0.15);">
      <template v-slot:prepend>
        <v-icon color="primary" size="28" class="ml-2">mdi-camera-iris</v-icon>
      </template>

      <v-app-bar-title>
        <span class="insta-gradient-text" style="font-weight: 800; font-size: 1.4rem; letter-spacing: -0.5px;">
          InstaRank
        </span>
        <span style="color: rgba(232, 232, 240, 0.4); font-weight: 300; font-size: 0.85rem; margin-left: 8px;">
          AI Photo Ranking
        </span>
      </v-app-bar-title>

      <template v-slot:append>
        <v-chip v-if="comparisonCount > 0" variant="tonal" color="secondary" size="small" class="mr-2">
          <v-icon start size="14">mdi-compare</v-icon>
          {{ comparisonCount }} compared
        </v-chip>
        <v-chip v-if="totalCount > 0" variant="tonal" color="primary" size="small" class="mr-2">
          <v-icon start size="14">mdi-image-multiple</v-icon>
          {{ rankedCount }}/{{ totalCount }} ranked
        </v-chip>
      </template>
    </v-app-bar>

    <!-- Main Content -->
    <v-main>
      <router-view />
    </v-main>

    <!-- Snackbar for errors -->
    <v-snackbar v-model="showError" color="error" timeout="5000" location="bottom right">
      {{ error }}
      <template v-slot:actions>
        <v-btn variant="text" @click="showError = false">Close</v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { usePhotos } from './composables/usePhotos';

const { error, rankedCount, totalCount, comparisonCount } = usePhotos();

const showError = ref(false);
watch(error, (val) => {
  if (val) showError.value = true;
});
</script>
