<template>
  <v-dialog v-model="dialogOpen" max-width="600" persistent>
    <template v-slot:activator="{ props: activatorProps }">
      <v-btn
        v-bind="activatorProps"
        color="primary"
        size="large"
        class="px-6"
        prepend-icon="mdi-cloud-upload"
      >
        Upload Photos
      </v-btn>
    </template>

    <v-card class="glass-panel" style="border: 1px solid rgba(200, 80, 192, 0.2);">
      <v-card-title class="d-flex align-center pa-6 pb-2">
        <v-icon color="primary" class="mr-3">mdi-cloud-upload</v-icon>
        <span class="insta-gradient-text" style="font-weight: 700; font-size: 1.3rem;">
          Upload Photos
        </span>
        <v-spacer />
        <v-btn icon variant="text" @click="dialogOpen = false" :disabled="uploading">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-card-text class="pa-6">
        <!-- Mode Toggle -->
        <div class="mode-toggle-wrapper mb-5">
          <v-btn-toggle
            v-model="uploadMode"
            mandatory
            divided
            density="comfortable"
            class="mode-toggle"
          >
            <v-btn value="standard" :disabled="uploading">
              <v-icon start size="18">mdi-image</v-icon>
              Standard
            </v-btn>
            <v-btn value="comparison" :disabled="uploading">
              <v-icon start size="18">mdi-compare</v-icon>
              Comparison
            </v-btn>
          </v-btn-toggle>
          <div class="mode-description">
            <template v-if="uploadMode === 'standard'">
              Upload photos individually — each gets its own AI analysis and score
            </template>
            <template v-else>
              Upload 2-4 photos to compare head-to-head — AI ranks them against each other
            </template>
          </div>
        </div>

        <!-- Drop Zone -->
        <div
          v-if="!uploading && selectedFiles.length === 0"
          class="upload-zone pa-12 text-center"
          :class="{ 'drag-over': isDragOver }"
          @dragenter.prevent="isDragOver = true"
          @dragleave.prevent="isDragOver = false"
          @dragover.prevent
          @drop.prevent="handleDrop"
          @click="fileInput?.click()"
          style="cursor: pointer;"
        >
          <v-icon size="64" color="primary" class="mb-4" style="opacity: 0.6;">
            mdi-image-plus
          </v-icon>
          <div style="font-size: 1.1rem; font-weight: 600; color: rgba(232, 232, 240, 0.8);">
            Drop photos here or click to browse
          </div>
          <div style="font-size: 0.85rem; color: rgba(232, 232, 240, 0.4); margin-top: 8px;">
            <template v-if="uploadMode === 'comparison'">
              Select 2-4 photos to compare — JPEG, PNG, GIF, WebP
            </template>
            <template v-else>
              Supports JPEG, PNG, GIF, WebP — Max 20MB each
            </template>
          </div>

          <input
            ref="fileInput"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            style="display: none;"
            @change="handleFileSelect"
          />
        </div>

        <!-- Selected Files Preview -->
        <div v-if="selectedFiles.length > 0 && !uploading">
          <div class="d-flex flex-wrap ga-3 mb-4">
            <div
              v-for="(file, i) in selectedFiles"
              :key="i"
              style="position: relative; width: 100px; height: 100px; border-radius: 12px; overflow: hidden; border: 1px solid rgba(200, 80, 192, 0.2);"
            >
              <img :src="getPreviewUrl(file)" style="width: 100%; height: 100%; object-fit: cover;" />
              <v-btn
                icon
                size="x-small"
                variant="flat"
                color="error"
                style="position: absolute; top: 4px; right: 4px;"
                @click="removeFile(i)"
              >
                <v-icon size="14">mdi-close</v-icon>
              </v-btn>
            </div>

            <div
              v-if="!isAtMaxFiles"
              style="width: 100px; height: 100px; border-radius: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer;"
              class="upload-zone"
              @click="fileInput?.click()"
            >
              <v-icon color="primary">mdi-plus</v-icon>
              <input
                ref="fileInput"
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                style="display: none;"
                @change="handleFileSelect"
              />
            </div>
          </div>

          <div class="d-flex align-center" style="font-size: 0.85rem; color: rgba(232, 232, 240, 0.5);">
            <span>
              {{ selectedFiles.length }} photo{{ selectedFiles.length > 1 ? 's' : '' }} selected
            </span>
            <template v-if="uploadMode === 'comparison'">
              <span class="ml-2" :style="{ color: isValidComparisonCount ? 'rgba(76, 175, 80, 0.8)' : 'rgba(255, 82, 82, 0.8)' }">
                ({{ isValidComparisonCount ? '✓' : '✗' }} 2-4 required)
              </span>
            </template>
          </div>
        </div>

        <!-- Upload Progress -->
        <div v-if="uploading" class="text-center py-6">
          <v-progress-circular
            :model-value="uploadProgress"
            :size="80"
            :width="6"
            color="primary"
          >
            <span style="font-weight: 700; font-size: 1rem;">
              {{ Math.round(uploadProgress) }}%
            </span>
          </v-progress-circular>

          <div style="font-size: 0.95rem; font-weight: 500; margin-top: 16px; color: rgba(232, 232, 240, 0.8);">
            <template v-if="uploadMode === 'comparison'">
              {{ uploadProgress < 30 ? 'Uploading photos...' : 'AI is comparing your photos...' }}
            </template>
            <template v-else>
              {{ uploadProgress < 50 ? 'Uploading photos...' : 'Analyzing with AI...' }}
            </template>
          </div>
          <div style="font-size: 0.8rem; color: rgba(232, 232, 240, 0.4); margin-top: 4px;">
            <template v-if="uploadMode === 'comparison'">
              The AI is evaluating all photos side-by-side
            </template>
            <template v-else>
              This may take a moment — the AI is evaluating each photo
            </template>
          </div>
        </div>
      </v-card-text>

      <v-card-actions class="pa-6 pt-2" v-if="selectedFiles.length > 0 && !uploading">
        <v-btn variant="text" @click="selectedFiles = []">Clear All</v-btn>
        <v-spacer />
        <v-btn
          v-if="uploadMode === 'standard'"
          color="primary"
          size="large"
          @click="handleUpload"
          prepend-icon="mdi-sparkles"
        >
          Upload &amp; Rank
        </v-btn>
        <v-btn
          v-else
          color="primary"
          size="large"
          @click="handleUpload"
          prepend-icon="mdi-compare"
          :disabled="!isValidComparisonCount"
        >
          Upload &amp; Compare
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { usePhotos } from '../composables/usePhotos';

