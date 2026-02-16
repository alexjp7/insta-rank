<template>
  <div
    class="score-badge"
    :style="{
      width: size + 'px',
      height: size + 'px',
      background: getBgGradient(),
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      boxShadow: `0 0 ${size / 3}px ${getGlowColor()}40`,
    }"
  >
    <!-- Outer ring -->
    <svg :width="size" :height="size" style="position: absolute; top: 0; left: 0;">
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="size / 2 - 3"
        fill="none"
        :stroke="getGlowColor()"
        stroke-width="2"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="circumference * (1 - score / 10)"
        stroke-linecap="round"
        style="transform: rotate(-90deg); transform-origin: center; transition: stroke-dashoffset 1s ease;"
      />
    </svg>

    <!-- Score text -->
    <div style="text-align: center; z-index: 1;">
      <div
        :style="{
          fontSize: size * 0.35 + 'px',
          fontWeight: 800,
          lineHeight: 1,
          color: '#fff',
        }"
      >
        {{ score.toFixed(1) }}
      </div>
      <div
        v-if="showLabel"
        :style="{
          fontSize: size * 0.12 + 'px',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.7)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginTop: '2px',
        }"
      >
        {{ getLabel() }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  score: number;
  size?: number;
  showLabel?: boolean;
}>(), {
  size: 72,
  showLabel: true,
});

const circumference = computed(() => Math.PI * 2 * (props.size / 2 - 3));

function getGlowColor(): string {
  if (props.score >= 7) return '#4caf50';
  if (props.score >= 5) return '#fb8c00';
  return '#ff5252';
}

function getBgGradient(): string {
  if (props.score >= 7) return 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%)';
  if (props.score >= 5) return 'linear-gradient(135deg, #e65100 0%, #f57c00 100%)';
  return 'linear-gradient(135deg, #b71c1c 0%, #d32f2f 100%)';
}

function getLabel(): string {
  if (props.score >= 8.5) return 'Excellent';
  if (props.score >= 7) return 'Great';
  if (props.score >= 5.5) return 'Good';
  if (props.score >= 4) return 'Fair';
  return 'Poor';
}
</script>
