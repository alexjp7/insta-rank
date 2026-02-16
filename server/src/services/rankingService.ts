import fs from 'fs';
import sharp from 'sharp';
import Anthropic from '@anthropic-ai/sdk';
import { RankingResult, DimensionScore, ComparisonResult, ComparisonPhotoResult } from '../types.js';

const CLAUDE_API_KEY = process.env.claude_key || '';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

if (!CLAUDE_API_KEY) {
    console.warn('⚠️  claude_key not set in .env — ranking will fail');
}

const anthropic = new Anthropic({ apiKey: CLAUDE_API_KEY });

function getMimeType(imagePath: string): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
    const ext = imagePath.toLowerCase().split('.').pop();
    if (ext === 'png') return 'image/png';
    if (ext === 'gif') return 'image/gif';
    if (ext === 'webp') return 'image/webp';
    return 'image/jpeg';
}

const MAX_RETRIES = 2;
const MAX_LLM_BYTES = 4 * 1024 * 1024; // 4MB — safe buffer under Claude's 5MB limit

/**
 * Resize an image so its base64 representation stays under the Claude API limit.
 * Progressively reduces max dimension and re-encodes as JPEG until small enough.
 */
async function resizeImageForLLM(
    imagePath: string
): Promise<{ buffer: Buffer; mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' }> {
    const originalBuffer = fs.readFileSync(imagePath);
    const originalMediaType = getMimeType(imagePath);

    if (originalBuffer.length <= MAX_LLM_BYTES) {
        return { buffer: originalBuffer, mediaType: originalMediaType };
    }

    console.log(`[Resize] Image ${imagePath} is ${(originalBuffer.length / 1024 / 1024).toFixed(1)}MB — resizing...`);

    const steps = [2048, 1536, 1024, 768];
    for (const maxDim of steps) {
        const resized = await sharp(originalBuffer)
            .resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer();

        console.log(`[Resize]   → ${maxDim}px max → ${(resized.length / 1024 / 1024).toFixed(1)}MB`);

        if (resized.length <= MAX_LLM_BYTES) {
            return { buffer: resized, mediaType: 'image/jpeg' };
        }
    }

    // Last resort: aggressive resize
    const finalBuffer = await sharp(originalBuffer)
        .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 70 })
        .toBuffer();
    console.log(`[Resize]   → 512px fallback → ${(finalBuffer.length / 1024 / 1024).toFixed(1)}MB`);
    return { buffer: finalBuffer, mediaType: 'image/jpeg' };
}

