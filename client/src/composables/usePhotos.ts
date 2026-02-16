import { ref, computed } from 'vue';
import type { Photo, ComparisonGroup } from '../types';

const photos = ref<Photo[]>([]);
const comparisons = ref<ComparisonGroup[]>([]);
const loading = ref(false);
const uploading = ref(false);
const uploadProgress = ref(0);
const error = ref<string | null>(null);

// Timeline item union type for the gallery
export interface TimelineItem {
    type: 'standard' | 'comparison';
    date: string;
    photo?: Photo;
    comparison?: ComparisonGroup & { photos: Photo[] };
}

export function usePhotos() {
    const sortedPhotos = computed(() => {
        return [...photos.value].sort((a, b) => {
            const scoreA = a.ranking?.overallScore ?? -1;
            const scoreB = b.ranking?.overallScore ?? -1;
            return scoreB - scoreA;
        });
    });

    // Timeline: interleave standard photos and comparison groups chronologically
    const timelineItems = computed<TimelineItem[]>(() => {
        const items: TimelineItem[] = [];

        // Add standard photos (those NOT in a comparison group)
        photos.value
            .filter((p) => !p.comparisonGroupId)
            .forEach((p) => {
                items.push({ type: 'standard', date: p.uploadedAt, photo: p });
            });

        // Add comparison groups with their photos attached
        comparisons.value.forEach((group) => {
            const groupPhotos = group.photoIds
                .map((id) => photos.value.find((p) => p.id === id))
                .filter(Boolean) as Photo[];
            items.push({
                type: 'comparison',
                date: group.createdAt,
                comparison: { ...group, photos: groupPhotos },
            });
        });

        // Sort newest first
        items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return items;
    });

    const rankedCount = computed(() =>
        photos.value.filter((p) => p.rankingStatus === 'completed' && !p.comparisonGroupId).length
    );

    const totalCount = computed(() =>
        photos.value.filter((p) => !p.comparisonGroupId).length
    );

    const comparisonCount = computed(() => comparisons.value.length);

    async function fetchPhotos() {
        loading.value = true;
        error.value = null;
        try {
            const res = await fetch('/api/photos');
            if (!res.ok) throw new Error('Failed to fetch photos');
            photos.value = await res.json();
        } catch (err: any) {
            error.value = err.message;
        } finally {
            loading.value = false;
        }
    }

    async function fetchComparisons() {
        try {
            const res = await fetch('/api/photos/comparisons/list');
            if (!res.ok) throw new Error('Failed to fetch comparisons');
            const data = await res.json();
            comparisons.value = data;
        } catch (err: any) {
            error.value = err.message;
        }
    }

    async function fetchAll() {
        await Promise.all([fetchPhotos(), fetchComparisons()]);
    }

    async function uploadPhotos(files: File[]) {
        uploading.value = true;
        uploadProgress.value = 0;
        error.value = null;

        try {
            const formData = new FormData();
            files.forEach((file) => formData.append('photos', file));

            const res = await fetch('/api/photos/upload', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) throw new Error('Upload failed');

            const uploaded: Photo[] = await res.json();
            photos.value.push(...uploaded);
            uploadProgress.value = 50;

            // Trigger ranking for each uploaded photo
            for (let i = 0; i < uploaded.length; i++) {
                const photo = uploaded[i];
                await rankPhoto(photo.id);
                uploadProgress.value = 50 + ((i + 1) / uploaded.length) * 50;
            }
        } catch (err: any) {
            error.value = err.message;
        } finally {
            uploading.value = false;
            uploadProgress.value = 100;
        }
    }

    async function uploadAndCompare(files: File[]) {
        uploading.value = true;
        uploadProgress.value = 0;
        error.value = null;

        try {
            const formData = new FormData();
            files.forEach((file) => formData.append('photos', file));

            uploadProgress.value = 20;

            const res = await fetch('/api/photos/compare', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Comparison upload failed');
            }

            const data = await res.json();
            const uploadedPhotos: Photo[] = data.photos;
            const group: ComparisonGroup = data.comparison;

            // Add photos and comparison to local state
            photos.value.push(...uploadedPhotos);
            comparisons.value.push(group);
            uploadProgress.value = 50;

            // Poll for comparison completion
            await pollComparison(group.id);
            uploadProgress.value = 100;
        } catch (err: any) {
            error.value = err.message;
        } finally {
            uploading.value = false;
        }
    }

    async function pollComparison(groupId: string, maxAttempts = 60) {
        for (let i = 0; i < maxAttempts; i++) {
            await new Promise((r) => setTimeout(r, 2000));

            try {
                const res = await fetch(`/api/photos/comparisons/${groupId}`);
                if (!res.ok) continue;
                const data = await res.json();

                // Update local state
                const idx = comparisons.value.findIndex((c) => c.id === groupId);
                if (idx !== -1) {
                    comparisons.value[idx] = data;
                }

                if (data.comparisonStatus === 'completed' || data.comparisonStatus === 'error') {
                    return;
                }

                uploadProgress.value = 50 + ((i + 1) / maxAttempts) * 50;
            } catch {
                // ignore polling errors, keep trying
            }
        }
    }

    async function rankPhoto(id: string) {
        const photo = photos.value.find((p) => p.id === id);
        if (photo) {
            photo.rankingStatus = 'processing';
        }

        try {
            const res = await fetch(`/api/photos/${id}/rank`, { method: 'POST' });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Ranking failed');
            }
            const updated: Photo = await res.json();

            const index = photos.value.findIndex((p) => p.id === id);
            if (index !== -1) {
                photos.value[index] = updated;
            }
        } catch (err: any) {
            if (photo) {
                photo.rankingStatus = 'error';
                photo.rankingError = err.message;
            }
        }
    }

    async function deletePhoto(id: string) {
        try {
            const res = await fetch(`/api/photos/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');
            photos.value = photos.value.filter((p) => p.id !== id);
        } catch (err: any) {
            error.value = err.message;
        }
    }

    function getPhoto(id: string): Photo | undefined {
        return photos.value.find((p) => p.id === id);
    }

    return {
        photos,
        comparisons,
        sortedPhotos,
        timelineItems,
        rankedCount,
        totalCount,
        comparisonCount,
        loading,
        uploading,
        uploadProgress,
        error,
        fetchPhotos,
        fetchComparisons,
        fetchAll,
        uploadPhotos,
        uploadAndCompare,
        rankPhoto,
        deletePhoto,
        getPhoto,
    };
}

