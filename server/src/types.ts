export interface DimensionScore {
    name: string;
    score: number;
    maxScore: number;
    weight: number;
    feedback: string;
}

export interface RankingResult {
    overallScore: number;
    dimensions: DimensionScore[];
    summary: string;
    instagramTip: string;
    rankedAt: string;
}

export interface Photo {
    id: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    uploadedAt: string;
    ranking: RankingResult | null;
    rankingStatus: 'pending' | 'processing' | 'completed' | 'error';
    rankingError?: string;
    comparisonGroupId?: string;
}

// --- Comparison Mode Types ---

export interface ComparisonPhotoResult {
    photoId: string;
    rank: number;
    score: number;
    strengths: string;
    weaknesses: string;
}

export interface ComparisonResult {
    rankings: ComparisonPhotoResult[];
    overallFeedback: string;
    winnerSummary: string;
    rankedAt: string;
}

export interface ComparisonGroup {
    id: string;
    photoIds: string[];
    createdAt: string;
    comparison: ComparisonResult | null;
    comparisonStatus: 'pending' | 'processing' | 'completed' | 'error';
    comparisonError?: string;
}