export async function rankPhoto(imagePath: string): Promise<RankingResult> {
    const { buffer, mediaType } = await resizeImageForLLM(imagePath);
    const base64Image = buffer.toString('base64');

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`[Rank] Attempt ${attempt}/${MAX_RETRIES} — analyzing photo with Claude (${CLAUDE_MODEL})...`);

            const response = await anthropic.messages.create({
                model: CLAUDE_MODEL,
                max_tokens: 2048,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: mediaType,
                                    data: base64Image,
                                },
                            },
                            {
                                type: 'text',
                                text: `You're my best friend who happens to be obsessed with Instagram and photography. I'm showing you this photo and I want your REAL opinion — no sugarcoating, but keep it friendly and fun. Talk to me like we're hanging out and I just showed you this on my phone.

Score each dimension from 1 to 10 (1=yikes delete that, 5=it's fine I guess, 8=oh that's fire, 10=absolute banger).
Be honest with me like a real friend would — if it's mid, tell me it's mid. If it slaps, hype me up! But don't just be nice to spare my feelings.

Your feedback should sound natural and conversational — use casual language, contractions, maybe throw in some enthusiasm when something's genuinely good. Be specific about what you see in THIS photo.

Respond ONLY with valid JSON in this exact format, no markdown or extra text:
{
  "composition_score": <int 1-10>,
  "composition_feedback": "<casual, specific feedback about composition — talk about framing, balance, what draws the eye>",
  "lighting_score": <int 1-10>,
  "lighting_feedback": "<casual, specific feedback about the lighting — is it moody? harsh? golden hour magic?>",
  "color_mood_score": <int 1-10>,
  "color_mood_feedback": "<casual, specific feedback about colors and vibe — does it have a mood or is it flat?>",
  "subject_focus_score": <int 1-10>,
  "subject_focus_feedback": "<casual, specific feedback about what's in focus and whether the subject pops>",
  "visual_impact_score": <int 1-10>,
  "visual_impact_feedback": "<casual, specific feedback about that first-glance wow factor — would you stop scrolling?>",
  "instagram_fit_score": <int 1-10>,
  "instagram_fit_feedback": "<casual, specific feedback about how this would perform on the gram>",
  "summary": "<2-3 sentences like you're texting your friend about this photo — be real but supportive>",
  "instagram_tip": "<one specific tip you'd actually tell your friend to do, not generic advice>"
}`,
                            },
                        ],
                    },
                ],
            });

            // Extract text from response
            const textBlock = response.content.find((block) => block.type === 'text');
            if (!textBlock || textBlock.type !== 'text') {
                throw new Error('No text response from Claude');
            }

            const content = textBlock.text.trim();
            // Strip markdown code fences if present
            const jsonStr = content.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
            const parsed = JSON.parse(jsonStr);

            // Map flat schema to dimension array
            const dimensionDefs = [
                { name: 'Composition', weight: 0.20, scoreKey: 'composition_score', feedbackKey: 'composition_feedback' },
                { name: 'Lighting', weight: 0.20, scoreKey: 'lighting_score', feedbackKey: 'lighting_feedback' },
                { name: 'Color & Mood', weight: 0.15, scoreKey: 'color_mood_score', feedbackKey: 'color_mood_feedback' },
                { name: 'Subject & Focus', weight: 0.20, scoreKey: 'subject_focus_score', feedbackKey: 'subject_focus_feedback' },
                { name: 'Visual Impact', weight: 0.15, scoreKey: 'visual_impact_score', feedbackKey: 'visual_impact_feedback' },
                { name: 'Instagram Fit', weight: 0.10, scoreKey: 'instagram_fit_score', feedbackKey: 'instagram_fit_feedback' },
            ];

            const dimensions: DimensionScore[] = dimensionDefs.map(def => ({
                name: def.name,
                score: Math.min(10, Math.max(1, Math.round(parsed[def.scoreKey] ?? 5))),
                maxScore: 10,
                weight: def.weight,
                feedback: parsed[def.feedbackKey] || 'No specific feedback available.',
            }));

            const overallScore = Math.round(
                dimensions.reduce((sum, d) => sum + d.score * d.weight, 0) * 10
            ) / 10;

            console.log(`[Rank] Success! Overall score: ${overallScore}/10`);

            return {
                overallScore,
                dimensions,
                summary: parsed.summary || 'Analysis complete.',
                instagramTip: parsed.instagram_tip || 'Consider what makes your photo unique and lean into that.',
                rankedAt: new Date().toISOString(),
            };
        } catch (err: any) {
            lastError = err;
            console.error(`[Rank] Attempt ${attempt} failed:`, err.message);
            if (attempt < MAX_RETRIES) {
                console.log(`[Rank] Retrying in 1s...`);
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    }

    throw new Error(`Ranking failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
}

// --- Comparison Mode ---

export async function comparePhotos(
    imagePaths: { id: string; path: string }[]
): Promise<ComparisonResult> {
    if (imagePaths.length < 2 || imagePaths.length > 4) {
        throw new Error('Comparison requires 2-4 photos');
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const count = imagePaths.length;
            console.log(`[Compare] Attempt ${attempt}/${MAX_RETRIES} — comparing ${count} photos with Claude (${CLAUDE_MODEL})...`);

            // Build content array: all images first, then the text prompt
            const imageBlocks = await Promise.all(imagePaths.map(async (img) => {
                const { buffer, mediaType } = await resizeImageForLLM(img.path);
                const base64Image = buffer.toString('base64');
                return {
                    type: 'image' as const,
                    source: {
                        type: 'base64' as const,
                        media_type: mediaType,
                        data: base64Image,
                    },
                };
            }));

            // Build photo labels for the prompt
            const photoLabels = imagePaths.map((img, i) => `Photo ${i + 1} (ID: "${img.id}")`).join(', ');

            const promptTextBlock = {
                type: 'text' as const,
                text: `You're my best friend who's obsessed with Instagram and photography. I'm showing you ${count} photos and I need you to rank them head-to-head. Compare them directly against each other — which one is THE ONE to post?

The photos are: ${photoLabels}. They were provided in that order above.

Be brutally honest but in a fun, supportive way. Talk like we're sitting together scrolling through my camera roll deciding which to post. Be specific about what you see in EACH photo and why one beats the others.

Score each photo from 1-10, rank them from best (rank 1) to worst, and tell me specifically what each one does well and what lets it down compared to the others.

Respond ONLY with valid JSON in this exact format, no markdown or extra text:
{
  "photos": [
    {
      "photo_id": "<the exact ID string from above>",
      "rank": <int, 1=best>,
      "score": <int 1-10>,
      "strengths": "<what this photo does better than the others — be specific and casual>",
      "weaknesses": "<what holds this photo back compared to the others — be honest but kind>"
    }
  ],
  "overall_feedback": "<2-3 sentences comparing all the photos like you're talking to your friend — mention them relative to each other>",
  "winner_summary": "<1-2 sentences about why the winner is THE one to post — get hyped about it>"
}`,
            };

            const response = await anthropic.messages.create({
                model: CLAUDE_MODEL,
                max_tokens: 3000,
                messages: [
                    {
                        role: 'user',
                        content: [...imageBlocks, promptTextBlock],
                    },
                ],
            });

            const textBlock = response.content.find((block) => block.type === 'text');
            if (!textBlock || textBlock.type !== 'text') {
                throw new Error('No text response from Claude');
            }

            const content = textBlock.text.trim();
            const jsonStr = content.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
            const parsed = JSON.parse(jsonStr);

            const rankings: ComparisonPhotoResult[] = (parsed.photos || []).map((p: any) => ({
                photoId: p.photo_id,
                rank: Math.min(count, Math.max(1, Math.round(p.rank ?? count))),
                score: Math.min(10, Math.max(1, Math.round(p.score ?? 5))),
                strengths: p.strengths || 'No specific strengths noted.',
                weaknesses: p.weaknesses || 'No specific weaknesses noted.',
            }));

            // Sort by rank
            rankings.sort((a, b) => a.rank - b.rank);

            console.log(`[Compare] Success! Winner: ${rankings[0]?.photoId} with score ${rankings[0]?.score}/10`);

            return {
                rankings,
                overallFeedback: parsed.overall_feedback || 'Comparison complete.',
                winnerSummary: parsed.winner_summary || 'The top photo stood out from the rest.',
                rankedAt: new Date().toISOString(),
            };
        } catch (err: any) {
            lastError = err;
            console.error(`[Compare] Attempt ${attempt} failed:`, err.message);
            if (attempt < MAX_RETRIES) {
                console.log(`[Compare] Retrying in 1s...`);
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    }

    throw new Error(`Comparison failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
}