const { uploadPhotos, uploadAndCompare, uploading, uploadProgress } = usePhotos();

const dialogOpen = ref(false);
const selectedFiles = ref<File[]>([]);
const isDragOver = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const uploadMode = ref<'standard' | 'comparison'>('standard');

const maxComparisonPhotos = 4;

const isValidComparisonCount = computed(() =>
  selectedFiles.value.length >= 2 && selectedFiles.value.length <= maxComparisonPhotos
);

const isAtMaxFiles = computed(() =>
  uploadMode.value === 'comparison' && selectedFiles.value.length >= maxComparisonPhotos
);

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files) {
    const newFiles = Array.from(input.files);
    addFiles(newFiles);
  }
}

function handleDrop(event: DragEvent) {
  isDragOver.value = false;
  if (event.dataTransfer?.files) {
    const newFiles = Array.from(event.dataTransfer.files).filter((f) =>
      f.type.startsWith('image/')
    );
    addFiles(newFiles);
  }
}

function addFiles(newFiles: File[]) {
  if (uploadMode.value === 'comparison') {
    // In comparison mode, cap at max
    const remaining = maxComparisonPhotos - selectedFiles.value.length;
    selectedFiles.value.push(...newFiles.slice(0, remaining));
  } else {
    selectedFiles.value.push(...newFiles);
  }
}

function removeFile(index: number) {
  selectedFiles.value.splice(index, 1);
}

function getPreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}

async function handleUpload() {
  if (selectedFiles.value.length === 0) return;

  if (uploadMode.value === 'comparison') {
    await uploadAndCompare(selectedFiles.value);
  } else {
    await uploadPhotos(selectedFiles.value);
  }
  selectedFiles.value = [];
  dialogOpen.value = false;
}
</script>
