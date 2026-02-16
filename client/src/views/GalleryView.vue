<template>
  <v-container fluid class="pa-4 pa-md-6" style="max-width: 1200px;">
    <!-- Header Section -->
    <div class="d-flex align-center mb-6 flex-wrap ga-4">
      <div class="flex-grow-1">
        <h1 class="insta-gradient-text" style="font-size: 2.2rem; font-weight: 800; letter-spacing: -1px;">
          Photo Gallery
        </h1>
        <p style="color: rgba(232, 232, 240, 0.5); font-size: 0.95rem; margin-top: 4px;">
          Upload your photos and let AI rank their Instagram potential
        </p>
      </div>

      <PhotoUpload />
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-16">
      <v-progress-circular indeterminate color="primary" size="48" />
      <div style="color: rgba(232, 232, 240, 0.5); margin-top: 16px;">Loading photos...</div>
    </div>

    <!-- Empty State -->
    <div v-else-if="timelineItems.length === 0" class="text-center py-16">
      <div style="width: 120px; height: 120px; margin: 0 auto 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center;"
           class="insta-gradient">
        <v-icon size="56" color="white">mdi-camera-plus</v-icon>
      </div>
      <h2 style="font-weight: 700; font-size: 1.5rem; color: rgba(232, 232, 240, 0.8); margin-bottom: 8px;">
        No photos yet
      </h2>
      <p style="color: rgba(232, 232, 240, 0.4); max-width: 400px; margin: 0 auto 24px;">
        Upload your photos to get AI-powered Instagram eligibility rankings with detailed feedback
      </p>
      <PhotoUpload />
    </div>

    <!-- Timeline View -->
    <div v-else class="ranked-list">
      <template v-for="item in timelineItems" :key="item.type === 'standard' ? item.photo?.id : item.comparison?.id">

        <!-- ========== STANDARD PHOTO ROW ========== -->
        <div
          v-if="item.type === 'standard' && item.photo"
          class="ranked-row"
        >
          <div class="ranked-row-header" :class="{ 'expandable': item.photo.ranking }" @click="item.photo.ranking && toggleExpand(item.photo.id)">
            <div class="ranked-row-top">
              <!-- Score Badge -->
              <div class="rank-number" :class="getScoreClass(item.photo.ranking?.overallScore)">
                <span v-if="item.photo.ranking">{{ item.photo.ranking.overallScore.toFixed(0) }}</span>
                <span v-else>—</span>
              </div>

              <!-- Photo Thumbnail -->
              <div class="rank-thumbnail" @click.stop="openPreview(item.photo)">
                <v-img
                  :src="`/uploads/${item.photo.filename}`"
                  :aspect-ratio="1"
                  cover
                  class="bg-surface-variant"
                  style="border-radius: 12px; cursor: pointer;"
                >
                  <template v-slot:placeholder>
                    <div class="d-flex align-center justify-center fill-height">
                      <v-progress-circular indeterminate color="primary" size="20" />
                    </div>
                  </template>
                </v-img>

                <div v-if="item.photo.rankingStatus === 'processing'" class="thumbnail-overlay">
                  <v-progress-circular indeterminate color="primary" size="24" width="2" />
                </div>
                <div v-if="item.photo.rankingStatus === 'error'" class="thumbnail-overlay">
                  <v-icon color="error" size="24">mdi-alert-circle</v-icon>
                </div>
              </div>

              <!-- Photo Info + Score -->
              <div class="rank-info">
                <div class="rank-filename">{{ item.photo.originalName }}</div>

                <div v-if="item.photo.rankingStatus === 'processing'" class="rank-status-text processing">
                  <v-progress-circular indeterminate size="12" width="2" color="primary" class="mr-2" />
                  AI is analyzing...
                </div>
                <div v-else-if="item.photo.rankingStatus === 'error'" class="rank-status-text error-text">
                  {{ item.photo.rankingError || 'Ranking failed' }}
                </div>
                <div v-else-if="item.photo.rankingStatus === 'pending'" class="rank-status-text">
                  Waiting to be analyzed...
                </div>
                <div v-else-if="item.photo.ranking" class="rank-score-row">
                  <ScoreBadge :score="item.photo.ranking.overallScore" :size="44" :showLabel="false" />
                  <span class="rank-score-label">
                    {{ item.photo.ranking.overallScore.toFixed(1) }}
                    <span class="rank-score-max">/ 10</span>
                  </span>
                </div>
              </div>

              <v-icon
                v-if="item.photo.ranking"
                class="expand-chevron"
                :class="{ 'expanded': expandedPhotos.has(item.photo.id) }"
                size="22"
              >
                mdi-chevron-down
              </v-icon>
            </div>

            <!-- Actions row -->
            <div class="ranked-row-bottom">
              <div class="rank-actions">
                <v-btn
                  icon size="small" variant="tonal" color="primary"
                  @click.stop="downloadPhoto(item.photo.id)"
                  title="Download"
                >
                  <v-icon size="18">mdi-download</v-icon>
                </v-btn>
                <v-btn
                  v-if="item.photo.rankingStatus === 'error' || item.photo.rankingStatus === 'pending'"
                  icon size="small" variant="tonal" color="primary"
                  @click.stop="retryRanking(item.photo.id)"
                >
                  <v-icon size="18">mdi-refresh</v-icon>
                </v-btn>
                <v-btn
                  v-if="item.photo.ranking"
                  icon size="small" variant="tonal" color="primary"
                  @click.stop="retryRanking(item.photo.id)"
                >
                  <v-icon size="18">mdi-refresh</v-icon>
                </v-btn>
                <v-btn
                  icon size="small" variant="tonal" color="error"
                  @click.stop="handleDelete(item.photo.id)"
                >
                  <v-icon size="18">mdi-delete</v-icon>
                </v-btn>
              </div>
            </div>
          </div>

          <!-- Collapsible AI Analysis Panel -->
          <div
            v-if="item.photo.ranking"
            class="analysis-collapse-wrapper"
            :class="{ 'is-expanded': expandedPhotos.has(item.photo.id) }"
          >
            <div class="ranked-row-analysis">
              <div class="analysis-section">
                <div class="analysis-section-header">
                  <v-icon color="primary" size="16">mdi-robot</v-icon>
                  <span>AI Assessment</span>
                </div>
                <div class="analysis-text">{{ item.photo.ranking.summary }}</div>
              </div>
              <div class="analysis-section tip-section">
                <div class="analysis-section-header tip-header">
                  <v-icon size="16" style="color: #ffcc70;">mdi-lightbulb</v-icon>
                  <span>Pro Tip</span>
                </div>
                <div class="analysis-text tip-text">{{ item.photo.ranking.instagramTip }}</div>
              </div>
              <div class="analysis-breakdown">
                <div class="analysis-section-header" style="margin-bottom: 12px;">
                  <v-icon color="primary" size="16">mdi-chart-bar</v-icon>
                  <span>Score Breakdown</span>
                </div>
                <div class="breakdown-grid">
                  <div v-for="dim in item.photo.ranking.dimensions" :key="dim.name" class="breakdown-item">
                    <div class="breakdown-label-row">
                      <span class="breakdown-name">{{ dim.name }}</span>
                      <span class="breakdown-score" :style="{ color: getDimColor(dim.score) }">{{ dim.score }}/10</span>
                    </div>
                    <div class="breakdown-bar-track">
                      <div
                        class="breakdown-bar-fill dimension-bar"
                        :style="{ width: (dim.score / 10 * 100) + '%', background: getDimGradient(dim.score) }"
                      />
                    </div>
                    <div class="breakdown-feedback">{{ dim.feedback }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ========== COMPARISON GROUP CARD ========== -->
        <div
          v-if="item.type === 'comparison' && item.comparison"
          class="comparison-card"
        >
          <!-- Card Header -->
          <div class="comparison-card-header" :class="{ 'expandable': item.comparison.comparisonStatus === 'completed' }" @click="item.comparison.comparisonStatus === 'completed' && toggleExpand(item.comparison.id)">
            <div class="comparison-header-top">
              <div class="comparison-badge">
                <v-icon size="16" class="mr-1">mdi-compare</v-icon>
                Comparison
              </div>

              <!-- Status -->
              <div class="comparison-status-area">
                <div v-if="item.comparison.comparisonStatus === 'processing'" class="rank-status-text processing">
                  <v-progress-circular indeterminate size="14" width="2" color="primary" class="mr-2" />
                  Comparing...
                </div>
                <div v-else-if="item.comparison.comparisonStatus === 'error'" class="rank-status-text error-text">
                  {{ item.comparison.comparisonError || 'Comparison failed' }}
                </div>
                <div v-else-if="item.comparison.comparisonStatus === 'completed' && item.comparison.comparison" class="comparison-winner-text">
                  <v-icon size="16" color="amber" class="mr-1">mdi-trophy</v-icon>
                  Winner selected
                </div>
              </div>

              <v-icon
                v-if="item.comparison.comparisonStatus === 'completed'"
                class="expand-chevron"
                :class="{ 'expanded': expandedPhotos.has(item.comparison.id) }"
                size="22"
              >
                mdi-chevron-down
              </v-icon>
            </div>

            <div class="comparison-thumbnails">
              <div
                v-for="(photo, pIdx) in getComparisonPhotosRanked(item.comparison)"
                :key="photo.id"
                class="comparison-thumb-wrapper"
                @click.stop="openPreview(photo)"
                style="cursor: pointer;"
              >
                <v-img
                  :src="`/uploads/${photo.filename}`"
                  :aspect-ratio="1"
                  cover
                  class="comparison-thumb-img"
                />
                <!-- Winner badge -->
                <div
                  v-if="pIdx === 0 && item.comparison.comparisonStatus === 'completed'"
                  class="winner-badge"
                >
                  🏆
                </div>
                <!-- Rank + Score overlay -->
                <div v-if="getPhotoComparisonResult(item.comparison, photo.id)" class="comparison-thumb-score">
                  <span class="comparison-rank-label">#{{ getPhotoComparisonResult(item.comparison, photo.id)?.rank }}</span>
                  <span class="comparison-score-value">{{ getPhotoComparisonResult(item.comparison, photo.id)?.score }}/10</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Expandable Comparison Analysis -->
          <div
            v-if="item.comparison.comparison"
            class="analysis-collapse-wrapper"
            :class="{ 'is-expanded': expandedPhotos.has(item.comparison.id) }"
          >
            <div class="ranked-row-analysis">
              <!-- Overall Feedback -->
              <div class="analysis-section">
                <div class="analysis-section-header">
                  <v-icon color="primary" size="16">mdi-robot</v-icon>
                  <span>Head-to-Head Verdict</span>
                </div>
                <div class="analysis-text">{{ item.comparison.comparison.overallFeedback }}</div>
              </div>

              <!-- Winner Summary -->
              <div class="analysis-section tip-section">
                <div class="analysis-section-header tip-header">
                  <v-icon size="16" style="color: #ffcc70;">mdi-trophy</v-icon>
                  <span>Why the Winner Won</span>
                </div>
                <div class="analysis-text tip-text">{{ item.comparison.comparison.winnerSummary }}</div>
              </div>

              <!-- Per-Photo Breakdown -->
              <div class="analysis-breakdown">
                <div class="analysis-section-header" style="margin-bottom: 12px;">
                  <v-icon color="primary" size="16">mdi-chart-bar</v-icon>
                  <span>Photo-by-Photo Breakdown</span>
                </div>
                <div class="comparison-photo-breakdown">
                  <div
                    v-for="result in item.comparison.comparison.rankings"
                    :key="result.photoId"
                    class="comparison-breakdown-item"
                  >
                    <div class="comparison-breakdown-header">
                      <div class="comparison-breakdown-thumb">
                        <v-img
                          :src="`/uploads/${getPhotoById(result.photoId)?.filename}`"
                          :aspect-ratio="1"
                          cover
                          style="border-radius: 8px;"
                        />
                    </div>
                    <div class="comparison-breakdown-info">
                        <div class="d-flex align-center ga-2">
                          <span class="comparison-breakdown-rank" :class="result.rank === 1 ? 'rank-gold' : ''">
                            #{{ result.rank }}
                          </span>
                          <span class="comparison-breakdown-name">
                            {{ getPhotoById(result.photoId)?.originalName || 'Photo' }}
                          </span>
                        </div>
                        <div class="d-flex align-center ga-2 mt-1">
                          <div class="comparison-breakdown-score-row">
                            <ScoreBadge :score="result.score" :size="32" :showLabel="false" />
                            <span style="font-weight: 700; color: #e8e8f0;">{{ result.score }}/10</span>
                          </div>
                          <v-btn
                            icon size="x-small" variant="tonal" color="primary"
                            @click.stop="downloadPhoto(result.photoId)"
                            title="Download"
                          >
                            <v-icon size="16">mdi-download</v-icon>
                          </v-btn>
                        </div>
                      </div>
                    </div>
                    <div class="comparison-strengths">
                      <strong style="color: rgba(76, 175, 80, 0.9);">Strengths:</strong> {{ result.strengths }}
                    </div>
                    <div class="comparison-weaknesses">
                      <strong style="color: rgba(255, 152, 0, 0.9);">Weaknesses:</strong> {{ result.weaknesses }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </template>
    </div>

    <!-- ========== FULL-SIZE IMAGE PREVIEW ========== -->
    <v-dialog v-model="previewOpen" max-width="95vw" content-class="preview-dialog">
      <div class="preview-backdrop" @click="previewOpen = false">
        <div class="preview-header">
          <span class="preview-filename">{{ previewPhoto?.originalName }}</span>
          <div class="preview-actions">
            <v-btn icon variant="tonal" color="primary" size="small" @click.stop="previewPhoto && downloadPhoto(previewPhoto.id)" title="Download">
              <v-icon size="20">mdi-download</v-icon>
            </v-btn>
            <v-btn icon variant="tonal" size="small" @click.stop="previewOpen = false" title="Close">
              <v-icon size="20">mdi-close</v-icon>
            </v-btn>
          </div>
        </div>
        <div class="preview-image-wrapper" @click.stop>
          <img
            v-if="previewPhoto"
            :src="`/uploads/${previewPhoto.filename}`"
            :alt="previewPhoto.originalName"
            class="preview-image"
          />
        </div>
      </div>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import { usePhotos } from '../composables/usePhotos';
import type { TimelineItem } from '../composables/usePhotos';
import type { ComparisonGroup, ComparisonPhotoResult, Photo } from '../types';
import PhotoUpload from '../components/PhotoUpload.vue';
import ScoreBadge from '../components/ScoreBadge.vue';

const { timelineItems, loading, fetchAll, rankPhoto, deletePhoto, getPhoto } = usePhotos();
const expandedPhotos = reactive(new Set<string>());
const previewOpen = ref(false);
const previewPhoto = ref<Photo | null>(null);

function openPreview(photo: Photo) {
  previewPhoto.value = photo;
  previewOpen.value = true;
}

function toggleExpand(id: string) {
  if (expandedPhotos.has(id)) {
    expandedPhotos.delete(id);
  } else {
    expandedPhotos.add(id);
  }
}

function getScoreClass(score?: number): string {
  if (!score) return '';
  if (score >= 8) return 'rank-gold';
  if (score >= 6) return 'rank-silver';
  if (score >= 4) return 'rank-bronze';
  return '';
}

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

function getPhotoById(id: string): Photo | undefined {
  return getPhoto(id);
}

function getComparisonPhotosRanked(group: ComparisonGroup & { photos: Photo[] }): Photo[] {
  if (!group.comparison) return group.photos;
  // Order photos by their comparison rank
  const rankMap = new Map(group.comparison.rankings.map((r) => [r.photoId, r.rank]));
  return [...group.photos].sort((a, b) => (rankMap.get(a.id) ?? 99) - (rankMap.get(b.id) ?? 99));
}

function getPhotoComparisonResult(
  group: ComparisonGroup & { photos: Photo[] },
  photoId: string
): ComparisonPhotoResult | undefined {
  return group.comparison?.rankings.find((r) => r.photoId === photoId);
}

async function retryRanking(id: string) {
  await rankPhoto(id);
}

async function handleDelete(id: string) {
  await deletePhoto(id);
}

function downloadPhoto(id: string) {
  const link = document.createElement('a');
  link.href = `/api/photos/${id}/download`;
  link.click();
}

onMounted(() => {
  fetchAll();
});
</script>
