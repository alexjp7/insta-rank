<template>
  <v-container fluid class="pa-6" style="max-width: 1000px;">
    <!-- Back Button -->
    <v-btn
      variant="text"
      color="primary"
      class="mb-4"
      prepend-icon="mdi-arrow-left"
      @click="$router.push({ name: 'gallery' })"
    >
      Back to Gallery
    </v-btn>

    <!-- Loading -->
    <div v-if="!photo" class="text-center py-16">
      <v-progress-circular indeterminate color="primary" size="48" />
    </div>

    <template v-else>
      <v-row>
        <!-- Photo Column -->
        <v-col cols="12" md="6">
          <v-card class="glass-panel" style="overflow: hidden;">
            <v-img
              :src="`/uploads/${photo.filename}`"
              :aspect-ratio="1"
              cover
              class="bg-surface-variant"
            />
          </v-card>

          <!-- Photo Info -->
          <v-card class="glass-panel mt-4 pa-4">
            <div style="font-weight: 600; font-size: 1rem; color: rgba(232, 232, 240, 0.9);">
              {{ photo.originalName }}
            </div>
            <div class="d-flex ga-4 mt-2" style="font-size: 0.8rem; color: rgba(232, 232, 240, 0.4);">
              <span>
                <v-icon size="14" class="mr-1">mdi-clock-outline</v-icon>
                {{ formatDate(photo.uploadedAt) }}
              </span>
              <span>
                <v-icon size="14" class="mr-1">mdi-file-image</v-icon>
                {{ formatSize(photo.size) }}
              </span>
            </div>

            <div class="d-flex ga-2 mt-4">
              <v-btn
                v-if="photo.rankingStatus !== 'processing'"
                variant="tonal"
                color="primary"
                size="small"
                prepend-icon="mdi-refresh"
                @click="retryRanking"
              >
                Re-rank
              </v-btn>
              <v-spacer />
              <v-btn
                variant="tonal"
                color="error"
                size="small"
                prepend-icon="mdi-delete"
                @click="handleDelete"
              >
                Delete
              </v-btn>
            </div>
          </v-card>
        </v-col>

        <!-- Ranking Column -->
        <v-col cols="12" md="6">
          <!-- Processing State -->
          <div v-if="photo.rankingStatus === 'processing'" class="text-center py-16">
            <v-progress-circular indeterminate color="primary" size="64" />
            <div style="color: rgba(232, 232, 240, 0.7); margin-top: 16px; font-weight: 500;">
              AI is analyzing your photo...
            </div>
          </div>

          <!-- Error State -->
          <v-card v-else-if="photo.rankingStatus === 'error'" class="glass-panel pa-6 text-center">
            <v-icon color="error" size="48" class="mb-4">mdi-alert-circle</v-icon>
            <div style="font-weight: 600; color: rgba(255, 82, 82, 0.9);">Ranking Failed</div>
            <div style="font-size: 0.85rem; color: rgba(232, 232, 240, 0.5); margin-top: 8px;">
              {{ photo.rankingError }}
            </div>
            <v-btn color="primary" variant="tonal" class="mt-4" @click="retryRanking">
              Try Again
            </v-btn>
          </v-card>

          <!-- Ranking Results -->
          <template v-else-if="photo.ranking">
            <!-- Overall Score -->
            <v-card class="glass-panel pa-6 mb-4">
              <div class="d-flex align-center ga-6">
                <ScoreBadge :score="photo.ranking.overallScore" :size="96" />
                <div class="flex-grow-1">
                  <div style="font-size: 0.85rem; color: rgba(232, 232, 240, 0.5); font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                    Overall Score
                  </div>
                  <div style="font-size: 1.8rem; font-weight: 800; color: #e8e8f0;">
                    {{ photo.ranking.overallScore.toFixed(1) }}
                    <span style="font-size: 1rem; color: rgba(232, 232, 240, 0.4);"> / 10</span>
                  </div>
                </div>
              </div>
            </v-card>

            <!-- Summary -->
            <v-card class="glass-panel pa-5 mb-4">
              <div class="d-flex align-start ga-3">
                <v-icon color="primary" size="20" class="mt-1">mdi-text-box</v-icon>
                <div>
                  <div style="font-weight: 600; font-size: 0.85rem; color: rgba(232, 232, 240, 0.6); margin-bottom: 6px;">
                    AI Assessment
                  </div>
                  <div style="font-size: 0.95rem; color: rgba(232, 232, 240, 0.85); line-height: 1.6;">
                    {{ photo.ranking.summary }}
                  </div>
                </div>
              </div>
            </v-card>

            <!-- Instagram Tip -->
            <v-card class="mb-4 pa-5" style="background: linear-gradient(135deg, rgba(200, 80, 192, 0.15) 0%, rgba(65, 88, 208, 0.15) 100%) !important; border: 1px solid rgba(200, 80, 192, 0.2); border-radius: 20px;">
              <div class="d-flex align-start ga-3">
                <v-icon color="accent" size="20" class="mt-1">mdi-lightbulb</v-icon>
                <div>
                  <div style="font-weight: 600; font-size: 0.85rem; color: rgba(255, 204, 112, 0.9); margin-bottom: 6px;">
                    Pro Tip
                  </div>
                  <div style="font-size: 0.9rem; color: rgba(232, 232, 240, 0.8); line-height: 1.6;">
                    {{ photo.ranking.instagramTip }}
                  </div>
                </div>
              </div>
            </v-card>

            <!-- Dimension Breakdown -->
            <v-card class="glass-panel pa-5">
              <div style="font-weight: 600; font-size: 0.85rem; color: rgba(232, 232, 240, 0.6); margin-bottom: 16px; text-transform: uppercase; letter-spacing: 1px;">
                Score Breakdown
              </div>

              <div
                v-for="dim in photo.ranking.dimensions"
                :key="dim.name"
                class="mb-5"
              >
                <div class="d-flex align-center justify-space-between mb-1">
                  <span style="font-weight: 600; font-size: 0.9rem; color: rgba(232, 232, 240, 0.85);">
                    {{ dim.name }}
                  </span>
                  <span style="font-weight: 700; font-size: 0.9rem;" :style="{ color: getDimColor(dim.score) }">
                    {{ dim.score }}/10
                  </span>
                </div>

                <div style="height: 8px; background: rgba(232, 232, 240, 0.08); border-radius: 4px; overflow: hidden;">
                  <div
                    class="dimension-bar"
                    :style="{
                      width: (dim.score / 10 * 100) + '%',
                      height: '100%',
                      borderRadius: '4px',
                      background: getDimGradient(dim.score),
                    }"
                  />
                </div>

                <div style="font-size: 0.8rem; color: rgba(232, 232, 240, 0.45); margin-top: 4px; line-height: 1.4;">
                  {{ dim.feedback }}
                </div>
              </div>
            </v-card>

            <!-- Ranked At -->
            <div style="text-align: center; font-size: 0.75rem; color: rgba(232, 232, 240, 0.25); margin-top: 16px;">
              Ranked {{ formatDate(photo.ranking.rankedAt) }}
            </div>
          </template>

          <!-- Pending State -->
          <v-card v-else class="glass-panel pa-6 text-center">
            <v-icon color="primary" size="48" class="mb-4" style="opacity: 0.5;">mdi-robot</v-icon>
            <div style="font-weight: 500; color: rgba(232, 232, 240, 0.6);">Not yet ranked</div>
            <v-btn color="primary" variant="tonal" class="mt-4" prepend-icon="mdi-sparkles" @click="retryRanking">
              Rank Now
            </v-btn>
          </v-card>
        </v-col>
      </v-row>
    </template>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePhotos } from '../composables/usePhotos';
import ScoreBadge from '../components/ScoreBadge.vue';

const route = useRoute();
const router = useRouter();
const { getPhoto, fetchPhotos, rankPhoto, deletePhoto } = usePhotos();

const photo = computed(() => getPhoto(route.params.id as string));

function getDimColor(score: number): string {
  if (score >= 7) return '#4caf50';
  if (score >= 5) return '#fb8c00';
  return '#ff5252';
}

function getDimGradient(score: number): string {
  if (score >= 7) return 'linear-gradient(90deg, #2e7d32, #4caf50)';
  if (score >= 5) return 'linear-gradient(90deg, #e65100, #fb8c00)';
  return 'linear-gradient(90deg, #b71c1c, #ff5252)';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function retryRanking() {
  if (photo.value) {
    await rankPhoto(photo.value.id);
  }
}

async function handleDelete() {
  if (photo.value) {
    await deletePhoto(photo.value.id);
    router.push({ name: 'gallery' });
  }
}

onMounted(() => {
  fetchPhotos();
});
</script>
